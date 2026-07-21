// SPDX-License-Identifier: MIT
// This line declares the open-source license used by this contract.

pragma solidity ^0.8.28;
// This contract can be compiled with Solidity 0.8.28 or a compatible later 0.8.x version.

/// @notice Minimal interface used to communicate with ParticipantRegistry.
/// @dev An interface contains function declarations but no implementation.
interface IParticipantRegistry {
    function isActiveCompany(address account) external view returns (bool);

    function isActiveTester(address account) external view returns (bool);
}

/// @title Bug Bounty Escrow
/// @notice Holds bounty funds and manages vulnerability submissions and reviews.
contract BugBountyEscrow {
    /// @notice Lifecycle status of a bounty.
    enum BountyStatus {
        None,      // Default value; the bounty does not exist.
        Open,      // Testers may submit reports during the configured time period.
        Closed,    // The bounty ended and the remaining escrow was returned.
        Cancelled  // The company cancelled before receiving any submission.
    }

    /// @notice Lifecycle status of one vulnerability submission.
    enum SubmissionStatus {
        None,      // Default value; the submission does not exist.
        Submitted, // The tester submitted the report and the company must review it.
        Accepted,  // The company accepted it and allocated a reward.
        Rejected   // The company rejected it and recorded a reason hash.
    }

    /// @notice Stores one bounty program.
    struct Bounty {
        address company;            // Company wallet that created the bounty.
        bytes32 metadataHash;       // Hash of the complete bounty metadata.
        string metadataCID;         // CID of the off-chain bounty metadata.
        uint256 totalEscrow;        // Original amount deposited by the company.
        uint256 availableEscrow;    // Amount not yet allocated or refunded.
        uint64 startTime;           // Time from which testers may submit reports.
        uint64 endTime;             // Final submission time.
        uint64 refundAvailableAt;   // Earliest time remaining escrow can be refunded.
        BountyStatus status;        // Current bounty status.
    }

    /// @notice Stores one tester's vulnerability submission.
    struct Submission {
        uint256 bountyId;                 // Bounty receiving this submission.
        address tester;                   // Tester wallet that submitted the bug.
        bytes32 reportHash;               // Cryptographic hash of the full report.
        string encryptedEvidenceCID;      // CID of encrypted off-chain evidence.
        bytes32 rejectionReasonHash;      // Hash of the company's rejection explanation.
        uint256 requestedReward;          // Reward requested by the tester.
        uint256 approvedReward;           // Reward approved by the company.
        uint64 submittedAt;               // Submission timestamp.
        uint64 rejectedAt;                // Rejection timestamp; zero until rejected.
        SubmissionStatus status;          // Current submission status.
    }

    /// @notice Temporary dispute period reserved for the future ArbitrationContract.
    uint64 public constant DISPUTE_WINDOW = 3 days;

    /// @notice Escrow administrator, currently used for emergency pause control.
    address public owner;

    /// @notice Address of the deployed ParticipantRegistry contract.
    IParticipantRegistry public immutable participantRegistry;

    /// @notice Total number of bounties created.
    uint256 public bountyCount;

    /// @notice Total number of vulnerability submissions created.
    uint256 public submissionCount;

    /// @notice True when sensitive escrow operations are temporarily paused.
    bool public paused;

    /// @dev Reentrancy lock: 1 means unlocked and 2 means locked.
    uint256 private reentrancyLock = 1;

    /// @dev Stores bounties by bounty ID.
    mapping(uint256 => Bounty) private bounties;

    /// @dev Stores submissions by submission ID.
    mapping(uint256 => Submission) private submissions;

    /// @notice Total number of reports ever submitted to each bounty.
    mapping(uint256 => uint256) public bountySubmissionCount;

    /// @notice Number of reports still waiting for company review.
    mapping(uint256 => uint256) public pendingSubmissionCount;

    /// @notice Prevents the same report hash from being submitted twice to one bounty.
    mapping(uint256 => mapping(bytes32 => bool)) public reportHashUsed;

    /// @notice Ether balances that users can safely withdraw themselves.
    mapping(address => uint256) public pendingWithdrawals;

    // Administrative and security errors.
    error OnlyOwner();
    error ContractPaused();
    error ContractNotPaused();
    error ReentrantCall();
    error ZeroAddress();
    error InvalidRegistryContract();

    // Participant permission errors.
    error NotRegisteredCompany();
    error NotRegisteredTester();

    // Bounty and submission lookup errors.
    error InvalidBountyId(uint256 bountyId);
    error InvalidSubmissionId(uint256 submissionId);
    error NotBountyCompany();

    // Input validation errors.
    error InvalidAmount();
    error InvalidHash();
    error EmptyCID();
    error InvalidTimeRange();

    // Workflow errors.
    error BountyNotOpen();
    error BountyNotStarted();
    error BountyExpired();
    error CompanyCannotSubmitOwnBounty();
    error DuplicateReportHash();
    error SubmissionNotPending();
    error InsufficientEscrow();
    error BountyHasSubmissions();
    error BountyNotExpired();
    error PendingSubmissionsExist();
    error DisputeWindowStillOpen();

    // Payment errors.
    error NothingToWithdraw();
    error TransferFailed();
    error DirectPaymentsNotAllowed();

    /// @notice Emitted when escrow ownership changes.
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /// @notice Emitted when the emergency pause is enabled.
    event ContractPausedBy(address indexed account);

    /// @notice Emitted when the emergency pause is disabled.
    event ContractUnpausedBy(address indexed account);

    /// @notice Emitted after a company creates and funds a bounty.
    event BountyCreated(
        uint256 indexed bountyId,
        address indexed company,
        uint256 escrowAmount,
        bytes32 metadataHash,
        string metadataCID,
        uint64 startTime,
        uint64 endTime
    );

    /// @notice Emitted after a tester submits an encrypted vulnerability report.
    event BugSubmitted(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        address indexed tester,
        bytes32 reportHash,
        string encryptedEvidenceCID,
        uint256 requestedReward
    );

    /// @notice Emitted after a company accepts a report.
    event SubmissionAccepted(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        address indexed tester,
        uint256 approvedReward
    );

    /// @notice Emitted after a company rejects a report.
    event SubmissionRejected(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        bytes32 rejectionReasonHash,
        uint64 disputeDeadline
    );

    /// @notice Emitted after a bounty with no submissions is cancelled.
    event BountyCancelled(
        uint256 indexed bountyId,
        address indexed company,
        uint256 refundAmount
    );

    /// @notice Emitted after an expired bounty is closed.
    event BountyClosed(
        uint256 indexed bountyId,
        address indexed company,
        uint256 refundAmount
    );

    /// @notice Emitted after a tester or company withdraws Ether.
    event Withdrawal(
        address indexed account,
        uint256 amount
    );

    /// @param registryAddress Address of the previously deployed ParticipantRegistry.
    constructor(address registryAddress) {
        if (registryAddress == address(0)) revert ZeroAddress();

        // code.length is zero for an ordinary wallet address.
        if (registryAddress.code.length == 0) {
            revert InvalidRegistryContract();
        }

        owner = msg.sender;

        // Converts the supplied address into the registry interface type.
        participantRegistry = IParticipantRegistry(registryAddress);

        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @dev Restricts a function so only the escrow owner can call it.
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    /// @dev Stops protected functions while the contract is paused.
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    /// @dev Prevents a function from being entered again before it finishes.
    modifier nonReentrant() {
        if (reentrancyLock != 1) revert ReentrantCall();

        reentrancyLock = 2;
        _;
        reentrancyLock = 1;
    }

    /// @notice Transfers escrow administration to another wallet.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();

        address previousOwner = owner;
        owner = newOwner;

        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /// @notice Temporarily stops new escrow workflow operations.
    function pause() external onlyOwner {
        if (paused) revert ContractPaused();

        paused = true;
        emit ContractPausedBy(msg.sender);
    }

    /// @notice Restarts escrow workflow operations.
    function unpause() external onlyOwner {
        if (!paused) revert ContractNotPaused();

        paused = false;
        emit ContractUnpausedBy(msg.sender);
    }

    /// @notice Creates a new bounty and locks msg.value as escrow.
    /// @param metadataHash Hash of the full off-chain bounty specification.
    /// @param metadataCID CID containing the bounty specification.
    /// @param startTime Start timestamp; pass zero to start immediately.
    /// @param endTime Final timestamp for bug submissions.
    function createBounty(
        bytes32 metadataHash,
        string calldata metadataCID,
        uint64 startTime,
        uint64 endTime
    ) external payable whenNotPaused returns (uint256 bountyId) {
        // Only an active registered company can create a bounty.
        if (!participantRegistry.isActiveCompany(msg.sender)) {
            revert NotRegisteredCompany();
        }

        // msg.value is the amount of native blockchain currency sent with this call.
        if (msg.value == 0) revert InvalidAmount();
        if (metadataHash == bytes32(0)) revert InvalidHash();
        if (bytes(metadataCID).length == 0) revert EmptyCID();

        // A zero start time means the bounty starts in the current block.
        uint64 effectiveStartTime = startTime == 0
            ? uint64(block.timestamp)
            : startTime;

        // The start cannot be in the past, and the end must follow the start.
        if (
            effectiveStartTime < block.timestamp ||
            endTime <= effectiveStartTime
        ) {
            revert InvalidTimeRange();
        }

        // Pre-increment generates IDs starting from 1.
        bountyId = ++bountyCount;

        // Saves the new bounty and its escrow accounting information.
        bounties[bountyId] = Bounty({
            company: msg.sender,
            metadataHash: metadataHash,
            metadataCID: metadataCID,
            totalEscrow: msg.value,
            availableEscrow: msg.value,
            startTime: effectiveStartTime,
            endTime: endTime,
            refundAvailableAt: endTime,
            status: BountyStatus.Open
        });

        emit BountyCreated(
            bountyId,
            msg.sender,
            msg.value,
            metadataHash,
            metadataCID,
            effectiveStartTime,
            endTime
        );
    }

    /// @notice Submits one vulnerability report to a bounty.
    /// @param bountyId Target bounty ID.
    /// @param reportHash Hash of the original complete vulnerability report.
    /// @param encryptedEvidenceCID CID of encrypted evidence stored off-chain.
    /// @param requestedReward Reward requested by the tester.
    function submitBug(
        uint256 bountyId,
        bytes32 reportHash,
        string calldata encryptedEvidenceCID,
        uint256 requestedReward
    ) external whenNotPaused returns (uint256 submissionId) {
        // Only an active registered tester can submit a report.
        if (!participantRegistry.isActiveTester(msg.sender)) {
            revert NotRegisteredTester();
        }

        // Loads the target bounty or reverts when the ID does not exist.
        Bounty storage bounty = _getBountyStorage(bountyId);

        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();
        if (block.timestamp < bounty.startTime) revert BountyNotStarted();
        if (block.timestamp > bounty.endTime) revert BountyExpired();

        // Prevents a company wallet from reporting its own bounty.
        if (msg.sender == bounty.company) {
            revert CompanyCannotSubmitOwnBounty();
        }

        if (reportHash == bytes32(0)) revert InvalidHash();
        if (bytes(encryptedEvidenceCID).length == 0) revert EmptyCID();
        if (requestedReward == 0) revert InvalidAmount();

        // A request larger than the currently available escrow cannot be honored.
        if (requestedReward > bounty.availableEscrow) {
            revert InsufficientEscrow();
        }

        // Prevents exact duplicate report hashes within the same bounty.
        if (reportHashUsed[bountyId][reportHash]) {
            revert DuplicateReportHash();
        }

        // Mark the hash before saving the submission.
        reportHashUsed[bountyId][reportHash] = true;

        submissionId = ++submissionCount;

        submissions[submissionId] = Submission({
            bountyId: bountyId,
            tester: msg.sender,
            reportHash: reportHash,
            encryptedEvidenceCID: encryptedEvidenceCID,
            rejectionReasonHash: bytes32(0),
            requestedReward: requestedReward,
            approvedReward: 0,
            submittedAt: uint64(block.timestamp),
            rejectedAt: 0,
            status: SubmissionStatus.Submitted
        });

        // One counter records all reports; the other records only reports awaiting review.
        bountySubmissionCount[bountyId]++;
        pendingSubmissionCount[bountyId]++;

        emit BugSubmitted(
            submissionId,
            bountyId,
            msg.sender,
            reportHash,
            encryptedEvidenceCID,
            requestedReward
        );
    }

    /// @notice Accepts a submitted report and allocates a tester reward.
    /// @param submissionId Submission being accepted.
    /// @param approvedReward Amount approved by the company.
    function acceptSubmission(
        uint256 submissionId,
        uint256 approvedReward
    ) external whenNotPaused {
        Submission storage submission = _getSubmissionStorage(submissionId);
        Bounty storage bounty = _getBountyStorage(submission.bountyId);

        // Only the company that owns this bounty can review the report.
        if (msg.sender != bounty.company) revert NotBountyCompany();

        if (submission.status != SubmissionStatus.Submitted) {
            revert SubmissionNotPending();
        }

        // The company may approve the requested amount or a smaller amount.
        if (
            approvedReward == 0 ||
            approvedReward > submission.requestedReward
        ) {
            revert InvalidAmount();
        }

        if (approvedReward > bounty.availableEscrow) {
            revert InsufficientEscrow();
        }

        // Effects: update all state before any Ether transfer is attempted later.
        submission.status = SubmissionStatus.Accepted;
        submission.approvedReward = approvedReward;
        bounty.availableEscrow -= approvedReward;
        pendingSubmissionCount[submission.bountyId]--;

        // The tester withdraws this amount separately using withdraw().
        pendingWithdrawals[submission.tester] += approvedReward;

        emit SubmissionAccepted(
            submissionId,
            submission.bountyId,
            submission.tester,
            approvedReward
        );
    }

    /// @notice Rejects a submitted report and records a rejection reason hash.
    function rejectSubmission(
        uint256 submissionId,
        bytes32 rejectionReasonHash
    ) external whenNotPaused {
        Submission storage submission = _getSubmissionStorage(submissionId);
        Bounty storage bounty = _getBountyStorage(submission.bountyId);

        if (msg.sender != bounty.company) revert NotBountyCompany();

        if (submission.status != SubmissionStatus.Submitted) {
            revert SubmissionNotPending();
        }

        if (rejectionReasonHash == bytes32(0)) revert InvalidHash();

        uint64 rejectedAt = uint64(block.timestamp);
        uint64 disputeDeadline = rejectedAt + DISPUTE_WINDOW;

        submission.status = SubmissionStatus.Rejected;
        submission.rejectionReasonHash = rejectionReasonHash;
        submission.rejectedAt = rejectedAt;

        pendingSubmissionCount[submission.bountyId]--;

        // The remaining escrow cannot be refunded before this rejection's dispute window ends.
        if (disputeDeadline > bounty.refundAvailableAt) {
            bounty.refundAvailableAt = disputeDeadline;
        }

        emit SubmissionRejected(
            submissionId,
            submission.bountyId,
            rejectionReasonHash,
            disputeDeadline
        );
    }

    /// @notice Cancels a bounty only when no tester has submitted a report.
    function cancelBounty(uint256 bountyId) external whenNotPaused {
        Bounty storage bounty = _getBountyStorage(bountyId);

        if (msg.sender != bounty.company) revert NotBountyCompany();
        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();

        // Protects testers by preventing cancellation after a report exists.
        if (bountySubmissionCount[bountyId] != 0) {
            revert BountyHasSubmissions();
        }

        uint256 refundAmount = bounty.availableEscrow;

        // Move the refund into the company's withdrawal balance.
        bounty.status = BountyStatus.Cancelled;
        bounty.availableEscrow = 0;
        pendingWithdrawals[bounty.company] += refundAmount;

        emit BountyCancelled(
            bountyId,
            bounty.company,
            refundAmount
        );
    }

    /// @notice Closes an expired bounty and returns unused escrow to the company.
    function closeExpiredBounty(uint256 bountyId) external whenNotPaused {
        Bounty storage bounty = _getBountyStorage(bountyId);

        if (msg.sender != bounty.company) revert NotBountyCompany();
        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();
        if (block.timestamp <= bounty.endTime) revert BountyNotExpired();

        // All submitted reports must first be accepted or rejected.
        if (pendingSubmissionCount[bountyId] != 0) {
            revert PendingSubmissionsExist();
        }

        // The last rejection's dispute period must also be over.
        if (block.timestamp <= bounty.refundAvailableAt) {
            revert DisputeWindowStillOpen();
        }

        uint256 refundAmount = bounty.availableEscrow;

        bounty.status = BountyStatus.Closed;
        bounty.availableEscrow = 0;
        pendingWithdrawals[bounty.company] += refundAmount;

        emit BountyClosed(
            bountyId,
            bounty.company,
            refundAmount
        );
    }

    /// @notice Withdraws the caller's accepted reward or refund.
    /// @dev Withdrawal remains available even when the main workflow is paused.
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];

        if (amount == 0) revert NothingToWithdraw();

        // Set the balance to zero before the external call.
        pendingWithdrawals[msg.sender] = 0;

        // call forwards Ether and returns whether the payment succeeded.
        (bool success, ) = payable(msg.sender).call{value: amount}("");

        // Reverting also restores pendingWithdrawals if the payment failed.
        if (!success) revert TransferFailed();

        emit Withdrawal(msg.sender, amount);
    }

    /// @notice Returns one complete bounty record.
    function getBounty(
        uint256 bountyId
    ) external view returns (Bounty memory) {
        Bounty memory bounty = bounties[bountyId];

        if (bounty.status == BountyStatus.None) {
            revert InvalidBountyId(bountyId);
        }

        return bounty;
    }

    /// @notice Returns one complete submission record.
    function getSubmission(
        uint256 submissionId
    ) external view returns (Submission memory) {
        Submission memory submission = submissions[submissionId];

        if (submission.status == SubmissionStatus.None) {
            revert InvalidSubmissionId(submissionId);
        }

        return submission;
    }

    /// @dev Returns a writable bounty storage reference after validating its ID.
    function _getBountyStorage(
        uint256 bountyId
    ) private view returns (Bounty storage bounty) {
        bounty = bounties[bountyId];

        if (bounty.status == BountyStatus.None) {
            revert InvalidBountyId(bountyId);
        }
    }

    /// @dev Returns a writable submission storage reference after validating its ID.
    function _getSubmissionStorage(
        uint256 submissionId
    ) private view returns (Submission storage submission) {
        submission = submissions[submissionId];

        if (submission.status == SubmissionStatus.None) {
            revert InvalidSubmissionId(submissionId);
        }
    }

    /// @notice Rejects Ether sent directly without calling createBounty().
    receive() external payable {
        revert DirectPaymentsNotAllowed();
    }
}
