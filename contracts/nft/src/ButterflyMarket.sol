// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
interface IButterflyCollection is IERC721 {function transferNonce(uint256 tokenId) external view returns(uint256);}
/// @notice Noncustodial fixed-price sales. Seller receives all proceeds atomically.
contract ButterflyMarket is ReentrancyGuard {
 address payable public constant TREASURY=payable(0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF);
 IButterflyCollection public immutable collection;
 uint256 public constant FEE_BPS=0;
 struct Listing {address payable seller;uint256 price;}
 mapping(uint256=>Listing) public listings;
 mapping(uint256=>uint256) public listingNonce;
 mapping(uint256=>uint256) public listingVersion;
 uint256[] private listedIds;
 mapping(uint256=>bool) private everListed;
 event Listed(uint256 indexed tokenId,address indexed seller,uint256 price);
 event Cancelled(uint256 indexed tokenId,address indexed seller);
 event Sold(uint256 indexed tokenId,address indexed seller,address indexed buyer,uint256 price,uint256 fee);
 constructor(address collection_) {require(collection_.code.length>0,'Invalid collection');collection=IButterflyCollection(collection_);}
 function isListingActive(uint256 tokenId) public view returns(bool){
  Listing memory l=listings[tokenId];if(l.seller==address(0))return false;
  return collection.ownerOf(tokenId)==l.seller && collection.transferNonce(tokenId)==listingNonce[tokenId]
   && (collection.getApproved(tokenId)==address(this) || collection.isApprovedForAll(l.seller,address(this)));
 }
 function listedTokenCount() external view returns(uint256){return listedIds.length;}
 /// @notice Historical candidates; clients filter with isListingActive.
 function listedTokenIds(uint256 offset,uint256 limit) external view returns(uint256[] memory ids){
  require(limit<=100,'Page too large');if(offset>=listedIds.length)return new uint256[](0);
  uint256 count=listedIds.length-offset;if(count>limit)count=limit;ids=new uint256[](count);
  for(uint256 i;i<count;++i)ids[i]=listedIds[offset+i];
 }
 function list(uint256 tokenId,uint256 price) external nonReentrant {
  require(price>0,'Invalid price');require(collection.ownerOf(tokenId)==msg.sender,'Only owner');
  require(collection.getApproved(tokenId)==address(this) || collection.isApprovedForAll(msg.sender,address(this)),'Approval required');
  if(!everListed[tokenId]){everListed[tokenId]=true;listedIds.push(tokenId);}
  ++listingVersion[tokenId];listings[tokenId]=Listing(payable(msg.sender),price);listingNonce[tokenId]=collection.transferNonce(tokenId);
  emit Listed(tokenId,msg.sender,price);
 }
 function cancel(uint256 tokenId) external nonReentrant {
  require(listings[tokenId].seller==msg.sender,'Only seller');delete listings[tokenId];delete listingNonce[tokenId];
  emit Cancelled(tokenId,msg.sender);
 }
 function buy(uint256 tokenId,address expectedSeller,uint256 expectedVersion) external payable nonReentrant {
  require(listings[tokenId].seller==expectedSeller && listingVersion[tokenId]==expectedVersion,'Listing changed');
  Listing memory l=listings[tokenId];require(isListingActive(tokenId) && msg.sender!=l.seller,'Invalid buyer or listing');
  require(msg.value==l.price,'Exact price required');delete listings[tokenId];delete listingNonce[tokenId];
  collection.safeTransferFrom(l.seller,msg.sender,tokenId);
  (bool sellerPaid,)=l.seller.call{value:l.price}('');require(sellerPaid,'Seller payment failed');
  emit Sold(tokenId,l.seller,msg.sender,l.price,0);
 }
}
