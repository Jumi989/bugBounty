import { expect } from "chai";
import { ethers } from "hardhat";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

const ONE_ETH = ethers.parseEther("1");
const FOUR_TENTHS_ETH = ethers.parseEther("0.4");
const EIGHT_TENTHS_ETH = ethers.parseEther("0.8");
const ONE_WEEK = 7 * 24 * 60 * 60;
const THREE_DAYS = 3 * 24 * 60 * 60;

// BountyStatus enum values
const BOUNTY_OPEN = 1n;
const BOUNTY_CLOSED = 2n;
const BOUNTY_CANCELLED = 3n;

// SubmissionStatus enum values
const SUBMISSION_SUBMITTED = 1n;
const SUBMISSION_ACCEPTED = 2n;
const SUBMISSION_REJECTED = 3n;

describe("BugBountyEscrow", function () {
  async function deploySystemFixture() {
    const [
      owner,
      company,
      tester,
      secondTester,
      outsider,
      newOwner,
    ] = await ethers.getSigners();

    const ParticipantRegistry = await ethers.getContractFactory(
      "ParticipantRegistry"
    );
    const registry = await ParticipantRegistry.deploy();
    await registry.waitForDeployment();

    const BugBountyEscrow = await ethers.getContractFactory(
      "BugBountyEscrow"
    );
    const escrow = await BugBountyEscrow.deploy(
      await registry.getAddress()
    );
    await escrow.waitForDeployment();

    await registry.registerCompany(
      company.address,
      ethers.id("SOFTWARE_COMPANY_A")
    );
    await registry.registerTester(
      tester.address,
      ethers.id("TESTER_ORGANIZATION_A")
    );
    await registry.registerTester(
      secondTester.address,
      ethers.id("TESTER_ORGANIZATION_B")
    );

    return {
      registry,
      escrow,
      owner,
      company,
      tester,
      secondTester,
      outsider,
      newOwner,
      metadataHash: ethers.id("BOUNTY_METADATA"),
      metadataCID: "ipfs://bounty-metadata-cid",
      reportHash: ethers.id("BUG_REPORT_A"),
      evidenceCID: "ipfs://encrypted-evidence-cid",
    };
  }

  async function createOpenBounty(
    context: Awaited<ReturnType<typeof deploySystemFixture>>,
    options: {
      companySigner?: typeof context.company;
      metadataHash?: string;
      metadataCID?: string;
      startTime?: number;
      endTime?: number;
      value?: bigint;
    } = {}
  ) {
    const now = await time.latest();
    const companySigner = options.companySigner ?? context.company;
    const metadataHash = options.metadataHash ?? context.metadataHash;
    const metadataCID = options.metadataCID ?? context.metadataCID;
    const startTime = options.startTime ?? 0;
    const endTime = options.endTime ?? now + ONE_WEEK;
    const value = options.value ?? ONE_ETH;

    const transaction = await context.escrow
      .connect(companySigner)
      .createBounty(metadataHash, metadataCID, startTime, endTime, {
        value,
      });

    await transaction.wait();

    return {
      bountyId: await context.escrow.bountyCount(),
      metadataHash,
      metadataCID,
      startTime,
      endTime,
      value,
    };
  }

  async function submitReport(
    context: Awaited<ReturnType<typeof deploySystemFixture>>,
    options: {
      testerSigner?: typeof context.tester;
      bountyId?: bigint;
      reportHash?: string;
      evidenceCID?: string;
      requestedReward?: bigint;
    } = {}
  ) {
    const testerSigner = options.testerSigner ?? context.tester;
    const bountyId = options.bountyId ?? 1n;
    const reportHash = options.reportHash ?? context.reportHash;
    const evidenceCID = options.evidenceCID ?? context.evidenceCID;
    const requestedReward = options.requestedReward ?? FOUR_TENTHS_ETH;

    const transaction = await context.escrow
      .connect(testerSigner)
      .submitBug(bountyId, reportHash, evidenceCID, requestedReward);

    await transaction.wait();

    return {
      submissionId: await context.escrow.submissionCount(),
      bountyId,
      reportHash,
      evidenceCID,
      requestedReward,
    };
  }

  describe("Deployment", function () {
    it("stores the owner and registry address", async function () {
      const { escrow, registry, owner } = await loadFixture(
        deploySystemFixture
      );

      expect(await escrow.owner()).to.equal(owner.address);
      expect(await escrow.participantRegistry()).to.equal(
        await registry.getAddress()
      );
      expect(await escrow.paused()).to.equal(false);
      expect(await escrow.DISPUTE_WINDOW()).to.equal(BigInt(THREE_DAYS));
    });

    it("rejects the zero registry address", async function () {
      const BugBountyEscrow = await ethers.getContractFactory(
        "BugBountyEscrow"
      );

      await expect(
        BugBountyEscrow.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(BugBountyEscrow, "ZeroAddress");
    });

    it("rejects an externally owned account as registry", async function () {
      const [owner] = await ethers.getSigners();
      const BugBountyEscrow = await ethers.getContractFactory(
        "BugBountyEscrow"
      );

      await expect(
        BugBountyEscrow.deploy(owner.address)
      ).to.be.revertedWithCustomError(
        BugBountyEscrow,
        "InvalidRegistryContract"
      );
    });
  });

  describe("Ownership and emergency pause", function () {
    it("allows the owner to transfer ownership", async function () {
      const { escrow, owner, newOwner } = await loadFixture(
        deploySystemFixture
      );

      await expect(escrow.transferOwnership(newOwner.address))
        .to.emit(escrow, "OwnershipTransferred")
        .withArgs(owner.address, newOwner.address);

      expect(await escrow.owner()).to.equal(newOwner.address);
    });

    it("rejects ownership transfer by a non-owner", async function () {
      const { escrow, outsider, newOwner } = await loadFixture(
        deploySystemFixture
      );

      await expect(
        escrow.connect(outsider).transferOwnership(newOwner.address)
      ).to.be.revertedWithCustomError(escrow, "OnlyOwner");
    });

    it("rejects ownership transfer to the zero address", async function () {
      const { escrow } = await loadFixture(deploySystemFixture);

      await expect(
        escrow.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(escrow, "ZeroAddress");
    });

    it("allows the owner to pause and unpause", async function () {
      const { escrow, owner } = await loadFixture(deploySystemFixture);

      await expect(escrow.pause())
        .to.emit(escrow, "ContractPausedBy")
        .withArgs(owner.address);
      expect(await escrow.paused()).to.equal(true);

      await expect(escrow.unpause())
        .to.emit(escrow, "ContractUnpausedBy")
        .withArgs(owner.address);
      expect(await escrow.paused()).to.equal(false);
    });

    it("rejects pause and unpause by a non-owner", async function () {
      const { escrow, outsider } = await loadFixture(deploySystemFixture);

      await expect(
        escrow.connect(outsider).pause()
      ).to.be.revertedWithCustomError(escrow, "OnlyOwner");

      await escrow.pause();

      await expect(
        escrow.connect(outsider).unpause()
      ).to.be.revertedWithCustomError(escrow, "OnlyOwner");
    });

    it("rejects pausing twice and unpausing when not paused", async function () {
      const { escrow } = await loadFixture(deploySystemFixture);

      await expect(escrow.unpause()).to.be.revertedWithCustomError(
        escrow,
        "ContractNotPaused"
      );

      await escrow.pause();

      await expect(escrow.pause()).to.be.revertedWithCustomError(
        escrow,
        "ContractPaused"
      );
    });

    it("blocks bounty creation while paused", async function () {
      const context = await loadFixture(deploySystemFixture);
      const now = await time.latest();

      await context.escrow.pause();

      await expect(
        context.escrow
          .connect(context.company)
          .createBounty(
            context.metadataHash,
            context.metadataCID,
            0,
            now + ONE_WEEK,
            { value: ONE_ETH }
          )
      ).to.be.revertedWithCustomError(context.escrow, "ContractPaused");
    });

    it("still permits withdrawal while paused", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);
      await context.escrow
        .connect(context.company)
        .acceptSubmission(1, FOUR_TENTHS_ETH);

      await context.escrow.pause();

      await expect(context.escrow.connect(context.tester).withdraw())
        .to.emit(context.escrow, "Withdrawal")
        .withArgs(context.tester.address, FOUR_TENTHS_ETH);
    });
  });

  describe("Bounty creation", function () {
    it("allows an active company to create and fund a bounty", async function () {
      const context = await loadFixture(deploySystemFixture);
      const now = await time.latest();
      const endTime = now + ONE_WEEK;

      await expect(
        context.escrow
          .connect(context.company)
          .createBounty(
            context.metadataHash,
            context.metadataCID,
            0,
            endTime,
            { value: ONE_ETH }
          )
      )
        .to.emit(context.escrow, "BountyCreated")
        .withArgs(
          1n,
          context.company.address,
          ONE_ETH,
          context.metadataHash,
          context.metadataCID,
          anyValue,
          BigInt(endTime)
        );

      const bounty = await context.escrow.getBounty(1);

      expect(await context.escrow.bountyCount()).to.equal(1n);
      expect(bounty.company).to.equal(context.company.address);
      expect(bounty.metadataHash).to.equal(context.metadataHash);
      expect(bounty.metadataCID).to.equal(context.metadataCID);
      expect(bounty.totalEscrow).to.equal(ONE_ETH);
      expect(bounty.availableEscrow).to.equal(ONE_ETH);
      expect(bounty.status).to.equal(BOUNTY_OPEN);
      expect(
        await ethers.provider.getBalance(await context.escrow.getAddress())
      ).to.equal(ONE_ETH);
    });

    it("accepts an explicitly scheduled future start", async function () {
      const context = await loadFixture(deploySystemFixture);
      const now = await time.latest();
      const startTime = now + 3600;
      const endTime = startTime + ONE_WEEK;

      await createOpenBounty(context, { startTime, endTime });

      const bounty = await context.escrow.getBounty(1);
      expect(bounty.startTime).to.equal(BigInt(startTime));
      expect(bounty.endTime).to.equal(BigInt(endTime));
    });

    it("increments bounty IDs", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await createOpenBounty(context, {
        metadataHash: ethers.id("SECOND_BOUNTY"),
        metadataCID: "ipfs://second-bounty",
      });

      expect(await context.escrow.bountyCount()).to.equal(2n);
      expect((await context.escrow.getBounty(2)).company).to.equal(
        context.company.address
      );
    });

    it("rejects bounty creation by an unregistered account", async function () {
      const context = await loadFixture(deploySystemFixture);
      const now = await time.latest();

      await expect(
        context.escrow
          .connect(context.outsider)
          .createBounty(
            context.metadataHash,
            context.metadataCID,
            0,
            now + ONE_WEEK,
            { value: ONE_ETH }
          )
      ).to.be.revertedWithCustomError(
        context.escrow,
        "NotRegisteredCompany"
      );
    });

    it("rejects bounty creation by a suspended company", async function () {
      const context = await loadFixture(deploySystemFixture);
      const now = await time.latest();

      await context.registry.setParticipantActive(
        context.company.address,
        false
      );

      await expect(
        context.escrow
          .connect(context.company)
          .createBounty(
            context.metadataHash,
            context.metadataCID,
            0,
            now + ONE_WEEK,
            { value: ONE_ETH }
          )
      ).to.be.revertedWithCustomError(
        context.escrow,
        "NotRegisteredCompany"
      );
    });

    it("rejects a zero escrow amount", async function () {
      const context = await loadFixture(deploySystemFixture);
      const now = await time.latest();

      await expect(
        context.escrow
          .connect(context.company)
          .createBounty(
            context.metadataHash,
            context.metadataCID,
            0,
            now + ONE_WEEK
          )
      ).to.be.revertedWithCustomError(context.escrow, "InvalidAmount");
    });

    it("rejects a zero metadata hash", async function () {
      const context = await loadFixture(deploySystemFixture);
      const now = await time.latest();

      await expect(
        context.escrow
          .connect(context.company)
          .createBounty(
            ethers.ZeroHash,
            context.metadataCID,
            0,
            now + ONE_WEEK,
            { value: ONE_ETH }
          )
      ).to.be.revertedWithCustomError(context.escrow, "InvalidHash");
    });

    it("rejects an empty metadata CID", async function () {
      const context = await loadFixture(deploySystemFixture);
      const now = await time.latest();

      await expect(
        context.escrow
          .connect(context.company)
          .createBounty(
            context.metadataHash,
            "",
            0,
            now + ONE_WEEK,
            { value: ONE_ETH }
          )
      ).to.be.revertedWithCustomError(context.escrow, "EmptyCID");
    });

    it("rejects a start time in the past", async function () {
      const context = await loadFixture(deploySystemFixture);
      const now = await time.latest();

      await expect(
        context.escrow
          .connect(context.company)
          .createBounty(
            context.metadataHash,
            context.metadataCID,
            now - 60,
            now + ONE_WEEK,
            { value: ONE_ETH }
          )
      ).to.be.revertedWithCustomError(context.escrow, "InvalidTimeRange");
    });

    it("rejects an end time that is not after the start", async function () {
      const context = await loadFixture(deploySystemFixture);
      const now = await time.latest();
      const startTime = now + 3600;

      await expect(
        context.escrow
          .connect(context.company)
          .createBounty(
            context.metadataHash,
            context.metadataCID,
            startTime,
            startTime,
            { value: ONE_ETH }
          )
      ).to.be.revertedWithCustomError(context.escrow, "InvalidTimeRange");
    });
  });

  describe("Bug submission", function () {
    it("allows an active tester to submit a report", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);

      await expect(
        context.escrow
          .connect(context.tester)
          .submitBug(
            1,
            context.reportHash,
            context.evidenceCID,
            FOUR_TENTHS_ETH
          )
      )
        .to.emit(context.escrow, "BugSubmitted")
        .withArgs(
          1n,
          1n,
          context.tester.address,
          context.reportHash,
          context.evidenceCID,
          FOUR_TENTHS_ETH
        );

      const submission = await context.escrow.getSubmission(1);

      expect(await context.escrow.submissionCount()).to.equal(1n);
      expect(submission.bountyId).to.equal(1n);
      expect(submission.tester).to.equal(context.tester.address);
      expect(submission.reportHash).to.equal(context.reportHash);
      expect(submission.encryptedEvidenceCID).to.equal(context.evidenceCID);
      expect(submission.requestedReward).to.equal(FOUR_TENTHS_ETH);
      expect(submission.approvedReward).to.equal(0n);
      expect(submission.status).to.equal(SUBMISSION_SUBMITTED);
      expect(await context.escrow.bountySubmissionCount(1)).to.equal(1n);
      expect(await context.escrow.pendingSubmissionCount(1)).to.equal(1n);
      expect(
        await context.escrow.reportHashUsed(1, context.reportHash)
      ).to.equal(true);
    });

    it("allows multiple testers to submit different reports", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);
      await submitReport(context, {
        testerSigner: context.secondTester,
        reportHash: ethers.id("BUG_REPORT_B"),
      });

      expect(await context.escrow.submissionCount()).to.equal(2n);
      expect(await context.escrow.bountySubmissionCount(1)).to.equal(2n);
      expect(await context.escrow.pendingSubmissionCount(1)).to.equal(2n);
      expect((await context.escrow.getSubmission(2)).tester).to.equal(
        context.secondTester.address
      );
    });

    it("rejects a report from an unregistered tester", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);

      await expect(
        context.escrow
          .connect(context.outsider)
          .submitBug(
            1,
            context.reportHash,
            context.evidenceCID,
            FOUR_TENTHS_ETH
          )
      ).to.be.revertedWithCustomError(
        context.escrow,
        "NotRegisteredTester"
      );
    });

    it("rejects a report from a suspended tester", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await context.registry.setParticipantActive(
        context.tester.address,
        false
      );

      await expect(
        context.escrow
          .connect(context.tester)
          .submitBug(
            1,
            context.reportHash,
            context.evidenceCID,
            FOUR_TENTHS_ETH
          )
      ).to.be.revertedWithCustomError(
        context.escrow,
        "NotRegisteredTester"
      );
    });

    it("rejects an invalid bounty ID", async function () {
      const context = await loadFixture(deploySystemFixture);

      await expect(
        context.escrow
          .connect(context.tester)
          .submitBug(
            999,
            context.reportHash,
            context.evidenceCID,
            FOUR_TENTHS_ETH
          )
      )
        .to.be.revertedWithCustomError(context.escrow, "InvalidBountyId")
        .withArgs(999n);
    });

    it("rejects submission before the scheduled start", async function () {
      const context = await loadFixture(deploySystemFixture);
      const now = await time.latest();
      const startTime = now + 3600;

      await createOpenBounty(context, {
        startTime,
        endTime: startTime + ONE_WEEK,
      });

      await expect(
        context.escrow
          .connect(context.tester)
          .submitBug(
            1,
            context.reportHash,
            context.evidenceCID,
            FOUR_TENTHS_ETH
          )
      ).to.be.revertedWithCustomError(context.escrow, "BountyNotStarted");
    });

    it("rejects submission after the bounty expires", async function () {
      const context = await loadFixture(deploySystemFixture);
      const now = await time.latest();
      const endTime = now + 100;

      await createOpenBounty(context, { endTime });
      await time.increaseTo(endTime + 1);

      await expect(
        context.escrow
          .connect(context.tester)
          .submitBug(
            1,
            context.reportHash,
            context.evidenceCID,
            FOUR_TENTHS_ETH
          )
      ).to.be.revertedWithCustomError(context.escrow, "BountyExpired");
    });

    it("rejects a zero report hash", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);

      await expect(
        context.escrow
          .connect(context.tester)
          .submitBug(
            1,
            ethers.ZeroHash,
            context.evidenceCID,
            FOUR_TENTHS_ETH
          )
      ).to.be.revertedWithCustomError(context.escrow, "InvalidHash");
    });

    it("rejects an empty evidence CID", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);

      await expect(
        context.escrow
          .connect(context.tester)
          .submitBug(1, context.reportHash, "", FOUR_TENTHS_ETH)
      ).to.be.revertedWithCustomError(context.escrow, "EmptyCID");
    });

    it("rejects a zero requested reward", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);

      await expect(
        context.escrow
          .connect(context.tester)
          .submitBug(1, context.reportHash, context.evidenceCID, 0)
      ).to.be.revertedWithCustomError(context.escrow, "InvalidAmount");
    });

    it("rejects a requested reward greater than available escrow", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);

      await expect(
        context.escrow
          .connect(context.tester)
          .submitBug(
            1,
            context.reportHash,
            context.evidenceCID,
            ethers.parseEther("1.1")
          )
      ).to.be.revertedWithCustomError(context.escrow, "InsufficientEscrow");
    });

    it("rejects the same report hash twice in one bounty", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);

      await expect(
        context.escrow
          .connect(context.secondTester)
          .submitBug(
            1,
            context.reportHash,
            "ipfs://second-copy",
            FOUR_TENTHS_ETH
          )
      ).to.be.revertedWithCustomError(context.escrow, "DuplicateReportHash");
    });

    it("allows the same report hash in a different bounty", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await createOpenBounty(context, {
        metadataHash: ethers.id("SECOND_BOUNTY"),
        metadataCID: "ipfs://second-bounty",
      });

      await submitReport(context, { bountyId: 1n });
      await submitReport(context, {
        bountyId: 2n,
        reportHash: context.reportHash,
      });

      expect(await context.escrow.submissionCount()).to.equal(2n);
    });
  });

  describe("Submission acceptance", function () {
    it("accepts a submission and allocates the reward", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);

      await expect(
        context.escrow
          .connect(context.company)
          .acceptSubmission(1, FOUR_TENTHS_ETH)
      )
        .to.emit(context.escrow, "SubmissionAccepted")
        .withArgs(
          1n,
          1n,
          context.tester.address,
          FOUR_TENTHS_ETH
        );

      const submission = await context.escrow.getSubmission(1);
      const bounty = await context.escrow.getBounty(1);

      expect(submission.status).to.equal(SUBMISSION_ACCEPTED);
      expect(submission.approvedReward).to.equal(FOUR_TENTHS_ETH);
      expect(bounty.availableEscrow).to.equal(ethers.parseEther("0.6"));
      expect(await context.escrow.pendingSubmissionCount(1)).to.equal(0n);
      expect(
        await context.escrow.pendingWithdrawals(context.tester.address)
      ).to.equal(FOUR_TENTHS_ETH);
    });

    it("allows a company to approve less than the requested amount", async function () {
      const context = await loadFixture(deploySystemFixture);
      const approvedReward = ethers.parseEther("0.25");

      await createOpenBounty(context);
      await submitReport(context);
      await context.escrow
        .connect(context.company)
        .acceptSubmission(1, approvedReward);

      expect((await context.escrow.getSubmission(1)).approvedReward).to.equal(
        approvedReward
      );
      expect(
        await context.escrow.pendingWithdrawals(context.tester.address)
      ).to.equal(approvedReward);
    });

    it("prevents an unauthorized account from accepting a submission", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);

      await expect(
        context.escrow
          .connect(context.outsider)
          .acceptSubmission(1, FOUR_TENTHS_ETH)
      ).to.be.revertedWithCustomError(context.escrow, "NotBountyCompany");
    });

    it("rejects an invalid submission ID", async function () {
      const context = await loadFixture(deploySystemFixture);

      await expect(
        context.escrow
          .connect(context.company)
          .acceptSubmission(999, FOUR_TENTHS_ETH)
      )
        .to.be.revertedWithCustomError(
          context.escrow,
          "InvalidSubmissionId"
        )
        .withArgs(999n);
    });

    it("rejects a zero approved reward", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);

      await expect(
        context.escrow.connect(context.company).acceptSubmission(1, 0)
      ).to.be.revertedWithCustomError(context.escrow, "InvalidAmount");
    });

    it("rejects an approved reward above the requested amount", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);

      await expect(
        context.escrow
          .connect(context.company)
          .acceptSubmission(1, ethers.parseEther("0.5"))
      ).to.be.revertedWithCustomError(context.escrow, "InvalidAmount");
    });

    it("rejects accepting the same submission twice", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);
      await context.escrow
        .connect(context.company)
        .acceptSubmission(1, FOUR_TENTHS_ETH);

      await expect(
        context.escrow
          .connect(context.company)
          .acceptSubmission(1, FOUR_TENTHS_ETH)
      ).to.be.revertedWithCustomError(context.escrow, "SubmissionNotPending");
    });

    it("rejects an approval when earlier rewards reduced available escrow", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context, {
        requestedReward: EIGHT_TENTHS_ETH,
      });
      await submitReport(context, {
        testerSigner: context.secondTester,
        reportHash: ethers.id("BUG_REPORT_B"),
        requestedReward: EIGHT_TENTHS_ETH,
      });

      await context.escrow
        .connect(context.company)
        .acceptSubmission(1, EIGHT_TENTHS_ETH);

      await expect(
        context.escrow
          .connect(context.company)
          .acceptSubmission(2, EIGHT_TENTHS_ETH)
      ).to.be.revertedWithCustomError(context.escrow, "InsufficientEscrow");
    });

    it("accumulates multiple accepted rewards for the same tester", async function () {
      const context = await loadFixture(deploySystemFixture);
      const firstReward = ethers.parseEther("0.2");
      const secondReward = ethers.parseEther("0.3");

      await createOpenBounty(context);
      await submitReport(context, {
        requestedReward: firstReward,
      });
      await submitReport(context, {
        reportHash: ethers.id("SECOND_REPORT_BY_SAME_TESTER"),
        requestedReward: secondReward,
      });

      await context.escrow
        .connect(context.company)
        .acceptSubmission(1, firstReward);
      await context.escrow
        .connect(context.company)
        .acceptSubmission(2, secondReward);

      expect(
        await context.escrow.pendingWithdrawals(context.tester.address)
      ).to.equal(firstReward + secondReward);
    });
  });

  describe("Submission rejection", function () {
    it("rejects a submission and records the reason and deadline", async function () {
      const context = await loadFixture(deploySystemFixture);
      const rejectionReasonHash = ethers.id("NOT_REPRODUCIBLE");

      await createOpenBounty(context, {
        endTime: (await time.latest()) + 100,
      });
      await submitReport(context);

      await expect(
        context.escrow
          .connect(context.company)
          .rejectSubmission(1, rejectionReasonHash)
      )
        .to.emit(context.escrow, "SubmissionRejected")
        .withArgs(1n, 1n, rejectionReasonHash, anyValue);

      const submission = await context.escrow.getSubmission(1);
      const bounty = await context.escrow.getBounty(1);

      expect(submission.status).to.equal(SUBMISSION_REJECTED);
      expect(submission.rejectionReasonHash).to.equal(rejectionReasonHash);
      expect(submission.rejectedAt).to.be.greaterThan(0n);
      expect(await context.escrow.pendingSubmissionCount(1)).to.equal(0n);
      expect(bounty.refundAvailableAt).to.equal(
        submission.rejectedAt + BigInt(THREE_DAYS)
      );
    });

    it("prevents an unauthorized account from rejecting a submission", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);

      await expect(
        context.escrow
          .connect(context.outsider)
          .rejectSubmission(1, ethers.id("REASON"))
      ).to.be.revertedWithCustomError(context.escrow, "NotBountyCompany");
    });

    it("rejects an empty rejection reason hash", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);

      await expect(
        context.escrow
          .connect(context.company)
          .rejectSubmission(1, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(context.escrow, "InvalidHash");
    });

    it("rejects a submission that has already been accepted", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);
      await context.escrow
        .connect(context.company)
        .acceptSubmission(1, FOUR_TENTHS_ETH);

      await expect(
        context.escrow
          .connect(context.company)
          .rejectSubmission(1, ethers.id("REASON"))
      ).to.be.revertedWithCustomError(context.escrow, "SubmissionNotPending");
    });

    it("rejects the same submission twice", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);
      await context.escrow
        .connect(context.company)
        .rejectSubmission(1, ethers.id("FIRST_REASON"));

      await expect(
        context.escrow
          .connect(context.company)
          .rejectSubmission(1, ethers.id("SECOND_REASON"))
      ).to.be.revertedWithCustomError(context.escrow, "SubmissionNotPending");
    });
  });

  describe("Bounty cancellation", function () {
    it("allows the company to cancel a bounty with no submissions", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);

      await expect(context.escrow.connect(context.company).cancelBounty(1))
        .to.emit(context.escrow, "BountyCancelled")
        .withArgs(1n, context.company.address, ONE_ETH);

      const bounty = await context.escrow.getBounty(1);

      expect(bounty.status).to.equal(BOUNTY_CANCELLED);
      expect(bounty.availableEscrow).to.equal(0n);
      expect(
        await context.escrow.pendingWithdrawals(context.company.address)
      ).to.equal(ONE_ETH);
    });

    it("prevents another account from cancelling the bounty", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);

      await expect(
        context.escrow.connect(context.outsider).cancelBounty(1)
      ).to.be.revertedWithCustomError(context.escrow, "NotBountyCompany");
    });

    it("prevents cancellation after any submission exists", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);

      await expect(
        context.escrow.connect(context.company).cancelBounty(1)
      ).to.be.revertedWithCustomError(context.escrow, "BountyHasSubmissions");
    });

    it("prevents cancelling a bounty twice", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await context.escrow.connect(context.company).cancelBounty(1);

      await expect(
        context.escrow.connect(context.company).cancelBounty(1)
      ).to.be.revertedWithCustomError(context.escrow, "BountyNotOpen");
    });
  });

  describe("Closing expired bounties", function () {
    it("closes an expired bounty with no submissions", async function () {
      const context = await loadFixture(deploySystemFixture);
      const endTime = (await time.latest()) + 100;

      await createOpenBounty(context, { endTime });
      await time.increaseTo(endTime + 1);

      await expect(
        context.escrow.connect(context.company).closeExpiredBounty(1)
      )
        .to.emit(context.escrow, "BountyClosed")
        .withArgs(1n, context.company.address, ONE_ETH);

      const bounty = await context.escrow.getBounty(1);

      expect(bounty.status).to.equal(BOUNTY_CLOSED);
      expect(bounty.availableEscrow).to.equal(0n);
      expect(
        await context.escrow.pendingWithdrawals(context.company.address)
      ).to.equal(ONE_ETH);
    });

    it("rejects closing by a non-company account", async function () {
      const context = await loadFixture(deploySystemFixture);
      const endTime = (await time.latest()) + 100;

      await createOpenBounty(context, { endTime });
      await time.increaseTo(endTime + 1);

      await expect(
        context.escrow.connect(context.outsider).closeExpiredBounty(1)
      ).to.be.revertedWithCustomError(context.escrow, "NotBountyCompany");
    });

    it("rejects closing before the bounty expires", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);

      await expect(
        context.escrow.connect(context.company).closeExpiredBounty(1)
      ).to.be.revertedWithCustomError(context.escrow, "BountyNotExpired");
    });

    it("rejects closing while submissions are pending", async function () {
      const context = await loadFixture(deploySystemFixture);
      const endTime = (await time.latest()) + 100;

      await createOpenBounty(context, { endTime });
      await submitReport(context);
      await time.increaseTo(endTime + 1);

      await expect(
        context.escrow.connect(context.company).closeExpiredBounty(1)
      ).to.be.revertedWithCustomError(
        context.escrow,
        "PendingSubmissionsExist"
      );
    });

    it("rejects closing while a rejection dispute window remains open", async function () {
      const context = await loadFixture(deploySystemFixture);
      const endTime = (await time.latest()) + 100;

      await createOpenBounty(context, { endTime });
      await submitReport(context);
      await context.escrow
        .connect(context.company)
        .rejectSubmission(1, ethers.id("REJECTION_REASON"));

      await time.increaseTo(endTime + 1);

      await expect(
        context.escrow.connect(context.company).closeExpiredBounty(1)
      ).to.be.revertedWithCustomError(
        context.escrow,
        "DisputeWindowStillOpen"
      );
    });

    it("closes after the rejection dispute window expires", async function () {
      const context = await loadFixture(deploySystemFixture);
      const endTime = (await time.latest()) + 100;

      await createOpenBounty(context, { endTime });
      await submitReport(context);
      await context.escrow
        .connect(context.company)
        .rejectSubmission(1, ethers.id("REJECTION_REASON"));

      const bountyBeforeClose = await context.escrow.getBounty(1);
      await time.increaseTo(bountyBeforeClose.refundAvailableAt + 1n);

      await context.escrow.connect(context.company).closeExpiredBounty(1);

      expect((await context.escrow.getBounty(1)).status).to.equal(
        BOUNTY_CLOSED
      );
      expect(
        await context.escrow.pendingWithdrawals(context.company.address)
      ).to.equal(ONE_ETH);
    });

    it("returns only unused escrow after accepted rewards", async function () {
      const context = await loadFixture(deploySystemFixture);
      const endTime = (await time.latest()) + 100;

      await createOpenBounty(context, { endTime });
      await submitReport(context);
      await context.escrow
        .connect(context.company)
        .acceptSubmission(1, FOUR_TENTHS_ETH);

      await time.increaseTo(endTime + 1);
      await context.escrow.connect(context.company).closeExpiredBounty(1);

      expect(
        await context.escrow.pendingWithdrawals(context.company.address)
      ).to.equal(ethers.parseEther("0.6"));
      expect(
        await context.escrow.pendingWithdrawals(context.tester.address)
      ).to.equal(FOUR_TENTHS_ETH);
    });
  });

  describe("Withdrawals", function () {
    it("allows a tester to withdraw an accepted reward", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);
      await context.escrow
        .connect(context.company)
        .acceptSubmission(1, FOUR_TENTHS_ETH);

      const escrowAddress = await context.escrow.getAddress();

      const withdrawalTx =
  context.escrow.connect(context.tester).withdraw();

await expect(withdrawalTx).to.changeEtherBalances(
  [escrowAddress, context.tester.address],
  [-FOUR_TENTHS_ETH, FOUR_TENTHS_ETH]
);

await expect(withdrawalTx)
  .to.emit(context.escrow, "Withdrawal")
  .withArgs(
    context.tester.address,
    FOUR_TENTHS_ETH
  );
      expect(
        await context.escrow.pendingWithdrawals(context.tester.address)
      ).to.equal(0n);
    });

    it("allows a company to withdraw a cancellation refund", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await context.escrow.connect(context.company).cancelBounty(1);

      await expect(context.escrow.connect(context.company).withdraw())
        .to.emit(context.escrow, "Withdrawal")
        .withArgs(context.company.address, ONE_ETH);

      expect(
        await context.escrow.pendingWithdrawals(context.company.address)
      ).to.equal(0n);
      expect(
        await ethers.provider.getBalance(await context.escrow.getAddress())
      ).to.equal(0n);
    });

    it("rejects withdrawal when no balance is available", async function () {
      const context = await loadFixture(deploySystemFixture);

      await expect(
        context.escrow.connect(context.outsider).withdraw()
      ).to.be.revertedWithCustomError(context.escrow, "NothingToWithdraw");
    });
  });

  describe("Read functions and direct payments", function () {
    it("rejects reading an invalid bounty ID", async function () {
      const context = await loadFixture(deploySystemFixture);

      await expect(context.escrow.getBounty(999))
        .to.be.revertedWithCustomError(context.escrow, "InvalidBountyId")
        .withArgs(999n);
    });

    it("rejects reading an invalid submission ID", async function () {
      const context = await loadFixture(deploySystemFixture);

      await expect(context.escrow.getSubmission(999))
        .to.be.revertedWithCustomError(
          context.escrow,
          "InvalidSubmissionId"
        )
        .withArgs(999n);
    });

    it("rejects Ether sent directly to the contract", async function () {
      const context = await loadFixture(deploySystemFixture);

      await expect(
        context.owner.sendTransaction({
          to: await context.escrow.getAddress(),
          value: ethers.parseEther("0.1"),
        })
      ).to.be.revertedWithCustomError(
        context.escrow,
        "DirectPaymentsNotAllowed"
      );
    });
  });

  describe("Complete successful workflow", function () {
    it("creates, submits, accepts, withdraws, and preserves the remaining escrow", async function () {
      const context = await loadFixture(deploySystemFixture);

      await createOpenBounty(context);
      await submitReport(context);
      await context.escrow
        .connect(context.company)
        .acceptSubmission(1, FOUR_TENTHS_ETH);

      await context.escrow.connect(context.tester).withdraw();

      const bounty = await context.escrow.getBounty(1);
      const submission = await context.escrow.getSubmission(1);

      expect(bounty.status).to.equal(BOUNTY_OPEN);
      expect(bounty.availableEscrow).to.equal(ethers.parseEther("0.6"));
      expect(submission.status).to.equal(SUBMISSION_ACCEPTED);
      expect(submission.approvedReward).to.equal(FOUR_TENTHS_ETH);
      expect(
        await context.escrow.pendingWithdrawals(context.tester.address)
      ).to.equal(0n);
      expect(
        await ethers.provider.getBalance(await context.escrow.getAddress())
      ).to.equal(ethers.parseEther("0.6"));
    });
  });
});
