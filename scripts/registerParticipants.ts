import { ethers } from "hardhat";

async function main() {
  const registryAddress =
    "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  // Account #0 is the ParticipantRegistry owner.
  // Account #1 will represent a software company.
  // Account #2 will represent a security tester.
  const [owner, company, tester] =
    await ethers.getSigners();

  console.log("Registry owner:", owner.address);
  console.log("Company account:", company.address);
  console.log("Tester account:", tester.address);

  // Connects to the already-deployed registry.
  const registry = await ethers.getContractAt(
    "ParticipantRegistry",
    registryAddress,
    owner
  );

  // Creates fixed bytes32 organization identifiers.
  const companyOrganizationId = ethers.id(
    "SOFTWARE_COMPANY_A"
  );

  const testerOrganizationId = ethers.id(
    "INDEPENDENT_TESTER_A"
  );

  console.log("Registering company...");

  const companyTransaction =
    await registry.registerCompany(
      company.address,
      companyOrganizationId
    );

  await companyTransaction.wait();

  console.log("Company registered successfully.");

  console.log("Registering tester...");

  const testerTransaction =
    await registry.registerTester(
      tester.address,
      testerOrganizationId
    );

  await testerTransaction.wait();

  console.log("Tester registered successfully.");

  // Verify both registrations.
  const companyIsActive =
    await registry.isActiveCompany(company.address);

  const testerIsActive =
    await registry.isActiveTester(tester.address);

  const totalParticipants =
    await registry.totalParticipants();

  console.log("Company active:", companyIsActive);
  console.log("Tester active:", testerIsActive);
  console.log(
    "Total participants:",
    totalParticipants.toString()
  );
}

main().catch((error) => {
  console.error("Registration failed:", error);
  process.exitCode = 1;
});