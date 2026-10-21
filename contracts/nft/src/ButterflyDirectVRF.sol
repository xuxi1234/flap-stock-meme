// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
interface IDirectWrapper {
 function calculateRequestPriceNative(uint32,uint32) external view returns(uint256);
 function requestRandomWordsInNative(uint32,uint16,uint32,bytes calldata) external payable returns(uint256);
}
interface IDirectCollection {function randomness() external view returns(address);function fulfill(uint256,uint256) external;}
/// @notice Project-funded VRF; small oracle callback, FIFO allocation outside the callback.
/// @dev No admin seed, re-request, cancellation, withdrawal or mutable oracle address.
contract ButterflyDirectVRF is ReentrancyGuard {
 uint32 public constant CALLBACK_GAS_LIMIT=100000;
 uint16 public constant CONFIRMATIONS=10;
 uint256 public constant MAX_ORACLE_FEE=0.0001 ether;
 IDirectWrapper public immutable wrapper;
 address public immutable binder;
 address public collection;
 uint256 public requestCount;
 uint256 public nextAllocation=1;
 mapping(uint256=>uint256) public queue;
 mapping(uint256=>bool) public requested;
 mapping(uint256=>bool) public ready;
 mapping(uint256=>bool) public delivered;
 mapping(uint256=>uint256) private seeds;
 event SeedReady(uint256 indexed requestId);
 event Allocated(uint256 indexed requestId);
 constructor(address wrapper_) {require(wrapper_.code.length>0,'Invalid wrapper');wrapper=IDirectWrapper(wrapper_);binder=msg.sender;}
 function bindCollection(address target) external {
  require(msg.sender==binder&&collection==address(0)&&target.code.length>0,'Binding denied');
  require(IDirectCollection(target).randomness()==address(this),'Wrong adapter');collection=target;
 }
 function fundOracle() external payable {require(msg.value>0,'Zero funding');}
 function oracleBalance() external view returns(uint256){return address(this).balance;}
 function oracleRequestPrice() public view returns(uint256){return wrapper.calculateRequestPriceNative(CALLBACK_GAS_LIMIT,1);}
 function request() external nonReentrant returns(uint256 id){
  require(msg.sender==collection&&collection!=address(0),'Only collection');
  uint256 fee=oracleRequestPrice();require(fee>0&&fee<=MAX_ORACLE_FEE&&address(this).balance>=fee,'Oracle unavailable');
  id=wrapper.requestRandomWordsInNative{value:fee}(CALLBACK_GAS_LIMIT,CONFIRMATIONS,1,abi.encodeWithSelector(bytes4(keccak256('VRF ExtraArgsV1')),true));
  require(id!=0&&!requested[id],'Invalid oracle request');requested[id]=true;queue[++requestCount]=id;
 }
 function rawFulfillRandomWords(uint256 id,uint256[] calldata words) external {
  require(msg.sender==address(wrapper),'Only wrapper');require(requested[id]&&!ready[id]&&!delivered[id]&&words.length==1,'Invalid fulfillment');
  seeds[id]=words[0];ready[id]=true;emit SeedReady(id);
 }
 /// @notice Process exactly the earliest ready request (at most 20 NFTs), never reorder draws.
 function finalize() external nonReentrant {
  uint256 id=queue[nextAllocation];require(id!=0&&ready[id]&&!delivered[id],'Head not ready');
  delivered[id]=true;++nextAllocation;uint256 seed=seeds[id];delete seeds[id];
  IDirectCollection(collection).fulfill(id,seed);emit Allocated(id);
 }
}
