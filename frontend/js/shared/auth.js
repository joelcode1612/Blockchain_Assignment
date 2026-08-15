let selectedRole = null;

function togglePw(id) {
  const el = document.getElementById(id);
  if (el) el.type = el.type === "password" ? "text" : "password";
}

function goRegStep(step) {
  [1, 2, 3].forEach((i) => {
    const el = document.getElementById("reg-step-" + i);
    if (el) el.classList.toggle("active", i === step);
  });
  document
    .querySelectorAll("#regDots .dot-bar")
    .forEach((dot, i) => dot.classList.toggle("on", i < step));
}

function selectRole(el) {
  document
    .querySelectorAll(".role-card")
    .forEach((card) => card.classList.remove("selected"));
  el.classList.add("selected");
  selectedRole = el.dataset.role;
  document.getElementById("regRoleContinue").disabled = false;
}

function finishRegister() {
  const name =
    document.getElementById("regDisplayName").value.trim() || "Mike Johnson";
  if (!selectedRole) {
    alert("Please select a role.");
    goRegStep(2);
    return;
  }
  localStorage.setItem("traxenUserName", name);
  localStorage.setItem("traxenUserRole", selectedRole);
  alert("Account created successfully as " + selectedRole + ".");
  window.location.href = "/" + selectedRole.toLowerCase();
}

function doLogin() {
  const role = localStorage.getItem("traxenUserRole") || "shipper";
  window.location.href = "/" + role.toLowerCase();
}

function selectWallet(el, ctx) {
  el.parentElement
    .querySelectorAll(".wallet-opt")
    .forEach((w) => w.classList.remove("selected"));
  el.classList.add("selected");
  const status = document.getElementById(ctx + "WalletStatus");
  const walletName = el.querySelector(".wallet-name").textContent;
  status.className = "status-line connecting";
  status.innerHTML =
    '<div class="status-dot"></div><span>Connecting to ' +
    walletName +
    "…</span>";
  setTimeout(() => {
    status.className = "status-line connected";
    status.innerHTML =
      '<div class="status-dot"></div><span>Connected · 0x7a83…4F2E</span>';
    if (ctx === "reg") setTimeout(() => goRegStep(2), 500);
    if (ctx === "login") setTimeout(() => doLogin(), 500);
  }, 900);
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("reg-step-1")) goRegStep(1);
});