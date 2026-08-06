import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from
  "@nomicfoundation/hardhat-network-helpers";

describe("BugBountyEscrow authorization", function () {
  const ROLE_COMPANY = 1;
  const ROLE_TESTER = 2;

  const ACTION_CREATE_BOUNTY = 1;
  const ACTION_SUBMIT_BUG = 2;
  const ACTION_ACCEPT_SUBMISSION = 3;

  const AUTHORIZATION_TYPES = {
    Authorization: [
      { name: "user", type: "address" },
      { name: "role", type: "uint8" },
      {
        name: "organizationId",
        type: "bytes32",
      },
      { name: "action", type: "uint8" },
      { name: "actionHash", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  async function deployFixture() {
    const [
      owner,
      company,
      tester,
      verifier,
      attacker,
    ] = await ethers.getSigners();

    const Factory =
      await ethers.getContractFactory(
        "BugBountyEscrow"
      );

    const escrow =
      await Factory.deploy(verifier.address);

    await escrow.waitForDeployment();

    return {
      owner,
      company,
      tester,
      verifier,
      attacker,
      escrow,
      companyOrganizationId:
        ethers.id("SOFTWARE_COMPANY_A"),
      testerOrganizationId:
        ethers.id("INDEPENDENT_TESTER_A"),
    };
  }

  async function signAuthorization(params: {
    escrow: any;
    verifier: any;
    user: any;
    role: number;
    organizationId: string;
    action: number;
    actionHash: string;
    deadline?: bigint;
  }) {
    const network =
      await ethers.provider.getNetwork();

    const nonce =
      await params.escrow.authorizationNonces(
        params.user.address
      );

    const deadline =
      params.deadline ??
      BigInt((await time.latest()) + 300);

    const domain = {
      name: "BugBountyEscrow",
      version: "1",
      chainId: network.chainId,
      verifyingContract:
        await params.escrow.getAddress(),
    };

    const authorization = {
      user: params.user.address,
      role: params.role,
      organizationId:
        params.organizationId,
      action: params.action,
      actionHash: params.actionHash,
      nonce,
      deadline,
    };

    const signature =
      await params.verifier.signTypedData(
        domain,
        AUTHORIZATION_TYPES,
        authorization
      );

    return { authorization, signature };
  }

  async function createBounty(context: any) {
    const metadataHash =
      ethers.id("BOUNTY_METADATA");

    const metadataCID =
      "ipfs://bounty-metadata";

    const latest = await time.latest();
    const startTime = 0n;
    const endTime =
      BigInt(latest + 7 * 24 * 60 * 60);

    const value = ethers.parseEther("1");

    const actionHash =
      await context.escrow.hashCreateBountyAction(
        metadataHash,
        metadataCID,
        startTime,
        endTime,
        value
      );

    const signed = await signAuthorization({
      escrow: context.escrow,
      verifier: context.verifier,
      user: context.company,
      role: ROLE_COMPANY,
      organizationId:
        context.companyOrganizationId,
      action: ACTION_CREATE_BOUNTY,
      actionHash,
    });

    await context.escrow
      .connect(context.company)
      .createBounty(
        metadataHash,
        metadataCID,
        startTime,
        endTime,
        signed.authorization,
        signed.signature,
        { value }
      );
  }

  it("creates a bounty using a valid backend authorization", async function () {
    const context = await deployFixture();

    await createBounty(context);

    const bounty =
      await context.escrow.getBounty(1);

    expect(bounty.company).to.equal(
      context.company.address
    );

    expect(
      bounty.companyOrganizationId
    ).to.equal(
      context.companyOrganizationId
    );

    expect(
      await context.escrow.authorizationNonces(
        context.company.address
      )
    ).to.equal(1n);
  });

  it("rejects replaying the same authorization", async function () {
    const context = await deployFixture();

    const metadataHash =
      ethers.id("BOUNTY_METADATA");

    const metadataCID = "ipfs://bounty";
    const startTime = 0n;
    const endTime =
      BigInt((await time.latest()) + 3600);
    const value = ethers.parseEther("1");

    const actionHash =
      await context.escrow.hashCreateBountyAction(
        metadataHash,
        metadataCID,
        startTime,
        endTime,
        value
      );

    const signed = await signAuthorization({
      escrow: context.escrow,
      verifier: context.verifier,
      user: context.company,
      role: ROLE_COMPANY,
      organizationId:
        context.companyOrganizationId,
      action: ACTION_CREATE_BOUNTY,
      actionHash,
    });

    await context.escrow
      .connect(context.company)
      .createBounty(
        metadataHash,
        metadataCID,
        startTime,
        endTime,
        signed.authorization,
        signed.signature,
        { value }
      );

    await expect(
      context.escrow
        .connect(context.company)
        .createBounty(
          metadataHash,
          metadataCID,
          startTime,
          endTime,
          signed.authorization,
          signed.signature,
          { value }
        )
    ).to.be.revertedWithCustomError(
      context.escrow,
      "AuthorizationNonceMismatch"
    );
  });

  it("rejects a signature from an untrusted signer", async function () {
    const context = await deployFixture();

    const metadataHash =
      ethers.id("BOUNTY_METADATA");

    const metadataCID = "ipfs://bounty";
    const startTime = 0n;
    const endTime =
      BigInt((await time.latest()) + 3600);
    const value = ethers.parseEther("1");

    const actionHash =
      await context.escrow.hashCreateBountyAction(
        metadataHash,
        metadataCID,
        startTime,
        endTime,
        value
      );

    const signed = await signAuthorization({
      escrow: context.escrow,
      verifier: context.attacker,
      user: context.company,
      role: ROLE_COMPANY,
      organizationId:
        context.companyOrganizationId,
      action: ACTION_CREATE_BOUNTY,
      actionHash,
    });

    await expect(
      context.escrow
        .connect(context.company)
        .createBounty(
          metadataHash,
          metadataCID,
          startTime,
          endTime,
          signed.authorization,
          signed.signature,
          { value }
        )
    ).to.be.revertedWithCustomError(
      context.escrow,
      "InvalidAuthorizationSigner"
    );
  });

  it("rejects an expired authorization", async function () {
    const context = await deployFixture();

    const metadataHash =
      ethers.id("BOUNTY_METADATA");

    const metadataCID = "ipfs://bounty";
    const startTime = 0n;
    const endTime =
      BigInt((await time.latest()) + 3600);
    const value = ethers.parseEther("1");

    const actionHash =
      await context.escrow.hashCreateBountyAction(
        metadataHash,
        metadataCID,
        startTime,
        endTime,
        value
      );

    const signed = await signAuthorization({
      escrow: context.escrow,
      verifier: context.verifier,
      user: context.company,
      role: ROLE_COMPANY,
      organizationId:
        context.companyOrganizationId,
      action: ACTION_CREATE_BOUNTY,
      actionHash,
      deadline:
        BigInt((await time.latest()) - 1),
    });

    await expect(
      context.escrow
        .connect(context.company)
        .createBounty(
          metadataHash,
          metadataCID,
          startTime,
          endTime,
          signed.authorization,
          signed.signature,
          { value }
        )
    ).to.be.revertedWithCustomError(
      context.escrow,
      "AuthorizationExpired"
    );
  });

  it("completes create, submit, accept and withdraw", async function () {
    const context = await deployFixture();

    await createBounty(context);

    const reportHash =
      ethers.id("BROKEN_ACCESS_CONTROL");

    const evidenceCID =
      "ipfs://encrypted-evidence";

    const requestedReward =
      ethers.parseEther("0.4");

    const submitActionHash =
      await context.escrow.hashSubmitBugAction(
        1,
        reportHash,
        evidenceCID,
        requestedReward
      );

    const testerAuthorization =
      await signAuthorization({
        escrow: context.escrow,
        verifier: context.verifier,
        user: context.tester,
        role: ROLE_TESTER,
        organizationId:
          context.testerOrganizationId,
        action: ACTION_SUBMIT_BUG,
        actionHash: submitActionHash,
      });

    await context.escrow
      .connect(context.tester)
      .submitBug(
        1,
        reportHash,
        evidenceCID,
        requestedReward,
        testerAuthorization.authorization,
        testerAuthorization.signature
      );

    const approvedReward =
      ethers.parseEther("0.4");

    const acceptActionHash =
      await context.escrow
        .hashAcceptSubmissionAction(
          1,
          approvedReward
        );

    const companyAuthorization =
      await signAuthorization({
        escrow: context.escrow,
        verifier: context.verifier,
        user: context.company,
        role: ROLE_COMPANY,
        organizationId:
          context.companyOrganizationId,
        action: ACTION_ACCEPT_SUBMISSION,
        actionHash: acceptActionHash,
      });

    await context.escrow
      .connect(context.company)
      .acceptSubmission(
        1,
        approvedReward,
        companyAuthorization.authorization,
        companyAuthorization.signature
      );

    expect(
      await context.escrow.pendingWithdrawals(
        context.tester.address
      )
    ).to.equal(approvedReward);

    await expect(
      context.escrow
        .connect(context.tester)
        .withdraw()
    ).to.changeEtherBalances(
      [
        await context.escrow.getAddress(),
        context.tester.address,
      ],
      [-approvedReward, approvedReward]
    );
  });
});
