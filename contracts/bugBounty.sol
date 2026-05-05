// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract BugBounty {
    enum SubmissionStatus {
        Pending,
        Accepted,
        Rejected
    }

    struct Bounty {
        address company;
        uint256 reward;
        uint256 remainingReward;
        uint256 deadline;
        bool closed;
    }

    struct Submission {
        uint256 bountyId;
        address tester;
        bytes32 bugHash;
        string evidenceCID;
        SubmissionStatus status;
        uint256 rewardPaid;
    }

    uint256 public bountyCount;
    uint256 public submissionCount;

    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => Submission) public submissions;
    mapping(uint256 => uint256[]) public bountySubmissions;

    address public owner;

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed company,
        uint256 reward,
        uint256 deadline
    );

    event BugSubmitted(
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        address indexed tester,
        bytes32 bugHash,
        string evidenceCID
    );

    event SubmissionAccepted(
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        address indexed tester,
        uint256 rewardPaid
    );

    event SubmissionRejected(
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        address indexed tester
    );

    event BountyClosed(
        uint256 indexed bountyId,
        uint256 refundedAmount
    );

    constructor() {
        owner = msg.sender;
    }

    modifier onlyCompany(uint256 _bountyId) {
        require(
            msg.sender == bounties[_bountyId].company,
            "Only company can do this"
        );
        _;
    }

    function createBounty(uint256 _durationInSeconds) external payable {
        require(msg.value > 0, "Reward must be greater than 0");
        require(_durationInSeconds > 0, "Duration must be greater than 0");

        bountyCount++;

        uint256 deadline = block.timestamp + _durationInSeconds;

        bounties[bountyCount] = Bounty({
            company: msg.sender,
            reward: msg.value,
            remainingReward: msg.value,
            deadline: deadline,
            closed: false
        });

        emit BountyCreated(
            bountyCount,
            msg.sender,
            msg.value,
            deadline
        );
    }

    function submitBug(
        uint256 _bountyId,
        bytes32 _bugHash,
        string calldata _evidenceCID
    ) external {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.company != address(0), "Bounty does not exist");
        require(!bounty.closed, "Bounty is closed");
        require(block.timestamp <= bounty.deadline, "Deadline passed");
        require(_bugHash != bytes32(0), "Invalid bug hash");

        submissionCount++;

        submissions[submissionCount] = Submission({
            bountyId: _bountyId,
            tester: msg.sender,
            bugHash: _bugHash,
            evidenceCID: _evidenceCID,
            status: SubmissionStatus.Pending,
            rewardPaid: 0
        });

        bountySubmissions[_bountyId].push(submissionCount);

        emit BugSubmitted(
            _bountyId,
            submissionCount,
            msg.sender,
            _bugHash,
            _evidenceCID
        );
    }

    function acceptSubmission(
        uint256 _bountyId,
        uint256 _submissionId,
        uint256 _rewardAmount
    ) external onlyCompany(_bountyId) {
        Bounty storage bounty = bounties[_bountyId];
        Submission storage submission = submissions[_submissionId];

        require(bounty.company != address(0), "Bounty does not exist");
        require(!bounty.closed, "Bounty is closed");
        require(block.timestamp > bounty.deadline, "Deadline not passed yet");
        require(
            submission.bountyId == _bountyId,
            "Submission does not belong to bounty"
        );
        require(
            submission.status == SubmissionStatus.Pending,
            "Submission already reviewed"
        );
        require(_rewardAmount > 0, "Reward must be greater than 0");
        require(
            _rewardAmount <= bounty.remainingReward,
            "Not enough remaining reward"
        );

        submission.status = SubmissionStatus.Accepted;
        submission.rewardPaid = _rewardAmount;
        bounty.remainingReward -= _rewardAmount;

        payable(submission.tester).transfer(_rewardAmount);

        emit SubmissionAccepted(
            _bountyId,
            _submissionId,
            submission.tester,
            _rewardAmount
        );
    }

    function rejectSubmission(
        uint256 _bountyId,
        uint256 _submissionId
    ) external onlyCompany(_bountyId) {
        Bounty storage bounty = bounties[_bountyId];
        Submission storage submission = submissions[_submissionId];

        require(bounty.company != address(0), "Bounty does not exist");
        require(!bounty.closed, "Bounty is closed");
        require(block.timestamp > bounty.deadline, "Deadline not passed yet");
        require(
            submission.bountyId == _bountyId,
            "Submission does not belong to bounty"
        );
        require(
            submission.status == SubmissionStatus.Pending,
            "Submission already reviewed"
        );

        submission.status = SubmissionStatus.Rejected;

        emit SubmissionRejected(
            _bountyId,
            _submissionId,
            submission.tester
        );
    }

    function closeBounty(uint256 _bountyId) external onlyCompany(_bountyId) {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.company != address(0), "Bounty does not exist");
        require(!bounty.closed, "Bounty already closed");
        require(block.timestamp > bounty.deadline, "Deadline not passed yet");

        bounty.closed = true;

        uint256 refundAmount = bounty.remainingReward;
        bounty.remainingReward = 0;

        if (refundAmount > 0) {
            payable(bounty.company).transfer(refundAmount);
        }

        emit BountyClosed(_bountyId, refundAmount);
    }

    function getBountySubmissions(
        uint256 _bountyId
    ) external view returns (uint256[] memory) {
        return bountySubmissions[_bountyId];
    }
}