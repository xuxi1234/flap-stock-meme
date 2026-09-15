// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface SwapAsset {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}

interface WrappedAsset is SwapAsset {
    function deposit() external payable;
    function withdraw(uint256) external;
}

interface SwapRouterV2 {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256,
        uint256,
        address[] calldata,
        address,
        uint256
    ) external;
}

interface SwapRouterV3 {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }
    function exactInput(ExactInputParams calldata) external payable returns (uint256);
}

/// @notice Output-asset fees and immediate referral settlement. No owner or arbitrary call entrypoint.
contract ButterflySwap {
    address public constant treasury = 0x133C7e613a62DC43876F17b688DF0B4D24A75735;
    uint256 public constant feeBps = 80;
    uint256 public constant inviterPercent = 70;
    address public immutable v2Router;
    address public immutable v3Router;
    address public immutable wrappedNative;
    mapping(address => address) public referrerOf;
    mapping(address => uint256) public invitedCount;
    // Actual credited units per asset. address(0) identifies native BNB.
    mapping(address => mapping(address => uint256)) public earned;
    bool private entered;
    error InvalidSwap();
    error TransferFailed();
    error MinimumNotMet();
    error InvalidReferrer();
    event ReferralBound(address indexed trader, address indexed inviter);
    event FeePaid(
        address indexed trader,
        address indexed asset,
        address indexed inviter,
        uint256 gross,
        uint256 serviceFee,
        uint256 inviterReceived,
        uint256 treasuryReceived,
        uint256 traderReceived
    );

    constructor(address v2, address v3, address wrapped) {
        if (v2.code.length == 0 || v3.code.length == 0 || wrapped.code.length == 0) revert InvalidSwap();
        // Test deployments may supply mocks; BSC deployments must use canonical protocols.
        if (
            block.chainid == 56
                && (v2 != 0x10ED43C718714eb63d5aA57B78B54704E256024E
                    || v3 != 0x1b81D678ffb9C0263b24A97847620C99d213eB14
                    || wrapped != 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c)
        ) revert InvalidSwap();
        v2Router = v2;
        v3Router = v3;
        wrappedNative = wrapped;
    }
    modifier nonReentrant() {
        if (entered) revert InvalidSwap();
        entered = true;
        _;
        entered = false;
    }

    receive() external payable {
        if (msg.sender != wrappedNative) revert InvalidSwap();
    }

    function swapV2(
        uint256 amountIn,
        uint256 minimumNet,
        address[] calldata path,
        bool nativeIn,
        bool nativeOut,
        address inviter,
        uint256 deadline
    ) external payable nonReentrant returns (uint256) {
        if (path.length < 2 || path.length > 4) revert InvalidSwap();
        for (uint256 i; i < path.length; ++i) {
            if (path[i] == address(0)) revert InvalidSwap();
            for (uint256 j; j < i; ++j) {
                if (path[i] == path[j]) revert InvalidSwap();
            }
        }
        address input = path[0];
        address output = path[path.length - 1];
        _validate(input, output, amountIn, minimumNet, nativeIn, nativeOut, deadline);
        address ref = _bind(inviter);
        uint256 beforeOutput = SwapAsset(output).balanceOf(address(this));
        _fund(input, amountIn, nativeIn, v2Router);
        SwapRouterV2(v2Router)
            .swapExactTokensForTokensSupportingFeeOnTransferTokens(amountIn, 0, path, address(this), deadline);
        _safe(input, abi.encodeCall(SwapAsset.approve, (v2Router, 0)));
        return _settle(output, SwapAsset(output).balanceOf(address(this)) - beforeOutput, minimumNet, nativeOut, ref);
    }

    function swapV3(
        uint256 amountIn,
        uint256 minimumNet,
        bytes calldata path,
        bool nativeIn,
        bool nativeOut,
        address inviter,
        uint256 deadline
    ) external payable nonReentrant returns (uint256) {
        (address input, address output) = _validateV3Path(path);
        _validate(input, output, amountIn, minimumNet, nativeIn, nativeOut, deadline);
        address ref = _bind(inviter);
        uint256 beforeOutput = SwapAsset(output).balanceOf(address(this));
        _fund(input, amountIn, nativeIn, v3Router);
        _executeV3(path, amountIn, deadline);
        _safe(input, abi.encodeCall(SwapAsset.approve, (v3Router, 0)));
        return _settle(output, SwapAsset(output).balanceOf(address(this)) - beforeOutput, minimumNet, nativeOut, ref);
    }

    function _executeV3(bytes calldata path, uint256 amountIn, uint256 deadline) private {
        SwapRouterV3(v3Router).exactInput(SwapRouterV3.ExactInputParams(path, address(this), deadline, amountIn, 0));
    }

    function _validateV3Path(bytes calldata path) private pure returns (address input, address output) {
        if (path.length != 43 && path.length != 66) revert InvalidSwap();
        input = _addressAt(path, 0);
        output = _addressAt(path, path.length - 20);
        uint256 hops = (path.length - 20) / 23;
        for (uint256 i; i < hops; ++i) {
            uint24 fee;
            uint256 offset = i * 23 + 20;
            assembly { fee := shr(232, calldataload(add(path.offset, offset))) }
            if (fee != 100 && fee != 500 && fee != 2500 && fee != 10000) revert InvalidSwap();
            address token = _addressAt(path, i * 23);
            if (token == address(0)) revert InvalidSwap();
            for (uint256 j = i + 1; j <= hops; ++j) {
                if (token == _addressAt(path, j * 23)) revert InvalidSwap();
            }
        }
    }

    function _validate(
        address input,
        address output,
        uint256 amount,
        uint256 minimum,
        bool nativeIn,
        bool nativeOut,
        uint256 deadline
    ) private view {
        if (
            amount == 0 || minimum == 0 || deadline < block.timestamp || deadline > block.timestamp + 600
                || input == output || input.code.length == 0 || output.code.length == 0
                || (nativeIn && input != wrappedNative) || (nativeOut && output != wrappedNative)
                || msg.value != (nativeIn ? amount : 0)
        ) revert InvalidSwap();
    }

    function _bind(address candidate) private returns (address ref) {
        ref = referrerOf[msg.sender];
        if (candidate == msg.sender || candidate == treasury || candidate == address(this)) revert InvalidReferrer();
        if (ref != address(0)) {
            if (candidate != ref) revert InvalidReferrer();
        } else if (candidate != address(0)) {
            ref = candidate;
            referrerOf[msg.sender] = candidate;
            ++invitedCount[candidate];
            emit ReferralBound(msg.sender, candidate);
        }
    }

    function _fund(address input, uint256 amount, bool nativeIn, address router) private {
        uint256 beforeInput = SwapAsset(input).balanceOf(address(this));
        if (nativeIn) WrappedAsset(wrappedNative).deposit{value: amount}();
        else _safe(input, abi.encodeCall(SwapAsset.transferFrom, (msg.sender, address(this), amount)));
        // An input transfer tax would change the quoted input; never consume donated balances.
        if (SwapAsset(input).balanceOf(address(this)) - beforeInput != amount) revert TransferFailed();
        _safe(input, abi.encodeCall(SwapAsset.approve, (router, 0)));
        _safe(input, abi.encodeCall(SwapAsset.approve, (router, amount)));
    }

    function _settle(address output, uint256 gross, uint256 minimum, bool nativeOut, address ref)
        private
        returns (uint256 net)
    {
        uint256 fee = gross * feeBps / 10000;
        uint256 share = ref == address(0) ? 0 : fee * inviterPercent / 100;
        if (gross - fee < minimum) revert MinimumNotMet();
        address asset = nativeOut ? address(0) : output;
        if (nativeOut) WrappedAsset(wrappedNative).withdraw(gross);
        // Measure trader payment independently, including when trader equals treasury.
        net = _pay(asset, msg.sender, gross - fee);
        if (net < minimum) revert MinimumNotMet();
        uint256 referralReceived = share == 0 ? 0 : _pay(asset, ref, share);
        uint256 treasuryReceived = _pay(asset, treasury, fee - share);
        earned[ref][asset] += referralReceived;
        earned[treasury][asset] += treasuryReceived;
        emit FeePaid(msg.sender, asset, ref, gross, fee, referralReceived, treasuryReceived, net);
    }

    function _pay(address asset, address recipient, uint256 amount) private returns (uint256) {
        if (amount == 0) return 0;
        if (asset == address(0)) {
            (bool ok,) = recipient.call{value: amount}("");
            if (!ok) revert TransferFailed();
            return amount;
        }
        uint256 beforeBalance = SwapAsset(asset).balanceOf(recipient);
        _safe(asset, abi.encodeCall(SwapAsset.transfer, (recipient, amount)));
        return SwapAsset(asset).balanceOf(recipient) - beforeBalance;
    }

    function _safe(address token, bytes memory data) private {
        (bool ok, bytes memory result) = token.call(data);
        if (!ok || (result.length != 0 && (result.length != 32 || !abi.decode(result, (bool))))) {
            revert TransferFailed();
        }
    }

    function _addressAt(bytes calldata path, uint256 offset) private pure returns (address a) {
        assembly { a := shr(96, calldataload(add(path.offset, offset))) }
    }
}
