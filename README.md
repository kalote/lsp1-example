# LSP1 examples hardhat project

This project showcase an example of usage of [LSP1 - UniversalReceiverDelegate](https://github.com/lukso-network/LIPs/blob/main/LSPs/LSP-1-UniversalReceiver.md). The use-case it answers is **"As a UP, I want to transfer part of the token I received to another UP"**.

## Environment variables

This example requires 4 environment variables. To set it up, use `cp .env.example .env` to copy the example file provided. In the `.env`, fill the following info:

- `PRIVATE_KEY` => your UP private key. To get it:
  - go in the UP browser extension
  - click on the ⚙️ icon in the top right
  - click on "Reveal private keys"
  - copy the value of the `privateKey` fied
- `UP_ADDR` => the address of your UP (you can find it in your browser extension)
- `UP_RECEIVER` => the UP address that will receive part of the tokens
- `PERCENTAGE` => the %age of the received tokens that will be transfered

## Contracts

This project showcases 2 methods:

- Method 1 (`method1/` folder): Transfer via UP (the custom URD will call the LSP7 `transfer()` function through the UP `execute()` function). In order to work, the Custom URD will needs special privileges (SUPER_CALL + REENTRANT)
- Method 2 (`method2/` folder): Direct transfer from URD (the custom URD will call the LSP7 `transfer()` function directly). In order to work, the custom URD needs to be authorized at the LSP7 level (using `authorizeOperator`) with unlimited amount (type(uint256).max)

In each folders, you will find 2 contracts:

- LSP1URDForwarderSingleton.sol => the custom Universal Receiver Delegate contract (can be used by multiple UP)
- LSP1URDForwarderSimple.sol => a simpler version of the custom Universal Receiver Delegate contract (can only be used by 1 UP)

The `LSP1URDForwarderSingleton.sol` and `LSP1URDForwarderSimple.sol` contracts takes 3 parameters:

- the `recipient` address (e.g., the UP that will receive a part of the token)
- the `percentage` number (e.g., what %age of the received tokens that will be transfered)
- the `tokenAddresses` array of addresses (e.g., on which token I want to trigger this custom behaviour)

There are 2 contracts in the `contracts/` folder:

- MyCustomToken.sol => a simple LSP7 token
- MockContract.sol => used to generate the `universalProfile` TypeScript type

## Deploy

There are 3 deployment scripts in the `scripts/` folder:

- deployToken.ts => deploy the simple custom LSP7 token
- deployLSP1SimpleMethod1.ts => deploy the simple custom URD with method 1
- deployLSP1SimpleMethod2.ts => deploy the simple custom URD with method 2
- deployLSP1Singleton.ts => deploy the singleton version of the custom URD

## Run

```bash
npm i
cp .env.sample .env # provide the values for PRIVATE_KEY, UP_ADDR, PERCENTAGE and UP_RECEIVER
npm run build
npx hardhat --network luksoTestnet run scripts/deployToken.ts # This will deploy a custom LSP7 Token
# update scripts/deployLSP1.ts with the deployed LSP7 token or with any LSP7 token addresses
npx hardhat --network luksoTestnet run scripts/deployLSP1SimpleMethod1.ts # This will deploy the Simpler Custom URD and update your UP to use it
```

## Gas cost

The gas cost for the custom URD is paid by the address which initiates the transfer. One of the difference between both methods is the gas cost. I also wanted to highlights the different type of transfer and their impact on the transaction fees. Here is a comparison:

- LSP7 Transfer without custom URD to a UP - First time: 271K used (https://explorer.execution.testnet.lukso.network/tx/0x986074a099611ffab980bc4be444e56b7cf4816f71dbe9f907d9b2908692a3c8/logs)
- LSP7 Transfer without custom URD to a UP - Second time: 169K used (https://explorer.execution.testnet.lukso.network/tx/0x7fb141eb59b1341da891c54f03b8a4c716dc0b4cb681753c91545a16f9f21303/logs)
- LSP7 Transfer without custom URD to an EoA: 136K used (https://explorer.execution.testnet.lukso.network/tx/0xa138996d35c70831ed13b2d787b6bc48343e6d6fbe93f08bdc88591b938704d5/logs)
- LSP7 Transfer with custom forwarder URD (UP execute the transfer) - First time : 511K used (https://explorer.execution.testnet.lukso.network/tx/0xda08f64350fe1f4dec7e6eaa8ad2b917254a1930776c108fc8c7ca67bf1838b4/logs)
- LSP7 Transfer with custom forwarder URD (UP execute the transfer) - Second time : 283K used (https://explorer.execution.testnet.lukso.network/tx/0x5e3e0f335babbb93b9f09688e9af2303f2113cdd233117f14feadc6b0bbf1ba9/logs)
- LSP7 Transfer with custom forwarder URD (URD execute the transfer) - First time : 460K used (https://explorer.execution.testnet.lukso.network/tx/0x88f02d9c9b048c40db4e556e51836d53f970c52db46b3263300a85cbe4f497ca/logs)
- LSP7 Transfer with custom forwarder URD (URD execute the transfer) - Second time : 260K used (https://explorer.execution.testnet.lukso.network/tx/0xa410570db995908686f496844419bc6211b2a3e3fa658bd3411789bd168e985e/logs)

### Why is it more expensive the first time?

This can be explained due to the default URD (present in all UP) updating LSP5 ReceivedAssets keys / values (setData + permission verification of default URD) which cost gas. The second time, the asset is already present in the ReceivedAssets so there's no need to update data & verify permission which save up some gas

### Conclusion

- LSP7 transfer is more expensive than ERC20 transfer
- LSP7 transfer to a UP is ~169K while a LSP7 transfer to an EoA is ~136K
- First time registering assets in LSP5 through default URD can increase the cost by up to 200k
- Difference between method 1 & method 2 is ~23K
