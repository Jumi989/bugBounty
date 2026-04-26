import { ethers } from "hardhat";

async function main() {
  const BugBounty = await ethers.getContractFactory("BugBounty");
  const bugBounty = await BugBounty.deploy();

  await bugBounty.waitForDeployment();

  console.log("BugBounty deployed to:", await bugBounty.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});