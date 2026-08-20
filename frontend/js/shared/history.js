// ─── Transaction History ──────────────────────────────────
console.log('🚀 history.js loaded');

(function() {
  let currentAgreementId = null;
  let allAgreements = [];

  function log(msg) {
    const el = document.getElementById('output');
    if (el) el.innerHTML += `\n${new Date().toLocaleTimeString()}: ${msg}`;
  }

  function getWalletAddress() {
    if (window.userWalletAddress) return window.userWalletAddress.toLowerCase();
    if (typeof window.Auth?.getWallet === 'function') {
      const wallet = window.Auth.getWallet();
      if (wallet) return wallet.toLowerCase();
    }
    const stored = localStorage.getItem('traxenWallet');
    if (stored) return stored.toLowerCase();
    return null;
  }

  async function loadAgreements() {
    try {
      const address = getWalletAddress();
      if (!address) {
        console.warn('No wallet address');
        return;
      }
      const res = await fetch('/api/agreements', {
        headers: { 'x-wallet-address': address }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      allAgreements = await res.json();
      console.log('✅ Agreements loaded:', allAgreements);

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
        loadHistory();
      } else {
        const content = document.getElementById('historyContent');
        if (content) content.innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">No agreements found.</div>';
        clearStats();
      }
    } catch (e) {
      console.error('Load agreements error:', e);
      log('❌ Failed to load agreements: ' + e.message);
    }
  }

  async function loadHistory() {
    const sel = document.getElementById('agreementSelect');
    const toggle = document.getElementById('showAllToggle');
    const showAll = toggle ? toggle.checked : true;
    const container = document.getElementById('historyContent');
    const desc = document.getElementById('historyDesc');

    let url;
    if (showAll) {
      url = '/api/history';
      if (desc) desc.textContent = 'All transactions across all your agreements';
      if (sel) { sel.disabled = true; sel.style.opacity = '0.6'; }
    } else {
      const id = parseInt(sel ? sel.value : '');
      currentAgreementId = isNaN(id) ? null : id;
      if (currentAgreementId === null) {
        if (container) container.innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">Select an agreement to view transactions.</div>';
        clearStats();
        return;
      }
      url = `/api/history/${currentAgreementId}`;
      if (desc) desc.textContent = `Transactions for AGR-${String(currentAgreementId).padStart(4, '0')}`;
      if (sel) { sel.disabled = false; sel.style.opacity = '1'; }
    }

    try {
      const address = getWalletAddress();
      if (!address) {
        if (container) container.innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">Please connect your wallet.</div>';
        return;
      }
      const res = await fetch(url, {
        headers: { 'x-wallet-address': address }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderHistory(data.payments || []);
      updateStats(data.payments || []);
      log(`✅ Loaded history (${showAll ? 'all' : 'selected'})`);
    } catch (e) {
      console.error('Load history error:', e);
      if (container) container.innerHTML = `<div style="color:var(--text-faint);padding:12px 0;">❌ ${e.message}</div>`;
      clearStats();
    }
  }

  function renderHistory(payments) {
    const container = document.getElementById('historyContent');
    if (!container) return;
    if (!payments || payments.length === 0) {
      container.innerHTML = '<div style="color:var(--text-faint);padding:12px 0;">📭 No transactions found.</div>';
      return;
    }

    let rows = payments.map(p => {
      const amount = p.amountEth || (p.amount ? ethers.formatEther(p.amount) : '—');
      const type = p.type || 'Event';
      const txHash = p.txHash || '—';
      const time = p.timestamp || '—';
      const status = p.status || 'completed';
      const statusClass = status === 'completed' ? 'lime' : 'amber';
      const shortHash = txHash.length > 12 ? `${txHash.slice(0,6)}…${txHash.slice(-4)}` : txHash;
      const agreementLabel = p.agreementId ? `AGR-${String(p.agreementId).padStart(4,'0')}` : '';

      return `
        <tr>
          <td>${type}${agreementLabel ? ' (' + agreementLabel + ')' : ''}</td>
          <td>${amount} ETH</td>
          <td class="mono">${shortHash}</td>
          <td>${time ? new Date(time).toLocaleString() : '—'}</td>
          <td><span class="pill ${statusClass}"><span class="dot"></span>${status}</span></td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table>
        <thead><tr><th>Type</th><th>Amount</th><th>Tx Hash</th><th>Timestamp</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function updateStats(payments) {
    // Only update if the elements exist
    const totalPaymentsEl = document.getElementById('totalPayments');
    const totalEthEl = document.getElementById('totalEth');
    const latestPaymentEl = document.getElementById('latestPayment');
    const agreementIdDisplayEl = document.getElementById('agreementIdDisplay');
    if (!totalPaymentsEl || !totalEthEl || !latestPaymentEl || !agreementIdDisplayEl) {
      console.warn('Stats elements not found – skipping update.');
      return;
    }

    const total = payments.length;
    const totalEth = payments.reduce((sum, p) => {
      const amt = p.amountEth || (p.amount ? ethers.formatEther(p.amount) : '0');
      return sum + parseFloat(amt);
    }, 0);
    const latest = payments.length > 0 ? payments[0] : null;

    totalPaymentsEl.textContent = total;
    totalEthEl.textContent = totalEth.toFixed(4) + ' ETH';
    latestPaymentEl.textContent = latest ? (latest.timestamp ? new Date(latest.timestamp).toLocaleString() : '—') : '—';

    const toggle = document.getElementById('showAllToggle');
    const showAll = toggle ? toggle.checked : true;
    if (showAll) {
      agreementIdDisplayEl.textContent = 'All';
    } else {
      agreementIdDisplayEl.textContent = currentAgreementId !== null ? `AGR-${String(currentAgreementId).padStart(4,'0')}` : '—';
    }
  }

  function clearStats() {
    ['totalPayments', 'totalEth', 'latestPayment', 'agreementIdDisplay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
  }

  // ─── Init ──────────────────────────────────────────────────
  async function initHistory() {
    const sel = document.getElementById('agreementSelect');
    if (!sel) {
      console.log('⏭️ Not on history page – skipping init.');
      return;
    }
    console.log('🚀 initHistory() called (always reload)');

    // Auto-connect if needed
    if (!window.contract) {
      try {
        if (typeof window.connectWallet === 'function') {
          await window.connectWallet();
        }
      } catch (e) { console.warn('Auto‑connect failed:', e); }
    }
    if (!window.userWalletAddress) {
      const stored = window.Auth?.getWallet ? window.Auth.getWallet() : localStorage.getItem('traxenWallet');
      if (stored) window.userWalletAddress = stored;
    }

    const toggle = document.getElementById('showAllToggle');
    if (toggle) {
      toggle.removeEventListener('change', loadHistory);
      toggle.addEventListener('change', loadHistory);
    }

    // Always reload agreements and history
    await loadAgreements();
  }

  // ─── Listen for wallet connection ──────────────────────
  window.addEventListener('walletConnected', async function() {
    if (document.getElementById('agreementSelect')) {
      await initHistory();
    }
  });

  // ─── Expose ──────────────────────────────────────────────
  window.loadHistory = loadHistory;
  window.loadAgreements = loadAgreements;
  window.initHistory = initHistory;
  window.debugInit = initHistory;
})();