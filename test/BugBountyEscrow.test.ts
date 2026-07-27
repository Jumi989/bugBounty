import { expect } from "chai";
import { ethers } from "hardhat";

describe("BugBountyEscrow", function () {
  it("should complete bounty creation, submission, acceptance, and withdrawal", async function () {
    // Hardhat provides temporary test accounts.
    const [owner, company, tester] =
      await ethers.getSigners();

    /*
     * STEP 1: Deploy ParticipantRegistry
     */

    const ParticipantRegistry =
      await ethers.getContractFactory(
        "ParticipantRegistry"
      );

    const registry =
      await ParticipantRegistry.deploy();

    await registry.waitForDeployment();

    /*
     * STEP 2: Deploy BugBountyEscrow
     */

    const registryAddress =
      await registry.getAddress();

    const BugBountyEscrow =
      await ethers.getContractFactory(
        "BugBountyEscrow"
      );

    const escrow =
      await BugBountyEscrow.deploy(
        registryAddress
      );

    await escrow.waitForDeployment();

    /*
     * STEP 3: Register company and tester
     */

    const companyOrganizationId =
      ethers.id("SOFTWARE_COMPANY_A");

    const testerOrganizationId =
      ethers.id("INDEPENDENT_TESTER_A");

    await registry.registerCompany(
      company.address,
      companyOrganizationId
    );

    await registry.registerTester(
      tester.address,
      testerOrganizationId
    );

    expect(
      await registry.isActiveCompany(company.address)
    ).to.equal(true);

    expect(
      await registry.isActiveTester(tester.address)
    ).to.equal(true);

    /*
     * STEP 4: Company creates a bounty
     */

    const metadataHash =
      ethers.id("TEST_BOUNTY_METADATA");

    const metadataCID =
      "ipfs://test-bounty-metadata-cid";

    const latestBlock =
      await ethers.provider.getBlock("latest");

    if (!latestBlock) {
      throw new Error(
        "Could not read the latest block"
      );
    }

    const sevenDays =
      7 * 24 * 60 * 60;

    const endTime =
      latestBlock.timestamp + sevenDays;

    const bountyAmount =
      ethers.parseEther("1");

    await escrow
      .connect(company)
      .createBounty(
        metadataHash,
        metadataCID,
        0,
        endTime,
        {
          value: bountyAmount
        }
      );

    expect(
      await escrow.bountyCount()
    ).to.equal(1n);

    const bountyBeforeSubmission =
      await escrow.getBounty(1);

    expect(
      bountyBeforeSubmission.company
    ).to.equal(company.address);

    expect(
      bountyBeforeSubmission.totalEscrow
    ).to.equal(bountyAmount);

    expect(
      bountyBeforeSubmission.availableEscrow
    ).to.equal(bountyAmount);

    // BountyStatus.Open = 1
    expect(
      bountyBeforeSubmission.status
    ).to.equal(1n);

    /*
     * STEP 5: Tester submits a bug
     */

    const reportHash =
      ethers.id("BROKEN_ACCESS_CONTROL_REPORT");

    const encryptedEvidenceCID =
      "ipfs://test-encrypted-evidence-cid";

    const requestedReward =
      ethers.parseEther("0.4");

    await escrow
      .connect(tester)
      .submitBug(
        1,
        reportHash,
        encryptedEvidenceCID,
        requestedReward
      );

    expect(
      await escrow.submissionCount()
    ).to.equal(1n);

    const submissionBeforeAcceptance =
      await escrow.getSubmission(1);

    expect(
      submissionBeforeAcceptance.bountyId
    ).to.equal(1n);

    expect(
      submissionBeforeAcceptance.tester
    ).to.equal(tester.address);

    expect(
      submissionBeforeAcceptance.requestedReward
    ).to.equal(requestedReward);

    // SubmissionStatus.Submitted = 1
    expect(
      submissionBeforeAcceptance.status
    ).to.equal(1n);

    expect(
      await escrow.pendingSubmissionCount(1)
    ).to.equal(1n);

    /*
     * STEP 6: Company accepts the submission
     */

    const approvedReward =
      ethers.parseEther("0.4");

    await escrow
      .connect(company)
      .acceptSubmission(
        1,
        approvedReward
      );

    const submissionAfterAcceptance =
      await escrow.getSubmission(1);

    // SubmissionStatus.Accepted = 2
    expect(
      submissionAfterAcceptance.status
    ).to.equal(2n);

    expect(
      submissionAfterAcceptance.approvedReward
    ).to.equal(approvedReward);

    expect(
      await escrow.pendingSubmissionCount(1)
    ).to.equal(0n);

    expect(
      await escrow.pendingWithdrawals(
        tester.address
      )
    ).to.equal(approvedReward);

    const bountyAfterAcceptance =
      await escrow.getBounty(1);

    expect(
      bountyAfterAcceptance.availableEscrow
    ).to.equal(
      ethers.parseEther("0.6")
    );

    /*
     * STEP 7: Tester withdraws the reward
     */

    const escrowAddress =
      await escrow.getAddress();

    await expect(
      escrow.connect(tester).withdraw()
    ).to.changeEtherBalances(
      [escrowAddress, tester],
      [-approvedReward, approvedReward]
    );

    expect(
      await escrow.pendingWithdrawals(
        tester.address
      )
    ).to.equal(0n);

    expect(
      await ethers.provider.getBalance(
        escrowAddress
      )
    ).to.equal(
      ethers.parseEther("0.6")
    );
  });
  it("should reject bounty creation by an unregistered account", async function () {
  // owner = registry administrator
  // unregisteredUser = not registered as a company
  const [owner, unregisteredUser] =
    await ethers.getSigners();

  /*
   * Deploy ParticipantRegistry
   */

  const ParticipantRegistry =
    await ethers.getContractFactory(
      "ParticipantRegistry"
    );

  const registry =
    await ParticipantRegistry.deploy();

  await registry.waitForDeployment();

  /*
   * Deploy BugBountyEscrow
   */

  const BugBountyEscrow =
    await ethers.getContractFactory(
      "BugBountyEscrow"
    );

  const escrow =
    await BugBountyEscrow.deploy(
      await registry.getAddress()
    );

  await escrow.waitForDeployment();

  /*
   * Prepare valid bounty data
   */

  const metadataHash =
    ethers.id("UNREGISTERED_BOUNTY_TEST");

  const metadataCID =
    "ipfs://unregistered-bounty-test";

  const latestBlock =
    await ethers.provider.getBlock("latest");

  if (!latestBlock) {
    throw new Error(
      "Could not read latest block"
    );
  }

  const endTime =
    latestBlock.timestamp + 7 * 24 * 60 * 60;

  /*
   * The account is not registered as a company,
   * so createBounty must revert.
   */

  await expect(
    escrow
      .connect(unregisteredUser)
      .createBounty(
        metadataHash,
        metadataCID,
        0,
        endTime,
        {
          value: ethers.parseEther("1")
        }
      )
  ).to.be.revertedWithCustomError(
    escrow,
    "NotRegisteredCompany"
  );

  /*
   * Because the transaction failed,
   * no bounty should have been created.
   */

  expect(
    await escrow.bountyCount()
  ).to.equal(0n);
});
it("should reject bug submission by an unregistered tester", async function () {
  const [owner, company, unregisteredTester] =
    await ethers.getSigners();

  // Deploy ParticipantRegistry.
  const ParticipantRegistry =
    await ethers.getContractFactory(
      "ParticipantRegistry"
    );

  const registry =
    await ParticipantRegistry.deploy();

  await registry.waitForDeployment();

  // Deploy BugBountyEscrow.
  const BugBountyEscrow =
    await ethers.getContractFactory(
      "BugBountyEscrow"
    );

  const escrow =
    await BugBountyEscrow.deploy(
      await registry.getAddress()
    );

  await escrow.waitForDeployment();

  // Register only the company.
  await registry.registerCompany(
    company.address,
    ethers.id("SOFTWARE_COMPANY_A")
  );

  // Prepare bounty dates.
  const latestBlock =
    await ethers.provider.getBlock("latest");

  if (!latestBlock) {
    throw new Error(
      "Could not read the latest block"
    );
  }

  const endTime =
    latestBlock.timestamp + 7 * 24 * 60 * 60;

  // Registered company creates bounty ID 1.
  await escrow
    .connect(company)
    .createBounty(
      ethers.id("TEST_BOUNTY"),
      "ipfs://test-bounty-cid",
      0,
      endTime,
      {
        value: ethers.parseEther("1")
      }
    );

  // This account was never registered as a tester.
  await expect(
    escrow
      .connect(unregisteredTester)
      .submitBug(
        1,
        ethers.id("TEST_BUG_REPORT"),
        "ipfs://encrypted-evidence-cid",
        ethers.parseEther("0.4")
      )
  ).to.be.revertedWithCustomError(
    escrow,
    "NotRegisteredTester"
  );

  // No submission should be created.
  expect(
    await escrow.submissionCount()
  ).to.equal(0n);
});
it("should prevent an unauthorized account from accepting a submission", async function () {
  const [owner, company, tester, unauthorizedAccount] =
    await ethers.getSigners();

  /*
   * Deploy ParticipantRegistry
   */

  const ParticipantRegistry =
    await ethers.getContractFactory(
      "ParticipantRegistry"
    );

  const registry =
    await ParticipantRegistry.deploy();

  await registry.waitForDeployment();

  /*
   * Deploy BugBountyEscrow
   */

  const BugBountyEscrow =
    await ethers.getContractFactory(
      "BugBountyEscrow"
    );

  const escrow =
    await BugBountyEscrow.deploy(
      await registry.getAddress()
    );

  await escrow.waitForDeployment();

  /*
   * Register company and tester
   */

  await registry.registerCompany(
    company.address,
    ethers.id("SOFTWARE_COMPANY_A")
  );

  await registry.registerTester(
    tester.address,
    ethers.id("TESTER_ORGANIZATION_A")
  );

  /*
   * Company creates bounty
   */

  const latestBlock =
    await ethers.provider.getBlock("latest");

  if (!latestBlock) {
    throw new Error(
      "Could not read the latest block"
    );
  }

  const endTime =
    latestBlock.timestamp + 7 * 24 * 60 * 60;

  await escrow
    .connect(company)
    .createBounty(
      ethers.id("BOUNTY_METADATA"),
      "ipfs://bounty-metadata-cid",
      0,
      endTime,
      {
        value: ethers.parseEther("1")
      }
    );

  /*
   * Tester submits a report
   */

  await escrow
    .connect(tester)
    .submitBug(
      1,
      ethers.id("BUG_REPORT"),
      "ipfs://encrypted-evidence-cid",
      ethers.parseEther("0.4")
    );

  /*
   * Unauthorized account tries to accept it
   */

  await expect(
    escrow
      .connect(unauthorizedAccount)
      .acceptSubmission(
        1,
        ethers.parseEther("0.4")
      )
  ).to.be.revertedWithCustomError(
    escrow,
    "NotBountyCompany"
  );

  /*
   * Confirm nothing changed
   */

  const submission =
    await escrow.getSubmission(1);

  const bounty =
    await escrow.getBounty(1);

  // SubmissionStatus.Submitted = 1
  expect(submission.status).to.equal(1n);

  // Full escrow must remain available.
  expect(
    bounty.availableEscrow
  ).to.equal(
    ethers.parseEther("1")
  );

  // Tester must not receive a withdrawal balance.
  expect(
    await escrow.pendingWithdrawals(
      tester.address
    )
  ).to.equal(0n);
});
});