// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============================================================
//  OpenZeppelin Security Imports
//  - ReentrancyGuard : blocks re-entrancy attacks on payments
//  - Ownable         : only deployer can do admin actions
// ============================================================
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  BugBountyContract
 * @notice Handles ONLY the 3 on-chain transactions from the diagram:
 *         1. Creates bounty and locks money  (Software Co.)
 *         2. Submit Bug                      (Tester)
 *         3. Receive Payment                 (Tester)
 *
 * @dev    Off-chain actions:
 *         - Receive Testers      → handled by backend
 *         - Discover Bounty      → handled by backend
 *         - Send Transaction Details → handled by backend
 *
 *         Future on-chain (Phase 2):
 *         - Report an Issue      → Dispute Contract
 *         - Final Dispute Decision → Arbitration Contract
 */
contract BugBountyContract is ReentrancyGuard, Ownable {

    // ============================================================
    //  ENUMS
    // ============================================================

    /// @notice Tracks the current state of a bounty
    enum BountyStatus {
        Active,       // Money locked, accepting bug submissions
        UnderReview,  // Bug submitted, waiting for approval
        Paid,         // Bug approved, tester paid
        Closed        // Bounty closed without payment
    }

    /// @notice Tracks the result of a submitted bug report
    enum ReportStatus {
        Pending,   // Submitted, not yet reviewed
        Approved,  // Valid bug — triggers payment
        Rejected   // Invalid bug — bounty reopens
    }

    // ============================================================
    //  STRUCTS
    // ============================================================

    /**
     * @notice Represents a bounty posted by a company
     * @dev    ETH reward is locked inside this contract on creation
     */
    struct Bounty {
        uint256      bountyId;      // Unique ID
        address      company;       // Who posted the bounty
        uint256      lockedAmount;  // Reward locked in contract
        string       title;         // e.g. "Login Page Bug"
        string       scope;         // e.g. "Authentication module"
        BountyStatus status;        // Current lifecycle state
        uint256      createdAt;     // Creation timestamp
        uint256      deadline;      // Submission deadline
    }

    /**
     * @notice Represents a bug report submitted by a tester
     * @dev    Full report lives on IPFS — only hash stored here
     *         Hash = cryptographic proof tester found bug at this time
     */
    struct BugReport {
        uint256      reportId;      // Unique ID
        uint256      bountyId;      // Which bounty this targets
        address      tester;        // Who submitted
        bytes32      reportHash;    // SHA256 hash of full report
        string       ipfsHash;      // IPFS link to encrypted report
        ReportStatus status;        // Pending / Approved / Rejected
        uint256      submittedAt;   // Timestamp — proof of discovery
    }

    // ============================================================
    //  STATE VARIABLES
    // ============================================================

    uint256 private bountyCounter;
    uint256 private reportCounter;

    mapping(uint256 => Bounty)     public bounties;          // bountyId => Bounty
    mapping(uint256 => BugReport)  public bugReports;        // reportId => BugReport
    mapping(uint256 => uint256[])  public bountyReports;     // bountyId => reportIds
    mapping(address => uint256[])  public testerReports;     // tester   => reportIds
    mapping(address => uint256[])  public companyBounties;   // company  => bountyIds

    // ============================================================
    //  EVENTS
    //  RVA validators listen to these events
    // ============================================================

    /// @notice ON-CHAIN TX 1 — Company creates bounty and locks money
    event BountyCreated(
        uint256 indexed bountyId,
        address indexed company,
        uint256         lockedAmount,
        string          title,
        uint256         deadline
    );

    /// @notice ON-CHAIN TX 2 — Tester submits a bug
    event BugSubmitted(
        uint256 indexed reportId,
        uint256 indexed bountyId,
        address indexed tester,
        bytes32         reportHash,
        uint256         submittedAt
    );

    /// @notice ON-CHAIN TX 3 — Tester receives payment
    event PaymentReceived(
        uint256 indexed bountyId,
        uint256 indexed reportId,
        address indexed tester,
        uint256         amount,
        uint256         paidAt
    );

    /// @notice Bug rejected — bounty reopens
    event BugRejected(
        uint256 indexed reportId,
        uint256 indexed bountyId,
        address indexed tester
    );

    /// @notice Bounty closed — company refunded
    event BountyClosed(
        uint256 indexed bountyId,
        address indexed company,
        uint256         refundAmount
    );

    // ============================================================
    //  MODIFIERS
    // ============================================================

    /// @dev Only the company that posted this bounty
    modifier onlyCompany(uint256 _bountyId) {
        require(
            bounties[_bountyId].company == msg.sender,
            "Only the posting company can call this"
        );
        _;
    }

    /// @dev Bounty must be Active
    modifier bountyActive(uint256 _bountyId) {
        require(
            bounties[_bountyId].status == BountyStatus.Active,
            "Bounty is not active"
        );
        _;
    }

    /// @dev Must be before deadline
    modifier beforeDeadline(uint256 _bountyId) {
        require(
            block.timestamp <= bounties[_bountyId].deadline,
            "Bounty deadline has passed"
        );
        _;
    }

    // ============================================================
    //  CONSTRUCTOR
    // ============================================================

    constructor() Ownable(msg.sender) {}

    // ============================================================
    //  ON-CHAIN TX 1 — Creates Bounty and Locks Money  🔴 Heavy
    //  Triggered by: Software Company
    // ============================================================

    /**
     * @notice Company posts a bounty and locks ETH as reward
     * @param  _title    Short bounty title
     * @param  _scope    What to test
     * @param  _deadline Unix timestamp for submission deadline
     * @return newBountyId
     *
     * @dev    msg.value = reward amount locked in this contract
     *         Money cannot be touched until approved or deadline passed
     */
    function createBounty(
        string  memory _title,
        string  memory _scope,
        uint256        _deadline
    ) external payable returns (uint256) {

        require(msg.value > 0,               "Must lock ETH as reward");
        require(bytes(_title).length > 0,    "Title cannot be empty");
        require(bytes(_scope).length > 0,    "Scope cannot be empty");
        require(_deadline > block.timestamp, "Deadline must be in the future");

        bountyCounter++;
        uint256 newBountyId = bountyCounter;

        bounties[newBountyId] = Bounty({
            bountyId:     newBountyId,
            company:      msg.sender,
            lockedAmount: msg.value,
            title:        _title,
            scope:        _scope,
            status:       BountyStatus.Active,
            createdAt:    block.timestamp,
            deadline:     _deadline
        });

        companyBounties[msg.sender].push(newBountyId);

        emit BountyCreated(
            newBountyId,
            msg.sender,
            msg.value,
            _title,
            _deadline
        );

        return newBountyId;
    }

    // ============================================================
    //  ON-CHAIN TX 2 — Submit Bug  🔴 Heavy
    //  Triggered by: Tester
    // ============================================================

    /**
     * @notice Tester submits a hashed bug report
     * @param  _bountyId   Target bounty
     * @param  _reportHash SHA256 hash of full report — proves ownership
     * @param  _ipfsHash   IPFS CID where encrypted report is stored
     * @return newReportId
     *
     * @dev    Timestamp locked on-chain = proof of when bug was found
     *         Full report stays private on IPFS until approved
     */
    function submitBug(
        uint256        _bountyId,
        bytes32        _reportHash,
        string  memory _ipfsHash
    )
        external
        bountyActive(_bountyId)
        beforeDeadline(_bountyId)
        returns (uint256)
    {
        require(_reportHash != bytes32(0),   "Report hash cannot be empty");
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(
            bounties[_bountyId].company != msg.sender,
            "Company cannot submit to their own bounty"
        );

        reportCounter++;
        uint256 newReportId = reportCounter;

        bugReports[newReportId] = BugReport({
            reportId:    newReportId,
            bountyId:    _bountyId,
            tester:      msg.sender,
            reportHash:  _reportHash,
            ipfsHash:    _ipfsHash,
            status:      ReportStatus.Pending,
            submittedAt: block.timestamp
        });

        bounties[_bountyId].status = BountyStatus.UnderReview;

        bountyReports[_bountyId].push(newReportId);
        testerReports[msg.sender].push(newReportId);

        emit BugSubmitted(
            newReportId,
            _bountyId,
            msg.sender,
            _reportHash,
            block.timestamp
        );

        return newReportId;
    }

    // ============================================================
    //  ON-CHAIN TX 3 — Receive Payment  🔴 Heavy
    //  Triggered by: Company approval → auto pays Tester
    // ============================================================

    /**
     * @notice Company approves bug — tester automatically receives payment
     * @param  _bountyId  The bounty being resolved
     * @param  _reportId  The approved bug report
     *
     * @dev    nonReentrant prevents double payment attacks
     *         lockedAmount cleared BEFORE transfer (security pattern)
     *         Payment goes directly to tester wallet automatically
     */
    function approveBugAndPay(
        uint256 _bountyId,
        uint256 _reportId
    )
        external
        nonReentrant
        onlyCompany(_bountyId)
    {
        Bounty    storage bounty = bounties[_bountyId];
        BugReport storage report = bugReports[_reportId];

        require(
            bounty.status == BountyStatus.UnderReview,
            "Bounty must be under review"
        );
        require(
            report.bountyId == _bountyId,
            "Report does not belong to this bounty"
        );
        require(
            report.status == ReportStatus.Pending,
            "Report already processed"
        );
        require(bounty.lockedAmount > 0, "No funds locked");

        // Update statuses
        report.status = ReportStatus.Approved;
        bounty.status = BountyStatus.Paid;

        // Clear amount before transfer — prevents re-entrancy
        uint256 payAmount   = bounty.lockedAmount;
        bounty.lockedAmount = 0;

        // Tester receives payment automatically
        (bool success, ) = payable(report.tester).call{value: payAmount}("");
        require(success, "Payment failed");

        emit PaymentReceived(
            _bountyId,
            _reportId,
            report.tester,
            payAmount,
            block.timestamp
        );
    }

    // ============================================================
    //  SUPPORTING FUNCTIONS
    //  (needed for the 3 core transactions to work properly)
    // ============================================================

    /**
     * @notice Company rejects a bug — bounty goes back to Active
     * @dev    Tester can see rejection via BugRejected event
     */
    function rejectBug(
        uint256 _bountyId,
        uint256 _reportId
    )
        external
        onlyCompany(_bountyId)
    {
        Bounty    storage bounty = bounties[_bountyId];
        BugReport storage report = bugReports[_reportId];

        require(
            bounty.status == BountyStatus.UnderReview,
            "Bounty is not under review"
        );
        require(report.bountyId == _bountyId, "Wrong bounty");
        require(report.status == ReportStatus.Pending, "Already processed");

        report.status = ReportStatus.Rejected;
        bounty.status = BountyStatus.Active;   // Reopen for new submissions

        emit BugRejected(_reportId, _bountyId, report.tester);
    }

    /**
     * @notice Company closes bounty after deadline — gets refund
     * @dev    Only callable after deadline passes
     */
    function closeBounty(uint256 _bountyId)
        external
        nonReentrant
        onlyCompany(_bountyId)
    {
        Bounty storage bounty = bounties[_bountyId];

        require(bounty.status == BountyStatus.Active,    "Not active");
        require(block.timestamp > bounty.deadline,        "Deadline not passed");
        require(bounty.lockedAmount > 0,                  "No funds to refund");

        uint256 refundAmount = bounty.lockedAmount;
        bounty.lockedAmount  = 0;
        bounty.status        = BountyStatus.Closed;

        (bool success, ) = payable(bounty.company).call{value: refundAmount}("");
        require(success, "Refund failed");

        emit BountyClosed(_bountyId, bounty.company, refundAmount);
    }

    // ============================================================
    //  READ FUNCTIONS — no gas, called off-chain
    // ============================================================

    function getBounty(uint256 _bountyId)
        external view returns (Bounty memory)
    { return bounties[_bountyId]; }

    function getBugReport(uint256 _reportId)
        external view returns (BugReport memory)
    { return bugReports[_reportId]; }

    function getBountyReports(uint256 _bountyId)
        external view returns (uint256[] memory)
    { return bountyReports[_bountyId]; }

    function getTesterReports(address _tester)
        external view returns (uint256[] memory)
    { return testerReports[_tester]; }

    function getCompanyBounties(address _company)
        external view returns (uint256[] memory)
    { return companyBounties[_company]; }

    function getTotalBounties() external view returns (uint256)
    { return bountyCounter; }

    function getTotalReports()  external view returns (uint256)
    { return reportCounter; }

    function getContractBalance() external view returns (uint256)
    { return address(this).balance; }
}
