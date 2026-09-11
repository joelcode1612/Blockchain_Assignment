require("dotenv").config();
const AuthService = require("./backend/services/authService");

(async () => {
  const wallet = "0x8cEC4cf1b95a1710fe3c26681D1BdF17a4C5e08d";

  console.log("Checking on-chain role for:", wallet);
  const role = await AuthService.getOnChainRole(wallet);
  console.log("Result:", role); // "Shipper" | "Carrier" | null

  process.exit(0);
})();
