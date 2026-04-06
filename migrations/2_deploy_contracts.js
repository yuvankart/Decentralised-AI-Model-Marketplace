const ModelRegistry = artifacts.require("ModelRegistry");
const PaymentContract = artifacts.require("PaymentContract");
const ReputationContract = artifacts.require("ReputationContract");

module.exports = async function (deployer) {

  await deployer.deploy(ModelRegistry);
  const registry = await ModelRegistry.deployed();

  await deployer.deploy(PaymentContract, registry.address);
  await deployer.deploy(ReputationContract, registry.address);
};