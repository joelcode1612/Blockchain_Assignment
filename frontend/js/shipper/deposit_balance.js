// ─── Deposit & Balance Logic ──────────────────────────────
let currentAgreementId = null;
let allAgreements = [];
let agreementData = {};
let isInitialized = false;

function log(msg) {
  const el = document.getElementById('output');
  if (!el) return;
  el.innerHTML += `\n${new Date().toLocaleTimeString()}: ${msg}`;
  el.scrollTop = el.scrollHeight;
}

// ─── Load Agreements from Supabase ──────────────────────────
async function loadAgreements() {
  console.log('🔍 loadAgreements called');
  try {
    const address = window.userWalletAddress;
    if (!address) {
      console.warn('⚠️ No wallet address, cannot load agreements');
      return [];
    }
    const res = await fetch('/api/agreements', {
      headers: { 'x-wallet-address': address }
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }
    allAgreements = await res.json();
    console.log('✅ Loaded agreements:', allAgreements);

    const sel = document.getElementById('agreementSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Select —</option>';
    allAgreements.forEach(ag => {
      const opt = document.createElement('option');
      opt.value = ag.onchain_id;
      opt.textContent = `AGR-${String(ag.onchain_id).padStart(4, '0')} (${ag.status})`;
      sel.appendChild(opt);
    });
    if (allAgreements.length > 0) {
      sel.value = allAgreements[0].onchain_id;
      await loadAgreementData();
    } else {
      // No agreements – show message
      document.getElementById('allAgreementsTable').innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">No agreements found. Create one first.</div>';
      clearUI();
    }
    await refreshAllAgreements();
    return allAgreements;
  } catch (e) {
    console.error('❌ loadAgreements error:', e);
    log('❌ Failed to load agreements: ' + e.message);
    document.getElementById('allAgreementsTable').innerHTML = `<div style="color:var(--text-faint);padding:12px 0;">❌ ${e.message}</div>`;
    return [];
  }
}

// ─── Render All Agreements Table ──────────────────────────
async function refreshAllAgreements() {
  console.log('🔄 refreshAllAgreements called');
  const container = document.getElementById('allAgreementsTable');
  if (!container) return;
  if (!allAgreements || allAgreements.length === 0) {
    container.innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">No agreements found.</div>';
    return;
  }

  container.innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">Loading balances...</div>';

  let rows = [];
  for (const ag of allAgreements) {
    try {
      if (!window.contract) {
        rows.push(`
          <tr>
            <td>AGR-${String(ag.onchain_id).padStart(4, '0')}</td>
            <td>${ag.total_amount || '0'} ETH</td>
            <td>—</td>
            <td>—</td>
            <td><span class="pill gray">No contract</span></td>
          </tr>
        `);
        continue;
      }
      const balanceWei = await window.contract.getEscrowBalance(ag.onchain_id);
      const balanceEth = ethers.formatEther(balanceWei);
      const total = ag.total_amount || '0';
      const deposited = (parseFloat(total) - parseFloat(balanceEth)).toFixed(4);
      const status = ag.status || 'pending';
      const statusClass = status === 'active' ? 'lime' : status === 'completed' ? 'lime' : status === 'refunded' ? 'red' : 'gray';
      rows.push(`
        <tr>
          <td>AGR-${String(ag.onchain_id).padStart(4, '0')}</td>
          <td>${total} ETH</td>
          <td>${deposited} ETH</td>
          <td>${balanceEth} ETH</td>
          <td><span class="pill ${statusClass}"><span class="dot"></span>${status.toUpperCase()}</span></td>
        </tr>
      `);
    } catch (e) {
      console.warn(`Failed to fetch balance for AGR-${ag.onchain_id}:`, e.message);
      rows.push(`
        <tr>
          <td>AGR-${String(ag.onchain_id).padStart(4, '0')}</td>
          <td>${ag.total_amount || '0'} ETH</td>
          <td>—</td>
          <td>—</td>
          <td><span class="pill gray">Error</span></td>
        </tr>
      `);
    }
  }

  container.innerHTML = `
    <table>
      <thead><tr><th>Agreement</th><th>Required</th><th>Deposited</th><th>Remaining</th><th>Status</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `;
  console.log('✅ refreshAllAgreements complete');
}

// ─── Load Agreement Data (selected) ──────────────────────────
async function loadAgreementData() {
  console.log('🔍 loadAgreementData called');
  const sel = document.getElementById('agreementSelect');
  if (!sel) return;
  const id = parseInt(sel.value);
  currentAgreementId = isNaN(id) ? null : id;

  if (currentAgreementId === null) {
    clearUI();
    return;
  }

  if (!window.contract) {
    console.warn('⚠️ window.contract not available');
    showToast('⚠️ Connect wallet first.', 'error');
    return;
  }

  try {
    console.log(`📖 Fetching agreement details for ID ${currentAgreementId}`);
    const details = await window.contract.getAgreementDetails(currentAgreementId);
    const totalAmount = ethers.formatEther(details[2]);
    const remainingAmount = ethers.formatEther(details[3]);
    const funded = details[4];
    const completed = details[5];
    const status = Number(details[7]);

    agreementData = { totalAmount, remainingAmount, funded, completed, status };

    const balanceWei = await window.contract.getEscrowBalance(currentAgreementId);
    const balanceEth = ethers.formatEther(balanceWei);

    updateUI(totalAmount, balanceEth, funded, completed, status);
    log(`✅ Loaded agreement ${currentAgreementId}: ${totalAmount} ETH total, ${balanceEth} ETH remaining`);

    const depositBtn = document.getElementById('depositBtn');
    if (!funded) {
      depositBtn.disabled = false;
      document.getElementById('depositDesc').textContent = `Deposit ETH into escrow for AGR-${String(currentAgreementId).padStart(4, '0')}. Required: ${totalAmount} ETH.`;
    } else {
      depositBtn.disabled = true;
      document.getElementById('depositDesc').textContent = `Agreement AGR-${String(currentAgreementId).padStart(4, '0')} is already funded.`;
    }

    // Update wallet balance
    if (window.userWalletAddress) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const balance = await signer.provider.getBalance(signer.address);
        document.getElementById('walletBalance').textContent = ethers.formatEther(balance).slice(0, 10) + ' ETH';
      } catch (e) { /* ignore */ }
    }

    await refreshAllAgreements();
  } catch (e) {
    console.error('❌ loadAgreementData error:', e);
    log('❌ Error loading agreement: ' + e.message);
    showToast('❌ Error loading agreement: ' + e.message, 'error');
    clearUI();
  }
}

function updateUI(total, remaining, funded, completed, status) {
  document.getElementById('totalEscrow').textContent = total + ' ETH';
  document.getElementById('remainingBalance').textContent = remaining + ' ETH';
  document.getElementById('fundedStatus').innerHTML = funded ? '✅ Yes' : '❌ No';
  const statusText = funded ? (completed ? '✅ Completed' : '🟢 Active') : '⏳ Pending';
  document.getElementById('agreementStatus').textContent = statusText;

  const deposited = parseFloat(total) - parseFloat(remaining);
  const percent = parseFloat(total) > 0 ? Math.round((deposited / parseFloat(total)) * 100) : 0;
  document.getElementById('depositProgressFill').style.width = percent + '%';
  document.getElementById('depositProgressLabel').textContent = `${deposited.toFixed(4)} / ${total} ETH deposited`;
  document.getElementById('depositPercent').textContent = percent + '%';

  document.getElementById('kvRequired').textContent = total + ' ETH';
  document.getElementById('kvDeposited').textContent = deposited.toFixed(4) + ' ETH';
  document.getElementById('kvRemaining').textContent = (parseFloat(total) - deposited).toFixed(4) + ' ETH';
  const statusPill = funded ? 'lime' : 'amber';
  const statusLabel = funded ? '✅ Funded' : '⏳ Awaiting Funding';
  document.getElementById('contractStatus').innerHTML = `<span class="pill ${statusPill}"><span class="dot"></span>${statusLabel}</span>`;
  document.getElementById('balanceDesc').textContent = `Live balance for AGR-${String(currentAgreementId).padStart(4, '0')}.`;
}

function clearUI() {
  document.getElementById('totalEscrow').textContent = '—';
  document.getElementById('remainingBalance').textContent = '—';
  document.getElementById('fundedStatus').textContent = '—';
  document.getElementById('agreementStatus').textContent = '—';
  document.getElementById('kvRequired').textContent = '—';
  document.getElementById('kvDeposited').textContent = '—';
  document.getElementById('kvRemaining').textContent = '—';
  document.getElementById('contractStatus').textContent = '—';
  document.getElementById('depositProgressFill').style.width = '0%';
  document.getElementById('depositProgressLabel').textContent = '0 / 0 ETH deposited';
  document.getElementById('depositPercent').textContent = '0%';
  document.getElementById('depositDesc').textContent = 'Select an agreement to deposit.';
  document.getElementById('balanceDesc').textContent = 'Select an agreement to view balance.';
  document.getElementById('depositBtn').disabled = true;
}

function updateDepositPreview() {
  const amt = parseFloat(document.getElementById('depositAmt').value) || 0;
  const remaining = parseFloat(agreementData.remainingAmount) || 0;
  const hint = document.getElementById('depositHint');
  if (amt > 0) {
    if (amt > remaining) {
      hint.textContent = `⚠️ Amount exceeds remaining requirement (${remaining.toFixed(4)} ETH needed).`;
      hint.style.color = 'var(--red)';
    } else {
      hint.textContent = `You will deposit ${amt.toFixed(4)} ETH. Remaining required: ${(remaining - amt).toFixed(4)} ETH.`;
      hint.style.color = 'var(--text-faint)';
    }
  } else {
    hint.textContent = 'Enter amount to deposit.';
    hint.style.color = 'var(--text-faint)';
  }
}

window.doDeposit = async function () {
  const amtInput = document.getElementById('depositAmt');
  const amount = parseFloat(amtInput.value);
  if (isNaN(amount) || amount <= 0) {
    showToast('Enter a valid amount.', 'error');
    return;
  }
  if (!window.contract) {
    showToast('Connect wallet first.', 'error');
    return;
  }
  if (currentAgreementId === null) {
    showToast('Select an agreement.', 'error');
    return;
  }
  if (agreementData.funded) {
    showToast('Agreement already funded.', 'error');
    return;
  }
  const remaining = parseFloat(agreementData.remainingAmount);
  if (amount > remaining) {
    showToast(`Amount exceeds remaining requirement (${remaining.toFixed(4)} ETH).`, 'error');
    return;
  }
  const amountWei = ethers.parseEther(amount.toString());
  log(`⏳ Depositing ${amount} ETH to agreement ${currentAgreementId}...`);
  try {
    const tx = await window.contract.depositEscrow(currentAgreementId, {
      value: amountWei,
      from: window.userWalletAddress
    });
    log(`📨 Tx sent: ${tx.hash}`);
    await tx.wait();
    log(`✅ Deposit successful!`);
    showToast(`✅ ${amount} ETH deposited successfully!`, 'success');
    await API.postDepositEscrow(currentAgreementId, amountWei.toString(), tx.hash);
    await loadAgreementData();
    await refreshAllAgreements();
  } catch (e) {
    log('❌ Deposit failed: ' + e.message);
    showToast('❌ Deposit failed: ' + e.message, 'error');
  }
};

// ─── Initialization ─────────────────────────────────────────
async function init() {
  console.log('🚀 init() called');
  if (isInitialized) return;
  const address = window.userWalletAddress;
  if (address) {
    console.log('✅ Wallet already connected:', address);
    await loadAgreements();
    await loadAgreementData();
  } else {
    console.log('⏳ No wallet connected yet. Waiting for event.');
    // Listen for wallet connection
    window.addEventListener('walletConnected', async function onConnect(e) {
      console.log('📢 walletConnected event received:', e.detail);
      window.removeEventListener('walletConnected', onConnect);
      await loadAgreements();
      await loadAgreementData();
    });
    // Also set a fallback timeout: if after 5 seconds still no connection, show a prompt
    setTimeout(() => {
      if (!window.userWalletAddress) {
        log('👛 Still not connected. Click Connect Wallet button.');
        document.getElementById('walletBalance').textContent = '—';
      }
    }, 3000);
  }
  isInitialized = true;
}

// ─── Auto-init on DOM ready ────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOMContentLoaded fired');
  // Ensure the global functions are exposed
  window.loadAgreementData = loadAgreementData;
  window.loadAgreements = loadAgreements;
  window.updateDepositPreview = updateDepositPreview;
  // Start init
  init();
});