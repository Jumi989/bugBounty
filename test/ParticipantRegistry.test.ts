import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// ParticipantType enum values from ParticipantRegistry.sol
const NONE = 0n;
const COMPANY = 1n;
const TESTER = 2n;

describe("ParticipantRegistry", function () {
  async function deployRegistryFixture() {
    const [owner, company, tester, secondTester, outsider, newOwner] =
      await ethers.getSigners();

    const ParticipantRegistry = await ethers.getContractFactory(
      "ParticipantRegistry"
    );

    const registry = await ParticipantRegistry.deploy();
    await registry.waitForDeployment();

    return {
      registry,
      owner,
      company,
      tester,
      secondTester,
      outsider,
      newOwner,
      companyOrganizationId: ethers.id("SOFTWARE_COMPANY_A"),
      testerOrganizationId: ethers.id("TESTER_ORGANIZATION_A"),
      secondOrganizationId: ethers.id("TESTER_ORGANIZATION_B"),
    };
  }

  describe("Deployment and ownership", function () {
    it("sets the deployer as owner", async function () {
      const { registry, owner } = await loadFixture(deployRegistryFixture);

      expect(await registry.owner()).to.equal(owner.address);
    });

    it("allows the owner to transfer ownership", async function () {
      const { registry, owner, newOwner } = await loadFixture(
        deployRegistryFixture
      );

      await expect(registry.transferOwnership(newOwner.address))
        .to.emit(registry, "OwnershipTransferred")
        .withArgs(owner.address, newOwner.address);

      expect(await registry.owner()).to.equal(newOwner.address);
    });

    it("rejects ownership transfer by a non-owner", async function () {
      const { registry, outsider, newOwner } = await loadFixture(
        deployRegistryFixture
      );

      await expect(
        registry.connect(outsider).transferOwnership(newOwner.address)
      ).to.be.revertedWithCustomError(registry, "OnlyOwner");
    });

    it("rejects ownership transfer to the zero address", async function () {
      const { registry } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("gives administrative authority to the new owner", async function () {
      const { registry, owner, company, newOwner, companyOrganizationId } =
        await loadFixture(deployRegistryFixture);

      await registry.transferOwnership(newOwner.address);

      await expect(
        registry.registerCompany(company.address, companyOrganizationId)
      ).to.be.revertedWithCustomError(registry, "OnlyOwner");

      await expect(
        registry
          .connect(newOwner)
          .registerCompany(company.address, companyOrganizationId)
      ).to.emit(registry, "ParticipantRegistered");

      expect(await registry.owner()).not.to.equal(owner.address);
    });
  });

  describe("Participant registration", function () {
    it("registers a company and stores its data", async function () {
      const { registry, company, companyOrganizationId } = await loadFixture(
        deployRegistryFixture
      );

      const transaction = registry.registerCompany(
        company.address,
        companyOrganizationId
      );

      await expect(transaction)
        .to.emit(registry, "ParticipantRegistered")
        .withArgs(company.address, COMPANY, companyOrganizationId);

      const participant = await registry.getParticipant(company.address);

      expect(participant.participantType).to.equal(COMPANY);
      expect(participant.organizationId).to.equal(companyOrganizationId);
      expect(participant.active).to.equal(true);
      expect(participant.validatorCandidate).to.equal(false);
      expect(participant.registeredAt).to.be.greaterThan(0n);
      expect(await registry.isActiveCompany(company.address)).to.equal(true);
      expect(await registry.isActiveTester(company.address)).to.equal(false);
    });

    it("registers a tester and stores its data", async function () {
      const { registry, tester, testerOrganizationId } = await loadFixture(
        deployRegistryFixture
      );

      await expect(
        registry.registerTester(tester.address, testerOrganizationId)
      )
        .to.emit(registry, "ParticipantRegistered")
        .withArgs(tester.address, TESTER, testerOrganizationId);

      const participant = await registry.getParticipant(tester.address);

      expect(participant.participantType).to.equal(TESTER);
      expect(participant.organizationId).to.equal(testerOrganizationId);
      expect(participant.active).to.equal(true);
      expect(await registry.isActiveTester(tester.address)).to.equal(true);
      expect(await registry.isActiveCompany(tester.address)).to.equal(false);
    });

    it("rejects company registration by a non-owner", async function () {
      const { registry, outsider, company, companyOrganizationId } =
        await loadFixture(deployRegistryFixture);

      await expect(
        registry
          .connect(outsider)
          .registerCompany(company.address, companyOrganizationId)
      ).to.be.revertedWithCustomError(registry, "OnlyOwner");
    });

    it("rejects tester registration by a non-owner", async function () {
      const { registry, outsider, tester, testerOrganizationId } =
        await loadFixture(deployRegistryFixture);

      await expect(
        registry
          .connect(outsider)
          .registerTester(tester.address, testerOrganizationId)
      ).to.be.revertedWithCustomError(registry, "OnlyOwner");
    });

    it("rejects registration of the zero address", async function () {
      const { registry, companyOrganizationId } = await loadFixture(
        deployRegistryFixture
      );

      await expect(
        registry.registerCompany(ethers.ZeroAddress, companyOrganizationId)
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("rejects a zero organization identifier", async function () {
      const { registry, company } = await loadFixture(deployRegistryFixture);

      await expect(
        registry.registerCompany(company.address, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(registry, "InvalidOrganizationId");
    });

    it("rejects duplicate registration of the same wallet", async function () {
      const { registry, company, companyOrganizationId, testerOrganizationId } =
        await loadFixture(deployRegistryFixture);

      await registry.registerCompany(company.address, companyOrganizationId);

      await expect(
        registry.registerTester(company.address, testerOrganizationId)
      )
        .to.be.revertedWithCustomError(registry, "AlreadyRegistered")
        .withArgs(company.address);
    });

    it("rejects reading a participant that does not exist", async function () {
      const { registry, outsider } = await loadFixture(deployRegistryFixture);

      await expect(registry.getParticipant(outsider.address))
        .to.be.revertedWithCustomError(registry, "ParticipantNotFound")
        .withArgs(outsider.address);
    });
  });

  describe("Participant status", function () {
    it("suspends and reactivates a participant", async function () {
      const { registry, tester, testerOrganizationId } = await loadFixture(
        deployRegistryFixture
      );

      await registry.registerTester(tester.address, testerOrganizationId);

      await expect(registry.setParticipantActive(tester.address, false))
        .to.emit(registry, "ParticipantStatusUpdated")
        .withArgs(tester.address, false);

      expect(await registry.isActiveTester(tester.address)).to.equal(false);

      await expect(registry.setParticipantActive(tester.address, true))
        .to.emit(registry, "ParticipantStatusUpdated")
        .withArgs(tester.address, true);

      expect(await registry.isActiveTester(tester.address)).to.equal(true);
    });

    it("rejects status updates by a non-owner", async function () {
      const { registry, tester, outsider, testerOrganizationId } =
        await loadFixture(deployRegistryFixture);

      await registry.registerTester(tester.address, testerOrganizationId);

      await expect(
        registry.connect(outsider).setParticipantActive(tester.address, false)
      ).to.be.revertedWithCustomError(registry, "OnlyOwner");
    });

    it("rejects status updates for an unknown participant", async function () {
      const { registry, outsider } = await loadFixture(deployRegistryFixture);

      await expect(registry.setParticipantActive(outsider.address, false))
        .to.be.revertedWithCustomError(registry, "ParticipantNotFound")
        .withArgs(outsider.address);
    });
  });

  describe("Validator-candidate management", function () {
    it("allows the owner to enable and disable validator candidacy", async function () {
      const { registry, tester, testerOrganizationId } = await loadFixture(
        deployRegistryFixture
      );

      await registry.registerTester(tester.address, testerOrganizationId);

      await expect(registry.setValidatorCandidate(tester.address, true))
        .to.emit(registry, "ValidatorCandidateUpdated")
        .withArgs(tester.address, true);

      let participant = await registry.getParticipant(tester.address);
      expect(participant.validatorCandidate).to.equal(true);

      await expect(registry.setValidatorCandidate(tester.address, false))
        .to.emit(registry, "ValidatorCandidateUpdated")
        .withArgs(tester.address, false);

      participant = await registry.getParticipant(tester.address);
      expect(participant.validatorCandidate).to.equal(false);
    });

    it("automatically removes validator candidacy when suspended", async function () {
      const { registry, tester, testerOrganizationId } = await loadFixture(
        deployRegistryFixture
      );

      await registry.registerTester(tester.address, testerOrganizationId);
      await registry.setValidatorCandidate(tester.address, true);
      await registry.setParticipantActive(tester.address, false);

      const participant = await registry.getParticipant(tester.address);

      expect(participant.active).to.equal(false);
      expect(participant.validatorCandidate).to.equal(false);
    });

    it("does not allow an inactive participant to become a validator candidate", async function () {
      const { registry, tester, testerOrganizationId } = await loadFixture(
        deployRegistryFixture
      );

      await registry.registerTester(tester.address, testerOrganizationId);
      await registry.setParticipantActive(tester.address, false);

      await expect(registry.setValidatorCandidate(tester.address, true))
        .to.be.revertedWithCustomError(registry, "ParticipantInactive")
        .withArgs(tester.address);
    });

    it("rejects validator updates by a non-owner", async function () {
      const { registry, tester, outsider, testerOrganizationId } =
        await loadFixture(deployRegistryFixture);

      await registry.registerTester(tester.address, testerOrganizationId);

      await expect(
        registry.connect(outsider).setValidatorCandidate(tester.address, true)
      ).to.be.revertedWithCustomError(registry, "OnlyOwner");
    });

    it("rejects validator updates for an unknown participant", async function () {
      const { registry, outsider } = await loadFixture(deployRegistryFixture);

      await expect(registry.setValidatorCandidate(outsider.address, true))
        .to.be.revertedWithCustomError(registry, "ParticipantNotFound")
        .withArgs(outsider.address);
    });
  });

  describe("Organization and enumeration queries", function () {
    it("returns true when two participants have the same organization", async function () {
      const {
        registry,
        tester,
        secondTester,
        testerOrganizationId,
      } = await loadFixture(deployRegistryFixture);

      await registry.registerTester(tester.address, testerOrganizationId);
      await registry.registerTester(secondTester.address, testerOrganizationId);

      expect(
        await registry.sameOrganization(tester.address, secondTester.address)
      ).to.equal(true);
    });

    it("returns false when participants have different organizations", async function () {
      const {
        registry,
        company,
        tester,
        companyOrganizationId,
        testerOrganizationId,
      } = await loadFixture(deployRegistryFixture);

      await registry.registerCompany(company.address, companyOrganizationId);
      await registry.registerTester(tester.address, testerOrganizationId);

      expect(
        await registry.sameOrganization(company.address, tester.address)
      ).to.equal(false);
    });

    it("returns false when either address is unregistered", async function () {
      const { registry, tester, outsider, testerOrganizationId } =
        await loadFixture(deployRegistryFixture);

      await registry.registerTester(tester.address, testerOrganizationId);

      expect(
        await registry.sameOrganization(tester.address, outsider.address)
      ).to.equal(false);
    });

    it("enumerates registered participant addresses in registration order", async function () {
      const {
        registry,
        company,
        tester,
        companyOrganizationId,
        testerOrganizationId,
      } = await loadFixture(deployRegistryFixture);

      await registry.registerCompany(company.address, companyOrganizationId);
      await registry.registerTester(tester.address, testerOrganizationId);

      expect(await registry.totalParticipants()).to.equal(2n);
      expect(await registry.participantAt(0)).to.equal(company.address);
      expect(await registry.participantAt(1)).to.equal(tester.address);
    });

    it("reports inactive and unregistered accounts as not active", async function () {
      const { registry, company, outsider, companyOrganizationId } =
        await loadFixture(deployRegistryFixture);

      await registry.registerCompany(company.address, companyOrganizationId);
      await registry.setParticipantActive(company.address, false);

      expect(await registry.isActiveCompany(company.address)).to.equal(false);
      expect(await registry.isActiveCompany(outsider.address)).to.equal(false);
      expect(await registry.isActiveTester(outsider.address)).to.equal(false);

      // The default enum value for an unregistered address is None.
      expect(NONE).to.equal(0n);
    });
  });
});
