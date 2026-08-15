function fundEscrow() {
  openSuccess(
    "Escrow Funded",
    "Your deposit has been locked into the smart contract for Agreement #AG8901.",
    `<div class="kv"><span class="k">Amount Deposited</span><span class="v">5.00 ETH</span></div><div class="kv"><span class="k">Transaction</span><span class="v" style="font-family:var(--mono);font-size:11px">0x21bd…9f31</span></div>`,
    "agreement_details_shipper.html?id=AG8901",
  );
}
function verifyRelease() {
  openSuccess(
    "Milestone Released",
    "Milestone 2 — In Transit has been verified and payment released to the carrier.",
    `<div class="kv"><span class="k">Milestone</span><span class="v">2. In Transit</span></div><div class="kv"><span class="k">Amount Released</span><span class="v">1.00 ETH</span></div><div class="kv"><span class="k">Recipient</span><span class="v">FastTrack Logistics</span></div>`,
    "agreement_details_shipper.html?id=AG8901",
  );
}
function raiseDispute() {
  openSuccess(
    "Dispute Raised",
    "Your dispute for Agreement #AG8901 has been logged on-chain and flagged for review.",
    `<div class="kv"><span class="k">Agreement</span><span class="v">#AG8901</span></div><div class="kv"><span class="k">Status</span><span class="v">Under Review</span></div>`,
    "agreement_details_shipper.html?id=AG8901",
  );
}
function submitProof() {
  openSuccess(
    "Proof Submitted",
    "Your milestone proof has been uploaded and sent to the shipper for verification.",
    `<div class="kv"><span class="k">Milestone</span><span class="v">2. In Transit</span></div><div class="kv"><span class="k">Status</span><span class="v">Pending Verification</span></div>`,
    "agreement-details-carrier.html?id=AG8901",
  );
}
function acceptJob() {
  openSuccess(
    "Job Accepted",
    "Agreement #AG8930 is now active. The shipper has been notified and the pickup window is open.",
    `<div class="kv"><span class="k">Agreement</span><span class="v">#AG8930</span></div><div class="kv"><span class="k">Payout</span><span class="v">2.80 ETH</span></div>`,
    "agreement-details-carrier.html?id=AG8930",
  );
}
function declineJob() {
  openSuccess(
    "Job Declined",
    "You have declined Agreement #AG8930. The shipper will be notified to find another carrier.",
    "",
    "agreements.html",
  );
}
