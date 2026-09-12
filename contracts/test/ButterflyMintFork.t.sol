// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import {ButterflyMintFactory, ButterflyMintCampaign} from "../src/ButterflyMint.sol";

interface ForkVm {
    function envOr(string calldata, bool) external returns (bool);
    function envString(string calldata) external returns (string memory);
    function createSelectFork(string calldata) external returns (uint256);
    function deal(address, uint256) external;
    function prank(address) external;
    function skip(bool) external;
}

interface ForkToken {
    function balanceOf(address) external view returns (uint256);
}

interface ForkPortal {
    struct Info {
        address vault;
        address vaultFactory;
        string description;
        bool isOfficial;
        uint8 riskLevel;
    }
    function getVault(address) external view returns (Info memory);
}

contract ButterflyMintForkTest {
    ForkVm constant vm = ForkVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ADMIN = 0x79F8b832DE72e81Ad34fd66EcbbF673613264072;
    address constant PORTAL = 0x90497450f2a706f1951b5bdda52B4E5d16f34C06;
    event ForkBlock(uint256 number);
    event ForkResult(address factory, address campaign, address token, uint256 tokensReceived, uint256 tokensClaimed);

    function testBscForkLaunchAndClaim() public {
        if (!vm.envOr("RUN_MINT_FORK", false)) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(vm.envString("BSC_MAINNET_RPC_URL"));
        emit ForkBlock(block.number);
        ButterflyMintFactory factory = new ButterflyMintFactory(ADMIN, ADMIN, PORTAL);
        ButterflyMintCampaign.Config memory c;
        c.name = "Butterfly Mint Fork Check";
        c.symbol = "MINTCHK";
        c.meta = "bafkreihoo25ud3y4yt5mr3zlddtdclt4v3mxibc3kmhznxz5dkid3ube4u";
        c.targetShares = 2;
        c.deadline = uint64(block.timestamp + 7 days);
        c.minimumTokensOut = 1 ether;
        c.vaultFactory = 0xfd2437DFFB8EBe9F96125b30c85Be22f99Fdddf3;
        c.vaultData = abi.encode(uint256(60), uint256(1000));
        c.buyTaxRate = 300;
        c.sellTaxRate = 300;
        c.taxDuration = 36500 days;
        c.antiFarmerDuration = 30 days;
        c.mktBps = 10000;
        vm.prank(ADMIN);
        ButterflyMintCampaign campaign = ButterflyMintCampaign(payable(factory.createCampaign(c)));
        vm.deal(ADMIN, 1 ether);
        vm.prank(ADMIN);
        campaign.mint{value: 0.02 ether}(2);
        // Precomputed with viem CREATE2 prediction, no on-chain mining loop.
        bytes32 salt = 0x96eea91af7a4e148e5913d1c843b4649110d8087449f1858d23a4f1fe44dbaa1;
        address predicted = 0x65B6D17FC8195A606F5577AaF0F0d13B8b3d7777;
        require(predicted.code.length == 0, "test salt already used");
        campaign.launch(salt);
        require(campaign.token() == predicted, "unexpected token");
        uint256 output = campaign.tokensForParticipants();
        require(output >= c.minimumTokensOut, "minimum output");
        vm.prank(ADMIN);
        campaign.claim(ADMIN);
        uint256 claimed = ForkToken(predicted).balanceOf(ADMIN);
        require(claimed > 0, "no claimed tokens");
        require(campaign.claimedShares() == 2 && campaign.sharesOf(ADMIN) == 0, "claim accounting");
        ForkPortal.Info memory info = ForkPortal(PORTAL).getVault(predicted);
        require(info.vault.code.length > 0 && info.vaultFactory == c.vaultFactory, "vault registry");
        emit ForkResult(address(factory), address(campaign), predicted, output, claimed);
    }
}
