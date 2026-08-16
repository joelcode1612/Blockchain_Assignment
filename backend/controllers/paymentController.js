// const supabase = require('../config/supabase');
// const blockchainService = require('../services/blockchainService');
// const { ethers } = require('ethers');

// /**
//  * Helper: find agreement by onchain_id or UUID
//  */
// async function findAgreementByIdentifier(identifier) {
//     // Try as onchain_id (integer)
//     let { data, error } = await supabase
//         .from('agreements')
//         .select('*')
//         .eq('onchain_id', parseInt(identifier))
//         .maybeSingle();
//     if (data) return data;

//     // Fallback to UUID
//     const { data: uuidData, error: uuidError } = await supabase
//         .from('agreements')
//         .select('*')
//         .eq('id', identifier)
//         .maybeSingle();
//     return uuidData;
// }

// // --- Calculate Payment ---
// exports.calculatePayment = async (req, res) => {
//     try {
//         const { agreementId, milestoneId } = req.params;
//         const agreement = await findAgreementByIdentifier(agreementId);
//         if (!agreement) {
//             return res.status(404).json({ error: 'Agreement not found' });
//         }
//         // ... rest (fetch milestone from contract or database)
//         // Assuming you have a function to get milestone details from contract
//         // but for calculation you can use the contract's getMilestone
//         const contract = blockchainService.getContract(); // you may need to expose getContract
//         const milestone = await contract.getMilestone(agreement.onchain_id, milestoneId);
//         // ... calculate and respond
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// // --- Release Payment ---
// exports.releasePayment = async (req, res) => {
//     try {
//         const { agreementId, milestoneId } = req.params;
//         const agreement = await findAgreementByIdentifier(agreementId);
//         if (!agreement) {
//             return res.status(404).json({ error: 'Agreement not found' });
//         }

//         // Check if already paid (optional)
//         const released = await blockchainService.isPaymentReleased(agreement.onchain_id, milestoneId);
//         if (released) {
//             return res.status(400).json({ error: 'Payment already released on blockchain' });
//         }

//         // ... rest of the logic (you may already have this)
//         // Ensure you use agreement.onchain_id for contract calls
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// // --- View Payment History ---
// exports.viewPaymentHistory = async (req, res) => {
//     try {
//         const { agreementId } = req.params;
//         const agreement = await findAgreementByIdentifier(agreementId);
//         if (!agreement) {
//             return res.status(404).json({ error: 'Agreement not found' });
//         }

//         // Find escrow using agreement UUID
//         const { data: escrow, error: escrowError } = await supabase
//             .from('escrows')
//             .select('id')
//             .eq('agreement_id', agreement.id)
//             .maybeSingle();

//         if (escrowError || !escrow) {
//             return res.status(404).json({ error: 'Escrow not found' });
//         }

//         const { data: payments, error: paymentsError } = await supabase
//             .from('payments')
//             .select('*')
//             .eq('escrow_id', escrow.id)
//             .order('paid_at', { ascending: false });

//         if (paymentsError) {
//             return res.status(500).json({ error: 'Failed to fetch payments' });
//         }

//         res.json({ payments });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };