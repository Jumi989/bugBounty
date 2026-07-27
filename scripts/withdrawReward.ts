import { ethers } from "hardhat";

async function main() {
  const escrowAddress =
    "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  // Account #2 is the registered tester.
  const [, , tester] = await ethers.getSigners();

  console.log("Tester address:", tester.address);

  // Connect to the escrow contract using the tester account.
  const escrow = await ethers.getContractAt(
    "BugBountyEscrow",
    escrowAddress,
    tester
  );

  // Read the tester's pending reward before withdrawal.
  const pendingBefore = await escrow.pendingWithdrawals(
    tester.address
  );

  // Read tester wallet balance before withdrawal.
  const walletBalanceBefore = await ethers.provider.getBalance(
    tester.address
  );

  // Read escrow contract balance before withdrawal.
  const contractBalanceBefore = await ethers.provider.getBalance(
    escrowAddress
  );

  console.log(
    "Pending withdrawal before:",
    ethers.formatEther(pendingBefore),
    "ETH"
  );

  console.log(
    "Escrow contract balance before:",
    ethers.formatEther(contractBalanceBefore),
    "ETH"
  );

  console.log("Withdrawing tester reward...");

  // Tester withdraws the allocated reward.
  const transaction = await escrow.withdraw();

  // Wait for confirmation and obtain the receipt.
  const receipt = await transaction.wait();

  if (!receipt) {
    throw new Error("Withdrawal transaction was not confirmed");
  }

  // Read updated values.
  const pendingAfter = await escrow.pendingWithdrawals(
    tester.address
  );

  const walletBalanceAfter = await ethers.provider.getBalance(
    tester.address
  );

  const contractBalanceAfter = await ethers.provider.getBalance(
    escrowAddress
  );

  console.log("Reward withdrawn successfully.");

  console.log(
    "Pending withdrawal after:",
    ethers.formatEther(pendingAfter),
    "ETH"
  );

  console.log(
    "Escrow contract balance after:",
    ethers.formatEther(contractBalanceAfter),
    "ETH"
  );

  console.log(
    "Tester wallet before:",
    ethers.formatEther(walletBalanceBefore),
    "ETH"
  );

  console.log(
    "Tester wallet after:",
    ethers.formatEther(walletBalanceAfter),
    "ETH"
  );

  console.log("Transaction hash:", receipt.hash);
}

main().catch((error) => {
  console.error("Reward withdrawal failed:", error);
  process.exitCode = 1;
});