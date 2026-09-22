// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Signed fixed-price BNB orders. On-chain registry makes listings publicly discoverable.
/// Registration and cancellation cost network gas; the platform takes no sale fee.
contract MoonMarket is EIP712, ReentrancyGuard {
    struct Order { address seller; address collection; uint256 tokenId; uint256 price; uint256 deadline; uint256 salt; }
    bytes32 public constant ORDER_TYPEHASH = keccak256("Order(address seller,address collection,uint256 tokenId,uint256 price,uint256 deadline,uint256 salt)");
    address public immutable change;
    address public immutable rabbit;
    mapping(bytes32 => Order) public orders;
    mapping(bytes32 => bytes) private signatures;
    mapping(bytes32 => bool) public closed;
    bytes32[] public orderIds;
    event Listed(bytes32 indexed orderId,address indexed seller,address indexed collection,uint256 tokenId,uint256 price,uint256 deadline);
    event Cancelled(bytes32 indexed orderId);
    event Sold(bytes32 indexed orderId,address indexed buyer,address indexed seller,address collection,uint256 tokenId,uint256 price);
    error InvalidOrder(); error NotSeller(); error IncorrectPayment(); error PaymentFailed();
    constructor(address change_,address rabbit_) EIP712("Butterfly Mid-Autumn Market","1") {
        if(change_==rabbit_ || change_.code.length==0 || rabbit_.code.length==0) revert InvalidOrder();
        change=change_;rabbit=rabbit_;
    }
    function hashOrder(Order memory o) public view returns(bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(ORDER_TYPEHASH,o.seller,o.collection,o.tokenId,o.price,o.deadline,o.salt)));
    }
    function _valid(Order memory o,bytes memory sig,bytes32 h) private view returns(bool) {
        if(closed[h] || (o.collection!=change && o.collection!=rabbit) || o.seller==address(0) || o.price==0 || o.deadline<=block.timestamp) return false;
        if(!SignatureChecker.isValidSignatureNow(o.seller,h,sig))return false;
        IERC721 n=IERC721(o.collection);
        try n.ownerOf(o.tokenId) returns(address owner){if(owner!=o.seller)return false;}catch{return false;}
        return n.getApproved(o.tokenId)==address(this) || n.isApprovedForAll(o.seller,address(this));
    }
    function register(Order calldata o,bytes calldata sig) external nonReentrant returns(bytes32 h) {
        h=hashOrder(o);
        if(orders[h].seller!=address(0) || !_valid(o,sig,h))revert InvalidOrder();
        orders[h]=o;signatures[h]=sig;orderIds.push(h);
        emit Listed(h,o.seller,o.collection,o.tokenId,o.price,o.deadline);
    }
    function isActive(bytes32 h) public view returns(bool){return _valid(orders[h],signatures[h],h);}
    function orderCount() external view returns(uint256){return orderIds.length;}
    // A seller may cancel even an unpublished signature to prevent later registration.
    function cancel(Order calldata o) external nonReentrant {
        if(msg.sender!=o.seller)revert NotSeller();
        bytes32 h=hashOrder(o);closed[h]=true;emit Cancelled(h);
    }
    function buy(bytes32 h) external payable nonReentrant {
        Order memory o=orders[h];
        if(!_valid(o,signatures[h],h))revert InvalidOrder();
        if(msg.value!=o.price)revert IncorrectPayment();
        closed[h]=true;
        IERC721(o.collection).safeTransferFrom(o.seller,msg.sender,o.tokenId);
        (bool ok,)=payable(o.seller).call{value:msg.value}("");if(!ok)revert PaymentFailed();
        emit Sold(h,msg.sender,o.seller,o.collection,o.tokenId,o.price);
    }
}
