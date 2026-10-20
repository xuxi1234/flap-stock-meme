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
 uint256 public constant REFERRAL_BPS=2000;
 uint256 public constant MAX_BATCH=20;
 address payable public constant TREASURY=payable(0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF);
 IButterflyRandomness public immutable randomness;
 string private metadataBase;
 uint256 public reserved;
 uint256 public assigned;
 uint256 public minted;
 struct MintRequest {address payer;uint256 tokenId;bool claimed;uint256 quantity;address referrer;}
 mapping(uint256=>MintRequest) public requests;
 mapping(uint256=>uint256[]) private assignedIds;
 mapping(address=>address) public referrers;
 mapping(address=>uint256) public invitedCount;
 mapping(address=>uint256) public referralMintCount;
 mapping(address=>uint256) public referralEarned;
 mapping(address=>uint256) public referralRewards;
 mapping(uint256=>uint256) private pool;
 mapping(uint256=>uint256) public transferNonce;
 mapping(address=>uint256[]) private payerIds;
 event ReferrerBound(address indexed payer,address indexed referrer);
 event ReferralRewardCredited(address indexed referrer,uint256 indexed requestId,uint256 quantity,uint256 amount);
 event ReferralRewardsWithdrawn(address indexed referrer,address indexed recipient,uint256 amount);
 event MintRequested(uint256 indexed requestId,address indexed payer);
 event MintAssigned(uint256 indexed requestId,uint256 indexed tokenId);
 event MintClaimed(uint256 indexed requestId,uint256 indexed tokenId,address indexed recipient);
 constructor(address adapter,string memory base) ERC721('Butterfly Genesis','BFLY') {
  require(adapter.code.length>0 && bytes(base).length>0,'Invalid configuration');randomness=IButterflyRandomness(adapter);metadataBase=base;
 }
 /// @notice Inviter selection is permanent and does not imply unique human identity.
 function bindReferrer(address inviter) external { _bindReferrer(msg.sender,inviter); }
 function _bindReferrer(address payer,address inviter) private {
  require(referrers[payer]==address(0),'Already bound');
  require(inviter!=address(0) && inviter!=payer && inviter!=address(this) && inviter!=address(0xdead),'Invalid inviter');
  referrers[payer]=inviter;++invitedCount[inviter];emit ReferrerBound(payer,inviter);
 }
 function requestMint() external payable nonReentrant returns(uint256) {
  address inviter=referrers[msg.sender];require(inviter!=address(0),'Inviter required');return _requestMint(1,inviter);
 }
 function requestMint(uint256 quantity,address inviter) external payable nonReentrant returns(uint256) {
  if(referrers[msg.sender]==address(0))_bindReferrer(msg.sender,inviter);
  else require(referrers[msg.sender]==inviter,'Inviter mismatch');
  return _requestMint(quantity,inviter);
 }
 function _requestMint(uint256 quantity,address inviter) private returns(uint256 requestId) {
  require(quantity>0 && quantity<=MAX_BATCH,'Invalid quantity');
  require(msg.value==MINT_PRICE*quantity,'Exact mint price required');require(quantity<=MAX_SUPPLY-reserved,'Sold out');
  reserved+=quantity;requestId=randomness.request();require(requestId!=0 && requests[requestId].payer==address(0),'Invalid request');
  requests[requestId]=MintRequest(msg.sender,0,false,quantity,inviter);payerIds[msg.sender].push(requestId);emit MintRequested(requestId,msg.sender);
 }
 /// @dev No external calls: receiver/treasury behavior cannot break a valid VRF fulfillment.
 function fulfill(uint256 requestId,uint256 word) external {
  require(msg.sender==address(randomness),'Only randomness');MintRequest storage r=requests[requestId];
  require(r.payer!=address(0) && r.tokenId==0,'Invalid fulfillment');
  for(uint256 i;i<r.quantity;++i){
   uint256 remaining=MAX_SUPPLY-assigned;
   // Preserve the legacy single draw; batches expand the VRF seed per index.
   uint256 draw=r.quantity==1?word:uint256(keccak256(abi.encode(word,requestId,i)));
   uint256 index=draw%remaining;uint256 value=pool[index];uint256 tokenId=value==0?index+1:value;
   uint256 last=pool[remaining-1];pool[index]=last==0?remaining:last;
   delete pool[remaining-1];++assigned;assignedIds[requestId].push(tokenId);
   if(i==0)r.tokenId=tokenId;emit MintAssigned(requestId,tokenId);
  }
 }
 function requestTokenIds(uint256 requestId) external view returns(uint256[] memory){return assignedIds[requestId];}
 function claim(uint256 requestId,address recipient) external nonReentrant {
  MintRequest storage r=requests[requestId];
  require(r.payer==msg.sender && r.tokenId!=0 && !r.claimed,'Not claimable');require(recipient!=address(0),'Zero recipient');
  r.claimed=true;minted+=r.quantity;
  uint256 total=MINT_PRICE*r.quantity;uint256 reward=total*REFERRAL_BPS/10000;
  referralMintCount[r.referrer]+=r.quantity;referralEarned[r.referrer]+=reward;referralRewards[r.referrer]+=reward;
  for(uint256 i;i<r.quantity;++i){uint256 tokenId=assignedIds[requestId][i];_safeMint(recipient,tokenId);emit MintClaimed(requestId,tokenId,recipient);}
  (bool paid,)=TREASURY.call{value:total-reward}('');require(paid,'Treasury payment failed');
  emit ReferralRewardCredited(r.referrer,requestId,r.quantity,reward);
 }
 function withdrawReferralRewards(address payable recipient) external nonReentrant {
  require(recipient!=address(0),'Zero recipient');uint256 reward=referralRewards[msg.sender];require(reward>0,'No rewards');
  referralRewards[msg.sender]=0;(bool paid,)=recipient.call{value:reward}('');require(paid,'Reward payment failed');
  emit ReferralRewardsWithdrawn(msg.sender,recipient,reward);
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

