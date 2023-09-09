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

// libraries
import {
    _TYPEID_LSP7_TOKENSRECIPIENT
} from "@lukso/lsp-smart-contracts/contracts/LSP7DigitalAsset/LSP7Constants.sol";

// constants
import "@lukso/lsp-smart-contracts/contracts/LSP1UniversalReceiver/LSP1Constants.sol";

// errors
import "@lukso/lsp-smart-contracts/contracts/LSP1UniversalReceiver/LSP1Errors.sol";

contract LSP1URDForwarder is
    ERC165,
    ILSP1UniversalReceiver
{
    // the receiver address
    address public royaltyRecipient;

    // the deployer / owner
    address public owner;

    // the contracts that are allowed
    mapping(address => bool) allowlist;

    modifier onlyOwner {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _royaltyRecipient, address[] memory tokenAddresses) {
        royaltyRecipient = _royaltyRecipient;
        owner = msg.sender;

        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            allowlist[tokenAddresses[i]] = true;
        }
    }

    function addAddress(address token) public onlyOwner {
        allowlist[token] = true;
    }

    function removeAddress(address token) public onlyOwner {
        allowlist[token] = false;
    }

    function getAddressStatus(address token) public view returns (bool) {
        return allowlist[token];
    }

    function universalReceiver(
        bytes32 typeId,
        bytes memory data
    ) public payable virtual returns (bytes memory) {
        // CHECK that we did not send any native tokens to the LSP1 Delegate, as it cannot transfer them back.
        if (msg.value != 0) {
            revert NativeTokensNotAccepted();
        }

        address notifier = address(bytes20(msg.data[msg.data.length - 52:]));

        // CHECK balance only when the Token contract is already deployed,
        // not when tokens are being transferred on deployment through the `constructor`
        if (notifier.code.length > 0) {
            // if the amount sent is 0, then do not update the keys
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

        if (typeId == _TYPEID_LSP7_TOKENSRECIPIENT) {
            if (allowlist[notifier]) {
                (, , uint256 amount, ) = abi.decode(
                    data,
                    (address, address, uint256, bytes)
                );

                // add a check for token amount
                uint256 tokensToTransfer = amount / 10;

                bytes memory encodededTx = abi.encodeWithSelector(
                    ILSP7DigitalAsset.transfer.selector,
                    // from Andreas: BE CAREFUL MAN, this is not what you want here
                    // (msg.sender? who is that? my UP? the LSP7 contract?)
                    msg.sender,
                    royaltyRecipient,
                    tokensToTransfer,
                    true,
                    ""
                );

                IERC725X(msg.sender).execute(0, notifier, 0, encodededTx);
            } else {
                return "Token not in allowlist";
            }
        }
        return "";
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
