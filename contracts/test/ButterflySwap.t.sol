// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import {ButterflySwap, SwapRouterV3} from "../src/ButterflySwap.sol";

interface VmSwap {
    function expectRevert(bytes4) external;
    function deal(address, uint256) external;
}

contract FeeToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public tax;
    bool public fail;
    bool public noReturn;
    address public callback;
    bool public blockedReentry;

    function configure(uint256 t, bool f, bool n) external {
        tax = t;
        fail = f;
        noReturn = n;
    }

    function mint(address a, uint256 n) external {
        balanceOf[a] += n;
    }

    function setCallback(address a) external {
        callback = a;
    }

    function approve(address a, uint256 n) external returns (bool) {
        require(allowance[msg.sender][a] == 0 || n == 0, "zero first");
        allowance[msg.sender][a] = n;
        return true;
    }

    function transfer(address a, uint256 n) external returns (bool) {
        return _transfer(msg.sender, a, n);
    }

    function transferFrom(address a, address b, uint256 n) external returns (bool) {
        allowance[a][msg.sender] -= n;
        return _transfer(a, b, n);
    }

    function _transfer(address a, address b, uint256 n) internal returns (bool) {
        if (fail) return false;
        balanceOf[a] -= n;
        balanceOf[b] += n * (10000 - tax) / 10000;
        if (callback != address(0)) {
            address[] memory path = new address[](2);
            path[0] = address(this);
            path[1] = address(123);
            (bool ok,) = callback.call(
                abi.encodeCall(ButterflySwap.swapV2, (1, 1, path, false, false, address(0), block.timestamp + 120))
            );
            blockedReentry = !ok;
        }
        if (noReturn) {
            assembly { return(0, 0) }
        }
        return true;
    }

    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
    }

    function withdraw(uint256 n) external {
        balanceOf[msg.sender] -= n;
        (bool ok,) = msg.sender.call{value: n}("");
        require(ok);
    }
    receive() external payable {}
}

contract FeeRouter {
    uint256 public output = 100000;
    bool public fail;

    function configure(uint256 n, bool f) external {
        output = n;
        fail = f;
    }

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 n,
        uint256,
        address[] calldata path,
        address recipient,
        uint256
    ) external {
        require(!fail, "swap failed");
        require(FeeToken(payable(path[0])).transferFrom(msg.sender, address(this), n));
        FeeToken(payable(path[path.length - 1])).mint(recipient, output);
    }

    function exactInput(SwapRouterV3.ExactInputParams calldata p) external payable returns (uint256) {
        bytes memory path = p.path;
        address input;
        address outputToken;
        assembly {
            input := shr(96, mload(add(path, 32)))
            outputToken := shr(96, mload(add(add(path, 32), sub(mload(path), 20))))
        }
        require(!fail, "swap failed");
        require(FeeToken(payable(input)).transferFrom(msg.sender, address(this), p.amountIn));
        FeeToken(payable(outputToken)).mint(p.recipient, output);
        return output;
    }
}

contract ButterflySwapTest {
    VmSwap constant vm = VmSwap(address(uint160(uint256(keccak256("hevm cheat code")))));
    ButterflySwap s;
    FeeToken input;
    FeeToken output;
    FeeToken wrapped;
    FeeRouter router;
    address inviter = address(0x777);

    function setUp() public {
        input = new FeeToken();
        output = new FeeToken();
        wrapped = new FeeToken();
        router = new FeeRouter();
        s = new ButterflySwap(address(router), address(router), address(wrapped));
        input.mint(address(this), 1000000);
        input.approve(address(s), 1000000);
    }
    receive() external payable {}

    function path() internal view returns (address[] memory p) {
        p = new address[](2);
        p[0] = address(input);
        p[1] = address(output);
    }

    function trade(address ref, uint256 minimum) internal returns (uint256) {
        return s.swapV2(100000, minimum, path(), false, false, ref, block.timestamp + 120);
    }

    function testInvitedSwapPays70And30AndClearsApproval() public {
        require(trade(inviter, 99200) == 99200);
        require(output.balanceOf(address(this)) == 99200);
        require(output.balanceOf(inviter) == 560 && output.balanceOf(s.treasury()) == 240);
        require(s.earned(inviter, address(output)) == 560 && s.invitedCount(inviter) == 1);
        require(input.allowance(address(s), address(router)) == 0 && output.balanceOf(address(s)) == 0);
    }

    function testUnreferredFeeEntirelyGoesToTreasury() public {
        trade(address(0), 99200);
        require(output.balanceOf(s.treasury()) == 800);
        require(s.referrerOf(address(this)) == address(0));
    }

    function testCanBindAfterUnreferredTradeButCannotReplace() public {
        trade(address(0), 99200);
        trade(inviter, 99200);
        trade(inviter, 99200);
        require(s.invitedCount(inviter) == 1 && s.referrerOf(address(this)) == inviter);
        vm.expectRevert(ButterflySwap.InvalidReferrer.selector);
        trade(address(0x888), 1);
        vm.expectRevert(ButterflySwap.InvalidReferrer.selector);
        trade(address(0), 1);
    }

    function testMinimumFailureRollsBackFeesInputAndBinding() public {
        vm.expectRevert(ButterflySwap.MinimumNotMet.selector);
        trade(inviter, 99201);
        require(input.balanceOf(address(this)) == 1000000 && output.balanceOf(inviter) == 0);
        require(s.referrerOf(address(this)) == address(0) && s.invitedCount(inviter) == 0);
    }

    function testFeeTransferFailureRollsBackSwap() public {
        output.configure(0, true, false);
        vm.expectRevert(ButterflySwap.TransferFailed.selector);
        trade(inviter, 1);
        require(input.balanceOf(address(this)) == 1000000 && s.referrerOf(address(this)) == address(0));
    }

    function testActualRecipientMinimumAfterFinalTransferTax() public {
        output.configure(300, false, false);
        vm.expectRevert(ButterflySwap.MinimumNotMet.selector);
        trade(inviter, 99200);
        require(trade(inviter, 96224) == 96224);
        require(s.earned(inviter, address(output)) == 543);
    }

    function testRejectsTaxedInboundWithoutSpendingDonations() public {
        input.mint(address(s), 12345);
        input.configure(300, false, false);
        vm.expectRevert(ButterflySwap.TransferFailed.selector);
        trade(inviter, 1);
        require(input.balanceOf(address(s)) == 12345);
    }

    function testOutputDonationsAreNeverChargedOrPaidOut() public {
        output.mint(address(s), 12345);
        trade(inviter, 99200);
        require(output.balanceOf(address(s)) == 12345);
    }

    function testZeroFirstApprovalAndNoReturnOutput() public {
        output.configure(0, false, true);
        trade(inviter, 99200);
        trade(inviter, 99200);
        require(output.balanceOf(inviter) == 1120);
    }

    function testRejectsSelfAndTreasuryInvitation() public {
        vm.expectRevert(ButterflySwap.InvalidReferrer.selector);
        trade(address(this), 1);
        address treasury = s.treasury();
        vm.expectRevert(ButterflySwap.InvalidReferrer.selector);
        trade(treasury, 1);
    }

    function testNativeInputAndNativeOutput() public {
        vm.deal(address(this), 1 ether);
        vm.deal(address(wrapped), 1 ether);
        address[] memory p = path();
        p[0] = address(wrapped);
        s.swapV2{value: 100000}(100000, 99200, p, true, false, inviter, block.timestamp + 120);
        p[0] = address(input);
        p[1] = address(wrapped);
        uint256 beforeBalance = address(this).balance;
        s.swapV2(100000, 99200, p, false, true, inviter, block.timestamp + 120);
        require(address(this).balance - beforeBalance == 99200);
        require(inviter.balance == 560 && s.treasury().balance == 240 && address(s).balance == 0);
    }

    function testV3UsesTheSameOutputFeePolicy() public {
        bytes memory p = abi.encodePacked(address(input), uint24(2500), address(output));
        s.swapV3(100000, 99200, p, false, false, inviter, block.timestamp + 120);
        require(output.balanceOf(inviter) == 560 && output.balanceOf(s.treasury()) == 240);
    }

    function testRejectsBadPathsAndUnexpectedBNB() public {
        address[] memory p = path();
        p[1] = p[0];
        vm.expectRevert(ButterflySwap.InvalidSwap.selector);
        s.swapV2(100000, 1, p, false, false, inviter, block.timestamp + 120);
        bytes memory bad = abi.encodePacked(address(input), uint24(99), address(output));
        vm.expectRevert(ButterflySwap.InvalidSwap.selector);
        s.swapV3(100000, 1, bad, false, false, inviter, block.timestamp + 120);
        vm.deal(address(this), 1 ether);
        vm.expectRevert(ButterflySwap.InvalidSwap.selector);
        s.swapV2{value: 1}(100000, 1, path(), false, false, inviter, block.timestamp + 120);
    }

    function testReentrancyBlockedDuringOutputTransfer() public {
        output.setCallback(address(s));
        trade(inviter, 99200);
        require(output.blockedReentry());
    }

    function testFuzzFeeConservation(uint96 raw) public {
        uint256 gross = uint256(raw) + 1;
        router.configure(gross, false);
        trade(inviter, 1);
        uint256 fee = gross * 80 / 10000;
        require(output.balanceOf(inviter) == fee * 70 / 100);
        require(output.balanceOf(s.treasury()) == fee - fee * 70 / 100);
        require(output.balanceOf(address(this)) + output.balanceOf(inviter) + output.balanceOf(s.treasury()) == gross);
    }
}
