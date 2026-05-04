import { expect } from "chai";
import { ethers } from "hardhat";

describe("BugBounty", function () {
   const evidenceCID = "ipfs://example-bug-report-cid";
   const bugHash = ethers.keccak256(ethers.toUtf8Bytes("bug report 1"));
  const reasonHash = ethers.keccak256(
    ethers.toUtf8Bytes("Company unfairly rejected the bug")
  );
  async function deployBugBounty() {
    const [owner, company, tester, arb1, arb2, arb3] =
      await ethers.getSigners();

    const BugBounty = await ethers.getContractFactory("BugBounty");
    const bugBounty: any = await BugBounty.deploy();
    await bugBounty.waitForDeployment();

    return { bugBounty, owner, company, tester, arb1, arb2, arb3 };
  }

  it("should create bounty, accept bug, and pay tester", async function () {
    const { bugBounty, company, tester } = await deployBugBounty();

    await bugBounty.connect(company).createBounty({
      value: ethers.parseEther("1"),
    });

    
    await bugBounty.connect(tester).submitBug(1, bugHash, evidenceCID);

    await expect(() =>
      bugBounty.connect(company).acceptBug(1)
    ).to.changeEtherBalance(tester, ethers.parseEther("1"));
  });

  it("should reject bug, open dispute, vote, and pay tester if tester wins", async function () {
    const { bugBounty, owner, company, tester, arb1, arb2, arb3 } =
      await deployBugBounty();

    await bugBounty.connect(owner).addArbitrator(arb1.address);
    await bugBounty.connect(owner).addArbitrator(arb2.address);
    await bugBounty.connect(owner).addArbitrator(arb3.address);

    await bugBounty.connect(company).createBounty({
      value: ethers.parseEther("1"),
    });


    await bugBounty.connect(tester).submitBug(1, bugHash, evidenceCID);
    await bugBounty.connect(company).rejectBug(1);
    await bugBounty.connect(tester).openDispute(1, reasonHash, evidenceCID);

    await bugBounty.connect(arb1).vote(1, true);
    await bugBounty.connect(arb2).vote(1, true);
    await bugBounty.connect(arb3).vote(1, false);

    await expect(() =>
      bugBounty.connect(company).resolveDispute(1)
    ).to.changeEtherBalance(tester, ethers.parseEther("1"));
  });

    it("should not allow tester to submit to a closed bounty", async function () {
    const { bugBounty, company, tester } = await deployBugBounty();

    await bugBounty.connect(company).createBounty({
      value: ethers.parseEther("1"),
    });

    await bugBounty.connect(tester).submitBug(1, bugHash, evidenceCID);

    await expect(
      bugBounty.connect(tester).submitBug(1, bugHash, evidenceCID)
    ).to.be.revertedWith("Bounty is not open");
  });

  it("should not allow non-company to accept bug", async function () {
    const { bugBounty, company, tester, arb1 } = await deployBugBounty();

    await bugBounty.connect(company).createBounty({
      value: ethers.parseEther("1"),
    });


    await bugBounty.connect(tester).submitBug(1, bugHash, evidenceCID);

    await expect(
      bugBounty.connect(arb1).acceptBug(1)
    ).to.be.revertedWith("Only company can do this");
  });

  it("should not allow non-company to reject bug", async function () {
    const { bugBounty, company, tester, arb1 } = await deployBugBounty();

    await bugBounty.connect(company).createBounty({
      value: ethers.parseEther("1"),
    });


    await bugBounty.connect(tester).submitBug(1, bugHash, evidenceCID);

    await expect(
      bugBounty.connect(arb1).rejectBug(1)
    ).to.be.revertedWith("Only company can do this");
  });

  it("should not allow non-arbitrator to vote", async function () {
    const { bugBounty, company, tester, arb1 } = await deployBugBounty();

    await bugBounty.connect(company).createBounty({
      value: ethers.parseEther("1"),
    });

    const bugHash = ethers.keccak256(ethers.toUtf8Bytes("bug report"));

    await bugBounty.connect(tester).submitBug(1, bugHash, evidenceCID);
    await bugBounty.connect(company).rejectBug(1);
    await bugBounty.connect(tester).openDispute(1, reasonHash, evidenceCID);

    await expect(
      bugBounty.connect(arb1).vote(1, true)
    ).to.be.revertedWith("Only arbitrator can do this");
  });

  it("should not allow arbitrator to vote twice", async function () {
    const { bugBounty, owner, company, tester, arb1 } = await deployBugBounty();

    await bugBounty.connect(owner).addArbitrator(arb1.address);

    await bugBounty.connect(company).createBounty({
      value: ethers.parseEther("1"),
    });


    await bugBounty.connect(tester).submitBug(1, bugHash, evidenceCID);
    await bugBounty.connect(company).rejectBug(1);
    await bugBounty.connect(tester).openDispute(1, reasonHash, evidenceCID);

    await bugBounty.connect(arb1).vote(1, true);

    await expect(
      bugBounty.connect(arb1).vote(1, false)
    ).to.be.revertedWith("Already voted");
  });

  it("should return money to company if tester loses dispute", async function () {
    const { bugBounty, owner, company, tester, arb1, arb2, arb3 } =
      await deployBugBounty();

    await bugBounty.connect(owner).addArbitrator(arb1.address);
    await bugBounty.connect(owner).addArbitrator(arb2.address);
    await bugBounty.connect(owner).addArbitrator(arb3.address);

    await bugBounty.connect(company).createBounty({
      value: ethers.parseEther("1"),
    });

    await bugBounty.connect(tester).submitBug(1, bugHash, evidenceCID);
    await bugBounty.connect(company).rejectBug(1);
    await bugBounty.connect(tester).openDispute(1, reasonHash, evidenceCID);

    await bugBounty.connect(arb1).vote(1, false);
    await bugBounty.connect(arb2).vote(1, false);
    await bugBounty.connect(arb3).vote(1, true);

    await expect(() =>
      bugBounty.connect(company).resolveDispute(1)
    ).to.changeEtherBalance(company, ethers.parseEther("1"));
  });
});