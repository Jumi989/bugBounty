import "dotenv/config";
import { ethers } from "hardhat";

async function main() {
  // ParticipantRegistry address deployed on the current localhost network.
const registryAddress =
  process.env.PARTICIPANT_REGISTRY_ADDRESS;

if (!registryAddress) {
  throw new Error(
    "PARTICIPANT_REGISTRY_ADDRESS is missing from .env"
  );
}

  // Gets the first Hardhat account.
  const [deployer] = await ethers.getSigners();

  console.log("Deploying BugBountyEscrow...");
  console.log("Deployer address:", deployer.address);
  console.log("ParticipantRegistry address:", registryAddress);

  // Loads the compiled BugBountyEscrow contract.
  const BugBountyEscrow = await ethers.getContractFactory(
    "BugBountyEscrow"
  );

  // Deploys the escrow and passes the registry address
  // into its constructor.
  const bugBountyEscrow = await BugBountyEscrow.deploy(
    registryAddress
  );

  // Waits for the deployment transaction to finish.
  await bugBountyEscrow.waitForDeployment();

  // Reads the deployed escrow address.
  const escrowAddress =
    await bugBountyEscrow.getAddress();

  console.log("BugBountyEscrow deployed successfully.");
  console.log("BugBountyEscrow address:", escrowAddress);

  // Verifies that the escrow saved the correct registry.
  const connectedRegistry =
    await bugBountyEscrow.participantRegistry();

  console.log(
    "Connected ParticipantRegistry:",
    connectedRegistry
  );
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});