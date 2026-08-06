import { ethers } from "hardhat";

async function main() {
  // Address of the deployed BugBountyEscrow contract.
  const escrowAddress =
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  // Account #0 = owner
  // Account #1 = registered company
  // Account #2 = registered tester
  const [, , tester] = await ethers.getSigners();

  console.log("Tester address:", tester.address);

  // Connect to the escrow contract using the tester account.
  const escrow = await ethers.getContractAt(
    "BugBountyEscrow",
    escrowAddress,
    tester
  );

  // The tester is submitting to bounty ID 1.
  const bountyId = 1;

  // Example vulnerability report.
  // In the real application, this complete report will remain off-chain.
  const bugReport = JSON.stringify({
    title: "Broken Access Control",
    severity: "High",
    affectedEndpoint: "/api/admin/users",
    description:
      "A normal user can access administrator user information.",
    reproductionSteps: [
      "Login using a normal user account",
      "Send a GET request to /api/admin/users",
      "Observe that administrator data is returned"
    ]
  });

  // Create a fixed cryptographic hash of the report.
  const reportHash = ethers.keccak256(
    ethers.toUtf8Bytes(bugReport)
  );

  // Temporary encrypted evidence CID.
  // Later, replace this with the real encrypted Pinata/IPFS CID.
  const encryptedEvidenceCID =
    "ipfs://test-encrypted-bug-evidence-cid";

  // The tester requests 0.4 ETH.
  const requestedReward = ethers.parseEther("0.4");

  console.log("Submitting bug report...");
  console.log("Bounty ID:", bountyId);
  console.log("Report hash:", reportHash);
  console.log("Evidence CID:", encryptedEvidenceCID);
  console.log(
    "Requested reward:",
    ethers.formatEther(requestedReward),
    "ETH"
  );

  // Send the bug submission transaction.
  const transaction = await escrow.submitBug(
    bountyId,
    reportHash,
    encryptedEvidenceCID,
    requestedReward
  );

  // Wait for confirmation.
  await transaction.wait();

  // Read the newly created submission ID.
  const submissionId = await escrow.submissionCount();

  // Read the complete submission from the contract.
  const submission =
    await escrow.getSubmission(submissionId);

  console.log("Bug submitted successfully.");
  console.log(
    "Submission ID:",
    submissionId.toString()
  );
  console.log(
    "Related bounty ID:",
    submission.bountyId.toString()
  );
  console.log("Tester:", submission.tester);
  console.log(
    "Requested reward:",
    ethers.formatEther(submission.requestedReward),
    "ETH"
  );
  console.log(
    "Submission status:",
    submission.status.toString()
  );
}

main().catch((error) => {
  console.error("Bug submission failed:", error);
  process.exitCode = 1;
});