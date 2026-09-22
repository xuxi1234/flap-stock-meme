// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {VRFV2PlusWrapperConsumerBase} from "vendor/chainlink/vrf/dev/VRFV2PlusWrapperConsumerBase.sol";
import {VRFV2PlusClient} from "vendor/chainlink/vrf/dev/libraries/VRFV2PlusClient.sol";
/// @notice Fixed-price random allocation. VRF callbacks store entropy only; settlement is FIFO.
contract MoonCollection is ERC721, ReentrancyGuard, VRFV2PlusWrapperConsumerBase {
    using Strings for uint256;
    uint256 public constant MAX_SUPPLY = 7777;
    uint256 public constant MINT_PRICE = 0.001 ether;
    uint256 public constant MAX_PER_TX = 50;
    address public constant VRF_WRAPPER = 0x471506e6ADED0b9811D05B8cAc8Db25eE839Ac94;
    uint32 public constant CALLBACK_GAS = 100_000;
    uint16 public constant CONFIRMATIONS = 20;
    uint256 public constant MAX_VRF_FEE = 0.01 ether;
    address payable public constant REVENUE = payable(0x23898F0866E4D5fa5C9B97645239eD635EA93cDC);
    uint256 public totalSupply;
    uint256 public totalReserved;
    uint256 public requestCount;
    uint256 public nextToSettle = 1;
    string private baseURI;
    bytes32 public immutable manifestHash;
    struct Request { address buyer; uint32 quantity; bool ready; bool settled; uint256 vrfId; uint256 seed; }
    mapping(uint256 => Request) public requests;
    mapping(uint256 => uint256) public sequenceOf;
    mapping(uint256 => uint256) private pool;
    mapping(uint256 => uint256[]) private assigned;
    mapping(address => uint256[]) private buyerRequests;
    event MintRequested(address indexed buyer, uint256 indexed sequence, uint256 indexed vrfId, uint256 quantity);
    event RandomnessReady(uint256 indexed sequence);
    event Minted(address indexed buyer, uint256 indexed sequence, uint256[] tokenIds);
    event RandomnessFunded(address indexed sender, uint256 value);
    error InvalidQuantity(); error IncorrectPayment(); error SoldOut(); error PaymentFailed(); error InvalidMetadata();
    error RandomnessUnfunded(); error RandomnessTooExpensive(); error NotReady(); error InvalidRequest();
    constructor(string memory collectionName, string memory collectionSymbol, string memory metadataBase, bytes32 manifest) ERC721(collectionName, collectionSymbol) VRFV2PlusWrapperConsumerBase(VRF_WRAPPER) {
        if(bytes(metadataBase).length == 0 || manifest == bytes32(0)) revert InvalidMetadata();
        baseURI = metadataBase; manifestHash = manifest;
    }
    receive() external payable { emit RandomnessFunded(msg.sender, msg.value); }
    function randomnessFee(uint256 gasPrice) public view returns(uint256) {
        return i_vrfV2PlusWrapper.estimateRequestPriceNative(CALLBACK_GAS, 1, gasPrice);
    }
    function mint(uint256 quantity) external payable nonReentrant returns(uint256 sequence) {
        if(quantity == 0 || quantity > MAX_PER_TX) revert InvalidQuantity();
        if(msg.value != quantity * MINT_PRICE) revert IncorrectPayment();
        if(totalReserved + quantity > MAX_SUPPLY) revert SoldOut();
        uint256 fee = i_vrfV2PlusWrapper.calculateRequestPriceNative(CALLBACK_GAS, 1);
        if(fee > MAX_VRF_FEE) revert RandomnessTooExpensive();
        // The complete NFT price goes to REVENUE. Randomness is paid from a separate reserve.
        if(address(this).balance - msg.value < fee) revert RandomnessUnfunded();
        totalReserved += quantity;
        sequence = ++requestCount;
        (uint256 vrfId,) = requestRandomnessPayInNative(CALLBACK_GAS, CONFIRMATIONS, 1,
            VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment:true})));
        if(vrfId == 0 || sequenceOf[vrfId] != 0) revert InvalidRequest();
        requests[sequence] = Request(msg.sender,uint32(quantity),false,false,vrfId,0);
        sequenceOf[vrfId] = sequence;
        buyerRequests[msg.sender].push(sequence);
        (bool ok,) = REVENUE.call{value:msg.value}("");
        if(!ok) revert PaymentFailed();
        emit MintRequested(msg.sender,sequence,vrfId,quantity);
    }
    function fulfillRandomWords(uint256 vrfId, uint256[] memory words) internal override {
        uint256 sequence = sequenceOf[vrfId];
        Request storage r = requests[sequence];
        // A duplicate or unexpected callback never overwrites accepted entropy.
        if(sequence == 0 || r.ready || words.length != 1) return;
        r.seed = words[0]; r.ready = true;
        emit RandomnessReady(sequence);
    }
    /// @notice Anyone may settle the next ready request. Caller and timing cannot alter its result.
    function settleNext(uint256 expectedSequence) external nonReentrant {
        uint256 sequence = nextToSettle;
        if(sequence != expectedSequence) revert InvalidRequest();
        Request storage r = requests[sequence];
        if(!r.ready || r.settled) revert NotReady();
        r.settled = true; nextToSettle = sequence + 1;
        uint256[] memory ids = new uint256[](r.quantity);
        for(uint256 i; i < r.quantity; ++i) {
            uint256 remaining = MAX_SUPPLY - totalSupply;
            uint256 index = uint256(keccak256(abi.encode(r.seed,sequence,i))) % remaining;
            uint256 tokenId = pool[index]; if(tokenId == 0) tokenId = index + 1;
            uint256 last = pool[remaining-1]; if(last == 0) last = remaining;
            if(index != remaining-1) pool[index] = last;
            delete pool[remaining-1];
            ++totalSupply; ids[i] = tokenId; assigned[sequence].push(tokenId);
            // No recipient callback: a receiver cannot revert and stall the global allocation queue.
            // Contract buyers must be capable of managing ERC721 tokens sent to their own address.
            _mint(r.buyer,tokenId);
        }
        emit Minted(r.buyer,sequence,ids);
    }
    function requestTokens(uint256 sequence) external view returns(uint256[] memory) {return assigned[sequence];}
    function buyerRequestCount(address buyer) external view returns(uint256) {return buyerRequests[buyer].length;}
    function buyerRequestAt(address buyer,uint256 index) external view returns(uint256) {return buyerRequests[buyer][index];}
    /// @notice Bounded owner lookup for a wallet UI without relying on an external indexer.
    function ownedInRange(address account,uint256 start,uint256 count) external view returns(uint256[] memory result) {
        if(account==address(0)||start==0||start>MAX_SUPPLY||count==0||count>256)revert InvalidQuantity();
        uint256 end=start+count;if(end>MAX_SUPPLY+1)end=MAX_SUPPLY+1;
        uint256 found;result=new uint256[](end-start);
        for(uint256 id=start;id<end;++id)if(_ownerOf(id)==account)result[found++]=id;
        assembly {mstore(result,found)}
    }
    function sweepUnusedReserve() external nonReentrant {
        if(totalSupply != MAX_SUPPLY) revert NotReady();
        (bool ok,) = REVENUE.call{value:address(this).balance}(""); if(!ok) revert PaymentFailed();
    }
    function tokenURI(uint256 id) public view override returns(string memory) {
        _requireOwned(id); return string.concat(baseURI,id.toString(),".json");
    }
}
