// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import {ButterflyDistributor} from "../src/ButterflyDistributor.sol";

interface VmD {
    function expectRevert(bytes4) external;
    function prank(address) external;
}

contract DistributionToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public blocked;
    uint256 public tax;
    bool public returnFalse;
    bool public noReturn;
    ButterflyDistributor public reentry;
    bool public reentryBlocked;

    function configure(address b, uint256 t, bool f, bool n) external {
        blocked = b;
        tax = t;
        returnFalse = f;
        noReturn = n;
    }

    function mint(address a, uint256 n) external {
        balanceOf[a] += n;
    }

    function approve(address s, uint256 n) external returns (bool) {
        allowance[msg.sender][s] = n;
        return true;
    }

    function setReentry(ButterflyDistributor d) external {
        reentry = d;
    }

    function transferFrom(address from, address to, uint256 n) external returns (bool) {
        require(to != blocked, "blocked");
        if (returnFalse) return false;
        allowance[from][msg.sender] -= n;
        balanceOf[from] -= n;
        balanceOf[to] += n * (100 - tax) / 100;
        if (address(reentry) != address(0)) {
            address[] memory r = new address[](1);
            r[0] = address(5);
            uint256[] memory a = new uint256[](1);
            a[0] = 1;
            try reentry.distribute(address(this), bytes32(uint256(99)), r, a) {}
            catch {
                reentryBlocked = true;
            }
        }
        if (noReturn) {
            assembly { return(0, 0) }
        }
        return true;
    }
}

contract ButterflyDistributorTest {
    VmD constant vm = VmD(address(uint160(uint256(keccak256("hevm cheat code")))));
    ButterflyDistributor d;
    DistributionToken t;
    address[] r;
    uint256[] a;

    function setUp() public {
        d = new ButterflyDistributor();
        t = new DistributionToken();
        t.mint(address(this), 10000);
        t.approve(address(d), 10000);
        r.push(address(1));
        r.push(address(2));
        a.push(400);
        a.push(100);
    }

    function testExactTransfersAndNoCustody() public {
        d.distribute(address(t), bytes32(uint256(1)), r, a);
        require(t.balanceOf(r[0]) == 400 && t.balanceOf(r[1]) == 100);
        require(t.balanceOf(address(d)) == 0);
        require(t.allowance(address(this), address(d)) == 9500);
    }

    function testDuplicateBatchCannotSendAgain() public {
        d.distribute(address(t), bytes32(uint256(1)), r, a);
        vm.expectRevert(ButterflyDistributor.AlreadyCompleted.selector);
        d.distribute(address(t), bytes32(uint256(1)), r, a);
    }

    function testAtomicFailureRollsBackAllAndCanRetry() public {
        t.configure(r[1], 0, false, false);
        vm.expectRevert(ButterflyDistributor.TransferFailed.selector);
        d.distribute(address(t), bytes32(uint256(1)), r, a);
        require(t.balanceOf(r[0]) == 0 && !d.completed(address(this), bytes32(uint256(1))));
        t.configure(address(0), 0, false, false);
        d.distribute(address(t), bytes32(uint256(1)), r, a);
        require(t.balanceOf(r[0]) == 400);
    }

    function testTaxTokenRecordsActualBalance() public {
        t.configure(address(0), 3, false, false);
        d.distribute(address(t), bytes32(uint256(1)), r, a);
        require(t.balanceOf(r[0]) == 388 && t.balanceOf(r[1]) == 97);
    }

    function testFalseReturnRejected() public {
        t.configure(address(0), 0, true, false);
        vm.expectRevert(ButterflyDistributor.TransferFailed.selector);
        d.distribute(address(t), bytes32(uint256(1)), r, a);
    }

    function testNoReturnTokenAccepted() public {
        t.configure(address(0), 0, false, true);
        d.distribute(address(t), bytes32(uint256(1)), r, a);
        require(t.balanceOf(r[0]) == 400);
    }

    function testZeroReceiptRejected() public {
        t.configure(address(0), 100, false, false);
        vm.expectRevert(ButterflyDistributor.TransferFailed.selector);
        d.distribute(address(t), bytes32(uint256(1)), r, a);
    }

    function testCallerCannotSpendOthersApproval() public {
        vm.prank(address(77));
        vm.expectRevert(ButterflyDistributor.TransferFailed.selector);
        d.distribute(address(t), bytes32(uint256(1)), r, a);
        require(t.balanceOf(address(this)) == 10000);
    }

    function testRejectZeroRecipient() public {
        r[0] = address(0);
        vm.expectRevert(ButterflyDistributor.InvalidBatch.selector);
        d.distribute(address(t), bytes32(uint256(1)), r, a);
    }

    function testRejectSelfRecipient() public {
        r[0] = address(this);
        vm.expectRevert(ButterflyDistributor.InvalidBatch.selector);
        d.distribute(address(t), bytes32(uint256(1)), r, a);
    }

    function testRejectContractRecipient() public {
        r[0] = address(d);
        vm.expectRevert(ButterflyDistributor.InvalidBatch.selector);
        d.distribute(address(t), bytes32(uint256(1)), r, a);
    }

    function testRejectEOATokenAndOversizedBatch() public {
        vm.expectRevert(ButterflyDistributor.InvalidBatch.selector);
        d.distribute(address(33), bytes32(uint256(1)), r, a);
        address[] memory x = new address[](201);
        uint256[] memory y = new uint256[](201);
        vm.expectRevert(ButterflyDistributor.InvalidBatch.selector);
        d.distribute(address(t), bytes32(uint256(1)), x, y);
    }

    function testReentrancyRejected() public {
        t.setReentry(d);
        d.distribute(address(t), bytes32(uint256(1)), r, a);
        require(t.reentryBlocked());
    }

    function testSend200AddressesInOneTransaction() public {
        address[] memory recipients = new address[](200);
        uint256[] memory amounts = new uint256[](200);
        for (uint256 i; i < 200; ++i) {
            recipients[i] = address(uint160(1000 + i));
            amounts[i] = 7;
        }
        uint256 beforeGas = gasleft();
        d.distribute(address(t), bytes32(uint256(200)), recipients, amounts);
        uint256 used = beforeGas - gasleft();
        require(used < 16000000, "200-recipient gas ceiling");
        for (uint256 i; i < 200; ++i) {
            require(t.balanceOf(recipients[i]) == 7);
        }
        require(t.balanceOf(address(this)) == 8600);
        require(d.completed(address(this), bytes32(uint256(200))));
    }

    function testLastRecipientFailureRollsBackAll200() public {
        address[] memory recipients = new address[](200);
        uint256[] memory amounts = new uint256[](200);
        for (uint256 i; i < 200; ++i) {
            recipients[i] = address(uint160(1000 + i));
            amounts[i] = 7;
        }
        t.configure(recipients[199], 0, false, false);
        vm.expectRevert(ButterflyDistributor.TransferFailed.selector);
        d.distribute(address(t), bytes32(uint256(200)), recipients, amounts);
        require(t.balanceOf(recipients[0]) == 0 && t.balanceOf(recipients[198]) == 0);
        require(t.balanceOf(address(this)) == 10000);
        require(!d.completed(address(this), bytes32(uint256(200))));
    }

    function testFuzzNoOverTransfer(uint96 n) public {
        uint256 v = uint256(n) % 10000 + 1;
        t.mint(address(this), v);
        t.approve(address(d), v);
        address[] memory x = new address[](1);
        uint256[] memory y = new uint256[](1);
        x[0] = address(6);
        y[0] = v;
        d.distribute(address(t), bytes32(uint256(2)), x, y);
        require(t.balanceOf(x[0]) == v && t.allowance(address(this), address(d)) == 0);
    }

    function testTwentyRoundsFourThousandRecipientsAndReplayProtection() public {
        t.mint(address(this), 28000 ether);
        t.approve(address(d), 28000 ether);
        address[] memory recipients = new address[](200);
        uint256[] memory amounts = new uint256[](200);
        for (uint256 batch; batch < 20; ++batch) {
            for (uint256 i; i < 200; ++i) {
                recipients[i] = address(uint160(10000 + batch * 200 + i));
                amounts[i] = 7 ether;
            }
            bytes32 id = keccak256(abi.encode("twenty-rounds", batch));
            d.distribute(address(t), id, recipients, amounts);
            for (uint256 i; i < 200; ++i) {
                require(t.balanceOf(recipients[i]) == 7 ether);
            }
            vm.expectRevert(ButterflyDistributor.AlreadyCompleted.selector);
            d.distribute(address(t), id, recipients, amounts);
        }
        require(t.balanceOf(address(this)) == 10000);
        require(t.allowance(address(this), address(d)) == 0);
        require(t.balanceOf(address(d)) == 0);
    }
}
