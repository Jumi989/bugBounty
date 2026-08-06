import "dotenv/config";

import { ethers } from "hardhat";

import {
  AuthorizedAction,
  ParticipantRole,
  closeAuthorizationService,
  issueAuthorization,
} from "../auth/authorizationService";

async function main(): Promise<void> {
  const escrowAddress =
    process.env.BUG_BOUNTY_ESCROW_ADDRESS;

  if (!escrowAddress) {
    throw new Error(
      "BUG_BOUNTY_ESCROW_ADDRESS is missing from .env"
    );
  }

  /*
   * Hardhat local account roles:
   *
   * Account #0 = deployer
   * Account #1 = company
   * Account #2 = tester
   */
  const [, company] = await ethers.getSigners();

  const escrow = await ethers.getContractAt(
    "BugBountyEscrow",
    escrowAddress,
    company
  );

  const metadataHash = ethers.id(
    "LOCAL_INTEGRATION_BOUNTY"
  );

  const metadataCID =
    "ipfs://local-integration-bounty";

  /*
   * startTime = 0 means:
   * start the bounty immediately.
   */
  const startTime = 0n;

  const latestBlock =
    await ethers.provider.getBlock("latest");

  if (!latestBlock) {
    throw new Error(
      "Could not read the latest blockchain block"
    );
  }

  const sevenDays = 7 * 24 * 60 * 60;

  const endTime =
    BigInt(latestBlock.timestamp + sevenDays);

  const escrowAmount =
    ethers.parseEther("0.5");

  /*
   * The action hash binds the authorization to these
   * exact bounty parameters.
   */
  const actionHash =
    await escrow.hashCreateBountyAction(
      metadataHash,
      metadataCID,
      startTime,
      endTime,
      escrowAmount
    );

  /*
   * This function reads the company from PostgreSQL.
   *
   * It checks:
   * - participant exists
   * - role is Company
   * - active is true
   * - verified is true
   *
   * It then signs an EIP-712 authorization.
   */
  const issuedAuthorization =
    await issueAuthorization({
      userAddress: company.address,
      requiredRole: ParticipantRole.Company,
      action: AuthorizedAction.CreateBounty,
      actionHash,
      lifetimeSeconds: 300,
    });

  console.log(
    "Company:",
    company.address
  );

  console.log(
    "Authorization digest:",
    issuedAuthorization.digest
  );

  const transaction =
    await escrow.createBounty(
      metadataHash,
      metadataCID,
      startTime,
      endTime,
      issuedAuthorization.authorization,
      issuedAuthorization.signature,
      {
        value: escrowAmount,
      }
    );

  console.log(
    "Transaction submitted:",
    transaction.hash
  );

  const receipt = await transaction.wait();

  if (!receipt) {
    throw new Error(
      "Transaction receipt was not returned"
    );
  }

  console.log(
    "Transaction confirmed in block:",
    receipt.blockNumber
  );

  const bountyCount =
    await escrow.bountyCount();

  const bounty =
    await escrow.getBounty(bountyCount);

  console.log(
    "Created bounty ID:",
    bountyCount.toString()
  );

  console.log(
    "Bounty company:",
    bounty.company
  );

  console.log(
    "Escrow amount:",
    ethers.formatEther(
      bounty.totalEscrow
    ),
    "ETH"
  );
}

main()
  .catch((error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "Integration test failed:",
      message
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await closeAuthorizationService();
  });