// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.4;

// interfaces
import {
    IERC725X
} from "@erc725/smart-contracts/contracts/interfaces/IERC725X.sol";
import {ILSP1UniversalReceiver} from "@lukso/lsp-smart-contracts/contracts/LSP1UniversalReceiver/ILSP1UniversalReceiver.sol";
import {ILSP7DigitalAsset} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/ILSP7DigitalAsset.sol";

// modules
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {
    ERC165Checker
} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

// libraries
import {
    _TYPEID_LSP7_TOKENSRECIPIENT
} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/LSP7Constants.sol";

// constants
import "@lukso/lsp-smart-contracts/contracts/LSP1UniversalReceiver/LSP1Constants.sol";
import "@lukso/lsp-smart-contracts/contracts/LSP0ERC725Account/LSP0Constants.sol";

// errors
import "@lukso/lsp-smart-contracts/contracts/LSP1UniversalReceiver/LSP1Errors.sol";

contract LSP1URDForwarder is
    ERC165,
    ILSP1UniversalReceiver
{
    event UniversalReceiverCustom(
        address from,
        bytes32 typeId,
        bytes receivedData
    );

    // When UP address receive token, send X% to _recipient 
    mapping (address => address) royaltyRecipients;

    // For each UP, map of a list of authorized LSP7 tokens
    mapping(address => mapping (address => bool)) allowlist;

    constructor(address _royaltyRecipient, address[] memory tokenAddresses) {
        // we set the recipient & addresses of the deployer for simplicity 
        royaltyRecipients[msg.sender] = _royaltyRecipient;

        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            allowlist[msg.sender][tokenAddresses[i]] = true;
        }
    }

    function addAddress(address token) public {
        allowlist[msg.sender][token] = true;
    }

    function setRecipient(address _recipient) public {
        royaltyRecipients[msg.sender] = _recipient;
    }

    function removeAddress(address token) public {
        allowlist[msg.sender][token] = false;
    }

    function getAddressStatus(address token) public view returns (bool) {
        return allowlist[msg.sender][token];
    }

    function getRecipient() public view returns (address) {
        return royaltyRecipients[msg.sender];
    }

    function universalReceiver(
        bytes32 typeId,
        bytes memory data
    ) public payable virtual returns (bytes memory) {
        // CHECK that we did not send any native tokens to the LSP1 Delegate, as it cannot transfer them back.
        if (msg.value != 0) {
            revert NativeTokensNotAccepted();
        }
        
        // debug event
        emit UniversalReceiverCustom(
            msg.sender,
            typeId,
            data
        );
        
        // CHECK that the msg.sender is a LSP0 (UniversalProfile)
        if (
            ERC165Checker.supportsERC165InterfaceUnchecked(
                msg.sender,
                _INTERFACEID_LSP0
            )
        ) {
            // GET the notifier from the calldata
            address notifier = address(bytes20(msg.data[msg.data.length - 52:]));

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

            // CHECK that the URD has been called because we received a LSP7 token
            if (typeId == _TYPEID_LSP7_TOKENSRECIPIENT) {
                // CHECK that the address of the LSP7 is whitelisted
                if (allowlist[msg.sender][notifier]) {
                    (, , uint256 amount, ) = abi.decode(
                        data,
                        (address, address, uint256, bytes)
                    );

                    if (amount % 10 != 0) {
                        return "Amount should be a multiple of 10";
                    } else {
                        uint256 tokensToTransfer = amount / 10;

                        // Requirements for direct Transfer via UP:
                        // - setData on PREFIX + _TYPEID_LSP7_TOKENSRECIPIENT with custom URD address
                        // - setData on AddressPermissions:Permissions<customURDAddress> (=create a controller) with SUPER_CALL
                        bytes memory encodedTx = abi.encodeWithSelector(
                            ILSP7DigitalAsset.transfer.selector,
                            msg.sender,
                            royaltyRecipients[msg.sender],
                            tokensToTransfer,
                            true,
                            ""
                        );
                        IERC725X(msg.sender).execute(0, notifier, 0, encodedTx);
                    } 
                } else {
                    return "Token not in allowlist";
                }
            }
            return "";
        } else {
            return "Caller is not a LSP0";
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
