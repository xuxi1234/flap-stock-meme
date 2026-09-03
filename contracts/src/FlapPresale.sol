// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

error OwnableInvalidOwner(address owner);
error OwnableUnauthorizedAccount(address account);
error EnforcedPause();
error ReentrancyGuardReentrantCall();
error InvalidPayment(uint256 sent);
error AlreadyParticipated(address participant);
error PresaleFull();
error PresaleEnded(uint64 endTime);
error TreasuryTransferFailed();

/// @notice Minimal ownership primitive for the fixed-administrator presale.
abstract contract Ownable {
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert OwnableInvalidOwner(initialOwner);

        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OwnableUnauthorizedAccount(msg.sender);
        _;
    }
}

/// @notice Pause state used to halt new participations without changing sale terms.
abstract contract Pausable {
    bool public paused;

    event Paused(address indexed account);
    event Unpaused(address indexed account);

    modifier whenNotPaused() {
        if (paused) revert EnforcedPause();
        _;
    }

    function _pause() internal {
        if (!paused) {
            paused = true;
            emit Paused(msg.sender);
        }
    }

    function _unpause() internal {
        if (paused) {
            paused = false;
            emit Unpaused(msg.sender);
        }
    }
}

/// @notice Reentrancy protection for a participation that forwards native currency.
abstract contract ReentrancyGuard {
    uint256 private _guardStatus = 1;

    modifier nonReentrant() {
        if (_guardStatus != 1) revert ReentrancyGuardReentrantCall();

        _guardStatus = 2;
        _;
        _guardStatus = 1;
    }
}

/// @notice Fixed-price, one-time FLAP presale participation recorder.
/// @dev This contract does not mint, distribute, or refund FLAP tokens.
contract FlapPresale is Ownable, Pausable, ReentrancyGuard {
    uint256 public constant PARTICIPATION_FEE = 0.05 ether;
    uint256 public constant MAX_PARTICIPANTS = 10_000;
    uint64 public constant INITIAL_END_TIME = 1_788_969_599;
    address public constant ADMIN = 0xbE37AB912De351B9312FA593C9f99e3279FDB0a2;
    address public constant TREASURY = 0x59389BDb944a4d8D4747b373b665a781d8DCD420;

    mapping(address participant => bool participated) public hasParticipated;
    uint256 public participantCount;
    uint64 public endTime;

    event Participated(address indexed participant, uint256 amount, uint64 timestamp, uint256 participantNumber);
    event EndTimeUpdated(uint64 previousEndTime, uint64 newEndTime);

    constructor() Ownable(ADMIN) {
        endTime = INITIAL_END_TIME;
    }

    function participate() external payable nonReentrant whenNotPaused {
        if (msg.value != PARTICIPATION_FEE) revert InvalidPayment(msg.value);
        if (hasParticipated[msg.sender]) revert AlreadyParticipated(msg.sender);
        if (participantCount >= MAX_PARTICIPANTS) revert PresaleFull();
        if (block.timestamp >= endTime) revert PresaleEnded(endTime);

        // Effects precede the external transfer so a successful payment is recorded exactly once.
        hasParticipated[msg.sender] = true;
        unchecked {
            ++participantCount;
        }

        (bool forwarded,) = TREASURY.call{value: msg.value}("");
        if (!forwarded) revert TreasuryTransferFailed();

        emit Participated(msg.sender, msg.value, uint64(block.timestamp), participantCount);
    }

    function setEndTime(uint64 newEndTime) external onlyOwner {
        uint64 previousEndTime = endTime;
        endTime = newEndTime;
        emit EndTimeUpdated(previousEndTime, newEndTime);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
