// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Canonical Flap VaultPortal V6 launch tuple. Source: flap-sh/FlapVaultExample IVaultPortal.
interface IButterflyVaultPortal {
    struct LaunchParams {
        string name;
        string symbol;
        string meta;
        uint8 dexThresh;
        bytes32 salt;
        uint8 migratorType;
        address quoteToken;
        uint256 quoteAmt;
        bytes permitData;
        bytes32 extensionID;
        bytes extensionData;
        uint8 dexId;
        uint8 lpFeeProfile;
        uint16 buyTaxRate;
        uint16 sellTaxRate;
        uint64 taxDuration;
        uint64 antiFarmerDuration;
        uint16 mktBps;
        uint16 deflationBps;
        uint16 dividendBps;
        uint16 lpBps;
        uint256 minimumShareBalance;
        address dividendToken;
        address commissionReceiver;
        uint8 tokenVersion;
        address vaultFactory;
        bytes vaultData;
    }
    function newTokenV6WithVault(LaunchParams calldata params) external payable returns (address);
}

interface IMintToken {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address receiver, uint256 amount) external returns (bool);
}

/// Non-upgradeable escrow. The factory owner has no withdrawal or configuration authority here.
contract ButterflyMintCampaign {
    uint256 public constant SHARE_PRICE = 0.01 ether;
    address public immutable factory;
    address public immutable vaultPortal;
    address public immutable commissionReceiver;
    bool private initialized;
    bool private entered;
    bool private launching;

    struct Config {
        string name;
        string symbol;
        string meta;
        uint16 targetShares;
        uint64 deadline;
        uint256 minimumTokensOut;
        address vaultFactory;
        bytes vaultData;
        uint16 buyTaxRate;
        uint16 sellTaxRate;
        uint64 taxDuration;
        uint64 antiFarmerDuration;
        uint16 mktBps;
        uint16 deflationBps;
        uint16 dividendBps;
        uint16 lpBps;
        uint256 minimumShareBalance;
        address dividendToken;
    }
    Config private terms;
    address public creator;
    address public token;
    uint256 public totalShares;
    uint256 public claimedShares;
    uint256 public tokensForParticipants;
    uint256 public bnbForParticipants;
    bool public launched;
    bool public aborted;
    mapping(address => uint256) public sharesOf;

    error Unauthorized();
    error InvalidTerms();
    error InvalidState();
    error InvalidAmount();
    error TransferFailed();
    error ReentrantCall();
    event Minted(address indexed participant, uint256 shares, uint256 amount);
    event Refunded(address indexed participant, address indexed receiver, uint256 shares, uint256 amount);
    event Launched(address indexed token, uint256 shares, uint256 spent, uint256 tokens, uint256 returnedBnb);
    event Claimed(address indexed participant, address indexed receiver, uint256 shares, uint256 tokens, uint256 bnb);
    event Aborted();
    event DustClaimed(address indexed receiver, uint256 tokens, uint256 bnb);

    constructor(address portal, address receiver) {
        factory = msg.sender;
        vaultPortal = portal;
        commissionReceiver = receiver;
        initialized = true; // Lock the implementation; clones start with empty storage.
    }
    modifier nonReentrant() {
        if (entered) revert ReentrantCall();
        entered = true;
        _;
        entered = false;
    }

    function initialize(Config calldata c, address author) external {
        if (msg.sender != factory || initialized) revert Unauthorized();
        if (
            author == address(0) || bytes(c.name).length == 0 || bytes(c.name).length > 64
                || bytes(c.symbol).length == 0 || bytes(c.symbol).length > 16 || bytes(c.meta).length == 0
                || bytes(c.meta).length > 256
        ) revert InvalidTerms();
        if (
            c.targetShares == 0 || c.targetShares > 1600 || c.deadline < block.timestamp + 1 hours
                || c.deadline > block.timestamp + 90 days || c.minimumTokensOut == 0 || c.vaultFactory.code.length == 0
                || c.vaultData.length > 8192
        ) revert InvalidTerms();
        if (
            c.buyTaxRate > 1000 || c.sellTaxRate > 1000 || (c.buyTaxRate == 0 && c.sellTaxRate == 0) || c.mktBps == 0
                || uint256(c.mktBps) + c.deflationBps + c.dividendBps + c.lpBps != 10000
        ) revert InvalidTerms();
        if (
            c.taxDuration < 365 days || c.taxDuration > 36500 days || c.antiFarmerDuration < 1 days
                || c.antiFarmerDuration > 365 days
        ) revert InvalidTerms();
        initialized = true;
        creator = author;
        terms = c;
    }

    function config() external view returns (Config memory) {
        return terms;
    }

    function targetShares() external view returns (uint256) {
        return terms.targetShares;
    }

    function deadline() external view returns (uint256) {
        return terms.deadline;
    }

    function mint(uint256 shares) external payable nonReentrant {
        if (!initialized || launched || aborted || block.timestamp >= terms.deadline) revert InvalidState();
        if (
            shares == 0 || shares > terms.targetShares || totalShares + shares > terms.targetShares
                || msg.value != shares * SHARE_PRICE
        ) revert InvalidAmount();
        sharesOf[msg.sender] += shares;
        totalShares += shares;
        emit Minted(msg.sender, shares, msg.value);
    }

    function refund(address payable receiver) external nonReentrant {
        if (launched || !initialized) revert InvalidState();
        uint256 shares = sharesOf[msg.sender];
        if (shares == 0 || receiver == address(0)) revert InvalidAmount();
        sharesOf[msg.sender] = 0;
        totalShares -= shares;
        uint256 amount = shares * SHARE_PRICE;
        _sendBnb(receiver, amount);
        emit Refunded(msg.sender, receiver, shares, amount);
    }

    function abort() external {
        if (msg.sender != creator) revert Unauthorized();
        if (launched || aborted) revert InvalidState();
        aborted = true;
        emit Aborted();
    }

    function launch(bytes32 salt) external nonReentrant {
        if (
            !initialized || launched || aborted || block.timestamp >= terms.deadline
                || totalShares != terms.targetShares
        ) {
            revert InvalidState();
        }
        uint256 amount = totalShares * SHARE_PRICE;
        IButterflyVaultPortal.LaunchParams memory p;
        p.name = terms.name;
        p.symbol = terms.symbol;
        p.meta = terms.meta;
        p.dexThresh = 1;
        p.salt = salt;
        p.migratorType = 1;
        p.quoteAmt = amount;
        p.buyTaxRate = terms.buyTaxRate;
        p.sellTaxRate = terms.sellTaxRate;
        p.taxDuration = terms.taxDuration;
        p.antiFarmerDuration = terms.antiFarmerDuration;
        p.mktBps = terms.mktBps;
        p.deflationBps = terms.deflationBps;
        p.dividendBps = terms.dividendBps;
        p.lpBps = terms.lpBps;
        p.minimumShareBalance = terms.minimumShareBalance;
        p.dividendToken = terms.dividendToken;
        p.commissionReceiver = commissionReceiver;
        p.tokenVersion = 6;
        p.vaultFactory = terms.vaultFactory;
        p.vaultData = terms.vaultData;
        launched = true;
        launching = true;
        address created = IButterflyVaultPortal(vaultPortal).newTokenV6WithVault{value: amount}(p);
        launching = false;
        if (created.code.length == 0) revert InvalidState();
        uint256 output = IMintToken(created).balanceOf(address(this));
        if (output < terms.minimumTokensOut) revert InvalidAmount();
        token = created;
        tokensForParticipants = output;
        bnbForParticipants = address(this).balance;
        emit Launched(created, totalShares, amount, output, bnbForParticipants);
    }

    function claimable(address participant) public view returns (uint256 tokens, uint256 bnb) {
        if (!launched) return (0, 0);
        uint256 shares = sharesOf[participant];
        return (tokensForParticipants * shares / totalShares, bnbForParticipants * shares / totalShares);
    }

    function claim(address receiver) external nonReentrant {
        if (!launched) revert InvalidState();
        uint256 shares = sharesOf[msg.sender];
        if (shares == 0 || receiver == address(0)) revert InvalidAmount();
        (uint256 tokens, uint256 bnb) = claimable(msg.sender);
        sharesOf[msg.sender] = 0;
        claimedShares += shares;
        _sendToken(receiver, tokens);
        _sendBnb(payable(receiver), bnb);
        emit Claimed(msg.sender, receiver, shares, tokens, bnb);
    }

    function claimCreatorDust(address receiver) external nonReentrant {
        if (msg.sender != creator) revert Unauthorized();
        if (!launched || claimedShares != totalShares || receiver == address(0)) revert InvalidState();
        uint256 tokens = IMintToken(token).balanceOf(address(this));
        uint256 bnb = address(this).balance;
        _sendToken(receiver, tokens);
        _sendBnb(payable(receiver), bnb);
        emit DustClaimed(receiver, tokens, bnb);
    }

    function _sendToken(address receiver, uint256 amount) private {
        if (amount == 0) return;
        (bool ok, bytes memory result) = token.call(abi.encodeCall(IMintToken.transfer, (receiver, amount)));
        if (!ok || (result.length != 0 && (result.length != 32 || !abi.decode(result, (bool))))) {
            revert TransferFailed();
        }
    }

    function _sendBnb(address payable receiver, uint256 amount) private {
        if (amount == 0) return;
        (bool ok,) = receiver.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    receive() external payable {
        if (!launching) revert InvalidState();
    }
}

/// EIP-1167 clones with immutable implementation. Owner only pauses new creation.
contract ButterflyMintFactory {
    address public immutable owner;
    address public immutable commissionReceiver;
    address public immutable vaultPortal;
    address public immutable implementation;
    bool public creationPaused;
    address[] public campaigns;
    mapping(address => bool) public isCampaign;
    error Unauthorized();
    error InvalidConfiguration();
    event CampaignCreated(address indexed campaign, address indexed creator, uint256 targetShares, uint256 deadline);
    event CreationPaused(bool paused);

    constructor(address admin, address receiver, address portal) {
        if (admin == address(0) || receiver == address(0) || portal.code.length == 0) revert InvalidConfiguration();
        owner = admin;
        commissionReceiver = receiver;
        vaultPortal = portal;
        implementation = address(new ButterflyMintCampaign(portal, receiver));
    }

    function setCreationPaused(bool paused) external {
        if (msg.sender != owner) revert Unauthorized();
        creationPaused = paused;
        emit CreationPaused(paused);
    }

    function campaignCount() external view returns (uint256) {
        return campaigns.length;
    }

    function createCampaign(ButterflyMintCampaign.Config calldata c) external returns (address instance) {
        if (creationPaused) revert InvalidConfiguration();
        bytes memory code = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73", bytes20(implementation), hex"5af43d82803e903d91602b57fd5bf3"
        );
        assembly { instance := create(0, add(code, 32), mload(code)) }
        if (instance == address(0)) revert InvalidConfiguration();
        ButterflyMintCampaign(payable(instance)).initialize(c, msg.sender);
        campaigns.push(instance);
        isCampaign[instance] = true;
        emit CampaignCreated(instance, msg.sender, c.targetShares, c.deadline);
    }
}
