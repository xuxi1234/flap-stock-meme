// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Permissionless direct transfers. No owner, fees, custody, or arbitrary call entrypoint.
contract ButterflyDistributor {
    mapping(address => mapping(bytes32 => bool)) public completed;
    uint256 private entered;
    error InvalidBatch();
    error AlreadyCompleted();
    error TransferFailed();
    error Reentrant();
    event Delivered(
        address indexed sender,
        bytes32 indexed batchId,
        address indexed token,
        address recipient,
        uint256 requested,
        uint256 received
    );
    event BatchCompleted(
        address indexed sender, bytes32 indexed batchId, address indexed token, uint256 count, uint256 total
    );

    function distribute(address token, bytes32 batchId, address[] calldata recipients, uint256[] calldata amounts)
        external
    {
        if (entered != 0) revert Reentrant();
        if (completed[msg.sender][batchId]) revert AlreadyCompleted();
        uint256 length = recipients.length;
        if (token.code.length == 0 || batchId == bytes32(0) || length == 0 || length > 50 || amounts.length != length) {
            revert InvalidBatch();
        }
        entered = 1;
        completed[msg.sender][batchId] = true;
        uint256 total;
        for (uint256 i; i < length; ++i) {
            address recipient = recipients[i];
            if (recipient == address(0) || recipient == address(this) || recipient == msg.sender || amounts[i] == 0) {
                revert InvalidBatch();
            }
            uint256 beforeBalance = balance(token, recipient);
            (bool ok, bytes memory result) = token.call(
                abi.encodeWithSelector(
                    bytes4(keccak256("transferFrom(address,address,uint256)")), msg.sender, recipient, amounts[i]
                )
            );
            if (!ok || (result.length != 0 && (result.length != 32 || !abi.decode(result, (bool))))) {
                revert TransferFailed();
            }
            uint256 afterBalance = balance(token, recipient);
            if (afterBalance <= beforeBalance) revert TransferFailed();
            emit Delivered(msg.sender, batchId, token, recipient, amounts[i], afterBalance - beforeBalance);
            total += amounts[i];
        }
        emit BatchCompleted(msg.sender, batchId, token, length, total);
        entered = 0;
    }

    function balance(address token, address account) private view returns (uint256) {
        (bool ok, bytes memory data) =
            token.staticcall(abi.encodeWithSelector(bytes4(keccak256("balanceOf(address)")), account));
        if (!ok || data.length != 32) revert TransferFailed();
        return abi.decode(data, (uint256));
    }
}
