// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title Bug Bounty Escrow with Off-Chain Participant Authorization
/// @notice Participant profiles, roles and active status live in PostgreSQL.
///         A trusted backend verifies PostgreSQL and signs short-lived EIP-712
///         authorizations. This contract verifies those signatures before
///         allowing protected actions.
contract BugBountyEscrow is EIP712 {
    using ECDSA for bytes32;

    enum ParticipantRole {
        None,
        Company,
        Tester
    }

    enum AuthorizedAction {
        None,
        CreateBounty,
        SubmitBug,
        AcceptSubmission,
        RejectSubmission,
        CancelBounty,
        CloseExpiredBounty
    }

    enum BountyStatus {
        None,
        Open,
        Closed,
        Cancelled
    }

    enum SubmissionStatus {
        None,
        Submitted,
        Accepted,
        Rejected
    }

    /// @notice Data signed by the trusted backend verifier.
    /// @dev EIP-712 encodes the enum values as uint8 values.
    struct Authorization {
        address user;
        ParticipantRole role;
        bytes32 organizationId;
        AuthorizedAction action;
        bytes32 actionHash;
        uint256 nonce;
        uint256 deadline;
    }

    struct Bounty {
        address company;
        bytes32 companyOrganizationId;
        bytes32 metadataHash;
        string metadataCID;
        uint256 totalEscrow;
        uint256 availableEscrow;
        uint64 startTime;
        uint64 endTime;
        uint64 refundAvailableAt;
        BountyStatus status;
    }

    struct Submission {
        uint256 bountyId;
        address tester;
        bytes32 testerOrganizationId;
        bytes32 reportHash;
        string encryptedEvidenceCID;
        bytes32 rejectionReasonHash;
        uint256 requestedReward;
        uint256 approvedReward;
        uint64 submittedAt;
        uint64 rejectedAt;
        SubmissionStatus status;
    }

    uint64 public constant DISPUTE_WINDOW = 3 days;

    bytes32 private constant AUTHORIZATION_TYPEHASH =
        keccak256(
            "Authorization(address user,uint8 role,bytes32 organizationId,uint8 action,bytes32 actionHash,uint256 nonce,uint256 deadline)"
        );

    address public owner;
    address public trustedVerifier;

    uint256 public bountyCount;
    uint256 public submissionCount;
    bool public paused;

    uint256 private reentrancyLock = 1;

    bytes32 private constant REWARD_APPROVAL_TYPEHASH =
    keccak256(
        "RewardApproval(uint256 bountyId,bytes32 reportHash,address tester,uint256 rewardAmount,uint256 nonce,uint256 deadline)"
    );

mapping(uint256 => uint256) public payoutNonces;

mapping(uint256 => mapping(bytes32 => bool))
    public rewardClaimedForReportHash;

    mapping(uint256 => Bounty) private bounties;
    mapping(uint256 => Submission) private submissions;

    mapping(uint256 => uint256) public bountySubmissionCount;
    mapping(uint256 => uint256) public pendingSubmissionCount;
    mapping(uint256 => mapping(bytes32 => bool)) public reportHashUsed;
    mapping(address => uint256) public pendingWithdrawals;

    /// @notice The next authorization nonce expected from each wallet.
    mapping(address => uint256) public authorizationNonces;

    error OnlyOwner();
    error ContractPaused();
    error ContractNotPaused();
    error ReentrantCall();
    error ZeroAddress();
    error VerifierMustBeExternallyOwnedAccount();

    error RewardApprovalExpired();
error RewardNonceMismatch(
    uint256 expected,
    uint256 received
);
error RewardAlreadyClaimed();
error InvalidRewardSigner();

    error InvalidBountyId(uint256 bountyId);
    error InvalidSubmissionId(uint256 submissionId);
    error NotBountyCompany();

    error InvalidAmount();
    error InvalidHash();
    error EmptyCID();
    error InvalidTimeRange();
    error InvalidOrganizationId();

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

    error NothingToWithdraw();
    error TransferFailed();
    error DirectPaymentsNotAllowed();

    error AuthorizationUserMismatch();
    error AuthorizationRoleMismatch();
    error AuthorizationActionMismatch();
    error AuthorizationActionHashMismatch();
    error AuthorizationExpired();
    error AuthorizationNonceMismatch(uint256 expected, uint256 received);
    error InvalidAuthorizationSigner();
    error AuthorizationOrganizationMismatch();
    error InvalidNonceUpdate();

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    event TrustedVerifierUpdated(
        address indexed previousVerifier,
        address indexed newVerifier
    );

    event AuthorizationConsumed(
        address indexed user,
        uint256 indexed nonce,
        AuthorizedAction indexed action,
        bytes32 organizationId,
        bytes32 actionHash
    );

    event AuthorizationNonceInvalidated(
        address indexed user,
        uint256 previousNonce,
        uint256 newNonce
    );

    event ContractPausedBy(address indexed account);
    event ContractUnpausedBy(address indexed account);

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed company,
        bytes32 indexed companyOrganizationId,
        uint256 escrowAmount,
        bytes32 metadataHash,
        string metadataCID,
        uint64 startTime,
        uint64 endTime
    );

    event BugSubmitted(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        address indexed tester,
        bytes32 testerOrganizationId,
        bytes32 reportHash,
        string encryptedEvidenceCID,
        uint256 requestedReward
    );

    event SubmissionAccepted(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        address indexed tester,
        uint256 approvedReward
    );

    event RewardClaimed(
    uint256 indexed bountyId,
    bytes32 indexed reportHash,
    address indexed tester,
    uint256 rewardAmount
);

    event SubmissionRejected(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        bytes32 rejectionReasonHash,
        uint64 disputeDeadline
    );

    event BountyCancelled(
        uint256 indexed bountyId,
        address indexed company,
        uint256 refundAmount
    );

    event BountyClosed(
        uint256 indexed bountyId,
        address indexed company,
        uint256 refundAmount
    );

    event Withdrawal(address indexed account, uint256 amount);

    /// @param verifierAddress Backend verifier wallet whose EIP-712 signatures
    ///        authorize active and verified PostgreSQL participants.
    constructor(address verifierAddress)
        EIP712("BugBountyEscrow", "1")
    {
        _validateVerifier(verifierAddress);

        owner = msg.sender;
        trustedVerifier = verifierAddress;

        emit OwnershipTransferred(address(0), msg.sender);
        emit TrustedVerifierUpdated(address(0), verifierAddress);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier nonReentrant() {
        if (reentrancyLock != 1) revert ReentrantCall();

        reentrancyLock = 2;
        _;
        reentrancyLock = 1;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();

        address previousOwner = owner;
        owner = newOwner;

        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /// @notice Rotates the backend authorization signer.
    /// @dev Existing signatures from the previous verifier immediately stop working.
    function setTrustedVerifier(address newVerifier) external onlyOwner {
        _validateVerifier(newVerifier);

        address previousVerifier = trustedVerifier;
        trustedVerifier = newVerifier;

        emit TrustedVerifierUpdated(previousVerifier, newVerifier);
    }

    /// @notice Invalidates outstanding authorizations for one wallet.
    /// @dev Useful for emergency revocation after an account is made inactive
    ///      in PostgreSQL. newNonce must be greater than the current nonce.
    function invalidateAuthorizationNonce(
        address user,
        uint256 newNonce
    ) external onlyOwner {
        if (user == address(0)) revert ZeroAddress();

        uint256 previousNonce = authorizationNonces[user];

        if (newNonce <= previousNonce) {
            revert InvalidNonceUpdate();
        }

        authorizationNonces[user] = newNonce;

        emit AuthorizationNonceInvalidated(
            user,
            previousNonce,
            newNonce
        );
    }

    function pause() external onlyOwner {
        if (paused) revert ContractPaused();

        paused = true;
        emit ContractPausedBy(msg.sender);
    }

    function unpause() external onlyOwner {
        if (!paused) revert ContractNotPaused();

        paused = false;
        emit ContractUnpausedBy(msg.sender);
    }

    /// @notice Hashes the exact create-bounty operation that the backend signs.
    function hashCreateBountyAction(
        bytes32 metadataHash,
        string calldata metadataCID,
        uint64 startTime,
        uint64 endTime,
        uint256 escrowAmount
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                metadataHash,
                keccak256(bytes(metadataCID)),
                startTime,
                endTime,
                escrowAmount
            )
        );
    }

    function hashSubmitBugAction(
        uint256 bountyId,
        bytes32 reportHash,
        string calldata encryptedEvidenceCID,
        uint256 requestedReward
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                bountyId,
                reportHash,
                keccak256(bytes(encryptedEvidenceCID)),
                requestedReward
            )
        );
    }

    function hashAcceptSubmissionAction(
        uint256 submissionId,
        uint256 approvedReward
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(submissionId, approvedReward)
        );
    }

    function hashRejectSubmissionAction(
        uint256 submissionId,
        bytes32 rejectionReasonHash
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(submissionId, rejectionReasonHash)
        );
    }

    function hashCancelBountyAction(
        uint256 bountyId
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(bountyId));
    }

    function hashCloseExpiredBountyAction(
        uint256 bountyId
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(bountyId));
    }

    function createBounty(
        bytes32 metadataHash,
        string calldata metadataCID,
        uint64 startTime,
        uint64 endTime,
        Authorization calldata authorization,
        bytes calldata signature
    )
        external
        payable
        whenNotPaused
        returns (uint256 bountyId)
    {
        if (msg.value == 0) revert InvalidAmount();
        if (metadataHash == bytes32(0)) revert InvalidHash();
        if (bytes(metadataCID).length == 0) revert EmptyCID();

        uint64 effectiveStartTime = startTime == 0
            ? uint64(block.timestamp)
            : startTime;

        if (
            effectiveStartTime < block.timestamp ||
            endTime <= effectiveStartTime
        ) {
            revert InvalidTimeRange();
        }

        bytes32 actionHash = hashCreateBountyAction(
            metadataHash,
            metadataCID,
            startTime,
            endTime,
            msg.value
        );

        _consumeAuthorization(
            authorization,
            signature,
            ParticipantRole.Company,
            AuthorizedAction.CreateBounty,
            actionHash
        );

        bountyId = ++bountyCount;

        bounties[bountyId] = Bounty({
            company: msg.sender,
            companyOrganizationId: authorization.organizationId,
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
            authorization.organizationId,
            msg.value,
            metadataHash,
            metadataCID,
            effectiveStartTime,
            endTime
        );
    }

    function submitBug(
        uint256 bountyId,
        bytes32 reportHash,
        string calldata encryptedEvidenceCID,
        uint256 requestedReward,
        Authorization calldata authorization,
        bytes calldata signature
    )
        external
        whenNotPaused
        returns (uint256 submissionId)
    {
        Bounty storage bounty = _getBountyStorage(bountyId);

        if (bounty.status != BountyStatus.Open) revert BountyNotOpen();
        if (block.timestamp < bounty.startTime) revert BountyNotStarted();
        if (block.timestamp > bounty.endTime) revert BountyExpired();

        if (msg.sender == bounty.company) {
            revert CompanyCannotSubmitOwnBounty();
        }

        if (reportHash == bytes32(0)) revert InvalidHash();
        if (bytes(encryptedEvidenceCID).length == 0) revert EmptyCID();
        if (requestedReward == 0) revert InvalidAmount();

        if (requestedReward > bounty.availableEscrow) {
            revert InsufficientEscrow();
        }

        if (reportHashUsed[bountyId][reportHash]) {
            revert DuplicateReportHash();
        }

        bytes32 actionHash = hashSubmitBugAction(
            bountyId,
            reportHash,
            encryptedEvidenceCID,
            requestedReward
        );

        _consumeAuthorization(
            authorization,
            signature,
            ParticipantRole.Tester,
            AuthorizedAction.SubmitBug,
            actionHash
        );

        reportHashUsed[bountyId][reportHash] = true;

        submissionId = ++submissionCount;

        submissions[submissionId] = Submission({
            bountyId: bountyId,
            tester: msg.sender,
            testerOrganizationId: authorization.organizationId,
            reportHash: reportHash,
            encryptedEvidenceCID: encryptedEvidenceCID,
            rejectionReasonHash: bytes32(0),
            requestedReward: requestedReward,
            approvedReward: 0,
            submittedAt: uint64(block.timestamp),
            rejectedAt: 0,
            status: SubmissionStatus.Submitted
        });

        bountySubmissionCount[bountyId]++;
        pendingSubmissionCount[bountyId]++;

        emit BugSubmitted(
            submissionId,
            bountyId,
            msg.sender,
            authorization.organizationId,
            reportHash,
            encryptedEvidenceCID,
            requestedReward
        );
    }

    function acceptSubmission(
        uint256 submissionId,
        uint256 approvedReward,
        Authorization calldata authorization,
        bytes calldata signature
    ) external whenNotPaused {
        Submission storage submission =
            _getSubmissionStorage(submissionId);

        Bounty storage bounty =
            _getBountyStorage(submission.bountyId);

        if (msg.sender != bounty.company) revert NotBountyCompany();

        if (submission.status != SubmissionStatus.Submitted) {
            revert SubmissionNotPending();
        }

        if (
            approvedReward == 0 ||
            approvedReward > submission.requestedReward
        ) {
            revert InvalidAmount();
        }

        if (approvedReward > bounty.availableEscrow) {
            revert InsufficientEscrow();
        }

        if (
            authorization.organizationId !=
            bounty.companyOrganizationId
        ) {
            revert AuthorizationOrganizationMismatch();
        }

        bytes32 actionHash = hashAcceptSubmissionAction(
            submissionId,
            approvedReward
        );

        _consumeAuthorization(
            authorization,
            signature,
            ParticipantRole.Company,
            AuthorizedAction.AcceptSubmission,
            actionHash
        );

        submission.status = SubmissionStatus.Accepted;
        submission.approvedReward = approvedReward;
        bounty.availableEscrow -= approvedReward;
        pendingSubmissionCount[submission.bountyId]--;

        pendingWithdrawals[submission.tester] += approvedReward;

        emit SubmissionAccepted(
            submissionId,
            submission.bountyId,
            submission.tester,
            approvedReward
        );
    }

    function rejectSubmission(
        uint256 submissionId,
        bytes32 rejectionReasonHash,
        Authorization calldata authorization,
        bytes calldata signature
    ) external whenNotPaused {
        Submission storage submission =
            _getSubmissionStorage(submissionId);

        Bounty storage bounty =
            _getBountyStorage(submission.bountyId);

        if (msg.sender != bounty.company) revert NotBountyCompany();

        if (submission.status != SubmissionStatus.Submitted) {
            revert SubmissionNotPending();
        }

        if (rejectionReasonHash == bytes32(0)) {
            revert InvalidHash();
        }

        if (
            authorization.organizationId !=
            bounty.companyOrganizationId
        ) {
            revert AuthorizationOrganizationMismatch();
        }

        bytes32 actionHash = hashRejectSubmissionAction(
            submissionId,
            rejectionReasonHash
        );

        _consumeAuthorization(
            authorization,
            signature,
            ParticipantRole.Company,
            AuthorizedAction.RejectSubmission,
            actionHash
        );

        uint64 rejectedAt = uint64(block.timestamp);
        uint64 disputeDeadline =
            rejectedAt + DISPUTE_WINDOW;

        submission.status = SubmissionStatus.Rejected;
        submission.rejectionReasonHash =
            rejectionReasonHash;
        submission.rejectedAt = rejectedAt;

        pendingSubmissionCount[submission.bountyId]--;

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

    function cancelBounty(
        uint256 bountyId,
        Authorization calldata authorization,
        bytes calldata signature
    ) external whenNotPaused {
        Bounty storage bounty =
            _getBountyStorage(bountyId);

        if (msg.sender != bounty.company) {
            revert NotBountyCompany();
        }

        if (bounty.status != BountyStatus.Open) {
            revert BountyNotOpen();
        }

        if (bountySubmissionCount[bountyId] != 0) {
            revert BountyHasSubmissions();
        }

        if (
            authorization.organizationId !=
            bounty.companyOrganizationId
        ) {
            revert AuthorizationOrganizationMismatch();
        }

        bytes32 actionHash =
            hashCancelBountyAction(bountyId);

        _consumeAuthorization(
            authorization,
            signature,
            ParticipantRole.Company,
            AuthorizedAction.CancelBounty,
            actionHash
        );

        uint256 refundAmount = bounty.availableEscrow;

        bounty.status = BountyStatus.Cancelled;
        bounty.availableEscrow = 0;
        pendingWithdrawals[bounty.company] +=
            refundAmount;

        emit BountyCancelled(
            bountyId,
            bounty.company,
            refundAmount
        );
    }

    function closeExpiredBounty(
        uint256 bountyId,
        Authorization calldata authorization,
        bytes calldata signature
    ) external whenNotPaused {
        Bounty storage bounty =
            _getBountyStorage(bountyId);

        if (msg.sender != bounty.company) {
            revert NotBountyCompany();
        }

        if (bounty.status != BountyStatus.Open) {
            revert BountyNotOpen();
        }

        if (block.timestamp <= bounty.endTime) {
            revert BountyNotExpired();
        }

        if (pendingSubmissionCount[bountyId] != 0) {
            revert PendingSubmissionsExist();
        }

        if (block.timestamp <= bounty.refundAvailableAt) {
            revert DisputeWindowStillOpen();
        }

        if (
            authorization.organizationId !=
            bounty.companyOrganizationId
        ) {
            revert AuthorizationOrganizationMismatch();
        }

        bytes32 actionHash =
            hashCloseExpiredBountyAction(bountyId);

        _consumeAuthorization(
            authorization,
            signature,
            ParticipantRole.Company,
            AuthorizedAction.CloseExpiredBounty,
            actionHash
        );

        uint256 refundAmount = bounty.availableEscrow;

        bounty.status = BountyStatus.Closed;
        bounty.availableEscrow = 0;
        pendingWithdrawals[bounty.company] +=
            refundAmount;

        emit BountyClosed(
            bountyId,
            bounty.company,
            refundAmount
        );
    }

    function claimReward(
    uint256 bountyId,
    bytes32 reportHash,
    uint256 rewardAmount,
    uint256 nonce,
    uint256 deadline,
    bytes calldata companySignature
)
    external
    whenNotPaused
    nonReentrant
{
    Bounty storage bounty =
        _getBountyStorage(bountyId);

    if (
        bounty.status != BountyStatus.Open
    ) {
        revert BountyNotOpen();
    }

    if (
        block.timestamp > deadline
    ) {
        revert RewardApprovalExpired();
    }

    if (
        reportHash == bytes32(0)
    ) {
        revert InvalidHash();
    }

    if (
        rewardAmount == 0
    ) {
        revert InvalidAmount();
    }

    if (
        rewardClaimedForReportHash[
            bountyId
        ][reportHash]
    ) {
        revert RewardAlreadyClaimed();
    }

    uint256 expectedNonce =
        payoutNonces[bountyId];

    if (
        nonce != expectedNonce
    ) {
        revert RewardNonceMismatch(
            expectedNonce,
            nonce
        );
    }

    if (
        rewardAmount >
        bounty.availableEscrow
    ) {
        revert InsufficientEscrow();
    }

    bytes32 structHash =
        keccak256(
            abi.encode(
                REWARD_APPROVAL_TYPEHASH,
                bountyId,
                reportHash,
                msg.sender,
                rewardAmount,
                nonce,
                deadline
            )
        );

    bytes32 digest =
        _hashTypedDataV4(
            structHash
        );

    address recoveredSigner =
        digest.recover(
            companySignature
        );

    if (
        recoveredSigner !=
        bounty.company
    ) {
        revert InvalidRewardSigner();
    }

    payoutNonces[bountyId] =
        expectedNonce + 1;

    rewardClaimedForReportHash[
        bountyId
    ][reportHash] = true;

    bounty.availableEscrow -=
        rewardAmount;

    (
        bool success,
    ) = payable(msg.sender).call{
        value: rewardAmount
    }("");

    if (!success) {
        revert TransferFailed();
    }

    emit RewardClaimed(
        bountyId,
        reportHash,
        msg.sender,
        rewardAmount
    );
}

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];

        if (amount == 0) revert NothingToWithdraw();

        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) =
            payable(msg.sender).call{value: amount}("");

        if (!success) revert TransferFailed();

        emit Withdrawal(msg.sender, amount);
    }

    function getBounty(
        uint256 bountyId
    ) external view returns (Bounty memory) {
        Bounty memory bounty = bounties[bountyId];

        if (bounty.status == BountyStatus.None) {
            revert InvalidBountyId(bountyId);
        }

        return bounty;
    }

    function getSubmission(
        uint256 submissionId
    ) external view returns (Submission memory) {
        Submission memory submission =
            submissions[submissionId];

        if (
            submission.status ==
            SubmissionStatus.None
        ) {
            revert InvalidSubmissionId(submissionId);
        }

        return submission;
    }

    function _consumeAuthorization(
        Authorization calldata authorization,
        bytes calldata signature,
        ParticipantRole requiredRole,
        AuthorizedAction requiredAction,
        bytes32 expectedActionHash
    ) private {
        if (authorization.user != msg.sender) {
            revert AuthorizationUserMismatch();
        }

        if (authorization.role != requiredRole) {
            revert AuthorizationRoleMismatch();
        }

        if (
            authorization.organizationId ==
            bytes32(0)
        ) {
            revert InvalidOrganizationId();
        }

        if (authorization.action != requiredAction) {
            revert AuthorizationActionMismatch();
        }

        if (
            authorization.actionHash !=
            expectedActionHash
        ) {
            revert AuthorizationActionHashMismatch();
        }

        if (block.timestamp > authorization.deadline) {
            revert AuthorizationExpired();
        }

        uint256 expectedNonce =
            authorizationNonces[msg.sender];

        if (authorization.nonce != expectedNonce) {
            revert AuthorizationNonceMismatch(
                expectedNonce,
                authorization.nonce
            );
        }

        bytes32 structHash = keccak256(
            abi.encode(
                AUTHORIZATION_TYPEHASH,
                authorization.user,
                uint8(authorization.role),
                authorization.organizationId,
                uint8(authorization.action),
                authorization.actionHash,
                authorization.nonce,
                authorization.deadline
            )
        );

        bytes32 digest =
            _hashTypedDataV4(structHash);

        address recoveredSigner =
            digest.recover(signature);

        if (recoveredSigner != trustedVerifier) {
            revert InvalidAuthorizationSigner();
        }

        authorizationNonces[msg.sender] =
            expectedNonce + 1;

        emit AuthorizationConsumed(
            msg.sender,
            expectedNonce,
            requiredAction,
            authorization.organizationId,
            expectedActionHash
        );
    }

    function _validateVerifier(
        address verifierAddress
    ) private view {
        if (verifierAddress == address(0)) {
            revert ZeroAddress();
        }

        // This implementation verifies ordinary ECDSA wallet signatures.
        if (verifierAddress.code.length != 0) {
            revert VerifierMustBeExternallyOwnedAccount();
        }
    }

    function _getBountyStorage(
        uint256 bountyId
    ) private view returns (Bounty storage bounty) {
        bounty = bounties[bountyId];

        if (bounty.status == BountyStatus.None) {
            revert InvalidBountyId(bountyId);
        }
    }

    function _getSubmissionStorage(
        uint256 submissionId
    )
        private
        view
        returns (Submission storage submission)
    {
        submission = submissions[submissionId];

        if (
            submission.status ==
            SubmissionStatus.None
        ) {
            revert InvalidSubmissionId(submissionId);
        }
    }

    receive() external payable {
        revert DirectPaymentsNotAllowed();
    }
}
