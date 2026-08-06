pragma solidity ^0.8.28;


/// @title Participant Registry
/// @notice Registers and manages software companies and security testers.
contract ParticipantRegistry {
    /// @notice Defines the permitted participant categories.
    enum ParticipantType {
        None,    // Default value. It also means that the address is not registered.
        Company, // A software company that can create bug bounties.
        Tester   // A security tester who can submit vulnerability reports.
    }

    /// @notice Stores the registration information of one participant.
    struct Participant {
        ParticipantType participantType; // Company or Tester.
        bytes32 organizationId;           // Hash/identifier of the participant's organization.
        bool active;                      // Determines whether the account may currently participate.
        bool validatorCandidate;          // Reserved for the future validator-selection mechanism.
        uint64 registeredAt;              // Block timestamp when the account was registered.
    }

    /// @notice Administrator of the registry.
    address public owner;

    /// @dev Connects each wallet address to its Participant record.
    mapping(address => Participant) private participants;

    /// @dev Stores participant addresses so they can later be enumerated for selection algorithms.
    address[] private participantAccounts;

    // Custom errors are cheaper and clearer than long revert strings.
    error OnlyOwner();
    error ZeroAddress();
    error InvalidOrganizationId();
    error AlreadyRegistered(address account);
    error ParticipantNotFound(address account);
    error ParticipantInactive(address account);
    error InvalidParticipantType();

    /// @notice Emitted when registry ownership changes.
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /// @notice Emitted after a company or tester is registered.
    event ParticipantRegistered(
        address indexed account,
        ParticipantType indexed participantType,
        bytes32 indexed organizationId
    );

    /// @notice Emitted when a participant is activated or suspended.
    event ParticipantStatusUpdated(
        address indexed account,
        bool active
    );

    /// @notice Emitted when validator-candidate permission changes.
    event ValidatorCandidateUpdated(
        address indexed account,
        bool validatorCandidate
    );

    /// @notice Sets the deploying account as the first registry owner.
    constructor() {
        owner = msg.sender;

        // address(0) represents that there was no previous owner.
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @dev Restricts a function so only the registry owner can call it.
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _; // Runs the body of the protected function.
    }

    /// @notice Transfers registry administration to another wallet.
    /// @param newOwner Address of the new owner.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();

        address previousOwner = owner;
        owner = newOwner;

        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /// @notice Registers a software company.
    /// @param account Wallet address controlled by the company.
    /// @param organizationId Stable identifier representing the company organization.
    function registerCompany(
        address account,
        bytes32 organizationId
    ) external onlyOwner {
        _registerParticipant(
            account,
            organizationId,
            ParticipantType.Company
        );
    }

    /// @notice Registers a security tester.
    /// @param account Wallet address controlled by the tester.
    /// @param organizationId Stable identifier representing the tester's organization.
    function registerTester(
        address account,
        bytes32 organizationId
    ) external onlyOwner {
        _registerParticipant(
            account,
            organizationId,
            ParticipantType.Tester
        );
    }

    /// @notice Activates or suspends an existing participant.
    /// @param account Registered participant address.
    /// @param active New active status.
    function setParticipantActive(
        address account,
        bool active
    ) external onlyOwner {
        // storage gives direct read/write access to the saved Participant record.
        Participant storage participant = participants[account];

        // None means that no Participant record exists for this address.
        if (participant.participantType == ParticipantType.None) {
            revert ParticipantNotFound(account);
        }

        participant.active = active;

        // A suspended participant should not remain a validator candidate.
        if (!active && participant.validatorCandidate) {
            participant.validatorCandidate = false;
            emit ValidatorCandidateUpdated(account, false);
        }

        emit ParticipantStatusUpdated(account, active);
    }

    /// @notice Adds or removes an account from the future validator candidate pool.
    /// @param account Registered participant address.
    /// @param validatorCandidate New validator-candidate status.
    function setValidatorCandidate(
        address account,
        bool validatorCandidate
    ) external onlyOwner {
        Participant storage participant = participants[account];

        if (participant.participantType == ParticipantType.None) {
            revert ParticipantNotFound(account);
        }

        // An inactive participant cannot become a validator candidate.
        if (!participant.active && validatorCandidate) {
            revert ParticipantInactive(account);
        }

        participant.validatorCandidate = validatorCandidate;

        emit ValidatorCandidateUpdated(account, validatorCandidate);
    }

    /// @notice Returns the complete Participant record for an address.
    function getParticipant(
        address account
    ) external view returns (Participant memory) {
        // memory creates a temporary read-only copy for returning to the caller.
        Participant memory participant = participants[account];

        if (participant.participantType == ParticipantType.None) {
            revert ParticipantNotFound(account);
        }

        return participant;
    }

    /// @notice Checks whether an address is an active registered company.
    function isActiveCompany(address account) external view returns (bool) {
        Participant storage participant = participants[account];

        return
            participant.participantType == ParticipantType.Company &&
            participant.active;
    }

    /// @notice Checks whether an address is an active registered tester.
    function isActiveTester(address account) external view returns (bool) {
        Participant storage participant = participants[account];

        return
            participant.participantType == ParticipantType.Tester &&
            participant.active;
    }

    /// @notice Checks whether two registered accounts belong to the same organization.
    /// @dev This will later help filter conflicted arbitrator candidates.
    function sameOrganization(
        address firstAccount,
        address secondAccount
    ) external view returns (bool) {
        Participant storage firstParticipant = participants[firstAccount];
        Participant storage secondParticipant = participants[secondAccount];

        // Return false when either address is not registered.
        if (
            firstParticipant.participantType == ParticipantType.None ||
            secondParticipant.participantType == ParticipantType.None
        ) {
            return false;
        }

        return
            firstParticipant.organizationId ==
            secondParticipant.organizationId;
    }

    /// @notice Returns the number of registered participant addresses.
    function totalParticipants() external view returns (uint256) {
        return participantAccounts.length;
    }

    /// @notice Returns a participant address by array position.
    /// @dev The first participant is at index 0.
    function participantAt(uint256 index) external view returns (address) {
        return participantAccounts[index];
    }

    /// @dev Shared internal registration logic used by both public registration functions.
    function _registerParticipant(
        address account,
        bytes32 organizationId,
        ParticipantType participantType
    ) private {
        if (account == address(0)) revert ZeroAddress();
        if (organizationId == bytes32(0)) revert InvalidOrganizationId();
        if (participantType == ParticipantType.None) {
            revert InvalidParticipantType();
        }

        // Prevents the same wallet from being registered twice.
        if (participants[account].participantType != ParticipantType.None) {
            revert AlreadyRegistered(account);
        }

        // Saves the new participant record in contract storage.
        participants[account] = Participant({
            participantType: participantType,
            organizationId: organizationId,
            active: true,
            validatorCandidate: false,
            registeredAt: uint64(block.timestamp)
        });

        // Adds the address to the enumerable participant list.
        participantAccounts.push(account);

        emit ParticipantRegistered(
            account,
            participantType,
            organizationId
        );
    }
}
