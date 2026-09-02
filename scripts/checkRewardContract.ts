// scripts/checkRewardContract.ts

import "dotenv/config";
import { ethers } from "ethers";

async function main() {
  const rpcUrl = process.env.RPC_URL;
  const contractAddress =
    process.env.BUG_BOUNTY_ESCROW_ADDRESS;

  if (!rpcUrl) throw new Error("RPC_URL missing");
  if (!contractAddress) {
    throw new Error("BUG_BOUNTY_ESCROW_ADDRESS missing");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const network = await provider.getNetwork();

  console.log("CHAIN ID:", network.chainId.toString());
  console.log("CONTRACT:", contractAddress);

  const code = await provider.getCode(contractAddress);

  console.log(
    "CONTRACT CODE LENGTH:",
    code.length
  );

  if (code === "0x") {
    console.log("❌ NO CONTRACT EXISTS AT THIS ADDRESS");
    return;
  }

  console.log("✅ CONTRACT EXISTS");

  const contract = new ethers.Contract(
    contractAddress,
    [
      "function payoutNonces(uint256) view returns (uint256)",
      "function bountyCount() view returns (uint256)",
      "function getBounty(uint256) view returns (tuple(address company,bytes32 companyOrganizationId,bytes32 metadataHash,string metadataCID,uint256 totalEscrow,uint256 availableEscrow,uint64 startTime,uint64 endTime,uint64 refundAvailableAt,uint8 status))"
    ],
    provider
  );

  try {
    const nonce =
      await contract.payoutNonces(6);

    console.log(
      "✅ payoutNonces(6):",
      nonce.toString()
    );
  } catch (error) {
    console.error(
      "❌ payoutNonces(6) FAILED:",
      error
    );
  }

  try {
    const bounty =
      await contract.getBounty(6);

    console.log("✅ BOUNTY 6:");
    console.log(bounty);
  } catch (error) {
    console.error(
      "❌ getBounty(6) FAILED:",
      error
    );
  }
}

main().catch(console.error);