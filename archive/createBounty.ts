import { ethers } from "hardhat";

async function main() {
  // Address of the deployed BugBountyEscrow contract.
  const escrowAddress =
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  // Account #0 is the administrator.
  // Account #1 is the registered software company.
  const [, company] = await ethers.getSigners();

  console.log("Company address:", company.address);

  // Connect to the deployed escrow using the company account.
  const escrow = await ethers.getContractAt(
    "BugBountyEscrow",
    escrowAddress,
    company
  );

  // Example bounty information that would normally be stored
  // in IPFS, Pinata, or another off-chain storage system.
  const bountyMetadata = JSON.stringify({
    title: "Web Application Security Bounty",
    description: "Find vulnerabilities in the test application",
    scope: ["Authentication", "API", "Access Control"],
    severity: ["Low", "Medium", "High", "Critical"]
  });

  // Creates a cryptographic hash of the bounty metadata.
  const metadataHash = ethers.keccak256(
    ethers.toUtf8Bytes(bountyMetadata)
  );

  // Temporary test CID.
  // Later, this will be replaced by the real Pinata IPFS CID.
  const metadataCID = "ipfs://test-bounty-metadata-cid";

  // Zero means the bounty starts immediately.
  const startTime = 0;

  // Read the latest blockchain timestamp.
  const latestBlock = await ethers.provider.getBlock("latest");

  if (!latestBlock) {
    throw new Error("Could not read the latest block");
  }

  // The bounty will remain open for seven days.
  const sevenDaysInSeconds = 7 * 24 * 60 * 60;
  const endTime = latestBlock.timestamp + sevenDaysInSeconds;

  // The company will lock 1 ETH inside the escrow contract.
  const escrowAmount = ethers.parseEther("1");

  console.log("Creating bounty...");
  console.log("Metadata hash:", metadataHash);
  console.log("Metadata CID:", metadataCID);
  console.log("Escrow amount:", ethers.formatEther(escrowAmount), "ETH");

  // Calls createBounty and sends 1 ETH with the transaction.
  const transaction = await escrow.createBounty(
    metadataHash,
    metadataCID,
    startTime,
    endTime,
    {
      value: escrowAmount
    }
  );

  // Wait for the blockchain to confirm the transaction.
  await transaction.wait();

  // Read the newly generated bounty ID.
  const bountyId = await escrow.bountyCount();

  // Read the stored bounty information.
  const bounty = await escrow.getBounty(bountyId);

  console.log("Bounty created successfully.");
  console.log("Bounty ID:", bountyId.toString());
  console.log("Company:", bounty.company);
  console.log(
    "Total escrow:",
    ethers.formatEther(bounty.totalEscrow),
    "ETH"
  );
  console.log(
    "Available escrow:",
    ethers.formatEther(bounty.availableEscrow),
    "ETH"
  );
  console.log("Bounty status:", bounty.status.toString());
}

main().catch((error) => {
  console.error("Bounty creation failed:", error);
  process.exitCode = 1;
});