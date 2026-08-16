document.addEventListener("DOMContentLoaded", async () => {
  const walletAddress = localStorage.getItem("traxenWallet");
  const userRole = localStorage.getItem("traxenUserRole");

  if (!walletAddress) {
    alert("Please log in first.");
    window.location.href = "/login";
    return;
  }

  try {
    // Fetch user profile
    const userRes = await fetch("/api/users/me", {
      headers: { "x-wallet-address": walletAddress },
    });
    if (!userRes.ok) throw new Error("Failed to fetch profile");
    const userData = await userRes.json();

    const name =
      userData.display_name ||
      localStorage.getItem("traxenUserName") ||
      "Shipper";
    const role = userData.role || userRole || "Shipper";

    // Update UI
    document.querySelector("h1").textContent = `Welcome back, ${name} 👋`;
    document.querySelector(".mini-name").textContent = name;
    document.querySelector(".mini-role").textContent = role;
    const initials = name.substring(0, 2).toUpperCase();
    document
      .querySelectorAll(".mini-avatar")
      .forEach((el) => (el.textContent = initials));

    // Update stats (could also come from backend)
    // For now, we keep static stats, but you could fetch stats from /api/users/stats

    // Fetch agreements for the table
    const agsRes = await fetch(
      `/api/agreements?shipper_wallet=${walletAddress}`,
    );
    if (!agsRes.ok) throw new Error("Failed to fetch agreements");
    const agreements = await agsRes.json();

    // Render agreements into the table
    const tbody = document.querySelector("tbody");
    if (tbody) {
      tbody.innerHTML = agreements
        .map(
          (ag) => `
        <tr class="clickable" onclick="location.href='agreement_details_shipper.html?id=${ag.onchain_id}'">
          <td>#${ag.onchain_id} — ${ag.description || "Agreement"}</td>
          <td>${ag.carrier?.display_name || ag.carrier_wallet?.slice(0, 6) || "Unknown"}</td>
          <td>${ag.escrow_amount || "0"} ETH</td>
          <td>${ag.milestones?.filter((m) => m.status === "verified").length || 0}/${ag.milestones?.length || 0} milestones</td>
          <td>${new Date(ag.deadline).toLocaleString()}</td>
          <td><span class="pill ${ag.status === "active" ? "lime" : ag.status === "pending" ? "amber" : "gray"}"><span class="dot"></span>${ag.status || "Pending"}</span></td>
        </tr>
      `,
        )
        .join("");
    }
  } catch (error) {
    console.error("Error loading dashboard:", error);
  }
});
