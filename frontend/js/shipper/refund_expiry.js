
let currentAgreementId = null;
let currentAgreementData = null;
let refundLog = [];

function log(msg) {
  const el = document.getElementById('output');
  el.innerHTML += `\n${new Date().toLocaleTimeString()}: ${msg}`;
  el.scrollTop = el.scrollHeight;
}

// ─── Load Agreements for dropdown ──────────────────────────
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
      opt.textContent = `AGR-${String(ag.onchain_id).padStart(4, '0')} (${ag.status})`;
      sel.appendChild(opt);
    });
    // Auto-select first if any
    if (data.length > 0) {
      sel.value = data[0].onchain_id;
      loadRefundData();
    }
    // Also update expiry grid
    renderExpiryGrid(data);
    return data;
  } catch (e) {
    log('❌ Failed to load agreements: ' + e.message);
    return [];
  }
}

// ─── Render Expiry Grid ────────────────────────────────────
function renderExpiryGrid(agreements) {
  const container = document.getElementById('expiryGrid');
  if (!agreements || agreements.length === 0) {
    container.innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">No agreements found.</div>';
    return;
  }
  container.innerHTML = agreements.map(ag => {
    const status = ag.status || 'pending';
    let statusClass = 'lime';
    let statusLabel = 'On Track';
    if (status === 'refunded') { statusClass = 'red'; statusLabel = 'Refunded'; }
    else if (status === 'completed') { statusClass = 'lime'; statusLabel = 'Completed'; }
    else if (status === 'active') { statusClass = 'lime'; statusLabel = 'Active'; }
    else if (status === 'pending') { statusClass = 'gray'; statusLabel = 'Pending'; }
    return `
        <div class="expiry-card ${status === 'refunded' ? 'expired' : status === 'active' ? '' : 'risk'}">
          <div class="pill ${statusClass}" style="margin-bottom:8px;"><span class="dot"></span>${statusLabel}</div>
          <div style="font-weight:700;">AGR-${String(ag.onchain_id).padStart(4, '0')}</div>
          <div style="font-size:11px;color:var(--text-faint);">${ag.total_amount || '0'} ETH</div>
        </div>
      `;
  }).join('');
}

// ─── Load Refund Data ──────────────────────────────────────
async function loadRefundData() {
  const sel = document.getElementById('agreementSelect');
  const id = parseInt(sel.value);
  currentAgreementId = isNaN(id) ? null : id;

  if (currentAgreementId === null) {
    document.getElementById('agreementDesc').textContent = 'Select an agreement to view refund status.';
    document.getElementById('deadlineDisplay').textContent = '—';
    document.getElementById('timeRemainingDisplay').textContent = '—';
    document.getElementById('expiryStatusDisplay').textContent = '—';
    document.getElementById('remainingLockedDisplay').textContent = '—';
    document.getElementById('timeLeftPercent').textContent = '—';
    document.getElementById('countdownCircle').style.strokeDasharray = '327';
    document.getElementById('countdownCircle').style.strokeDashoffset = '0';
    document.getElementById('refundBtn').disabled = true;
    document.getElementById('refundBanner').innerHTML = '';
    return;
  }

  if (!window.contract) {
    showToast('⚠️ Connect wallet first.', 'error');
    return;
  }

  try {
    // Get agreement details from contract
    const details = await window.contract.getAgreementDetails(currentAgreementId);
    const shipper = details[0];
    const carrier = details[1];
    const totalAmount = ethers.formatEther(details[2]);
    const remainingAmount = ethers.formatEther(details[3]);
    const funded = details[4];
    const completed = details[5];
    const deadline = new Date(Number(details[6]) * 1000);
    const status = Number(details[7]);

    currentAgreementData = {
      shipper,
      carrier,
      totalAmount,
      remainingAmount,
      funded,
      completed,
      deadline,
      status
    };

    // Get milestone data
    const agreementData = await window.contract.agreements(currentAgreementId);
    const milestoneCount = Number(agreementData.milestoneCount);
    const milestones = [];
    for (let i = 0; i < milestoneCount; i++) {
      const m = await window.contract.getMilestone(currentAgreementId, i);
      milestones.push({ verified: m[2], paid: m[3] });
    }
    const allPaid = milestones.length > 0 && milestones.every(m => m.paid);

    // Update UI
    updateRefundUI(currentAgreementId, totalAmount, remainingAmount, funded, completed, deadline, status, allPaid);

    log(`✅ Loaded refund data for agreement ${currentAgreementId}`);
  } catch (e) {
    log('❌ Error loading refund data: ' + e.message);
    showToast('❌ Error loading agreement: ' + e.message, 'error');
  }
}

function updateRefundUI(agreementId, total, remaining, funded, completed, deadline, status, allPaid) {
  const now = new Date();
  const isExpired = now > deadline;
  const hasBalance = parseFloat(remaining) > 0;
  const isRefundable = isExpired && hasBalance && funded && !completed;

  // Agreement description
  document.getElementById('agreementDesc').textContent = `AGR-${String(agreementId).padStart(4, '0')} — ${funded ? '✅ Funded' : '⏳ Not Funded'} | ${completed ? '✅ Completed' : '⏳ In Progress'}`;

  // Deadline
  document.getElementById('deadlineDisplay').textContent = deadline.toLocaleString();

  // Time remaining
  const diff = deadline - now;
  if (diff > 0) {
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    document.getElementById('timeRemainingDisplay').textContent = `${days}d ${hours}h ${mins}m`;
    document.getElementById('timeRemainingDisplay').style.color = 'var(--lime)';
  } else {
    document.getElementById('timeRemainingDisplay').textContent = 'Expired ⏳';
    document.getElementById('timeRemainingDisplay').style.color = 'var(--red)';
  }

  // Expiry status
  const statusLabel = isExpired ? (hasBalance ? 'Expired ⚠️' : 'Expired ✅') : 'On Track';
  const statusClass = isExpired ? (hasBalance ? 'amber' : 'lime') : 'lime';
  document.getElementById('expiryStatusDisplay').innerHTML = `<span class="pill ${statusClass}"><span class="dot"></span>${statusLabel}</span>`;

  // Remaining locked
  document.getElementById('remainingLockedDisplay').textContent = remaining + ' ETH';

  // Countdown ring
  const circumference = 327;
  const totalSeconds = 30 * 24 * 60 * 60; // assume 30 days max for percentage
  const elapsedSeconds = Math.max(0, (deadline - now) / 1000);
  const percent = Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100));
  const offset = circumference - (percent / 100) * circumference;
  document.getElementById('countdownCircle').style.strokeDasharray = circumference;
  document.getElementById('countdownCircle').style.strokeDashoffset = offset;
  document.getElementById('timeLeftPercent').textContent = Math.round(percent) + '%';

  // Refund button
  const btn = document.getElementById('refundBtn');
  if (isRefundable && !completed) {
    btn.disabled = false;
    btn.textContent = `↩ Request Refund (${remaining} ETH)`;
  } else {
    btn.disabled = true;
    if (completed) btn.textContent = '✅ Agreement Completed';
    else if (!funded) btn.textContent = '⏳ Agreement Not Funded';
    else if (!isExpired) btn.textContent = '⏳ Deadline Not Passed';
    else if (!hasBalance) btn.textContent = '✅ No Balance to Refund';
    else btn.textContent = '↩ Refund Unavailable';
  }

  // Banner
  const banner = document.getElementById('refundBanner');
  if (isRefundable && !completed) {
    banner.innerHTML = `
        <div class="banner warn">
          <div class="banner-icon">⚠️</div>
          <div><strong>Refund available.</strong> The deadline has passed and there is ${remaining} ETH remaining in escrow. Click "Request Refund" to reclaim your funds.</div>
        </div>
      `;
  } else if (isExpired && !hasBalance) {
    banner.innerHTML = `
        <div class="banner ok">
          <div class="banner-icon">✅</div>
          <div><strong>No balance to refund.</strong> All funds have been released.</div>
        </div>
      `;
  } else if (completed) {
    banner.innerHTML = `
        <div class="banner ok">
          <div class="banner-icon">✅</div>
          <div><strong>Agreement completed.</strong> All milestones have been paid.</div>
        </div>
      `;
  } else {
    banner.innerHTML = `
        <div class="banner info">
          <div class="banner-icon">ℹ</div>
          <div><strong>Agreement active.</strong> Deadline: ${deadline.toLocaleString()} | Remaining: ${remaining} ETH</div>
        </div>
      `;
  }
}

// ─── Handle Refund ─────────────────────────────────────────
window.handleRefund = async function () {
  if (!window.contract) {
    showToast('Connect wallet first!', 'error');
    return;
  }
  if (currentAgreementId === null) {
    showToast('No agreement selected.', 'error');
    return;
  }
  if (!currentAgreementData) {
    showToast('Agreement data not loaded.', 'error');
    return;
  }

  const { remainingAmount, deadline } = currentAgreementData;
  const now = new Date();
  if (now < deadline) {
    showToast('❌ Deadline not passed yet.', 'error');
    return;
  }
  if (parseFloat(remainingAmount) <= 0) {
    showToast('❌ No balance to refund.', 'error');
    return;
  }

  if (!confirm(`Are you sure you want to refund ${remainingAmount} ETH to the Shipper?`)) return;

  log(`⏳ Requesting refund for agreement ${currentAgreementId}...`);
  try {
    const tx = await window.contract.refund(currentAgreementId);
    log(`📨 Tx sent: ${tx.hash}`);
    await tx.wait();
    log(`✅ Refund successful!`);

    // Record refund in database (optional – you can add an endpoint)
    // await API.postRefund(currentAgreementId);

    showToast(`✅ Refund successful! ${remainingAmount} ETH returned.`, 'success');

    // Update local refund log
    refundLog.unshift({
      agreementId: currentAgreementId,
      amount: remainingAmount,
      txHash: tx.hash,
      time: new Date().toLocaleString()
    });
    renderRefundLog();

    // Refresh data
    await loadRefundData();
  } catch (e) {
    log('❌ Refund failed: ' + e.message);
    showToast('❌ Refund failed: ' + e.message, 'error');
  }
};

function renderRefundLog() {
  const container = document.getElementById('refundLog');
  if (!refundLog || refundLog.length === 0) {
    container.innerHTML = '<div style="color:var(--text-faint);font-size:12px;">No refunds recorded yet.</div>';
    return;
  }
  container.innerHTML = refundLog.map(entry => `
      <div class="log-row">
        <div class="log-icon refund">↩</div>
        <div class="log-main">
          <div class="log-title">Refund executed — AGR-${String(entry.agreementId).padStart(4, '0')}</div>
          <div class="log-sub">tx ${truncateHash(entry.txHash)} · ${entry.amount} ETH → Shipper</div>
        </div>
        <div class="log-time">${entry.time}</div>
      </div>
    `).join('');
}

function truncateHash(hash) {
  if (!hash) return '';
  if (hash.length <= 10) return hash;
  return hash.slice(0, 6) + '…' + hash.slice(-4);
}

// ─── Wallet Events ────────────────────────────────────────
window.addEventListener('walletConnected', () => {
  loadAgreements().then(() => loadRefundData());
});

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (window.userWalletAddress) {
    await loadAgreements();
    await loadRefundData();
  } else {
    log('👛 Connect wallet to start.');
    window.addEventListener('walletConnected', async () => {
      await loadAgreements();
      await loadRefundData();
    });
  }
});

// Expose for inline onclick
window.loadRefundData = loadRefundData;
window.loadAgreements = loadAgreements;
