// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {FlapPresale} from "../src/FlapPresale.sol";

error UnsupportedChain(uint256 actualChainId);
error DeploymentInvariantFailed(bytes32 invariant);

interface ScriptVm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// @notice BSC-mainnet-only deployment entrypoint with immediate state validation.
contract DeployFlapPresale {
    uint256 public constant BSC_MAINNET_CHAIN_ID = 56;
    address public constant EXPECTED_ADMIN = 0xbE37AB912De351B9312FA593C9f99e3279FDB0a2;
    address public constant EXPECTED_TREASURY = 0xc46fC8D76Ad6Db1a0f88d97EbF5Aa3c405d177C2;

    ScriptVm internal constant vm = ScriptVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    /// @dev Foundry's script entrypoint. No broadcast starts before the chain gate passes.
    function run() external returns (FlapPresale presale) {
        _requireBscMainnet();
        _startBroadcast();
        presale = _deployAndAssert();
        _stopBroadcast();
    }

    /// @notice Non-broadcast entrypoint used by tests and explicit preflight simulations.
    function deploy() external returns (FlapPresale presale) {
        _requireBscMainnet();
        presale = _deployAndAssert();
    }

    function _requireBscMainnet() internal view {
        if (block.chainid != BSC_MAINNET_CHAIN_ID) revert UnsupportedChain(block.chainid);
    }

    function _startBroadcast() internal virtual {
        vm.startBroadcast();
    }

    function _stopBroadcast() internal virtual {
        vm.stopBroadcast();
    }

    function _deployAndAssert() internal returns (FlapPresale presale) {
        presale = new FlapPresale();

        if (address(presale).code.length == 0) revert DeploymentInvariantFailed("runtime-bytecode");
        if (presale.PARTICIPATION_FEE() != 0.05 ether) revert DeploymentInvariantFailed("participation-fee");
        if (presale.MAX_PARTICIPANTS() != 10_000) revert DeploymentInvariantFailed("max-participants");
        if (presale.INITIAL_END_TIME() != 1_788_969_599) revert DeploymentInvariantFailed("initial-end-time");
        if (presale.endTime() != 1_788_969_599) revert DeploymentInvariantFailed("end-time");
        if (presale.ADMIN() != EXPECTED_ADMIN) revert DeploymentInvariantFailed("admin");
        if (presale.owner() != EXPECTED_ADMIN) revert DeploymentInvariantFailed("owner");
        if (presale.TREASURY() != EXPECTED_TREASURY) revert DeploymentInvariantFailed("treasury");
        if (presale.participantCount() != 0) revert DeploymentInvariantFailed("participant-count");
        if (presale.paused()) revert DeploymentInvariantFailed("paused");
    }
}
