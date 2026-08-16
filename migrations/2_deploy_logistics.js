const LogisticsEscrow = artifacts.require("LogisticsEscrow");

module.exports = function (deployer) {
  deployer.deploy(LogisticsEscrow);
};
