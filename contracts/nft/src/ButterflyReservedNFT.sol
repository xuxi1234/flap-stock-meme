// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ButterflyNFT} from './ButterflyNFT.sol';

/// @notice Four disclosed constructor allocations; the other 7,773 IDs use VRF.
/// No administrator, extra mint entry point, or mutable allocation recipient.
contract ButterflyReservedNFT is ButterflyNFT {
 address public constant ALLOCATION_RECIPIENT=0x1aee21A82300f315Bb3782dFb0330477C5b87C58;
 uint256 public constant PREALLOCATED_SUPPLY=4;
 uint256 public constant PUBLIC_SUPPLY=7773;
 constructor(address adapter,string memory base) ButterflyNFT(adapter,base) {
  // Descending removal means each requested ID still occupies index ID-1.
  uint256[4] memory ids=[uint256(7777),1314,520,1];
  reserved=PREALLOCATED_SUPPLY;minted=PREALLOCATED_SUPPLY;
  for(uint256 i;i<ids.length;++i){
   require(_drawToken(ids[i]-1)==ids[i],'Allocation mismatch');
  }
  for(uint256 i;i<ids.length;++i)_safeMint(ALLOCATION_RECIPIENT,ids[i]);
 }
}
