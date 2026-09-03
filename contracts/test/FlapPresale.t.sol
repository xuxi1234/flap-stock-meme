// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {
    FlapPresale,
    ReentrancyGuardReentrantCall,
    OwnableUnauthorizedAccount,
    EnforcedPause,
    InvalidPayment,
    AlreadyParticipated,
    PresaleFull,
    PresaleEnded,
    TreasuryTransferFailed
} from "../src/FlapPresale.sol";

interface Vm {
    function deal(address account, uint256 newBalance) external;
    function etch(address target, bytes calldata newRuntimeBytecode) external;
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
    function prank(address sender) external;
    function warp(uint256 newTimestamp) external;
}

abstract contract Test {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 left, uint256 right) internal pure {
        require(left == right, "assertion failed: uint256");
    }

    function assertEq(address left, address right) internal pure {
        require(left == right, "assertion failed: address");
    }

    function assertEq(bool left, bool right) internal pure {
        require(left == right, "assertion failed: bool");
    }
}

contract RejectingTreasury {
    receive() external payable {
        revert();
    }
}

contract ReentrantTreasury {
    FlapPresale private immutable presale;
    bool public reentryBlocked;
    bool private attempted;

    constructor(FlapPresale _presale) {
        presale = _presale;
    }

    receive() external payable {
        if (attempted) return;

        attempted = true;
        try presale.participate{value: msg.value}() {
        // The nonReentrant modifier must always reject this call.
        }
        catch (bytes memory reason) {
            reentryBlocked = bytes4(reason) == ReentrancyGuardReentrantCall.selector;
        }
    }
}

contract FlapPresaleTest is Test {
    FlapPresale internal presale;

    address internal constant ADMIN = 0xbE37AB912De351B9312FA593C9f99e3279FDB0a2;
    address internal constant TREASURY = 0x59389BDb944a4d8D4747b373b665a781d8DCD420;
    address internal constant PARTICIPANT = address(0xA11CE);
    uint256 internal constant PAYMENT = 0.05 ether;

    function setUp() public {
        presale = new FlapPresale();
    }

    function testDeploymentUsesSpecifiedImmutableTerms() public view {
        assertEq(presale.PARTICIPATION_FEE(), PAYMENT);
        assertEq(presale.MAX_PARTICIPANTS(), 10_000);
        assertEq(presale.INITIAL_END_TIME(), 1_788_969_599);
        assertEq(presale.endTime(), 1_788_969_599);
        assertEq(presale.ADMIN(), ADMIN);
        assertEq(presale.TREASURY(), TREASURY);
        assertEq(presale.owner(), ADMIN);
        assertEq(presale.paused(), false);
        assertEq(presale.participantCount(), 0);
    }

    function testParticipateRejectsUnderpayment() public {
        vm.deal(PARTICIPANT, PAYMENT);
        vm.prank(PARTICIPANT);
        vm.expectRevert(abi.encodeWithSelector(InvalidPayment.selector, PAYMENT - 1));
        presale.participate{value: PAYMENT - 1}();
    }

    function testParticipateRejectsOverpayment() public {
        vm.deal(PARTICIPANT, PAYMENT + 1);
        vm.prank(PARTICIPANT);
        vm.expectRevert(abi.encodeWithSelector(InvalidPayment.selector, PAYMENT + 1));
        presale.participate{value: PAYMENT + 1}();
    }

    function testParticipateForwardsPaymentAndRecordsParticipant() public {
        uint256 treasuryBalanceBefore = TREASURY.balance;
        vm.deal(PARTICIPANT, PAYMENT);

        vm.prank(PARTICIPANT);
        presale.participate{value: PAYMENT}();

        assertEq(TREASURY.balance, treasuryBalanceBefore + PAYMENT);
        assertEq(presale.hasParticipated(PARTICIPANT), true);
        assertEq(presale.participantCount(), 1);
    }

    function testParticipateRejectsDuplicateAddress() public {
        vm.deal(PARTICIPANT, PAYMENT * 2);
        vm.prank(PARTICIPANT);
        presale.participate{value: PAYMENT}();

        vm.prank(PARTICIPANT);
        vm.expectRevert(abi.encodeWithSelector(AlreadyParticipated.selector, PARTICIPANT));
        presale.participate{value: PAYMENT}();
    }

    function testParticipateRejectsWhenCapacityIsReached() public {
        for (uint256 index; index < presale.MAX_PARTICIPANTS(); ++index) {
            address participant = address(uint160(index + 10));
            vm.deal(participant, PAYMENT);
            vm.prank(participant);
            presale.participate{value: PAYMENT}();
        }

        address extraParticipant = address(0xF00D);
        vm.deal(extraParticipant, PAYMENT);
        vm.prank(extraParticipant);
        vm.expectRevert(PresaleFull.selector);
        presale.participate{value: PAYMENT}();
    }

    function testParticipateRejectsAfterDeadline() public {
        vm.warp(uint256(presale.endTime()) + 1);
        vm.deal(PARTICIPANT, PAYMENT);

        vm.prank(PARTICIPANT);
        vm.expectRevert(abi.encodeWithSelector(PresaleEnded.selector, presale.endTime()));
        presale.participate{value: PAYMENT}();
    }

    function testParticipateRejectsAtExactDeadline() public {
        vm.warp(presale.endTime());
        vm.deal(PARTICIPANT, PAYMENT);

        vm.prank(PARTICIPANT);
        vm.expectRevert(abi.encodeWithSelector(PresaleEnded.selector, presale.endTime()));
        presale.participate{value: PAYMENT}();
    }

    function testPauseBlocksParticipationAndUnpauseRestoresIt() public {
        vm.prank(ADMIN);
        presale.pause();
        assertEq(presale.paused(), true);

        vm.deal(PARTICIPANT, PAYMENT);
        vm.prank(PARTICIPANT);
        vm.expectRevert(EnforcedPause.selector);
        presale.participate{value: PAYMENT}();

        vm.prank(ADMIN);
        presale.unpause();
        assertEq(presale.paused(), false);

        vm.prank(PARTICIPANT);
        presale.participate{value: PAYMENT}();
        assertEq(presale.hasParticipated(PARTICIPANT), true);
    }

    function testOnlyAdminCanManagePresale() public {
        vm.expectRevert(abi.encodeWithSelector(OwnableUnauthorizedAccount.selector, address(this)));
        presale.setEndTime(1);

        vm.expectRevert(abi.encodeWithSelector(OwnableUnauthorizedAccount.selector, address(this)));
        presale.pause();

        vm.expectRevert(abi.encodeWithSelector(OwnableUnauthorizedAccount.selector, address(this)));
        presale.unpause();

        vm.prank(ADMIN);
        presale.setEndTime(1_800_000_000);
        assertEq(presale.endTime(), 1_800_000_000);
    }

    function testParticipationRevertsWhenTreasuryCannotReceivePayment() public {
        vm.etch(TREASURY, address(new RejectingTreasury()).code);
        vm.deal(PARTICIPANT, PAYMENT);

        vm.prank(PARTICIPANT);
        vm.expectRevert(TreasuryTransferFailed.selector);
        presale.participate{value: PAYMENT}();

        assertEq(presale.hasParticipated(PARTICIPANT), false);
        assertEq(presale.participantCount(), 0);
    }

    function testReentrancyAttemptFromTreasuryIsBlocked() public {
        ReentrantTreasury implementation = new ReentrantTreasury(presale);
        vm.etch(TREASURY, address(implementation).code);
        vm.deal(PARTICIPANT, PAYMENT);

        vm.prank(PARTICIPANT);
        presale.participate{value: PAYMENT}();

        assertEq(ReentrantTreasury(payable(TREASURY)).reentryBlocked(), true);
        assertEq(presale.participantCount(), 1);
        assertEq(presale.hasParticipated(PARTICIPANT), true);
    }
}
