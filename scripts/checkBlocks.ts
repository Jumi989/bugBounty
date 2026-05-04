import { ethers } from "hardhat";

async function main() {
  const [company, tester] = await ethers.getSigners();

  const BugBounty = await ethers.getContractFactory("BugBounty");
  const bugBounty: any = await BugBounty.deploy();
  await bugBounty.waitForDeployment();

  console.log("Contract deployed at:", await bugBounty.getAddress());

  let blockNumber = await ethers.provider.getBlockNumber();
  console.log("Current block after deploy:", blockNumber);

  const tx1 = await bugBounty.connect(company).createBounty({
    value: ethers.parseEther("1"),
  });

  const receipt1 = await tx1.wait();
  const block1 = await ethers.provider.getBlock(receipt1!.blockNumber);
  console.log("createBounty transaction hash:", tx1.hash);
  console.log("createBounty stored in block:", receipt1?.blockNumber);
  console.log("Block hash:", block1?.hash);

  const bugHash = ethers.keccak256(
    ethers.toUtf8Bytes("SQL injection bug report")
  );
  const evidenceCID = "ipfs://example-bug-report-cid";
  const reasonHash = ethers.keccak256(
    ethers.toUtf8Bytes("Company unfairly rejected the bug")
  );

  const tx2 = await bugBounty.connect(tester).submitBug(1, bugHash, evidenceCID);
  const receipt2 = await tx2.wait();

  console.log("submitBug transaction hash:", tx2.hash);
  console.log("submitBug stored in block:", receipt2?.blockNumber);

  const bounty = await bugBounty.bounties(1);

  console.log("Stored bounty data:");
  console.log("Company:", bounty.company);
  console.log("Tester:", bounty.tester);
  console.log("Reward:", ethers.formatEther(bounty.reward), "ETH");
  console.log("Bug hash:", bounty.bugHash);
  console.log("Status:", bounty.status.toString());

  const block = await ethers.provider.getBlock(receipt2!.blockNumber);

  console.log("Block data:");
  console.log("Block number:", block?.number);
  console.log("Block hash:", block?.hash);
  console.log("Previous block hash:", block?.parentHash);
  console.log("Timestamp:", block?.timestamp);
  console.log("Transactions inside block:", block?.transactions);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});