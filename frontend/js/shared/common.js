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
