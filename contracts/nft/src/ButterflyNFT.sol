// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC721} from '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import {ERC721Enumerable} from '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
interface IButterflyRandomness {function request() external returns(uint256);}
/// @notice Fixed-price, non-upgradeable collection; pending requests reserve capacity permanently.
contract ButterflyNFT is ERC721Enumerable, ReentrancyGuard {
 uint256 public constant MAX_SUPPLY=7777;
 uint256 public constant MINT_PRICE=0.01 ether;
 address payable public constant TREASURY=payable(0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF);
 IButterflyRandomness public immutable randomness;
 string private metadataBase;
 uint256 public reserved;
 uint256 public assigned;
 uint256 public minted;
 struct MintRequest {address payer;uint256 tokenId;bool claimed;}
 mapping(uint256=>MintRequest) public requests;
 mapping(uint256=>uint256) private pool;
 mapping(uint256=>uint256) public transferNonce;
 mapping(address=>uint256[]) private payerIds;
 event MintRequested(uint256 indexed requestId,address indexed payer);
 event MintAssigned(uint256 indexed requestId,uint256 indexed tokenId);
 event MintClaimed(uint256 indexed requestId,uint256 indexed tokenId,address indexed recipient);
 constructor(address adapter,string memory base) ERC721('Butterfly Genesis','BFLY') {
  require(adapter.code.length>0 && bytes(base).length>0,'Invalid configuration');randomness=IButterflyRandomness(adapter);metadataBase=base;
 }
 function requestMint() external payable nonReentrant returns(uint256 requestId) {
  require(msg.value==MINT_PRICE,'Exact mint price required');require(reserved<MAX_SUPPLY,'Sold out');
  ++reserved;requestId=randomness.request();require(requestId!=0 && requests[requestId].payer==address(0),'Invalid request');
  requests[requestId]=MintRequest(msg.sender,0,false);payerIds[msg.sender].push(requestId);emit MintRequested(requestId,msg.sender);
 }
 /// @dev No external calls: receiver/treasury behavior cannot break a valid VRF fulfillment.
 function fulfill(uint256 requestId,uint256 word) external {
  require(msg.sender==address(randomness),'Only randomness');MintRequest storage r=requests[requestId];
  require(r.payer!=address(0) && r.tokenId==0,'Invalid fulfillment');
  uint256 remaining=MAX_SUPPLY-assigned;
  uint256 index=word%remaining;
  uint256 value=pool[index];r.tokenId=value==0?index+1:value;
  uint256 last=pool[remaining-1];pool[index]=last==0?remaining:last;
  delete pool[remaining-1];++assigned;emit MintAssigned(requestId,r.tokenId);
 }
 function claim(uint256 requestId,address recipient) external nonReentrant {
  MintRequest storage r=requests[requestId];
  require(r.payer==msg.sender && r.tokenId!=0 && !r.claimed,'Not claimable');require(recipient!=address(0),'Zero recipient');
  r.claimed=true;++minted;_safeMint(recipient,r.tokenId);
  (bool paid,)=TREASURY.call{value:MINT_PRICE}('');require(paid,'Treasury payment failed');
  emit MintClaimed(requestId,r.tokenId,recipient);
 }
 /// @notice Matches the generated immutable metadata files: {base}/{id}.json.
 function tokenURI(uint256 tokenId) public view override returns(string memory) {
  // OpenZeppelin checks token existence before constructing the base URI.
  return string.concat(super.tokenURI(tokenId), '.json');
 }
 function contractURI() external view returns(string memory){return string.concat(metadataBase,'collection.json');}
 function payerRequestCount(address payer) external view returns(uint256){return payerIds[payer].length;}
 /// @notice Stable append-only pages, including claimed requests; inspect requests(id) for status.
 function payerRequests(address payer,uint256 offset,uint256 limit) external view returns(uint256[] memory ids){
  require(limit<=100,'Page too large');uint256 length=payerIds[payer].length;
  if(offset>=length)return new uint256[](0);
  uint256 count=length-offset;if(count>limit)count=limit;ids=new uint256[](count);
  for(uint256 i;i<count;++i)ids[i]=payerIds[payer][offset+i];
 }
 function _update(address to,uint256 tokenId,address auth) internal override returns(address){
  address from=super._update(to,tokenId,auth);++transferNonce[tokenId];return from;
 }
 function _baseURI() internal view override returns(string memory){return metadataBase;}
}
