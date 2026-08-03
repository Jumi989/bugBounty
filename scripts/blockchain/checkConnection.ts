import "dotenv/config";
import { ethers } from "ethers";

async function main(): Promise<void> {
  const rpcUrl = process.env.RPC_URL;
  const configuredChainId = process.env.CHAIN_ID;
  const registryAddress =
    process.env.PARTICIPANT_REGISTRY_ADDRESS;
  const escrowAddress =
    process.env.BUG_BOUNTY_ESCROW_ADDRESS;

  if (!rpcUrl) {
    throw new Error("RPC_URL is missing from .env");
  }

  if (!configuredChainId) {
    throw new Error("CHAIN_ID is missing from .env");
  }

  if (!registryAddress) {
    throw new Error(
      "PARTICIPANT_REGISTRY_ADDRESS is missing from .env"
    );
  }

  if (!escrowAddress) {
    throw new Error(
      "BUG_BOUNTY_ESCROW_ADDRESS is missing from .env"
    );
  }

  // Connect to the local Hardhat blockchain.
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Read the blockchain network information.
  const network = await provider.getNetwork();

  console.log("Blockchain connected successfully.");
  console.log("RPC URL:", rpcUrl);
  console.log("Detected chain ID:", network.chainId.toString());

  // Confirm that the expected chain is connected.
  if (network.chainId !== BigInt(configuredChainId)) {
    throw new Error(
      `Chain ID mismatch. Expected ${configuredChainId}, ` +
      `received ${network.chainId.toString()}`
    );
  }

  // Read the deployed bytecode at each address.
  const registryCode =
    await provider.getCode(registryAddress);

  const escrowCode =
    await provider.getCode(escrowAddress);

  if (registryCode === "0x") {
    throw new Error(
      "ParticipantRegistry is not deployed at the configured address"
    );
  }

  if (escrowCode === "0x") {
    throw new Error(
      "BugBountyEscrow is not deployed at the configured address"
    );
  }

  console.log(
    "ParticipantRegistry found:",
    registryAddress
  );

  console.log(
    "BugBountyEscrow found:",
    escrowAddress
  );

  console.log("Blockchain configuration is valid.");
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  console.error("Blockchain check failed:", message);
  process.exitCode = 1;
});