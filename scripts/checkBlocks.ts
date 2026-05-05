import { ethers } from "hardhat";

async function main() {
  const [company, tester1, tester2, tester3] = await ethers.getSigners();

  const BugBounty = await ethers.getContractFactory("BugBounty");
  const bugBounty: any = await BugBounty.deploy();
  await bugBounty.waitForDeployment();

  console.log("\n=== CONTRACT DEPLOYED ===");
  console.log("Contract deployed at:", await bugBounty.getAddress());

  const deployBlockNumber = await ethers.provider.getBlockNumber();
  console.log("Current block after deploy:", deployBlockNumber);

  // Create bounty for 60 seconds
  const durationInSeconds = 60;

  const tx1 = await bugBounty.connect(company).createBounty(durationInSeconds, {
    value: ethers.parseEther("10"),
  });

  const receipt1 = await tx1.wait();
  const block1 = await ethers.provider.getBlock(receipt1!.blockNumber);

  console.log("\n=== COMPANY CREATES BOUNTY ===");
  console.log("createBounty transaction hash:", tx1.hash);
  console.log("createBounty stored in block:", receipt1?.blockNumber);
  console.log("Block hash:", block1?.hash);
  console.log("Previous block hash:", block1?.parentHash);

  // Tester 1 submits bug
  const bugHash1 = ethers.keccak256(
    ethers.toUtf8Bytes("SQL injection bug report")
  );
  const evidenceCID1 = "ipfs://example-bug-report-cid-1";

  const tx2 = await bugBounty
    .connect(tester1)
    .submitBug(1, bugHash1, evidenceCID1);

  const receipt2 = await tx2.wait();
  const block2 = await ethers.provider.getBlock(receipt2!.blockNumber);

  console.log("\n=== TESTER 1 SUBMITS BUG ===");
  console.log("submitBug transaction hash:", tx2.hash);
  console.log("submitBug stored in block:", receipt2?.blockNumber);
  console.log("Block hash:", block2?.hash);
  console.log("Previous block hash:", block2?.parentHash);

  // Tester 2 submits bug
  const bugHash2 = ethers.keccak256(
    ethers.toUtf8Bytes("XSS bug report")
  );
  const evidenceCID2 = "ipfs://example-bug-report-cid-2";

  const tx3 = await bugBounty
    .connect(tester2)
    .submitBug(1, bugHash2, evidenceCID2);

  const receipt3 = await tx3.wait();
  const block3 = await ethers.provider.getBlock(receipt3!.blockNumber);

  console.log("\n=== TESTER 2 SUBMITS BUG ===");
  console.log("submitBug transaction hash:", tx3.hash);
  console.log("submitBug stored in block:", receipt3?.blockNumber);
  console.log("Block hash:", block3?.hash);
  console.log("Previous block hash:", block3?.parentHash);

  // Tester 3 submits bug
  const bugHash3 = ethers.keccak256(
    ethers.toUtf8Bytes("Authentication bypass bug report")
  );
  const evidenceCID3 = "ipfs://example-bug-report-cid-3";

  const tx4 = await bugBounty
    .connect(tester3)
    .submitBug(1, bugHash3, evidenceCID3);

  const receipt4 = await tx4.wait();
  const block4 = await ethers.provider.getBlock(receipt4!.blockNumber);

  console.log("\n=== TESTER 3 SUBMITS BUG ===");
  console.log("submitBug transaction hash:", tx4.hash);
  console.log("submitBug stored in block:", receipt4?.blockNumber);
  console.log("Block hash:", block4?.hash);
  console.log("Previous block hash:", block4?.parentHash);

  // Read bounty data
  const bounty = await bugBounty.bounties(1);

  console.log("\n=== STORED BOUNTY DATA ===");
  console.log("Company:", bounty.company);
  console.log("Original reward:", ethers.formatEther(bounty.reward), "ETH");
  console.log(
    "Remaining reward:",
    ethers.formatEther(bounty.remainingReward),
    "ETH"
  );
  console.log("Deadline timestamp:", bounty.deadline.toString());
  console.log("Closed:", bounty.closed);

  // Read submission IDs for bounty 1
  const submissionIds = await bugBounty.getBountySubmissions(1);

  console.log("\n=== SUBMISSION IDS FOR BOUNTY 1 ===");
  console.log(submissionIds.map((id: bigint) => id.toString()));

  // Read each submission data
  console.log("\n=== STORED SUBMISSION DATA ===");

  for (const id of submissionIds) {
    const submission = await bugBounty.submissions(id);

    console.log(`\nSubmission ID: ${id.toString()}`);
    console.log("Bounty ID:", submission.bountyId.toString());
    console.log("Tester:", submission.tester);
    console.log("Bug hash:", submission.bugHash);
    console.log("Evidence CID:", submission.evidenceCID);
    console.log("Status:", submission.status.toString());
    console.log("Reward paid:", ethers.formatEther(submission.rewardPaid), "ETH");
  }

  // Show block details for the last submission block
  const lastBlock = await ethers.provider.getBlock(receipt4!.blockNumber);

  console.log("\n=== LAST SUBMISSION BLOCK DATA ===");
  console.log("Block number:", lastBlock?.number);
  console.log("Block hash:", lastBlock?.hash);
  console.log("Previous block hash:", lastBlock?.parentHash);
  console.log("Timestamp:", lastBlock?.timestamp);
  console.log("Transactions inside block:", lastBlock?.transactions);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});