let milestones = [
  { name: "Pickup", desc: "Goods picked up from origin", pct: 30 },
  { name: "In Transit", desc: "Goods in transit", pct: 20 },
  { name: "Out for Delivery", desc: "Goods out for final delivery", pct: 20 },
  { name: "Delivered", desc: "Successfully delivered", pct: 30 },
];
function goStep(n) {
  [1, 2, 3].forEach((i) => {
    document.getElementById("ws-" + i).style.display =
      i === n ? "block" : "none";
    const s = document.getElementById("stp-" + i);
    s.classList.remove("current", "done");
    if (i < n) s.classList.add("done");
    if (i === n) s.classList.add("current");
  });
  if (n === 2) renderMilestones();
  if (n === 3) fillReview();
}
function renderMilestones() {
  const body = document.getElementById("milestoneBody");
  body.innerHTML = "";
  milestones.forEach((m, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><div class="m-badge">${i + 1}</div></td><td><input value="${m.name}"></td><td><input value="${m.desc}"></td><td><input type="number" value="${m.pct}" min="0" max="100"></td><td><span class="m-remove">✕</span></td>`;
    tr.querySelectorAll("input")[0].onchange = (e) => (m.name = e.target.value);
    tr.querySelectorAll("input")[1].onchange = (e) => (m.desc = e.target.value);
    tr.querySelectorAll("input")[2].onchange = (e) => {
      m.pct = Number(e.target.value);
      updatePct();
    };
    tr.querySelector(".m-remove").onclick = () => {
      milestones.splice(i, 1);
      renderMilestones();
    };
    body.appendChild(tr);
  });
  updatePct();
}
function addMilestone() {
  milestones.push({ name: "New Milestone", desc: "", pct: 0 });
  renderMilestones();
}
function updatePct() {
  const total = milestones.reduce((s, m) => s + Number(m.pct || 0), 0);
  const el = document.getElementById("pctTotal");
  el.textContent = `Total allocated: ${total}%`;
  el.className = "pct-total " + (total === 100 ? "good" : "bad");
}
function fillReview() {
  document.getElementById("rv-name").textContent =
    document.getElementById("f-name").value ||
    "Electronics Shipment to New York";
  document.getElementById("rv-carrier").textContent =
    document.getElementById("f-carrier").value;
  const val = document.getElementById("f-value").value || "5.00";
  document.getElementById("rv-value").textContent = val + " ETH";
  const dl = document.getElementById("f-deadline").value;
  document.getElementById("rv-deadline").textContent = dl
    ? new Date(dl).toLocaleString()
    : "Not set";
  const wrap = document.getElementById("rv-milestones");
  wrap.innerHTML = "";
  milestones.forEach((m, i) => {
    const amt = (((Number(val) || 0) * m.pct) / 100).toFixed(2);
    wrap.insertAdjacentHTML(
      "beforeend",
      `<div class="mini-milestone"><div><div class="name">${i + 1}. ${m.name}</div><div class="sub">${m.desc}</div></div><div class="pct">${m.pct}% (${amt} ETH)</div></div>`,
    );
  });
}
function submitCreateAgreement() {
  const total = milestones.reduce((s, m) => s + Number(m.pct || 0), 0);
  if (total !== 100) {
    openError(
      "Agreement Creation Failed",
      "Milestone percentages must total exactly 100% before the contract can be deployed.",
      `<div class="kv"><span class="k">Current Total</span><span class="v">${total}%</span></div><div class="kv"><span class="k">Required</span><span class="v">100%</span></div>`,
      "INVALID_MILESTONE_SPLIT",
      "create-agreement.html",
    );
    return;
  }
  const name =
    document.getElementById("f-name").value ||
    "Electronics Shipment to New York";
  const value = document.getElementById("f-value").value || "5.00";
  openSuccess(
    "Agreement Created",
    "Your escrow contract has been deployed on-chain and is now awaiting funding.",
    `<div class="kv"><span class="k">Agreement</span><span class="v">${name}</span></div><div class="kv"><span class="k">Total Value</span><span class="v">${value} ETH</span></div><div class="kv"><span class="k">Contract Address</span><span class="v" style="font-family:var(--mono);font-size:11px">0x9F2c…7B1E</span></div>`,
    "agreement-details-shipper.html?id=AG8901",
  );
}
renderMilestones();
