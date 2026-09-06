// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {FlapPresale} from "../src/FlapPresale.sol";
import {DeployFlapPresale, UnsupportedChain} from "../script/DeployFlapPresale.s.sol";

error BroadcastReachedBeforeChainGate();

interface DeployVm {
    function chainId(uint256 newChainId) external;
    function expectRevert(bytes calldata revertData) external;
}

abstract contract DeployTest {
    DeployVm internal constant vm = DeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 left, uint256 right) internal pure {
        require(left == right, "assertion failed: uint256");
    }

    function assertEq(address left, address right) internal pure {
        require(left == right, "assertion failed: address");
    }

    function assertEq(bool left, bool right) internal pure {
        require(left == right, "assertion failed: bool");
    }

    function assertTrue(bool value) internal pure {
        require(value, "assertion failed: bool");
    }
}

contract TestableDeployFlapPresale is DeployFlapPresale {
    uint256 public broadcastPhase;

    function _startBroadcast() internal override {
        require(broadcastPhase == 0, "broadcast started out of order");
        broadcastPhase = 1;
    }

    function _stopBroadcast() internal override {
        require(broadcastPhase == 1, "broadcast stopped out of order");
        broadcastPhase = 2;
    }
}

contract RevertingBroadcastDeployFlapPresale is DeployFlapPresale {
    function _startBroadcast() internal pure override {
        revert BroadcastReachedBeforeChainGate();
    }
}

contract DeployFlapPresaleTest is DeployTest {
    address internal constant ADMIN = 0xbE37AB912De351B9312FA593C9f99e3279FDB0a2;
    address internal constant TREASURY = 0xc46fC8D76Ad6Db1a0f88d97EbF5Aa3c405d177C2;

    DeployFlapPresale internal deployment;

    function setUp() public {
        deployment = new DeployFlapPresale();
    }

    function testDeploymentEntrypointsRejectNonBscMainnetChains() public {
        RevertingBroadcastDeployFlapPresale gateProbe = new RevertingBroadcastDeployFlapPresale();
        vm.chainId(1);
        vm.expectRevert(abi.encodeWithSelector(UnsupportedChain.selector, 1));
        gateProbe.run();

        vm.chainId(97);
        vm.expectRevert(abi.encodeWithSelector(UnsupportedChain.selector, 97));
        deployment.deploy();
    }

    function testDeploymentOnBscMainnetHasBindingState() public {
        vm.chainId(56);

        FlapPresale presale = deployment.deploy();

        assertTrue(address(presale).code.length > 0);
        assertEq(presale.PARTICIPATION_FEE(), 0.05 ether);
        assertEq(presale.MAX_PARTICIPANTS(), 10_000);
        assertEq(presale.INITIAL_END_TIME(), 1_788_969_599);
        assertEq(presale.endTime(), 1_788_969_599);
        assertEq(presale.ADMIN(), ADMIN);
        assertEq(presale.owner(), ADMIN);
        assertEq(presale.TREASURY(), TREASURY);
        assertEq(presale.participantCount(), 0);
        assertEq(presale.paused(), false);
    }

    function testRunOnBscMainnetDeploysBindingStateInsideBroadcastBoundary() public {
        TestableDeployFlapPresale testableDeployment = new TestableDeployFlapPresale();
        vm.chainId(56);

        FlapPresale presale = testableDeployment.run();

        assertEq(testableDeployment.broadcastPhase(), 2);
        assertTrue(address(presale).code.length > 0);
        assertEq(presale.PARTICIPATION_FEE(), 0.05 ether);
        assertEq(presale.MAX_PARTICIPANTS(), 10_000);
        assertEq(presale.INITIAL_END_TIME(), 1_788_969_599);
        assertEq(presale.endTime(), 1_788_969_599);
        assertEq(presale.ADMIN(), ADMIN);
        assertEq(presale.owner(), ADMIN);
        assertEq(presale.TREASURY(), TREASURY);
        assertEq(presale.participantCount(), 0);
        assertEq(presale.paused(), false);
    }
}
