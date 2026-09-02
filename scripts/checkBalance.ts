import "dotenv/config";
import { ethers } from "ethers";

async function main() {
  const rpcUrl = process.env.RPC_URL;

  const contractAddress =
    "0xa06F11A640757e937121f61D6D00250e704B68c8";

  if (!rpcUrl) {
    throw new Error("RPC_URL is missing");
  }

  const provider =
    new ethers.JsonRpcProvider(rpcUrl);

  const network = await provider.getNetwork();

  console.log("CHAIN ID:", network.chainId.toString());

  const balance =
    await provider.getBalance(contractAddress);

  console.log("CONTRACT:", contractAddress);

  console.log(
    "BALANCE (wei):",
    balance.toString()
  );

  console.log(
    "BALANCE (ETH):",
    ethers.formatEther(balance)
  );
}

main().catch(console.error);