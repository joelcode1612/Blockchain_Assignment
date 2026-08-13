/**
 * history.js – Real transaction history from backend
 */

let currentAgreementId = null;
let transactions = [];

async function loadHistory() {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id !== null) {
        currentAgreementId = parseInt(id);
        document.querySelectorAll('.ag-id-placeholder').forEach(el => {
            el.textContent = `AGR-${String(currentAgreementId).padStart(4, '0')}`;
        });
    }

    try {
        const data = await API.getPaymentHistory(currentAgreementId || 0);
        transactions = data.payments || [];
        renderHistory(transactions);
    } catch (error) {
        console.error('Failed to load history:', error);
        transactions = [];
        renderHistory([]);
        showToast('Could not load transaction history.', 'error');
    }
}

function renderHistory(data) {
    const container = document.getElementById('tx-list');
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="card empty-state">
                <p>📭 No transactions found for this agreement.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = data.map(tx => `
        <div class="tx-item">
            <div class="tx-icon">${getIcon(tx.type)}</div>
            <div class="tx-info">
                <div class="tx-title">${tx.type || 'Transaction'}</div>
                <div class="tx-meta">
                    ${tx.amount ? `<span>💰 ${tx.amount} ETH</span>` : ''}
                    ${tx.transaction_hash ? `<span>🔗 ${truncateHash(tx.transaction_hash)}</span>` : ''}
                    ${tx.paid_at ? `<span>🕐 ${new Date(tx.paid_at).toLocaleString()}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function getIcon(type) {
    if (!type) return '📄';
    const t = type.toLowerCase();
    if (t.includes('fund') || t.includes('deposit')) return '💰';
    if (t.includes('verify') || t.includes('milestone')) return '✅';
    if (t.includes('payment') || t.includes('release')) return '📤';
    if (t.includes('refund')) return '↩';
    return '📄';
}

function truncateHash(hash) {
    if (!hash) return '';
    return hash.slice(0,6)+'…'+hash.slice(-4);
}

// Export functions
function exportJSON() { /* ... as before */ }
function exportCSV() { /* ... as before */ }

document.addEventListener('DOMContentLoaded', loadHistory);
window.refreshData = loadHistory;