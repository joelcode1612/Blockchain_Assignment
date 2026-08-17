// let currentAgreementId = null;
// let allAgreements = [];
// let agreementData = {};

// function log(msg) {
//   const el = document.getElementById('output');
//   if (!el) return;
//   el.innerHTML += `\n${new Date().toLocaleTimeString()}: ${msg}`;
//   el.scrollTop = el.scrollHeight;
// }

// // ─── Load Agreements from API ──────────────────────────────
// async function loadAgreements() {
//   console.log('🔍 loadAgreements called');
//   try {
//     const address = window.userWalletAddress;
//     console.log('📌 Raw wallet address:', address);
//     if (!address) {
//       console.warn('⚠️ No wallet address, cannot load agreements');
//       return [];
//     }
//     const normalizedAddress = address.toLowerCase();
//     console.log('🔽 Lowercased address:', normalizedAddress);

//     const res = await fetch('/api/agreements', {
//       headers: { 'x-wallet-address': normalizedAddress }
//     });
//     console.log('📡 Response status:', res.status);

//     if (!res.ok) {
//       const errText = await res.text();
//       throw new Error(`HTTP ${res.status}: ${errText}`);
//     }
//     allAgreements = await res.json();
//     console.log('✅ Loaded agreements:', allAgreements);

//     // Populate dropdown
//     const sel = document.getElementById('agreementSelect');
//     if (!sel) {
//       console.warn('⚠️ #agreementSelect not found in DOM');
//       return;
//     }
//     sel.innerHTML = '<option value="">— Select —</option>';
//     allAgreements.forEach(ag => {
//       const opt = document.createElement('option');
//       opt.value = ag.onchain_id;
//       const status = ag.status || 'Pending';
//       opt.textContent = `AGR-${String(ag.onchain_id).padStart(4, '0')} (${status})`;
//       sel.appendChild(opt);
//     });

//     if (allAgreements.length > 0) {
//       sel.value = allAgreements[0].onchain_id;
//       await loadAgreementData();
//     } else {
//       const table = document.getElementById('allAgreementsTable');
//       if (table) table.innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">No agreements found. Create one first.</div>';
//       clearUI();
//     }
//     await refreshAllAgreements();
//     return allAgreements;
//   } catch (e) {
//     console.error('❌ loadAgreements error:', e);
//     log('❌ Failed to load agreements: ' + e.message);
//     const table = document.getElementById('allAgreementsTable');
//     if (table) table.innerHTML = `<div style="color:var(--text-faint);padding:12px 0;">❌ ${e.message}</div>`;
//     return [];
//   }
// }

// // ─── Render All Agreements Table ──────────────────────────
// async function refreshAllAgreements() {
//   console.log('🔄 refreshAllAgreements called');
//   const container = document.getElementById('allAgreementsTable');
//   if (!container) {
//     console.warn('⚠️ #allAgreementsTable not found');
//     return;
//   }
//   if (!allAgreements || allAgreements.length === 0) {
//     container.innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">No agreements found.</div>';
//     return;
//   }

//   let rows = [];
//   for (const ag of allAgreements) {
//     const totalEth = ag.total_amount ? ethers.formatEther(ag.total_amount.toString()) : '0';
//     const status = ag.status || 'Pending';
//     let statusClass = 'gray';
//     if (status === 'Active' || status === 'Funded') statusClass = 'lime';
//     else if (status === 'Completed') statusClass = 'lime';
//     else if (status === 'Refunded') statusClass = 'red';
//     else if (status === 'Pending' || status === 'PendingAcceptance') statusClass = 'amber';

//     let balanceEth = '—';
//     let depositedEth = '—';
//     if (window.contract) {
//       try {
//         const balWei = await window.contract.getEscrowBalance(ag.onchain_id);
//         balanceEth = ethers.formatEther(balWei);
//         const total = parseFloat(totalEth);
//         const bal = parseFloat(balanceEth);
//         depositedEth = (total - bal).toFixed(4);
//       } catch (e) {
//         console.warn(`Could not fetch on‑chain balance for AGR-${ag.onchain_id}:`, e.message);
//       }
//     }

//     rows.push(`
//       <tr>
//         <td>AGR-${String(ag.onchain_id).padStart(4, '0')}</td>
//         <td>${totalEth} ETH</td>
//         <td>${depositedEth} ETH</td>
//         <td>${balanceEth} ETH</td>
//         <td><span class="pill ${statusClass}"><span class="dot"></span>${status.toUpperCase()}</span></td>
//       </tr>
//     `);
//   }

//   container.innerHTML = `
//     <table>
//       <thead><tr><th>Agreement</th><th>Required</th><th>Deposited</th><th>Remaining</th><th>Status</th></tr></thead>
//       <tbody>${rows.join('')}</tbody>
//     </table>
//   `;
//   console.log('✅ refreshAllAgreements complete');
// }

// // ─── Load Selected Agreement Data ──────────────────────────
// async function loadAgreementData() {
//   console.log('🔍 loadAgreementData called');
//   const sel = document.getElementById('agreementSelect');
//   if (!sel) {
//     console.warn('⚠️ #agreementSelect not found');
//     return;
//   }
//   const id = parseInt(sel.value);
//   currentAgreementId = isNaN(id) ? null : id;

//   if (currentAgreementId === null) {
//     clearUI();
//     return;
//   }

//   const agreement = allAgreements.find(a => a.onchain_id === currentAgreementId);
//   if (!agreement) {
//     log(`❌ Agreement ${currentAgreementId} not found in API data`);
//     clearUI();
//     return;
//   }

//   const totalEth = agreement.total_amount ? ethers.formatEther(agreement.total_amount.toString()) : '0';
//   const status = agreement.status || 'Pending';
//   const funded = (status === 'Active' || status === 'Funded' || status === 'Completed');
//   const completed = (status === 'Completed');

//   let balanceEth = '0';
//   let remainingEth = '0';
//   if (window.contract) {
//     try {
//       const balWei = await window.contract.getEscrowBalance(currentAgreementId);
//       balanceEth = ethers.formatEther(balWei);
//       remainingEth = balanceEth;
//     } catch (e) {
//       console.warn('Could not fetch on‑chain balance:', e.message);
//       if (!funded) remainingEth = totalEth;
//       else remainingEth = '0';
//     }
//   } else {
//     remainingEth = funded ? '0' : totalEth;
//     balanceEth = remainingEth;
//   }

//   agreementData = { totalAmount: totalEth, remainingAmount: remainingEth, funded, completed, status };

//   updateUI(totalEth, remainingEth, funded, completed, status);
//   log(`✅ Loaded agreement ${currentAgreementId}: ${totalEth} ETH total, ${remainingEth} ETH remaining`);

//   const depositBtn = document.getElementById('depositBtn');
//   if (!funded) {
//     depositBtn.disabled = false;
//     document.getElementById('depositDesc').textContent =
//       `Deposit ETH into escrow for AGR-${String(currentAgreementId).padStart(4, '0')}. Required: ${totalEth} ETH.`;
//   } else {
//     depositBtn.disabled = true;
//     document.getElementById('depositDesc').textContent =
//       `Agreement AGR-${String(currentAgreementId).padStart(4, '0')} is already funded.`;
//   }

//   if (window.userWalletAddress && window.ethereum) {
//     try {
//       const provider = new ethers.BrowserProvider(window.ethereum);
//       const signer = await provider.getSigner();
//       const balance = await signer.provider.getBalance(signer.address);
//       document.getElementById('walletBalance').textContent = ethers.formatEther(balance).slice(0, 10) + ' ETH';
//     } catch (e) { /* ignore */ }
//   }

//   await refreshAllAgreements();
// }

// function updateUI(total, remaining, funded, completed, status) {
//   const el = id => document.getElementById(id);
//   el('totalEscrow').textContent = total + ' ETH';
//   el('remainingBalance').textContent = remaining + ' ETH';
//   el('fundedStatus').innerHTML = funded ? '✅ Yes' : '❌ No';
//   const statusText = funded ? (completed ? '✅ Completed' : '🟢 Active') : '⏳ Pending';
//   el('agreementStatus').textContent = statusText;

//   const deposited = parseFloat(total) - parseFloat(remaining);
//   const percent = parseFloat(total) > 0 ? Math.round((deposited / parseFloat(total)) * 100) : 0;
//   el('depositProgressFill').style.width = percent + '%';
//   el('depositProgressLabel').textContent = `${deposited.toFixed(4)} / ${total} ETH deposited`;
//   el('depositPercent').textContent = percent + '%';

//   el('kvRequired').textContent = total + ' ETH';
//   el('kvDeposited').textContent = deposited.toFixed(4) + ' ETH';
//   el('kvRemaining').textContent = (parseFloat(total) - deposited).toFixed(4) + ' ETH';
//   const statusPill = funded ? 'lime' : 'amber';
//   const statusLabel = funded ? '✅ Funded' : '⏳ Awaiting Funding';
//   el('contractStatus').innerHTML = `<span class="pill ${statusPill}"><span class="dot"></span>${statusLabel}</span>`;
//   el('balanceDesc').textContent = `Live balance for AGR-${String(currentAgreementId).padStart(4, '0')}.`;
// }

// function clearUI() {
//   const el = id => document.getElementById(id);
//   el('totalEscrow').textContent = '—';
//   el('remainingBalance').textContent = '—';
//   el('fundedStatus').textContent = '—';
//   el('agreementStatus').textContent = '—';
//   el('kvRequired').textContent = '—';
//   el('kvDeposited').textContent = '—';
//   el('kvRemaining').textContent = '—';
//   el('contractStatus').textContent = '—';
//   el('depositProgressFill').style.width = '0%';
//   el('depositProgressLabel').textContent = '0 / 0 ETH deposited';
//   el('depositPercent').textContent = '0%';
//   el('depositDesc').textContent = 'Select an agreement to deposit.';
//   el('balanceDesc').textContent = 'Select an agreement to view balance.';
//   el('depositBtn').disabled = true;
// }

// function updateDepositPreview() {
//   const amt = parseFloat(document.getElementById('depositAmt').value) || 0;
//   const remaining = parseFloat(agreementData.remainingAmount) || 0;
//   const hint = document.getElementById('depositHint');
//   if (amt > 0) {
//     if (amt > remaining) {
//       hint.textContent = `⚠️ Amount exceeds remaining requirement (${remaining.toFixed(4)} ETH needed).`;
//       hint.style.color = 'var(--red)';
//     } else {
//       hint.textContent = `You will deposit ${amt.toFixed(4)} ETH. Remaining required: ${(remaining - amt).toFixed(4)} ETH.`;
//       hint.style.color = 'var(--text-faint)';
//     }
//   } else {
//     hint.textContent = 'Enter amount to deposit.';
//     hint.style.color = 'var(--text-faint)';
//   }
// }

// window.doDeposit = async function () {
//   const amtInput = document.getElementById('depositAmt');
//   const amount = parseFloat(amtInput.value);
//   if (isNaN(amount) || amount <= 0) {
//     showToast('Enter a valid amount.', 'error');
//     return;
//   }
//   if (!window.contract) {
//     showToast('Connect wallet first.', 'error');
//     return;
//   }
//   if (currentAgreementId === null) {
//     showToast('Select an agreement.', 'error');
//     return;
//   }
//   if (agreementData.funded) {
//     showToast('Agreement already funded.', 'error');
//     return;
//   }
//   const remaining = parseFloat(agreementData.remainingAmount);
//   if (amount > remaining) {
//     showToast(`Amount exceeds remaining requirement (${remaining.toFixed(4)} ETH).`, 'error');
//     return;
//   }
//   const amountWei = ethers.parseEther(amount.toString());
//   log(`⏳ Depositing ${amount} ETH to agreement ${currentAgreementId}...`);
//   try {
//     const tx = await window.contract.depositEscrow(currentAgreementId, {
//       value: amountWei,
//       from: window.userWalletAddress
//     });
//     log(`📨 Tx sent: ${tx.hash}`);
//     await tx.wait();
//     log(`✅ Deposit successful!`);
//     showToast(`✅ ${amount} ETH deposited successfully!`, 'success');

//     // Update backend via API (make sure API.postDepositEscrow exists)
//     if (typeof API !== 'undefined' && API.postDepositEscrow) {
//       await API.postDepositEscrow(currentAgreementId, amountWei.toString(), tx.hash);
//     } else {
//       console.warn('API.postDepositEscrow not available, skipping DB update.');
//     }

//     // Reload data
//     await loadAgreementData();
//     await refreshAllAgreements();
//   } catch (e) {
//     log('❌ Deposit failed: ' + e.message);
//     showToast('❌ Deposit failed: ' + e.message, 'error');
//   }
// };

// async function init() {
//   console.log('🚀 init() called (hardcoded mode)');
//   const hardcodedAddress = '0x3b2c00fb015555fe8e6c389aa071bcbb18463dad';
//   window.userWalletAddress = hardcodedAddress;   // ✅ this should set it
//   console.log('🔎 Using hardcoded address:', hardcodedAddress);
//   await loadAgreements();
//   await loadAgreementData();
// }
// // ─── Initialization ─────────────────────────────────────────
// // async function init() {
// //   console.log('🚀 init() called');
// //   console.log('🔎 window.userWalletAddress =', window.userWalletAddress);
// //   console.log('🔎 document.readyState =', document.readyState);

// //   const address = window.userWalletAddress;
// //   if (address) {
// //     console.log('✅ Wallet already connected:', address);
// //     await loadAgreements();
// //     await loadAgreementData();
// //   } else {
// //     console.log('⏳ No wallet connected yet. Waiting for event.');
// //     window.addEventListener('walletConnected', async function onConnect(e) {
// //       console.log('📢 walletConnected event received', e.detail);
// //       window.removeEventListener('walletConnected', onConnect);
// //       await loadAgreements();
// //       await loadAgreementData();
// //     });
// //     // Fallback: check again after 2 seconds
// //     setTimeout(async () => {
// //       if (window.userWalletAddress) {
// //         console.log('🔄 Fallback: wallet detected after timeout');
// //         await loadAgreements();
// //         await loadAgreementData();
// //       } else {
// //         log('👛 Still not connected. Click Connect Wallet button.');
// //         document.getElementById('walletBalance').textContent = '—';
// //       }
// //     }, 2000);
// //   }
// // }

// // ─── Expose global functions ──────────────────────────────
// window.loadAgreementData = loadAgreementData;
// window.loadAgreements = loadAgreements;
// window.updateDepositPreview = updateDepositPreview;
// window.debugInit = init;   // 👈 Manual trigger from console

// // ─── Auto-init ──────────────────────────────────────────────
// document.addEventListener('DOMContentLoaded', function() {
//   console.log('📄 DOMContentLoaded fired');
//   init();
// });

// console.log('✅ deposit_balance.js ready – call window.debugInit() from console to retry.');



// ─── Deposit & Balance – Hardcoded (SPA‑ready) ──────────
console.log('🚀 deposit_balance.js loaded');

let currentAgreementId = null;
let allAgreements = [];
let agreementData = {};

function log(msg) {
  const el = document.getElementById('output');
  if (el) el.innerHTML += `\n${new Date().toLocaleTimeString()}: ${msg}`;
}

// ─── Helper: get URL parameter ──────────────────────────────
function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// ─── Load Agreements from API ──────────────────────────────
async function loadAgreements() {
  console.log('🔍 loadAgreements() called');
  const hardcodedAddress = '0x3b2c00fb015555fe8e6c389aa071bcbb18463dad';
  const normalizedAddress = hardcodedAddress.toLowerCase();
  console.log('📌 Using address:', normalizedAddress);

  try {
    const res = await fetch('/api/agreements', {
      headers: { 'x-wallet-address': normalizedAddress }
    });
    console.log('📡 Response status:', res.status);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    allAgreements = await res.json();
    console.log('✅ Agreements loaded:', allAgreements);

    const sel = document.getElementById('agreementSelect');
    if (!sel) { console.warn('⚠️ #agreementSelect missing'); return; }
    sel.innerHTML = '<option value="">— Select —</option>';
    allAgreements.forEach(ag => {
      const opt = document.createElement('option');
      opt.value = ag.onchain_id;
      const status = ag.status || 'Pending';
      opt.textContent = `AGR-${String(ag.onchain_id).padStart(4, '0')} (${status})`;
      sel.appendChild(opt);
    });

    // ─── Check URL for agreement ID ──────────────────────────
    const requestedId = getUrlParam('id') || getUrlParam('agreementId');
    let selectedId = null;
    if (requestedId) {
      const numericId = parseInt(requestedId);
      if (!isNaN(numericId) && allAgreements.some(a => a.onchain_id === numericId)) {
        selectedId = numericId;
        console.log(`📌 Found requested agreement ID ${selectedId} in the list.`);
      } else {
        console.warn(`⚠️ Requested ID ${requestedId} not found in agreements.`);
      }
    }

    // If we have a valid selectedId, set it; otherwise fallback to first.
    if (selectedId !== null) {
      sel.value = selectedId;
    } else if (allAgreements.length > 0) {
      sel.value = allAgreements[0].onchain_id;
    }

    if (allAgreements.length > 0) {
      await loadAgreementData();
    } else {
      const table = document.getElementById('allAgreementsTable');
      if (table) table.innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">No agreements found.</div>';
      clearUI();
    }
    await refreshAllAgreements();
  } catch (e) {
    console.error('❌ loadAgreements error:', e);
    const table = document.getElementById('allAgreementsTable');
    if (table) table.innerHTML = `❌ ${e.message}`;
  }
}

// ─── Refresh All Agreements Table ──────────────────────────
async function refreshAllAgreements() {
  const container = document.getElementById('allAgreementsTable');
  if (!container) return;
  if (!allAgreements || allAgreements.length === 0) {
    container.innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">No agreements found.</div>';
    return;
  }
  let rows = [];
  for (const ag of allAgreements) {
    const totalEth = ag.total_amount ? ethers.formatEther(ag.total_amount.toString()) : '0';
    const status = ag.status || 'Pending';
    let statusClass = 'gray';
    if (status === 'Active' || status === 'Funded') statusClass = 'lime';
    else if (status === 'Completed') statusClass = 'lime';
    else if (status === 'Refunded') statusClass = 'red';
    else if (status === 'Pending' || status === 'PendingAcceptance') statusClass = 'amber';

    let balanceEth = '—';
    let depositedEth = '—';
    if (window.contract) {
      try {
        const balWei = await window.contract.getEscrowBalance(ag.onchain_id);
        balanceEth = ethers.formatEther(balWei);
        const total = parseFloat(totalEth);
        const bal = parseFloat(balanceEth);
        depositedEth = (total - bal).toFixed(4);
      } catch (e) {
        console.warn(`Could not fetch on‑chain balance for AGR-${ag.onchain_id}:`, e.message);
      }
    }
    rows.push(`
      <tr>
        <td>AGR-${String(ag.onchain_id).padStart(4, '0')}</td>
        <td>${totalEth} ETH</td>
        <td>${depositedEth} ETH</td>
        <td>${balanceEth} ETH</td>
        <td><span class="pill ${statusClass}"><span class="dot"></span>${status.toUpperCase()}</span></td>
      </tr>
    `);
  }
  container.innerHTML = `
    <table>
      <thead><tr><th>Agreement</th><th>Required</th><th>Deposited</th><th>Remaining</th><th>Status</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `;
}

// ─── Load Selected Agreement Data ──────────────────────────
async function loadAgreementData() {
  console.log('🔍 loadAgreementData called');
  const sel = document.getElementById('agreementSelect');
  if (!sel) return;
  const id = parseInt(sel.value);
  currentAgreementId = isNaN(id) ? null : id;
  if (currentAgreementId === null) { clearUI(); return; }
  const agreement = allAgreements.find(a => a.onchain_id === currentAgreementId);
  if (!agreement) { log(`❌ Agreement ${currentAgreementId} not found`); clearUI(); return; }

  const totalEth = agreement.total_amount ? ethers.formatEther(agreement.total_amount.toString()) : '0';
  const status = agreement.status || 'Pending';
  const funded = (status === 'Active' || status === 'Funded' || status === 'Completed');
  const completed = (status === 'Completed');

  let balanceEth = '0';
  let remainingEth = '0';
  if (window.contract) {
    try {
      const balWei = await window.contract.getEscrowBalance(currentAgreementId);
      balanceEth = ethers.formatEther(balWei);
      remainingEth = balanceEth;
    } catch (e) {
      console.warn('Could not fetch on‑chain balance:', e.message);
      if (!funded) remainingEth = totalEth;
      else remainingEth = '0';
    }
  } else {
    remainingEth = funded ? '0' : totalEth;
    balanceEth = remainingEth;
  }
  agreementData = { totalAmount: totalEth, remainingAmount: remainingEth, funded, completed, status };

  updateUI(totalEth, remainingEth, funded, completed, status);
  log(`✅ Loaded agreement ${currentAgreementId}: ${totalEth} ETH total, ${remainingEth} ETH remaining`);

  const depositBtn = document.getElementById('depositBtn');
  if (!funded) {
    depositBtn.disabled = false;
    document.getElementById('depositDesc').textContent =
      `Deposit ETH into escrow for AGR-${String(currentAgreementId).padStart(4, '0')}. Required: ${totalEth} ETH.`;
  } else {
    depositBtn.disabled = true;
    document.getElementById('depositDesc').textContent =
      `Agreement AGR-${String(currentAgreementId).padStart(4, '0')} is already funded.`;
  }

  if (window.userWalletAddress && window.ethereum) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const balance = await signer.provider.getBalance(signer.address);
      document.getElementById('walletBalance').textContent = ethers.formatEther(balance).slice(0, 10) + ' ETH';
    } catch (e) { /* ignore */ }
  }
  await refreshAllAgreements();
}

function updateUI(total, remaining, funded, completed, status) {
  const el = id => document.getElementById(id);
  el('totalEscrow').textContent = total + ' ETH';
  el('remainingBalance').textContent = remaining + ' ETH';
  el('fundedStatus').innerHTML = funded ? '✅ Yes' : '❌ No';
  const statusText = funded ? (completed ? '✅ Completed' : '🟢 Active') : '⏳ Pending';
  el('agreementStatus').textContent = statusText;

  const deposited = parseFloat(total) - parseFloat(remaining);
  const percent = parseFloat(total) > 0 ? Math.round((deposited / parseFloat(total)) * 100) : 0;
  el('depositProgressFill').style.width = percent + '%';
  el('depositProgressLabel').textContent = `${deposited.toFixed(4)} / ${total} ETH deposited`;
  el('depositPercent').textContent = percent + '%';

  el('kvRequired').textContent = total + ' ETH';
  el('kvDeposited').textContent = deposited.toFixed(4) + ' ETH';
  el('kvRemaining').textContent = (parseFloat(total) - deposited).toFixed(4) + ' ETH';
  const statusPill = funded ? 'lime' : 'amber';
  const statusLabel = funded ? '✅ Funded' : '⏳ Awaiting Funding';
  el('contractStatus').innerHTML = `<span class="pill ${statusPill}"><span class="dot"></span>${statusLabel}</span>`;
  el('balanceDesc').textContent = `Live balance for AGR-${String(currentAgreementId).padStart(4, '0')}.`;
}

function clearUI() {
  const el = id => document.getElementById(id);
  if (!el) return;
  el('totalEscrow').textContent = '—';
  el('remainingBalance').textContent = '—';
  el('fundedStatus').textContent = '—';
  el('agreementStatus').textContent = '—';
  el('kvRequired').textContent = '—';
  el('kvDeposited').textContent = '—';
  el('kvRemaining').textContent = '—';
  el('contractStatus').textContent = '—';
  el('depositProgressFill').style.width = '0%';
  el('depositProgressLabel').textContent = '0 / 0 ETH deposited';
  el('depositPercent').textContent = '0%';
  el('depositDesc').textContent = 'Select an agreement to deposit.';
  el('balanceDesc').textContent = 'Select an agreement to view balance.';
  el('depositBtn').disabled = true;
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
  if (isNaN(amount) || amount <= 0) { showToast('Enter a valid amount.', 'error'); return; }
  if (!window.contract) { showToast('Connect wallet first.', 'error'); return; }
  if (currentAgreementId === null) { showToast('Select an agreement.', 'error'); return; }
  if (agreementData.funded) { showToast('Agreement already funded.', 'error'); return; }
  const remaining = parseFloat(agreementData.remainingAmount);
  if (amount > remaining) { showToast(`Amount exceeds remaining requirement (${remaining.toFixed(4)} ETH).`, 'error'); return; }
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
    if (typeof API !== 'undefined' && API.postDepositEscrow) {
      await API.postDepositEscrow(currentAgreementId, amountWei.toString(), tx.hash);
    }
    await loadAgreementData();
    await refreshAllAgreements();
  } catch (e) {
    log('❌ Deposit failed: ' + e.message);
    showToast('❌ Deposit failed: ' + e.message, 'error');
  }
};

// ─── Init (for both standalone & SPA) ──────────────────────
async function initDepositBalance() {
  console.log('🚀 initDepositBalance() called');
  // Hardcoded address – change if needed
  const hardcodedAddress = '0x3b2c00fb015555fe8e6c389aa071bcbb18463dad';
  window.userWalletAddress = hardcodedAddress;
  await loadAgreements();
}

// ─── Expose to global scope ────────────────────────────────
window.loadAgreementData = loadAgreementData;
window.loadAgreements = loadAgreements;
window.updateDepositPreview = updateDepositPreview;
window.initDepositBalance = initDepositBalance;   
window.debugInit = initDepositBalance;            

// ─── Auto‑init when loaded directly (not via SPA) ──────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDepositBalance);
} else {
  // DOM already ready
  initDepositBalance();
}

console.log('✅ deposit_balance.js ready – URL param support added.');