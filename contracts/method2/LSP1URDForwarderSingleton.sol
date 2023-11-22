// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.4;

// interfaces
import { IERC725X } from "@erc725/smart-contracts/contracts/interfaces/IERC725X.sol";
import { ILSP1UniversalReceiverDelegate } from "@lukso/lsp-smart-contracts/contracts/LSP1UniversalReceiver/ILSP1UniversalReceiverDelegate.sol";
import { ILSP7DigitalAsset } from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/ILSP7DigitalAsset.sol";

// modules
import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { ERC165Checker } from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// constants
import { _TYPEID_LSP7_TOKENSRECIPIENT } from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/LSP7Constants.sol";
import "@lukso/lsp-smart-contracts/contracts/LSP1UniversalReceiver/LSP1Constants.sol";
import "@lukso/lsp-smart-contracts/contracts/LSP0ERC725Account/LSP0Constants.sol";

// errors
import "@lukso/lsp-smart-contracts/contracts/LSP1UniversalReceiver/LSP1Errors.sol";

contract LSP1URDForwarder is
    ERC165,
    ILSP1UniversalReceiverDelegate
{
    // For each UP, we set a recipient
    mapping (address => address) recipients;
    
    // For each UP, we set a percentage to send to recipient
    mapping (address => uint256) percentages;

    // For each UP, we set a list of authorized LSP7 tokens
    mapping(address => mapping (address => bool)) allowlist;

    // we set the recipient & percentage & addresses of the deployer in the constructor for simplicity 
    constructor(address _recipient, uint256 _percentage, address[] memory tokenAddresses) {
        require(_percentage < 100, "Percentage should be < 100");
        recipients[msg.sender] = _recipient;
        percentages[msg.sender] = _percentage;

        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            allowlist[msg.sender][tokenAddresses[i]] = true;
        }
    }

    function addAddress(address token) public {
        allowlist[msg.sender][token] = true;
    }

    function setRecipient(address _recipient) public {
        recipients[msg.sender] = _recipient;
    }
    
    function setPercentage(uint256 _percentage) public {
        require(_percentage < 100, "Percentage should be < 100");
        percentages[msg.sender] = _percentage;
    }

    function removeAddress(address token) public {
        allowlist[msg.sender][token] = false;
    }

    function getAddressStatus(address token) public view returns (bool) {
        return allowlist[msg.sender][token];
    }

    function getRecipient() public view returns (address) {
        return recipients[msg.sender];
    }
    
    function getPercentage() public view returns (uint256) {
        return percentages[msg.sender];
    }

    function universalReceiverDelegate(
        address caller, 
        uint256 /*value*/, 
        bytes32 /*typeId*/, 
        bytes memory data
    ) public virtual returns (bytes memory) {
        // CHECK that the caller is a LSP0 (UniversalProfile)
        // by checking its interface support
        if (
            !ERC165Checker.supportsERC165InterfaceUnchecked(
                msg.sender,
                _INTERFACEID_LSP0
            )
        ) {
            return "Caller is not a LSP0";
        }
        // GET the notifier (e.g., the LSP7 Token) from the calldata
        address notifier = caller;

        // CHECK that notifier is a contract with a `balanceOf` method
        // and that msg.sender (the UP) has a positive balance
        if (notifier.code.length > 0) {
            try ILSP7DigitalAsset(notifier).balanceOf(msg.sender) returns (
                uint256 balance
            ) {
                if (balance == 0) {
                    return "LSP1: balance is zero";
                }
            } catch {
                return "LSP1: `balanceOf(address)` function not found";
            }
        }

        // CHECK that the address of the LSP7 is whitelisted
        if (!allowlist[msg.sender][notifier]) {
            return "Token not in allowlist";
        }
        
        // extract data (we only need the amount that was transfered / minted)
        (, , uint256 amount, ) = abi.decode(
            data,
            (address, address, uint256, bytes)
        );

        // CHECK if amount is not too low
        if (amount < 100) {
            return "Amount is too low (< 100)";
        } else {
            uint256 tokensToTransfer = (amount * percentages[msg.sender]) / 100;

            ILSP7DigitalAsset(notifier).transfer(msg.sender, recipients[msg.sender], tokensToTransfer, true, "");
            return "";
        }
    }

    // --- Overrides

    /**
     * @inheritdoc ERC165
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override returns (bool) {
        return
            interfaceId == _INTERFACEID_LSP1 ||
            super.supportsInterface(interfaceId);
    }
}
