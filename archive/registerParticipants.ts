import "dotenv/config";
import { ethers } from "hardhat";

async function main(): Promise<void> {
  /*
   * Read the registry address from .env.
   */
  const registryAddress =
    process.env.PARTICIPANT_REGISTRY_ADDRESS;

  if (!registryAddress) {
    throw new Error(
      "PARTICIPANT_REGISTRY_ADDRESS is missing from .env"
    );
  }

  /*
   * Check whether the value is a valid Ethereum address.
   */
  if (!ethers.isAddress(registryAddress)) {
    throw new Error(
      "PARTICIPANT_REGISTRY_ADDRESS is not a valid address"
    );
  }

  /*
   * Confirm that deployed contract bytecode exists there.
   */
  const contractCode =
    await ethers.provider.getCode(registryAddress);

  if (contractCode === "0x") {
    throw new Error(
      `No contract is deployed at ${registryAddress}`
    );
  }

  /*
   * Account #0 = registry owner
   * Account #1 = company
   * Account #2 = tester
   */
  const [owner, company, tester] =
    await ethers.getSigners();

  console.log("Registry address:", registryAddress);
  console.log("Registry owner:", owner.address);
  console.log("Company account:", company.address);
  console.log("Tester account:", tester.address);

  /*
   * Connect to the deployed registry using the owner signer.
   */
  const registry = await ethers.getContractAt(
    "ParticipantRegistry",
    registryAddress,
    owner
  );

  /*
   * Confirm that Account #0 really owns this contract.
   */
  const contractOwner = await registry.owner();

  if (
    contractOwner.toLowerCase() !==
    owner.address.toLowerCase()
  ) {
    throw new Error(
      "The selected signer is not the registry owner"
    );
  }

  const companyOrganizationId =
    ethers.id("SOFTWARE_COMPANY_A");

  const testerOrganizationId =
    ethers.id("INDEPENDENT_TESTER_A");

  /*
   * Register the company.
   */
  console.log("Registering company...");

  const companyTransaction =
    await registry.registerCompany(
      company.address,
      companyOrganizationId
    );

  await companyTransaction.wait();

  console.log("Company registered successfully.");

  /*
   * Register the tester.
   */
  console.log("Registering tester...");

  const testerTransaction =
    await registry.registerTester(
      tester.address,
      testerOrganizationId
    );

  await testerTransaction.wait();

  console.log("Tester registered successfully.");

  /*
   * Verify the stored blockchain state.
   */
  const companyIsActive =
    await registry.isActiveCompany(
      company.address
    );

  const testerIsActive =
    await registry.isActiveTester(
      tester.address
    );

  const totalParticipants =
    await registry.totalParticipants();

  console.log("Company active:", companyIsActive);
  console.log("Tester active:", testerIsActive);
  console.log(
    "Total participants:",
    totalParticipants.toString()
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  console.error("Registration failed:", message);
  process.exitCode = 1;
});