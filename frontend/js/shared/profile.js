/**
 * profile.js - Shared logic for both Carrier and Shipper profiles
 */

function toggleEdit() {
  document.getElementById("editForm").classList.toggle("open");
}

function saveProfile() {
  const nameInput = document.getElementById("nameInput").value || "User Name";
  const emailInput =
    document.getElementById("emailInput").value || "user@example.com";

  // Update the UI elements
  document.getElementById("nameValue").textContent = nameInput;
  document.getElementById("emailValue").textContent = emailInput;
  document.querySelector(".profile-name").textContent = nameInput;
  document.querySelector(".mini-name").textContent = nameInput;

  // Close the form
  document.getElementById("editForm").classList.remove("open");
}

// Accept the wallet address as a parameter so it works for any user
function copyWallet(walletAddress) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(walletAddress);
    alert("Wallet address copied: " + walletAddress);
  }
}
