// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
/// @notice Fixed-price, fixed-supply, non-upgradeable Chang'e collection.
contract ChangeFairies is ERC721, ReentrancyGuard {
    using Strings for uint256;
    uint256 public constant MAX_SUPPLY = 7777;
    uint256 public constant MINT_PRICE = 0.001 ether;
    uint256 public constant MAX_PER_TX = 50;
    address payable public constant REVENUE = payable(0x23898F0866E4D5fa5C9B97645239eD635EA93cDC);
    uint256 public totalSupply;
    string private baseURI;
    bytes32 public immutable manifestHash;
    event Minted(address indexed buyer, uint256 firstId, uint256 quantity, uint256 paid);
    error InvalidQuantity(); error IncorrectPayment(); error SoldOut(); error PaymentFailed(); error InvalidMetadata();
    constructor(string memory metadataBase, bytes32 manifest) ERC721("Chang'e Fairies", "CHANGE") {
        if(bytes(metadataBase).length == 0 || manifest == bytes32(0)) revert InvalidMetadata();
        baseURI = metadataBase; manifestHash = manifest;
    }
    function mint(uint256 quantity) external payable nonReentrant {
        if(quantity == 0 || quantity > MAX_PER_TX) revert InvalidQuantity();
        if(msg.value != quantity * MINT_PRICE) revert IncorrectPayment();
        uint256 first = totalSupply + 1;
        if(totalSupply + quantity > MAX_SUPPLY) revert SoldOut();
        totalSupply += quantity;
        for(uint256 id = first; id < first + quantity; ++id) _safeMint(msg.sender, id);
        (bool ok,) = REVENUE.call{value: msg.value}("");
        if(!ok) revert PaymentFailed();
        emit Minted(msg.sender, first, quantity, msg.value);
    }
    function tokenURI(uint256 id) public view override returns(string memory) {
        _requireOwned(id);
        return string.concat(baseURI, id.toString(), ".json");
    }
}
