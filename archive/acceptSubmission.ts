import { ethers } from "hardhat";

async function main() {
  // Address of the deployed BugBountyEscrow contract.
  const escrowAddress =
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  // Account #0 = contract administrator
  // Account #1 = registered company
  // Account #2 = registered tester
  const [, company, tester] = await ethers.getSigners();

  console.log("Company address:", company.address);
  console.log("Tester address:", tester.address);

  // Connect to the escrow contract using the company account.
  // Only the bounty-owning company can accept the submission.
  const escrow = await ethers.getContractAt(
    "BugBountyEscrow",
    escrowAddress,
    company
  );

  // The report previously submitted by the tester.
  const submissionId = 1;

  // Company approves the tester's requested reward.
  const approvedReward = ethers.parseEther("0.4");

  // Read the submission before accepting it.
  const submissionBefore =
    await escrow.getSubmission(submissionId);

  console.log(
    "Submission status before acceptance:",
    submissionBefore.status.toString()
  );

  console.log(
    "Requested reward:",
    ethers.formatEther(submissionBefore.requestedReward),
    "ETH"
  );

  console.log(
    "Approved reward:",
    ethers.formatEther(approvedReward),
    "ETH"
  );

  console.log("Accepting submission...");

  // Accept the submission and allocate the reward.
  const transaction = await escrow.acceptSubmission(
    submissionId,
    approvedReward
  );

  // Wait for blockchain confirmation.
  await transaction.wait();

  // Read the updated submission.
  const submissionAfter =
    await escrow.getSubmission(submissionId);

  // Read the related bounty.
  const bountyAfter =
    await escrow.getBounty(submissionAfter.bountyId);

  // Read the tester's withdrawable balance.
  const testerPendingWithdrawal =
    await escrow.pendingWithdrawals(tester.address);

  console.log("Submission accepted successfully.");

  console.log(
    "Submission status after acceptance:",
    submissionAfter.status.toString()
  );

  console.log(
    "Stored approved reward:",
    ethers.formatEther(submissionAfter.approvedReward),
    "ETH"
  );

  console.log(
    "Remaining bounty escrow:",
    ethers.formatEther(bountyAfter.availableEscrow),
    "ETH"
  );

  console.log(
    "Tester pending withdrawal:",
    ethers.formatEther(testerPendingWithdrawal),
    "ETH"
  );
}

main().catch((error) => {
  console.error("Submission acceptance failed:", error);
  process.exitCode = 1;
});