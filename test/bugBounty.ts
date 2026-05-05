import { expect } from "chai";
import { ethers } from "hardhat";

describe("BugBounty", function () {
  const evidenceCID1 = "ipfs://example-bug-report-cid-1";
  const evidenceCID2 = "ipfs://example-bug-report-cid-2";
  const evidenceCID3 = "ipfs://example-bug-report-cid-3";

  async function deployBugBounty() {
    const [owner, company, tester1, tester2, tester3, outsider] =
      await ethers.getSigners();

    const BugBounty = await ethers.getContractFactory("BugBounty");
    const bugBounty: any = await BugBounty.deploy();
    await bugBounty.waitForDeployment();

    return { bugBounty, owner, company, tester1, tester2, tester3, outsider };
  }

  async function increaseTime(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  it("should create a bounty with reward and deadline", async function () {
    const { bugBounty, company } = await deployBugBounty();

    await bugBounty.connect(company).createBounty(7 * 24 * 60 * 60, {
      value: ethers.parseEther("10"),
    });

    const bounty = await bugBounty.bounties(1);

    expect(bounty.company).to.equal(company.address);
    expect(bounty.reward).to.equal(ethers.parseEther("10"));
    expect(bounty.remainingReward).to.equal(ethers.parseEther("10"));
    expect(bounty.closed).to.equal(false);
  });

  it("should allow multiple testers to submit bugs before deadline", async function () {
    const { bugBounty, company, tester1, tester2, tester3 } =
      await deployBugBounty();

    await bugBounty.connect(company).createBounty(7 * 24 * 60 * 60, {
      value: ethers.parseEther("10"),
    });

    const bugHash1 = ethers.keccak256(ethers.toUtf8Bytes("bug report 1"));
    const bugHash2 = ethers.keccak256(ethers.toUtf8Bytes("bug report 2"));
    const bugHash3 = ethers.keccak256(ethers.toUtf8Bytes("bug report 3"));

    await bugBounty.connect(tester1).submitBug(1, bugHash1, evidenceCID1);
    await bugBounty.connect(tester2).submitBug(1, bugHash2, evidenceCID2);
    await bugBounty.connect(tester3).submitBug(1, bugHash3, evidenceCID3);

    const submissionIds = await bugBounty.getBountySubmissions(1);

    expect(submissionIds.length).to.equal(3);

    const submission1 = await bugBounty.submissions(1);
    const submission2 = await bugBounty.submissions(2);
    const submission3 = await bugBounty.submissions(3);

    expect(submission1.tester).to.equal(tester1.address);
    expect(submission2.tester).to.equal(tester2.address);
    expect(submission3.tester).to.equal(tester3.address);

    expect(submission1.evidenceCID).to.equal(evidenceCID1);
    expect(submission2.evidenceCID).to.equal(evidenceCID2);
    expect(submission3.evidenceCID).to.equal(evidenceCID3);
  });

  it("should not allow bug submission after deadline", async function () {
    const { bugBounty, company, tester1 } = await deployBugBounty();

    await bugBounty.connect(company).createBounty(60, {
      value: ethers.parseEther("10"),
    });

    await increaseTime(61);

    const bugHash = ethers.keccak256(ethers.toUtf8Bytes("late bug report"));

    await expect(
      bugBounty.connect(tester1).submitBug(1, bugHash, evidenceCID1)
    ).to.be.revertedWith("Deadline passed");
  });

  it("should not allow company to accept submission before deadline", async function () {
    const { bugBounty, company, tester1 } = await deployBugBounty();

    await bugBounty.connect(company).createBounty(60, {
      value: ethers.parseEther("10"),
    });

    const bugHash = ethers.keccak256(ethers.toUtf8Bytes("bug report"));
    await bugBounty.connect(tester1).submitBug(1, bugHash, evidenceCID1);

    await expect(
      bugBounty
        .connect(company)
        .acceptSubmission(1, 1, ethers.parseEther("2"))
    ).to.be.revertedWith("Deadline not passed yet");
  });

  it("should allow multiple testers to win and receive different rewards", async function () {
    const { bugBounty, company, tester1, tester2, tester3 } =
      await deployBugBounty();

    await bugBounty.connect(company).createBounty(60, {
      value: ethers.parseEther("10"),
    });

    const bugHash1 = ethers.keccak256(ethers.toUtf8Bytes("critical bug"));
    const bugHash2 = ethers.keccak256(ethers.toUtf8Bytes("medium bug"));
    const bugHash3 = ethers.keccak256(ethers.toUtf8Bytes("low bug"));

    await bugBounty.connect(tester1).submitBug(1, bugHash1, evidenceCID1);
    await bugBounty.connect(tester2).submitBug(1, bugHash2, evidenceCID2);
    await bugBounty.connect(tester3).submitBug(1, bugHash3, evidenceCID3);

    await increaseTime(61);

    await expect(() =>
      bugBounty
        .connect(company)
        .acceptSubmission(1, 1, ethers.parseEther("4"))
    ).to.changeEtherBalance(tester1, ethers.parseEther("4"));

    await expect(() =>
      bugBounty
        .connect(company)
        .acceptSubmission(1, 2, ethers.parseEther("3"))
    ).to.changeEtherBalance(tester2, ethers.parseEther("3"));

    await expect(() =>
      bugBounty
        .connect(company)
        .acceptSubmission(1, 3, ethers.parseEther("1"))
    ).to.changeEtherBalance(tester3, ethers.parseEther("1"));

    const bounty = await bugBounty.bounties(1);

    expect(bounty.remainingReward).to.equal(ethers.parseEther("2"));

    const submission1 = await bugBounty.submissions(1);
    const submission2 = await bugBounty.submissions(2);
    const submission3 = await bugBounty.submissions(3);

    expect(submission1.rewardPaid).to.equal(ethers.parseEther("4"));
    expect(submission2.rewardPaid).to.equal(ethers.parseEther("3"));
    expect(submission3.rewardPaid).to.equal(ethers.parseEther("1"));
  });

  it("should reject a submission after deadline", async function () {
    const { bugBounty, company, tester1 } = await deployBugBounty();

    await bugBounty.connect(company).createBounty(60, {
      value: ethers.parseEther("10"),
    });

    const bugHash = ethers.keccak256(ethers.toUtf8Bytes("invalid bug"));
    await bugBounty.connect(tester1).submitBug(1, bugHash, evidenceCID1);

    await increaseTime(61);

    await bugBounty.connect(company).rejectSubmission(1, 1);

    const submission = await bugBounty.submissions(1);

    // SubmissionStatus:
    // Pending = 0
    // Accepted = 1
    // Rejected = 2
    expect(submission.status).to.equal(2);
  });

  it("should not allow non-company to accept submission", async function () {
    const { bugBounty, company, tester1, outsider } = await deployBugBounty();

    await bugBounty.connect(company).createBounty(60, {
      value: ethers.parseEther("10"),
    });

    const bugHash = ethers.keccak256(ethers.toUtf8Bytes("bug report"));
    await bugBounty.connect(tester1).submitBug(1, bugHash, evidenceCID1);

    await increaseTime(61);

    await expect(
      bugBounty
        .connect(outsider)
        .acceptSubmission(1, 1, ethers.parseEther("2"))
    ).to.be.revertedWith("Only company can do this");
  });

  it("should not allow reward more than remaining reward", async function () {
    const { bugBounty, company, tester1 } = await deployBugBounty();

    await bugBounty.connect(company).createBounty(60, {
      value: ethers.parseEther("10"),
    });

    const bugHash = ethers.keccak256(ethers.toUtf8Bytes("bug report"));
    await bugBounty.connect(tester1).submitBug(1, bugHash, evidenceCID1);

    await increaseTime(61);

    await expect(
      bugBounty
        .connect(company)
        .acceptSubmission(1, 1, ethers.parseEther("11"))
    ).to.be.revertedWith("Not enough remaining reward");
  });

  it("should close bounty and refund leftover reward to company", async function () {
    const { bugBounty, company, tester1, tester2 } = await deployBugBounty();

    await bugBounty.connect(company).createBounty(60, {
      value: ethers.parseEther("10"),
    });

    const bugHash1 = ethers.keccak256(ethers.toUtf8Bytes("bug report 1"));
    const bugHash2 = ethers.keccak256(ethers.toUtf8Bytes("bug report 2"));

    await bugBounty.connect(tester1).submitBug(1, bugHash1, evidenceCID1);
    await bugBounty.connect(tester2).submitBug(1, bugHash2, evidenceCID2);

    await increaseTime(61);

    await bugBounty
      .connect(company)
      .acceptSubmission(1, 1, ethers.parseEther("4"));

    await bugBounty.connect(company).rejectSubmission(1, 2);

    await expect(() =>
      bugBounty.connect(company).closeBounty(1)
    ).to.changeEtherBalance(company, ethers.parseEther("6"));

    const bounty = await bugBounty.bounties(1);

    expect(bounty.closed).to.equal(true);
    expect(bounty.remainingReward).to.equal(0);
  });

  it("should not allow submitting to a closed bounty", async function () {
    const { bugBounty, company, tester1, tester2 } = await deployBugBounty();

    await bugBounty.connect(company).createBounty(60, {
      value: ethers.parseEther("10"),
    });

    const bugHash1 = ethers.keccak256(ethers.toUtf8Bytes("bug report 1"));
    await bugBounty.connect(tester1).submitBug(1, bugHash1, evidenceCID1);

    await increaseTime(61);

    await bugBounty.connect(company).closeBounty(1);

    const bugHash2 = ethers.keccak256(ethers.toUtf8Bytes("bug report 2"));

    await expect(
      bugBounty.connect(tester2).submitBug(1, bugHash2, evidenceCID2)
    ).to.be.revertedWith("Bounty is closed");
  });
});