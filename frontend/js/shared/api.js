// /**
//  * api.js - Backend API Service Layer
//  * All HTTP requests to the Express backend are centralized here
//  */

// const API_BASE = 'http://localhost:5000/api';

// /**
//  * Get headers with wallet address
//  */
// function getHeaders() {
//     return {
//         'Content-Type': 'application/json',
//         'x-wallet-address': window.userWalletAddress || ''
//     };
// }

// /**
//  * Handle API errors
//  */
// async function handleResponse(response) {
//     if (!response.ok) {
//         const error = await response.text();
//         throw new Error(error || `HTTP error ${response.status}`);
//     }
//     return response.json();
// }

// // ============================================================
// // ESCROW APIs
// // ============================================================

// /**
//  * Get escrow balance for an agreement
//  */
// async function getEscrowBalance(agreementId) {
//     try {
//         const response = await fetch(`${API_BASE}/escrow/${agreementId}/balance`, {
//             headers: getHeaders()
//         });
//         return await handleResponse(response);
//     } catch (error) {
//         console.error('getEscrowBalance failed:', error);
//         throw error;
//     }
// }

// /**
//  * Deposit funds into escrow (record in backend)
//  */
// async function postDepositEscrow(agreementId, amount, txHash) {
//     try {
//         const response = await fetch(`${API_BASE}/escrow/${agreementId}/deposit`, {
//             method: 'POST',
//             headers: getHeaders(),
//             body: JSON.stringify({ amount, txHash })
//         });
//         return await handleResponse(response);
//     } catch (error) {
//         console.error('postDepositEscrow failed:', error);
//         throw error;
//     }
// }

// // ============================================================
// // PAYMENT APIs
// // ============================================================

// /**
//  * Get payment history for an agreement
//  */
// async function getPaymentHistory(agreementId) {
//     try {
//         const response = await fetch(`${API_BASE}/payment/${agreementId}/history`, {
//             headers: getHeaders()
//         });
//         return await handleResponse(response);
//     } catch (error) {
//         console.error('getPaymentHistory failed:', error);
//         throw error;
//     }
// }

// /**
//  * Calculate payment amount for a milestone
//  */
// async function calculatePayment(agreementId, milestoneId) {
//     try {
//         const response = await fetch(`${API_BASE}/payment/${agreementId}/milestone/${milestoneId}/calculate`, {
//             headers: getHeaders()
//         });
//         return await handleResponse(response);
//     } catch (error) {
//         console.error('calculatePayment failed:', error);
//         throw error;
//     }
// }

// /**
//  * Release payment for a milestone
//  */
// async function postReleasePayment(agreementId, milestoneId) {
//     try {
//         const response = await fetch(`${API_BASE}/payment/${agreementId}/milestone/${milestoneId}/release`, {
//             method: 'POST',
//             headers: getHeaders(),
//             body: JSON.stringify({})
//         });
//         return await handleResponse(response);
//     } catch (error) {
//         console.error('postReleasePayment failed:', error);
//         throw error;
//     }
// }

// // ============================================================
// // REFUND APIs (if your backend has them)
// // ============================================================

// /**
//  * Request a refund for an agreement
//  */
// async function postRefund(agreementId) {
//     try {
//         const response = await fetch(`${API_BASE}/refund/${agreementId}`, {
//             method: 'POST',
//             headers: getHeaders(),
//             body: JSON.stringify({})
//         });
//         return await handleResponse(response);
//     } catch (error) {
//         console.error('postRefund failed:', error);
//         throw error;
//     }
// }

// // Export all API functions
// window.API = {
//     getEscrowBalance,
//     postDepositEscrow,
//     getPaymentHistory,
//     calculatePayment,
//     postReleasePayment,
//     postRefund
// };