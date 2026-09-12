function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toast-container");
  if (!container) {
    console.warn("Toast container not found.");
    return;
  }

  // Create the toast element
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  // Add to container
  container.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    toast.classList.add("toast-hidden");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, duration);
}

// ─── Custom Alert (safe — no innerHTML +=) ───────────────
function CustomAlert() {
  let overlayEl = null;
  let boxEl = null;

  function ensureDOM() {
    if (overlayEl && boxEl) return;

    overlayEl = document.createElement("div");
    overlayEl.id = "dialogoverlay";
    overlayEl.style.display = "none";

    boxEl = document.createElement("div");
    boxEl.id = "dialogbox";
    boxEl.className = "slit-in-vertical";
    boxEl.style.display = "none";
    boxEl.innerHTML = `
      <div>
        <div id="dialogboxhead"></div>
        <div id="dialogboxbody"></div>
        <div id="dialogboxfoot"></div>
      </div>
    `;

    document.body.appendChild(overlayEl);
    document.body.appendChild(boxEl);
  }

  this.alert = function (message, title) {
    ensureDOM();

    const winH = window.innerHeight;
    overlayEl.style.height = winH + "px";
    boxEl.style.top = "100px";
    overlayEl.style.display = "block";
    boxEl.style.display = "block";

    const head = document.getElementById("dialogboxhead");
    if (typeof title === "undefined") {
      head.style.display = "none";
    } else {
      head.style.display = "block";
      head.innerHTML =
        '<i class="fa fa-exclamation-circle" aria-hidden="true"></i> ' + title;
    }

    document.getElementById("dialogboxbody").innerHTML = message;

    // Rebuild footer each time so the OK button always works
    const foot = document.getElementById("dialogboxfoot");
    foot.innerHTML = "";
    const okBtn = document.createElement("button");
    okBtn.className = "pure-material-button-contained active";
    okBtn.textContent = "OK";
    okBtn.onclick = () => this.ok();
    foot.appendChild(okBtn);
  };

  this.ok = function () {
    if (boxEl) boxEl.style.display = "none";
    if (overlayEl) overlayEl.style.display = "none";
  };
}

// ─── Custom Confirm (Promise-based, OK + Cancel) ─────────
function CustomConfirm() {
  let overlayEl = null;
  let boxEl = null;
  let resolver = null;

  function ensureDOM() {
    if (overlayEl && boxEl) return;

    overlayEl = document.createElement("div");
    overlayEl.id = "confirmoverlay";
    overlayEl.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9998;display:none;";

    boxEl = document.createElement("div");
    boxEl.id = "confirmbox";
    boxEl.className = "slit-in-vertical";
    boxEl.style.cssText =
      "position:fixed;top:100px;left:50%;transform:translateX(-50%);" +
      "max-width:420px;width:90%;background:var(--panel,#1e1e2a);" +
      "border:1px solid var(--border-soft,#333);border-radius:12px;" +
      "z-index:9999;padding:20px;color:var(--text,#fff);display:none;";
    boxEl.innerHTML = `
      <div>
        <div id="confirmboxhead" style="font-weight:700;font-size:16px;margin-bottom:10px;"></div>
        <div id="confirmboxbody" style="font-size:14px;margin-bottom:16px;line-height:1.5;"></div>
        <div id="confirmboxfoot" style="text-align:right;display:flex;gap:10px;justify-content:flex-end;">
          <button id="confirmCancelBtn" class="pure-material-button-contained" style="background:#444;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">Cancel</button>
          <button id="confirmOkBtn" class="pure-material-button-contained active" style="background:var(--lime,#22c55e);color:#000;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlayEl);
    document.body.appendChild(boxEl);

    document.getElementById("confirmOkBtn").onclick = () => close(true);
    document.getElementById("confirmCancelBtn").onclick = () => close(false);
    overlayEl.onclick = () => close(false);   // click outside = cancel

    // Escape key = cancel
    document.addEventListener("keydown", function escListener(e) {
      if (e.key === "Escape" && overlayEl.style.display === "block") {
        close(false);
      }
    });
  }

  function close(result) {
    if (boxEl) boxEl.style.display = "none";
    if (overlayEl) overlayEl.style.display = "none";
    const r = resolver;
    resolver = null;
    if (r) r(result);
  }

  // Returns Promise<boolean>
  this.confirm = function (message, title) {
    ensureDOM();

    const winH = window.innerHeight;
    overlayEl.style.height = winH + "px";
    overlayEl.style.display = "block";
    boxEl.style.display = "block";

    const head = document.getElementById("confirmboxhead");
    if (typeof title === "undefined" || title === null) {
      head.style.display = "none";
    } else {
      head.style.display = "block";
      head.textContent = title;
    }

    document.getElementById("confirmboxbody").innerHTML = message;

    return new Promise((resolve) => {
      resolver = resolve;
    });
  };
}

const customAlert = new CustomAlert();
const customConfirm = new CustomConfirm();

// ─── Expose on window so any script can access them ────
window.customAlert = customAlert;
window.customConfirm = customConfirm;

console.log("✅ common.js loaded — customAlert & customConfirm registered");



// const params = new URLSearchParams(location.search);

// function setRole(role) {
//   localStorage.setItem("traxenRole", role);
//   if (location.pathname.endsWith("agreements.html")) {
//     const ship = document.getElementById("grid-shipper"),
//       car = document.getElementById("grid-carrier");
//     if (ship && car) {
//       ship.style.display = role === "shipper" ? "grid" : "none";
//       car.style.display = role === "carrier" ? "grid" : "none";
//     }
//     document
//       .querySelectorAll(".rs-opt")
//       .forEach((e) => e.classList.toggle("active", e.dataset.role === role));
//     const roleEl = document.querySelector(".mini-role");
//     if (roleEl) roleEl.textContent = role === "shipper" ? "Shipper" : "Carrier";
//     const create = document.querySelector('a[href="create_agreement.html"]');
//     if (create) create.style.display = role === "shipper" ? "flex" : "none";
//   }
// }

// function openSuccess(title, message, details, next = "agreements.html") {
//   const q = new URLSearchParams({ title, message, details, next });
//   location.href = "transaction-success.html?" + q.toString();
// }

// function openError(title, message, details, code, retry = "agreements.html") {
//   const q = new URLSearchParams({ title, message, details, code, retry });
//   location.href = "transaction-error.html?" + q.toString();
// }
