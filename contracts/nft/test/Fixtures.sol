// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface Callback {function rawFulfillRandomWords(uint256, uint256[] calldata) external;}
contract Coordinator {
 struct RandomWordsRequest {bytes32 keyHash;uint256 subId;uint16 requestConfirmations;uint32 callbackGasLimit;uint32 numWords;bytes extraArgs;}
 uint256 public nextId;
 function requestRandomWords(RandomWordsRequest calldata r) external returns(uint256){require(keccak256(r.extraArgs)==keccak256(abi.encodeWithSelector(bytes4(keccak256('VRF ExtraArgsV1')),true)),'Native billing required');require(r.numWords==1 && r.subId!=0 && r.keyHash!=bytes32(0));return ++nextId;}
 function fulfill(address target,uint256 requestId,uint256 word) external {uint256[] memory words=new uint256[](1);words[0]=word;Callback(target).rawFulfillRandomWords(requestId,words);}
}
contract RejectNFT {}
interface CollectionRequests {function requestMint(uint256 quantity,address inviter) external payable returns(uint256);}
contract BatchRequester {
 function reserve(address collection,uint256 count,uint256 quantity,address inviter) external payable {
  for(uint256 i;i<count;++i) CollectionRequests(collection).requestMint{value:0.01 ether*quantity}(quantity,inviter);
 }
}
contract AdversarialReceiver {
 address private attackTarget;
 bytes private attackData;
 bool public attempted;
 bool public reentered;
 bool public rejectPayment;
 function configure(address target,bytes calldata data,bool reject_) external {
  attackTarget=target;attackData=data;rejectPayment=reject_;attempted=false;reentered=false;
 }
 function execute(address target,bytes calldata data) external payable {
  (bool ok,bytes memory result)=target.call{value:msg.value}(data);
  if(!ok) assembly {revert(add(result,32),mload(result))}
 }
 function attack() private {
  if(attackTarget!=address(0) && !attempted){attempted=true;(reentered,)=attackTarget.call(attackData);}
 }
 function onERC721Received(address,address,uint256,bytes calldata) external returns(bytes4){attack();return 0x150b7a02;}
 receive() external payable {require(!rejectPayment,'Rejected payment');attack();}
}
contract RejectingBuyer {
 function buy(address market,uint256 tokenId,address expectedSeller,uint256 expectedVersion) external payable {
  (bool ok,bytes memory data)=market.call{value:msg.value}(abi.encodeWithSignature('buy(uint256,address,uint256)',tokenId,expectedSeller,expectedVersion));
  if(!ok)assembly{revert(add(data,32),mload(data))}
 }
}

contract RejectThirdNFT {
 uint256 public received;
 function onERC721Received(address,address,uint256,bytes calldata) external returns(bytes4){require(++received<3,'Reject third NFT');return 0x150b7a02;}
}
