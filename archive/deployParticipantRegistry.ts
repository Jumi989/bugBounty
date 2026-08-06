import { ethers } from "hardhat";

async function main() {
  // Gets the first wallet provided by the selected network.
  const [deployer] = await ethers.getSigners();

  console.log("Deploying ParticipantRegistry...");
  console.log("Deployer address:", deployer.address);

  // Loads the compiled ParticipantRegistry contract.
  const ParticipantRegistry = await ethers.getContractFactory(
    "ParticipantRegistry"
  );

  // Sends the deployment transaction.
  // ParticipantRegistry has no constructor arguments.
  const participantRegistry = await ParticipantRegistry.deploy();

  // Waits until the deployment transaction is confirmed.
  await participantRegistry.waitForDeployment();

  // Gets the deployed contract address.
  const registryAddress = await participantRegistry.getAddress();

  console.log("ParticipantRegistry deployed successfully.");
  console.log("ParticipantRegistry address:", registryAddress);

  // Confirms that the deployer became the registry owner.
  const owner = await participantRegistry.owner();

  console.log("Registry owner:", owner);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});