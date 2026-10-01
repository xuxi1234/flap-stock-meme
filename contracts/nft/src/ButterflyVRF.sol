// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
/// @dev Chainlink VRF v2.5 subscription ABI; pinned coordinator, native BNB subscription billing.
interface IVRFCoordinatorV2Plus {
 struct RandomWordsRequest {bytes32 keyHash;uint256 subId;uint16 requestConfirmations;uint32 callbackGasLimit;uint32 numWords;bytes extraArgs;}
 function requestRandomWords(RandomWordsRequest calldata request) external returns(uint256);
}
interface IRandomCollection {function fulfill(uint256 requestId,uint256 word) external;function randomness() external view returns(address);}
contract ButterflyVRF {
 IVRFCoordinatorV2Plus public immutable coordinator;
 bytes32 public immutable keyHash;
 uint256 public immutable subscriptionId;
 uint16 public immutable confirmations;
 uint32 public immutable callbackGasLimit;
 address public immutable binder;
 address public collection;
 mapping(uint256=>bool) public pending;
 event CollectionBound(address indexed collection);
 constructor(address coordinator_,bytes32 keyHash_,uint256 subscriptionId_,uint16 confirmations_,uint32 gasLimit_) {
  require(coordinator_.code.length>0 && keyHash_!=bytes32(0) && subscriptionId_!=0 && confirmations_>=3 && confirmations_<=200 && gasLimit_>=200000 && gasLimit_<=2500000,'Invalid VRF configuration');
  coordinator=IVRFCoordinatorV2Plus(coordinator_);keyHash=keyHash_;subscriptionId=subscriptionId_;confirmations=confirmations_;callbackGasLimit=gasLimit_;binder=msg.sender;
 }
 function bindCollection(address target) external {
  require(msg.sender==binder && collection==address(0) && target.code.length>0,'Binding denied');
  require(IRandomCollection(target).randomness()==address(this),'Wrong adapter');collection=target;emit CollectionBound(target);
 }
 function request() external returns(uint256 requestId) {
  require(msg.sender==collection && collection!=address(0),'Only collection');
  requestId=coordinator.requestRandomWords(IVRFCoordinatorV2Plus.RandomWordsRequest({keyHash:keyHash,subId:subscriptionId,requestConfirmations:confirmations,callbackGasLimit:callbackGasLimit,numWords:1,extraArgs:abi.encodeWithSelector(bytes4(keccak256('VRF ExtraArgsV1')),true)}));
  require(requestId!=0 && !pending[requestId],'Invalid coordinator request');pending[requestId]=true;
 }
 function rawFulfillRandomWords(uint256 requestId,uint256[] calldata words) external {
  require(msg.sender==address(coordinator),'Only coordinator');require(pending[requestId] && words.length==1,'Invalid fulfillment');
  delete pending[requestId];IRandomCollection(collection).fulfill(requestId,words[0]);
 }
}
