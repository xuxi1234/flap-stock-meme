// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ButterflyMintFactory, ButterflyMintCampaign, IButterflyVaultPortal} from "../src/ButterflyMint.sol";

interface MintVm {
    function deal(address, uint256) external;
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert() external;
}

contract MintTestToken {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MintTestPortal is IButterflyVaultPortal {
    MintTestToken public token = new MintTestToken();
    bool public fail;
    uint256 public returned;

    function setReturn(uint256 value) external {
        returned = value;
    }
    uint256 public output = 1001;
    address public receiver;
    uint256 public received;

    function configure(bool f, uint256 amount) external {
        fail = f;
        output = amount;
    }

    function newTokenV6WithVault(LaunchParams calldata p) external payable returns (address) {
        require(!fail, "portal failed");
        require(msg.value == p.quoteAmt, "wrong purchase");
        receiver = p.commissionReceiver;
        received = msg.value;
        token.mint(msg.sender, output);
        if (returned > 0) {
            (bool ok,) = msg.sender.call{value: returned}("");
            require(ok);
        }
        return address(token);
    }
}

contract MintRejectReceiver {
    receive() external payable {
        revert();
    }
}

contract MintReentryReceiver {
    ButterflyMintCampaign public campaign;
    bool public blocked;

    constructor(ButterflyMintCampaign c) {
        campaign = c;
    }

    function join() external payable {
        campaign.mint{value: msg.value}(1);
    }

    function exit() external {
        campaign.refund(payable(address(this)));
    }

    receive() external payable {
        try campaign.refund(payable(address(this))) {
            blocked = false;
        } catch {
            blocked = true;
        }
    }
}

contract ButterflyMintTest {
    MintVm internal constant vm = MintVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address internal constant ADMIN = address(0xAA);
    address internal constant ALICE = address(0xA1);
    address internal constant BOB = address(0xB1);
    MintTestPortal internal portal;
    ButterflyMintFactory internal factory;
    ButterflyMintCampaign internal campaign;

    function config() internal view returns (ButterflyMintCampaign.Config memory c) {
        c.name = "Mint acceptance";
        c.symbol = "MCHK";
        c.meta = "bafy-test";
        c.targetShares = 3;
        c.deadline = uint64(block.timestamp + 7 days);
        c.minimumTokensOut = 900;
        c.vaultFactory = address(portal);
        c.vaultData = hex"1234";
        c.buyTaxRate = 300;
        c.sellTaxRate = 300;
        c.taxDuration = 365 days;
        c.antiFarmerDuration = 30 days;
        c.mktBps = 10000;
    }

    function setUp() public {
        portal = new MintTestPortal();
        factory = new ButterflyMintFactory(ADMIN, ADMIN, address(portal));
        vm.prank(ALICE);
        campaign = ButterflyMintCampaign(payable(factory.createCampaign(config())));
        vm.deal(ALICE, 1 ether);
        vm.deal(BOB, 1 ether);
    }

    function join(address who, uint256 shares) internal {
        vm.prank(who);
        campaign.mint{value: shares * 0.01 ether}(shares);
    }

    function fill() internal {
        join(ALICE, 1);
        join(BOB, 2);
    }

    function testRefundRestoresSharesAndCannotRepeat() public {
        join(ALICE, 1);
        vm.prank(ALICE);
        campaign.refund(payable(ALICE));
        require(ALICE.balance == 1 ether && campaign.totalShares() == 0 && address(campaign).balance == 0);
        vm.expectRevert();
        vm.prank(ALICE);
        campaign.refund(payable(ALICE));
    }

    function testRejectsWrongAmountAndOverSubscription() public {
        vm.expectRevert();
        vm.prank(ALICE);
        campaign.mint{value: 0.009 ether}(1);
        vm.expectRevert();
        vm.prank(ALICE);
        campaign.mint{value: 0}(0);
        fill();
        vm.expectRevert();
        vm.prank(ALICE);
        campaign.mint{value: 0.01 ether}(1);
    }

    function testPortalRevertPreservesRefunds() public {
        fill();
        portal.configure(true, 1001);
        vm.expectRevert();
        campaign.launch(bytes32(uint256(1)));
        require(!campaign.launched() && address(campaign).balance == 0.03 ether);
        vm.prank(BOB);
        campaign.refund(payable(BOB));
        require(BOB.balance == 1 ether);
    }

    function testMinimumOutputFailureRollsBackWholeLaunch() public {
        fill();
        portal.configure(false, 899);
        vm.expectRevert();
        campaign.launch(bytes32(uint256(1)));
        require(!campaign.launched() && portal.received() == 0 && address(campaign).balance == 0.03 ether);
    }

    function testLaunchClaimsAndOnlyFinalRoundingDust() public {
        fill();
        campaign.launch(bytes32(uint256(1)));
        require(portal.receiver() == ADMIN && portal.received() == 0.03 ether && campaign.launched());
        vm.expectRevert();
        vm.prank(ALICE);
        campaign.claimCreatorDust(ALICE);
        vm.prank(ALICE);
        campaign.claim(ALICE);
        require(portal.token().balanceOf(ALICE) == 333);
        vm.expectRevert();
        vm.prank(ALICE);
        campaign.claim(ALICE);
        vm.prank(BOB);
        campaign.claim(BOB);
        require(portal.token().balanceOf(BOB) == 667);
        vm.prank(ALICE);
        campaign.claimCreatorDust(ALICE);
        require(portal.token().balanceOf(ALICE) == 334);
        vm.expectRevert();
        vm.prank(ALICE);
        campaign.refund(payable(ALICE));
    }

    function testDeadlineBlocksMintAndLaunchButKeepsRefund() public {
        fill();
        vm.warp(block.timestamp + 8 days);
        vm.expectRevert();
        campaign.launch(bytes32(uint256(1)));
        vm.prank(ALICE);
        campaign.refund(payable(ALICE));
        require(ALICE.balance == 1 ether);
    }

    function testOnlyCreatorCanCancelAndRefundRemains() public {
        join(BOB, 1);
        vm.expectRevert();
        vm.prank(ADMIN);
        campaign.abort();
        vm.prank(ALICE);
        campaign.abort();
        vm.expectRevert();
        vm.prank(ALICE);
        campaign.mint{value: 0.01 ether}(1);
        vm.prank(BOB);
        campaign.refund(payable(BOB));
        require(BOB.balance == 1 ether);
    }

    function testFactoryOwnerCanPauseNewCampaignsOnly() public {
        vm.expectRevert();
        vm.prank(BOB);
        factory.setCreationPaused(true);
        vm.prank(ADMIN);
        factory.setCreationPaused(true);
        vm.expectRevert();
        factory.createCampaign(config());
        join(ALICE, 1);
        vm.prank(ALICE);
        campaign.refund(payable(ALICE));
        require(ALICE.balance == 1 ether);
    }

    function testImplementationAndCampaignCannotBeReinitialized() public {
        vm.expectRevert();
        campaign.initialize(config(), BOB);
        address implementation = factory.implementation();
        vm.expectRevert();
        ButterflyMintCampaign(payable(implementation)).initialize(config(), BOB);
    }

    function testRefundReentryCannotWithdrawTwice() public {
        MintReentryReceiver receiver = new MintReentryReceiver(campaign);
        vm.deal(address(this), 0.01 ether);
        receiver.join{value: 0.01 ether}();
        receiver.exit();
        require(receiver.blocked() && address(receiver).balance == 0.01 ether && address(campaign).balance == 0);
    }

    function testPartialCampaignCannotLaunchOrClaim() public {
        join(ALICE, 1);
        vm.expectRevert();
        campaign.launch(bytes32(uint256(1)));
        vm.expectRevert();
        vm.prank(ALICE);
        campaign.claim(ALICE);
    }

    function testRejectingRefundReceiverKeepsCredit() public {
        MintRejectReceiver receiver = new MintRejectReceiver();
        join(ALICE, 1);
        vm.expectRevert();
        vm.prank(ALICE);
        campaign.refund(payable(address(receiver)));
        require(campaign.sharesOf(ALICE) == 1 && address(campaign).balance == 0.01 ether);
        vm.prank(ALICE);
        campaign.refund(payable(ALICE));
        require(ALICE.balance == 1 ether);
    }

    function testReturnedBnbIsDistributedAndRejectingClaimRollsBack() public {
        fill();
        portal.setReturn(0.003 ether);
        campaign.launch(bytes32(uint256(1)));
        MintRejectReceiver receiver = new MintRejectReceiver();
        vm.expectRevert();
        vm.prank(ALICE);
        campaign.claim(address(receiver));
        require(campaign.sharesOf(ALICE) == 1 && campaign.claimedShares() == 0);
        require(portal.token().balanceOf(address(receiver)) == 0);
        vm.prank(ALICE);
        campaign.claim(ALICE);
        require(ALICE.balance == 0.991 ether);
        vm.prank(BOB);
        campaign.claim(BOB);
        require(BOB.balance == 0.982 ether);
        require(address(campaign).balance == 0 && campaign.claimedShares() == 3);
    }

    function testInvalidTermsCannotCreateCampaign() public {
        ButterflyMintCampaign.Config memory c = config();
        c.targetShares = 0;
        vm.expectRevert();
        factory.createCampaign(c);
        c = config();
        c.minimumTokensOut = 0;
        vm.expectRevert();
        factory.createCampaign(c);
        c = config();
        c.vaultFactory = BOB;
        vm.expectRevert();
        factory.createCampaign(c);
        c = config();
        c.mktBps = 9999;
        vm.expectRevert();
        factory.createCampaign(c);
        c = config();
        c.deadline = uint64(block.timestamp);
        vm.expectRevert();
        factory.createCampaign(c);
        require(factory.campaignCount() == 1);
    }

    function testFuzzRefundConservation(uint8 raw) public {
        uint256 shares = uint256(raw) % 3 + 1;
        join(ALICE, shares);
        vm.prank(ALICE);
        campaign.refund(payable(ALICE));
        require(address(campaign).balance == 0 && ALICE.balance == 1 ether && campaign.totalShares() == 0);
    }
}
