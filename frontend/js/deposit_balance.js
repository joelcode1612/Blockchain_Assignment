/**
 * deposit_balance.js – Dynamic Deposit & Balance page
 */

let currentAgreementId = null;

// ─── Log helper ──────────────────────────────────────────────
function log(msg) {
  const el = document.getElementById('output');
  el.innerHTML += `\n${new Date().toLocaleTimeString()}: ${msg}`;
  el.scrollTop = el.scrollHeight;
}

// ─── Wallet UI ───────────────────────────────────────────────
function updateWalletUI() {
  const status = document.getElementById('wallet-status');
  if (window.userWalletAddress) {
    status.textContent = '✅ ' + window.userWalletAddress.slice(0,6)+'…'+window.userWalletAddress.slice(-4);
  } else {
    status.textContent = 'Not connected';
  }
}

// ─── Load agreements into dropdown ─────────────────────────
async function loadAgreements() {
  try {
    const res = await fetch('/api/agreements', {
      headers: { 'x-wallet-address': window.userWalletAddress || '' }
    });
    if (!res.ok) throw new Error('Failed to fetch agreements');
    const data = await res.json();
    const sel = document.getElementById('agreementSelect');
    sel.innerHTML = '<option value="">— Select —</option>';
    data.forEach(ag => {
      const opt = document.createElement('option');
      opt.value = ag.onchain_id;
      opt.textContent = `AGR-${String(ag.onchain_id).padStart(4,'0')} (${ag.status})`;
      sel.appendChild(opt);
    });
    if (data.length > 0) sel.value = data[0].onchain_id;
    return data;
  } catch (e) {
    log('❌ Failed to load agreements: '+e.message);
    return [];
  }
}

// ─── Load selected agreement ────────────────────────────────
async function loadAgreement() {
  const sel = document.getElementById('agreementSelect');
  const id = parseInt(sel.value);
  if (isNaN(id)) { currentAgreementId = null; clearUI(); return; }
  currentAgreementId = id;
  await refresh();
}

// ─── Refresh data for current agreement ─────────────────────
async function refresh() {
  if (currentAgreementId === null) return;
  try {
    const data = await API.getEscrowBalance(currentAgreementId);
    const contract = window.contract;
    if (!contract) throw new Error('Contract not initialized');
    const details = await contract.getAgreementDetails(currentAgreementId);
    const total = ethers.formatEther(details[2]);
    const remaining = ethers.formatEther(details[3]);

    document.getElementById('totalEscrow').textContent = total + ' ETH';
    document.getElementById('remainingBalance').textContent = remaining + ' ETH';
    document.getElementById('fundedStatus').textContent = data.funded ? '✅ Yes' : '❌ No';
    document.getElementById('agreementStatus').textContent = data.funded ? 'ACTIVE' : 'PENDING';

    const pct = data.funded ? 100 : 0;
    document.getElementById('progressFill').style.width = pct+'%';
    document.getElementById('progressLabel').textContent = `${data.funded ? total : '0'} / ${total} ETH`;
    document.getElementById('progressPercent').textContent = pct+'%';

    document.getElementById('depositInfo').innerHTML = `
      Required: <strong>${total} ETH</strong> | 
      Deposited: <strong>${remaining} ETH</strong> |
      Status: ${data.funded ? '✅ Funded' : '⏳ Awaiting funding'}
    `;
    log(`✅ Loaded agreement ${currentAgreementId}`);
  } catch (e) {
    log('❌ Error: '+e.message);
  }
}

function clearUI() {
  ['totalEscrow','remainingBalance','fundedStatus','agreementStatus'].forEach(id => {
    document.getElementById(id).textContent = '—';
  });
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('progressLabel').textContent = '0 / 0 ETH';
  document.getElementById('progressPercent').textContent = '0%';
  document.getElementById('depositInfo').textContent = 'Select an agreement.';
}

// ─── Deposit action ──────────────────────────────────────────
async function handleDeposit() {
  const amount = document.getElementById('depositAmount').value.trim();
  if (!amount || parseFloat(amount) <= 0) { log('❌ Enter a valid amount'); return; }
  if (!window.contract) { log('❌ Contract not initialized'); return; }
  if (currentAgreementId === null) { log('❌ No agreement selected'); return; }
  const amountWei = ethers.parseEther(amount);
  log(`⏳ Depositing ${amount} ETH to agreement ${currentAgreementId}...`);
  try {
    const tx = await window.contract.depositEscrow(currentAgreementId, {
      value: amountWei,
      from: window.userWalletAddress
    });
    log(`📨 Tx sent: ${tx.hash}`);
    await tx.wait();
    log(`✅ Deposit successful!`);
    await API.postDepositEscrow(currentAgreementId, amountWei.toString(), tx.hash);
    await refresh();
  } catch (e) {
    log(`❌ Deposit failed: ${e.message}`);
  }
}

// ─── Event listeners ─────────────────────────────────────────
window.addEventListener('walletConnected', () => {
  updateWalletUI();
  loadAgreements().then(() => loadAgreement());
});

document.addEventListener('DOMContentLoaded', () => {
  updateWalletUI();
  if (window.userWalletAddress) {
    loadAgreements().then(() => loadAgreement());
  } else {
    log('👛 Connect wallet to start.');
  }
});

// Expose functions for inline onclick
window.loadAgreement = loadAgreement;
window.refresh = refresh;
window.handleDeposit = handleDeposit;