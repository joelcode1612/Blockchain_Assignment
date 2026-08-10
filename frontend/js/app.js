// app.js – shared utilities for Traxen dashboards

document.addEventListener("DOMContentLoaded", function () {
  const currentPath = window.location.pathname;
  const isShipper =
    currentPath.includes("shipper.html") || currentPath.endsWith("/");
  const isCarrier = currentPath.includes("carrier.html");

  document.querySelectorAll(".rs-opt").forEach((el) => {
    el.classList.remove("active");
    if (isShipper && el.getAttribute("href")?.includes("shipper.html")) {
      el.classList.add("active");
    }
    if (isCarrier && el.getAttribute("href")?.includes("carrier.html")) {
      el.classList.add("active");
    }
  });
});

console.log("Traxen app loaded.");

// ============ TOP-LEVEL PAGE ROUTER ============
function showPage(id) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo({ top: 0, behavior: "instant" });
}
function goToLanding() {
  showPage("page-landing");
}
function goToRegister() {
  showPage("page-register");
  resetRegisterForm();
}
function goToLogin() {
  showPage("page-login");
  resetLoginForm();
}
function goToDashboard(role) {
  showPage("page-dashboard");
  setRole(role || "shipper");
}
function logout() {
  goToLanding();
}

// ============ SHARED HELPERS ============
function togglePw(id) {
  const el = document.getElementById(id);
  el.type = el.type === "password" ? "text" : "password";
}

// ============ REGISTER FLOW ============
function resetRegisterForm() {
  goRegStep(1);
  document
    .querySelectorAll("#page-register .wallet-opt")
    .forEach((w) => w.classList.remove("selected"));
  document.getElementById("regWalletStatus").className = "status-line";
  document.getElementById("regWalletStatus").innerHTML =
    '<div class="status-dot"></div><span>No wallet connected</span>';
  document
    .querySelectorAll("#page-register .role-card")
    .forEach((r) => r.classList.remove("selected"));
  document.getElementById("regRoleContinue").disabled = true;
}

function goRegStep(n) {
  [1, 2, 3].forEach((i) => {
    document
      .getElementById("reg-step-" + i)
      .classList.toggle("active", i === n);
  });
  document
    .querySelectorAll("#regDots .dot-bar")
    .forEach((d, i) => d.classList.toggle("on", i < n));
}

function selectRole(el) {
  el.parentElement
    .querySelectorAll(".role-card")
    .forEach((r) => r.classList.remove("selected"));
  el.classList.add("selected");
  document.getElementById("regRoleContinue").disabled = false;
}

function finishRegister() {
  const name =
    document.getElementById("regDisplayName").value || "Mike Johnson";
  const roleEl = document.querySelector("#page-register .role-card.selected");
  const role = roleEl ? roleEl.dataset.role : "Shipper";
  document.getElementById("miniName").textContent = name;
  const initials =
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "MJ";
  document.getElementById("miniAvatar").textContent = initials;
  goToDashboard(role.toLowerCase());
}

// ============ LOGIN FLOW ============
function resetLoginForm() {
  document
    .querySelectorAll("#page-login .wallet-opt")
    .forEach((w) => w.classList.remove("selected"));
  document.getElementById("loginWalletStatus").className = "status-line";
  document.getElementById("loginWalletStatus").innerHTML =
    '<div class="status-dot"></div><span>No wallet connected</span>';
}
function doLogin() {
  goToDashboard("shipper");
}

// ============ WALLET CONNECT (shared by register + login) ============
function selectWallet(el, ctx) {
  el.parentElement
    .querySelectorAll(".wallet-opt")
    .forEach((w) => w.classList.remove("selected"));
  el.classList.add("selected");
  const statusEl = document.getElementById(ctx + "WalletStatus");
  statusEl.className = "status-line connecting";
  statusEl.innerHTML =
    '<div class="status-dot"></div><span>Connecting to ' +
    el.querySelector(".wallet-name").textContent +
    "…</span>";
  setTimeout(() => {
    statusEl.className = "status-line connected";
    statusEl.innerHTML =
      '<div class="status-dot"></div><span>Connected · 0x7a83…4F2E</span>';
    if (ctx === "reg") {
      setTimeout(() => goRegStep(2), 500);
    } else if (ctx === "login") {
      setTimeout(() => doLogin(), 500);
    }
  }, 900);
}

// ============ DASHBOARD ROLE SWITCH ============
function setRole(role) {
  document
    .querySelectorAll(".rs-opt")
    .forEach((el) => el.classList.toggle("active", el.dataset.role === role));
  document.getElementById("nav-shipper").style.display =
    role === "shipper" ? "block" : "none";
  document.getElementById("nav-carrier").style.display =
    role === "carrier" ? "block" : "none";
  document
    .getElementById("view-shipper")
    .classList.toggle("active", role === "shipper");
  document
    .getElementById("view-carrier")
    .classList.toggle("active", role === "carrier");

  const name = document.getElementById("miniName").textContent || "Mike";
  const firstName = name.split(" ")[0];
  if (role === "shipper") {
    document.getElementById("pageTitle").textContent =
      "Welcome back, " + firstName + " 👋";
    document.getElementById("pageSub").textContent =
      "Here's what's happening with your shipments";
    document.getElementById("miniRole").textContent = "Shipper";
  } else {
    document.getElementById("pageTitle").textContent =
      "Welcome back, " + firstName + " 🚚";
    document.getElementById("pageSub").textContent =
      "Here's what's happening with your deliveries";
    document.getElementById("miniRole").textContent = "Carrier";
  }
  window.scrollTo({ top: 0, behavior: "instant" });
}
