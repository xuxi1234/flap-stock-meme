// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
interface IDirectCallback {function rawFulfillRandomWords(uint256,uint256[] calldata) external;}
contract DirectWrapperMock {
 uint256 public fee=0.00002 ether;uint256 public nextId;
 function setFee(uint256 f) external {fee=f;}
 function calculateRequestPriceNative(uint32,uint32) external view returns(uint256){return fee;}
 function requestRandomWordsInNative(uint32 gasLimit,uint16 confirmations,uint32 words,bytes calldata extraArgs) external payable returns(uint256){require(msg.value==fee&&gasLimit==100000&&confirmations==10&&words==1);require(keccak256(extraArgs)==keccak256(abi.encodeWithSelector(bytes4(keccak256('VRF ExtraArgsV1')),true)));return ++nextId;}
 function fulfill(address target,uint256 id,uint256 seed) external {uint256[] memory words=new uint256[](1);words[0]=seed;(bool ok,)=target.call{gas:100000}(abi.encodeCall(IDirectCallback.rawFulfillRandomWords,(id,words)));require(ok,'Callback failed');}
}
