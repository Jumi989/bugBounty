import "dotenv/config";
import { ethers } from "hardhat";

async function main(): Promise<void> {
  const privateKey =
    process.env.AUTHORIZER_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error(
      "AUTHORIZER_PRIVATE_KEY is missing from .env"
    );
  }

  const verifierWallet =
    new ethers.Wallet(privateKey);

  const [deployer] = await ethers.getSigners();

  console.log("Deploying BugBountyEscrow...");
  console.log("Deployer:", deployer.address);
  console.log(
    "Trusted verifier:",
    verifierWallet.address
  );

  const Factory =
    await ethers.getContractFactory(
      "BugBountyEscrow"
    );

  const escrow =
    await Factory.deploy(verifierWallet.address);

  await escrow.waitForDeployment();

  const escrowAddress =
    await escrow.getAddress();

  console.log(
    "BugBountyEscrow deployed:",
    escrowAddress
  );

  console.log(
    "Configured verifier:",
    await escrow.trustedVerifier()
  );

  console.log(
    "\nUpdate BUG_BOUNTY_ESCROW_ADDRESS in .env."
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
