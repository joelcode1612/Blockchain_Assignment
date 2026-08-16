let currentAgreementId = null;
let currentMilestones = [];
let releaseLog = [];

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
      loadMilestones();
    }
    return data;
  } catch (e) {
    log('❌ Failed to load agreements: ' + e.message);
    return [];
  }
}

// ─── Load Milestones from Contract ──────────────────────────
async function loadMilestones() {
  const sel = document.getElementById('agreementSelect');
  const id = parseInt(sel.value);
  currentAgreementId = isNaN(id) ? null : id;

  if (currentAgreementId === null) {
    document.getElementById('milestoneTableContainer').innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">Select an agreement to view milestones.</div>';
    document.getElementById('agreementDesc').textContent = 'Select an agreement to view milestones.';
    clearStats();
    return;
  }

  if (!window.contract) {
    document.getElementById('milestoneTableContainer').innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">⚠️ Connect wallet first.</div>';
    return;
  }

  try {
    // Get agreement details
    const details = await window.contract.getAgreementDetails(currentAgreementId);
    const totalAmount = ethers.formatEther(details[2]);
    const remainingAmount = ethers.formatEther(details[3]);
    const funded = details[4];

    // Get milestone count
    const agreementData = await window.contract.agreements(currentAgreementId);
    const milestoneCount = Number(agreementData.milestoneCount);

    // Fetch each milestone
    const milestones = [];
    for (let i = 0; i < milestoneCount; i++) {
      const m = await window.contract.getMilestone(currentAgreementId, i);
      milestones.push({
        id: i,
        description: m[0] || `Milestone ${i + 1}`,
        percentage: Number(m[1]),
        verified: m[2],
        paid: m[3]
      });
    }
    currentMilestones = milestones;

    // Update stats
    const paid = milestones.filter(m => m.paid).length;
    const total = milestones.length;
    const releasedEth = milestones.filter(m => m.paid).reduce((sum, m) => sum + (totalAmount * m.percentage / 100), 0);
    const remainingEth = totalAmount - releasedEth;
    const nextMilestone = milestones.find(m => !m.paid && m.verified);

    document.getElementById('totalEscrow').textContent = totalAmount + ' ETH';
    document.getElementById('releasedSoFar').textContent = releasedEth.toFixed(2) + ' ETH';
    document.getElementById('remainingLocked').textContent = remainingEth.toFixed(2) + ' ETH';
    document.getElementById('nextRelease').textContent = nextMilestone ? `${nextMilestone.description} — ${(totalAmount * nextMilestone.percentage / 100).toFixed(2)} ETH` : 'All paid ✅';

    document.getElementById('summaryTotal').textContent = totalAmount + ' ETH';
    document.getElementById('summaryReleased').textContent = releasedEth.toFixed(2) + ' ETH';
    document.getElementById('summaryRemaining').textContent = remainingEth.toFixed(2) + ' ETH';
    document.getElementById('summaryNext').textContent = nextMilestone ? `${nextMilestone.description} — ${(totalAmount * nextMilestone.percentage / 100).toFixed(2)} ETH` : 'All paid ✅';

    document.getElementById('agreementDesc').textContent = `Agreement AGR-${String(currentAgreementId).padStart(4, '0')} — ${funded ? 'Funded ✅' : 'Awaiting funding ⏳'}`;

    renderMilestones(milestones, totalAmount);
    log(`✅ Loaded ${milestones.length} milestones for agreement ${currentAgreementId}`);
  } catch (e) {
    log('❌ Error loading milestones: ' + e.message);
    document.getElementById('milestoneTableContainer').innerHTML = `<div style="color:var(--text-faint);padding:12px 0;">❌ Error: ${e.message}</div>`;
  }
}

function renderMilestones(milestones, totalAmount) {
  const container = document.getElementById('milestoneTableContainer');

  if (!milestones || milestones.length === 0) {
    container.innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">No milestones defined for this agreement.</div>';
    return;
  }

  let rows = milestones.map(m => {
    const payout = (totalAmount * m.percentage / 100).toFixed(2);
    let status = m.paid ? 'Released' : (m.verified ? 'Verified' : 'Pending');
    let statusClass = m.paid ? 'lime' : (m.verified ? 'amber' : 'gray');
    let action = '';
    if (m.verified && !m.paid) {
      action = `<button class="btn btn-primary btn-sm" onclick="releaseMilestone(${m.id})">Release</button>`;
    } else if (m.paid) {
      action = '<span style="color:var(--lime);font-weight:700;">✅ Paid</span>';
    } else {
      action = '—';
    }
    return `
        <tr>
          <td>${m.id + 1}</td>
          <td>${m.description}</td>
          <td>${m.percentage}%</td>
          <td>${payout} ETH</td>
          <td class="mono">—</td>
          <td><span class="pill ${statusClass}"><span class="dot"></span>${status}</span></td>
          <td>${action}</td>
        </tr>
      `;
  }).join('');

  container.innerHTML = `
      <table>
        <thead><tr><th>#</th><th>Milestone</th><th>%</th><th>Payout</th><th>Verification</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
}

// ─── Release Milestone ──────────────────────────────────────
window.releaseMilestone = async function (milestoneId) {
  if (!window.contract) {
    showToast('Connect wallet first!', 'error');
    return;
  }
  if (currentAgreementId === null) {
    showToast('No agreement selected.', 'error');
    return;
  }

  log(`⏳ Releasing payment for milestone ${milestoneId}...`);
  try {
    const tx = await window.contract.releasePayment(currentAgreementId, milestoneId);
    log(`📨 Tx sent: ${tx.hash}`);
    await tx.wait();
    log(`✅ Payment released for milestone ${milestoneId}`);

    // Record in backend
    await API.postReleasePayment(currentAgreementId, milestoneId);

    showToast('✅ Payment released successfully!', 'success');

    // Add to release log
    const milestone = currentMilestones.find(m => m.id === milestoneId);
    const details = await window.contract.getAgreementDetails(currentAgreementId);
    const totalAmount = ethers.formatEther(details[2]);
    const payout = (totalAmount * milestone.percentage / 100).toFixed(2);

    const logEntry = {
      title: `Milestone ${milestoneId + 1} — ${milestone.description} released`,
      amount: payout + ' ETH → Carrier',
      time: new Date().toLocaleString()
    };
    releaseLog.unshift(logEntry);
    renderReleaseLog();

    // Refresh milestones
    await loadMilestones();
  } catch (e) {
    log(`❌ Release failed: ${e.message}`);
    showToast('❌ Release failed: ' + e.message, 'error');
  }
};

function renderReleaseLog() {
  const container = document.getElementById('releaseLog');
  if (!releaseLog || releaseLog.length === 0) {
    container.innerHTML = '<div style="color:var(--text-faint);font-size:12px;">No releases yet.</div>';
    return;
  }
  container.innerHTML = releaseLog.map(entry => `
      <div class="log-row">
        <div class="log-icon ok">✓</div>
        <div class="log-main">
          <div class="log-title">${entry.title}</div>
          <div class="log-sub">${entry.amount}</div>
        </div>
        <div class="log-time">${entry.time}</div>
      </div>
    `).join('');
}

function clearStats() {
  document.getElementById('totalEscrow').textContent = '—';
  document.getElementById('releasedSoFar').textContent = '—';
  document.getElementById('remainingLocked').textContent = '—';
  document.getElementById('nextRelease').textContent = '—';
  document.getElementById('summaryTotal').textContent = '—';
  document.getElementById('summaryReleased').textContent = '—';
  document.getElementById('summaryRemaining').textContent = '—';
  document.getElementById('summaryNext').textContent = '—';
}

// ─── Wallet Events ────────────────────────────────────────
window.addEventListener('walletConnected', () => {
  loadAgreements().then(() => loadMilestones());
});

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (window.userWalletAddress) {
    await loadAgreements();
    await loadMilestones();
  } else {
    log('👛 Connect wallet to start.');
    // Try again when wallet connects
    window.addEventListener('walletConnected', async () => {
      await loadAgreements();
      await loadMilestones();
    });
  }
});

// Expose for inline onclick
window.loadMilestones = loadMilestones;
window.loadAgreements = loadAgreements;
