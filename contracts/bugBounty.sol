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
        string evidenceCID;
        bytes32 disputeReasonHash;
        string disputeEvidenceCID;
        Status status;
        uint256 yesVotes;
        uint256 noVotes;
    }

    uint256 public bountyCount;

    mapping(uint256 => Bounty) public bounties;
    mapping(address => bool) public arbitrators;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    address public owner;

    event BountyCreated(
    uint256 indexed bountyId,
    address indexed company,
    uint256 reward
);

event BugSubmitted(
    uint256 indexed bountyId,
    address indexed tester,
    bytes32 bugHash,
    string evidenceCID
);

event BugAccepted(
    uint256 indexed bountyId,
    address indexed tester,
    uint256 reward
);

event BugRejected(
    uint256 indexed bountyId,
    address indexed company
);

event DisputeOpened(
    uint256 indexed bountyId,
    address indexed openedBy,
    bytes32 reasonHash,
    string evidenceCID
);

event VoteCast(
    uint256 indexed bountyId,
    address indexed arbitrator,
    bool supportTester
);

event DisputeResolved(
    uint256 indexed bountyId,
    bool testerWon,
    uint256 yesVotes,
    uint256 noVotes
);

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
            evidenceCID: "",
            disputeReasonHash: bytes32(0),
            disputeEvidenceCID: "",
            status: Status.Open,
            yesVotes: 0,
            noVotes: 0
        });

        emit BountyCreated(bountyCount, msg.sender, msg.value);   
    }

    function submitBug(
    uint256 _bountyId,
    bytes32 _bugHash,
    string calldata _evidenceCID
    ) external {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == Status.Open, "Bounty is not open");
        require(_bugHash != bytes32(0), "Invalid bug hash");

        bounty.tester = msg.sender;
        bounty.bugHash = _bugHash;
        bounty.evidenceCID = _evidenceCID;
        bounty.status = Status.Submitted;
        emit BugSubmitted(_bountyId, msg.sender, _bugHash, _evidenceCID);
    }

    function acceptBug(uint256 _bountyId) external onlyCompany(_bountyId) {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == Status.Submitted, "Bug not submitted yet");

        bounty.status = Status.Accepted;
        uint256 amount = bounty.reward;


        payable(bounty.tester).transfer(bounty.reward);
        bounty.reward = 0;
        emit BugAccepted(_bountyId, bounty.tester, amount);
    }

    function rejectBug(uint256 _bountyId) external onlyCompany(_bountyId) {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == Status.Submitted, "Bug not submitted yet");

        bounty.status = Status.Rejected;
        emit BugRejected(_bountyId, msg.sender);
    }

    function openDispute(
    uint256 _bountyId,
    bytes32 _reasonHash,
    string calldata _evidenceCID
     ) external onlyTester(_bountyId) {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == Status.Rejected, "Bug must be rejected first");

        bounty.status = Status.Disputed;
        bounty.disputeReasonHash = _reasonHash;
        bounty.disputeEvidenceCID = _evidenceCID;

        emit DisputeOpened(_bountyId, msg.sender, _reasonHash, _evidenceCID);
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
        emit VoteCast(_bountyId, msg.sender, _supportTester);
    }

    function resolveDispute(uint256 _bountyId) external {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == Status.Disputed, "Bounty is not disputed");
        require(bounty.yesVotes + bounty.noVotes >= 3, "Need at least 3 votes");

        bounty.status = Status.Resolved;

        bool testerWon = bounty.yesVotes > bounty.noVotes;
        uint256 amount = bounty.reward;
        bounty.reward = 0;

           if (testerWon) {
             payable(bounty.tester).transfer(amount);
           } else {
             payable(bounty.company).transfer(amount);
           }
        emit DisputeResolved(_bountyId, testerWon, bounty.yesVotes, bounty.noVotes);
    }
}