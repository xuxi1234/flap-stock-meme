// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC721} from '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import {IERC721Receiver} from '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
/// @notice Single-collection escrow. Fee rounds down to whole wei; remainder goes to seller.
contract ButterflyMarket is IERC721Receiver, ReentrancyGuard {
 address payable public constant TREASURY=payable(0x764dBCD80ca3E5d50CBAe986e2b6F507Dc47CfcF);
 IERC721 public immutable collection;
 uint256 public constant FEE_BPS=700;
 struct Listing {address payable seller;uint256 price;}
 mapping(uint256=>Listing) public listings;
 bool private receiving;
 uint256 private receivingToken;
 address private receivingSeller;
 event Listed(uint256 indexed tokenId,address indexed seller,uint256 price);
 event Cancelled(uint256 indexed tokenId,address indexed seller);
 event Sold(uint256 indexed tokenId,address indexed seller,address indexed buyer,uint256 price,uint256 fee);
 constructor(address collection_) {require(collection_.code.length>0,'Invalid collection');collection=IERC721(collection_);}
 function list(uint256 tokenId,uint256 price) external nonReentrant {
  require(price>0 && listings[tokenId].seller==address(0),'Invalid listing');require(collection.ownerOf(tokenId)==msg.sender,'Only owner');
  listings[tokenId]=Listing(payable(msg.sender),price);receiving=true;receivingToken=tokenId;receivingSeller=msg.sender;
  collection.safeTransferFrom(msg.sender,address(this),tokenId);receiving=false;delete receivingSeller;delete receivingToken;
  emit Listed(tokenId,msg.sender,price);
 }
 function cancel(uint256 tokenId) external nonReentrant {
  Listing memory l=listings[tokenId];require(l.seller==msg.sender,'Only seller');delete listings[tokenId];
  collection.safeTransferFrom(address(this),msg.sender,tokenId);emit Cancelled(tokenId,msg.sender);
 }
 function buy(uint256 tokenId) external payable nonReentrant {
  Listing memory l=listings[tokenId];require(l.seller!=address(0) && msg.sender!=l.seller,'Invalid buyer');require(msg.value==l.price,'Exact price required');
  delete listings[tokenId];uint256 fee=l.price/10000*FEE_BPS+(l.price%10000)*FEE_BPS/10000;
  collection.safeTransferFrom(address(this),msg.sender,tokenId);
  (bool sellerPaid,)=l.seller.call{value:l.price-fee}('');require(sellerPaid,'Seller payment failed');
  (bool feePaid,)=TREASURY.call{value:fee}('');require(feePaid,'Fee payment failed');emit Sold(tokenId,l.seller,msg.sender,l.price,fee);
 }
 function onERC721Received(address operator,address from,uint256 tokenId,bytes calldata) external view returns(bytes4) {
  require(msg.sender==address(collection) && operator==address(this) && receiving && tokenId==receivingToken && from==receivingSeller,'Unsolicited NFT');return IERC721Receiver.onERC721Received.selector;
 }
}
