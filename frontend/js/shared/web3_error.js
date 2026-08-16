document.addEventListener("DOMContentLoaded", () => {
  // Read dynamic errors from URL parameters: ?code=4001&msg=User+rejected+signature
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const msg = params.get("msg");
  const title = params.get("title");

  const errorCodeEl = document.getElementById("errorCode");
  const errorMessageEl = document.getElementById("errorMessage");
  const errorTitleEl = document.getElementById("errorTitle");

  if (code && errorCodeEl) {
    errorCodeEl.innerText = `Error Code: ${code}`;
  }
  if (msg && errorMessageEl) {
    errorMessageEl.innerText = decodeURIComponent(msg);
  }
  if (title && errorTitleEl) {
    errorTitleEl.innerText = decodeURIComponent(title);
  }
});
