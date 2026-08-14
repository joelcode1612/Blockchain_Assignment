function openAgreement(role, id) {

  if (role === "shipper")
    location.href =
      "agreement-details-shipper.html?id=" + encodeURIComponent(id);
  else
    location.href =
      "agreement-details-carrier.html?id=" + encodeURIComponent(id);
}
(function () {
  const saved = localStorage.getItem("traxenRole");
  if (saved) setRole(saved);
})();
