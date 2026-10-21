// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ButterflyReservedNFT} from '../src/ButterflyReservedNFT.sol';
// Test-only adapter and harness, never used by the deployment launcher.
contract ReservedAdapterMock {uint256 private nextId;function request() external returns(uint256){return ++nextId;}}
contract ReservedPoolHarness is ButterflyReservedNFT {
 constructor(address adapter) ButterflyReservedNFT(adapter,'https://example.org/nft/') {}
 event Drawn(uint256[] ids);
 function drawBatch(uint256 count,uint256 seed) external {
  uint256[] memory ids=new uint256[](count);
  for(uint256 i;i<count;++i)ids[i]=_drawToken(uint256(keccak256(abi.encode(seed,i))));
  emit Drawn(ids);
 }
}
