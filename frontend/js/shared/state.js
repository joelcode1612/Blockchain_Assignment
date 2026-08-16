document.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);

  // --- Success block ---
  const successTitleEl = document.getElementById("successTitle");
  const successMsgEl = document.getElementById("successMessage");
  const successDetailsEl = document.getElementById("successDetails");
  const successBtnEl = document.getElementById("successPrimaryBtn");

  if (successTitleEl) {
    successTitleEl.textContent = params.get("title") || "Success";
  }
  if (successMsgEl) {
    successMsgEl.textContent =
      params.get("message") || "Your action completed successfully.";
  }
  if (successDetailsEl) {
    const details = params.get("details") || "";
    successDetailsEl.innerHTML = details;
    successDetailsEl.style.display = details ? "block" : "none";
  }
  if (successBtnEl) {
    successBtnEl.href = params.get("next") || "agreements.html";
  }

  // --- Error block ---
  const errorTitleEl = document.getElementById("errorTitle");
  const errorMsgEl = document.getElementById("errorMessage");
  const errorDetailsEl = document.getElementById("errorDetails");
  const errorCodeEl = document.getElementById("errorCode");
  const errorBtnEl = document.getElementById("errorRetryBtn");

  if (errorTitleEl) {
    errorTitleEl.textContent = params.get("title") || "Something went wrong";
  }
  if (errorMsgEl) {
    errorMsgEl.textContent =
      params.get("message") || "Your transaction could not be completed.";
  }
  if (errorDetailsEl) {
    const details = params.get("details") || "";
    errorDetailsEl.innerHTML = details;
    errorDetailsEl.style.display = details ? "block" : "none";
  }
  if (errorCodeEl) {
    errorCodeEl.textContent =
      "Error Code: " + (params.get("code") || "TX_REVERTED");
  }
  if (errorBtnEl) {
    errorBtnEl.href = params.get("retry") || "agreements.html";
  }
});
