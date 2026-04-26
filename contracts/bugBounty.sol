// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract BugBounty {
    enum Status {
        Open,
        Submitted,
        Accepted,
        Rejected,
        Disputed,
        Resolved
    }

    struct Bounty {
        address company; //The company wallet address.
        address tester; // The tester wallet address.
        uint256 reward;
        bytes32 bugHash;
        Status status;
        uint256 yesVotes;
        uint256 noVotes;
    }

    uint256 public bountyCount;

    mapping(uint256 => Bounty) public bounties;
    mapping(address => bool) public arbitrators;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can do this");
        _;
    }

    modifier onlyCompany(uint256 _bountyId) {
        require(msg.sender == bounties[_bountyId].company, "Only company can do this");
        _;
    }

    modifier onlyTester(uint256 _bountyId) {
        require(msg.sender == bounties[_bountyId].tester, "Only tester can do this");
        _;
    }

    modifier onlyArbitrator() {
        require(arbitrators[msg.sender], "Only arbitrator can do this");
        _;
    }

    function addArbitrator(address _arbitrator) external onlyOwner {
        arbitrators[_arbitrator] = true;
    }

    function createBounty() external payable {
        require(msg.value > 0, "Reward must be greater than 0");

        bountyCount++;

        bounties[bountyCount] = Bounty({
            company: msg.sender,
            tester: address(0),
            reward: msg.value,
            bugHash: bytes32(0),
            status: Status.Open,
            yesVotes: 0,
            noVotes: 0
        });
    }

    function submitBug(uint256 _bountyId, bytes32 _bugHash) external {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == Status.Open, "Bounty is not open");
        require(_bugHash != bytes32(0), "Invalid bug hash");

        bounty.tester = msg.sender;
        bounty.bugHash = _bugHash;
        bounty.status = Status.Submitted;
    }

    function acceptBug(uint256 _bountyId) external onlyCompany(_bountyId) {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == Status.Submitted, "Bug not submitted yet");

        bounty.status = Status.Accepted;

        payable(bounty.tester).transfer(bounty.reward);
    }

    function rejectBug(uint256 _bountyId) external onlyCompany(_bountyId) {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == Status.Submitted, "Bug not submitted yet");

        bounty.status = Status.Rejected;
    }

    function openDispute(uint256 _bountyId) external onlyTester(_bountyId) {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == Status.Rejected, "Bug must be rejected first");

        bounty.status = Status.Disputed;
    }

    function vote(uint256 _bountyId, bool _supportTester) external onlyArbitrator {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == Status.Disputed, "Bounty is not disputed");
        require(!hasVoted[_bountyId][msg.sender], "Already voted");

        hasVoted[_bountyId][msg.sender] = true;

        if (_supportTester) {
            bounty.yesVotes++;
        } else {
            bounty.noVotes++;
        }
    }

    function resolveDispute(uint256 _bountyId) external {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == Status.Disputed, "Bounty is not disputed");
        require(bounty.yesVotes + bounty.noVotes >= 3, "Need at least 3 votes");

        bounty.status = Status.Resolved;

        if (bounty.yesVotes > bounty.noVotes) {
            payable(bounty.tester).transfer(bounty.reward);
        } else {
            payable(bounty.company).transfer(bounty.reward);
        }
    }
}