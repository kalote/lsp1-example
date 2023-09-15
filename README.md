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

There are 4 contracts in the `contracts/` folder:

- MyCustomToken.sol => a simple LSP7 token
- MockContract.sol => used to generate the `universalProfile` TypeScript type
- LSP1URDForwarder.sol => the custom Universal Receiver Delegate contract (can be used by multiple UP)
- LSP1URDForwarderSimple.sol => a simpler version of the custom Universal Receiver Delegate contract (can only be used by 1 UP)

The `LSP1URDForwarder.sol` and `LSP1URDForwarderSimple.sol` contracts takes 3 parameters:

- the `recipient` address (e.g., the UP that will receive a part of the token)
- the `percentage` number (e.g., what %age of the received tokens that will be transfered)
- the `tokenAddresses` array of addresses (e.g., on which token I want to trigger this custom behaviour)

## Deploy

There are 3 deployment scripts in the `scripts/` folder:

- deployToken.ts => deploy the simple custom LSP7 token
- deployLSP1.ts => deploy the custom URD and register it on the `UP_ADDR`
- deployLSP1.ts => deploy the simple custom URD and register it on the `UP_ADDR`

## Run

```bash
npm i
cp .env.sample .env # provide the values for PRIVATE_KEY, UP_ADDR, PERCENTAGE and UP_RECEIVER
npm run build
npx hardhat --network luksoTestnet run scripts/deployToken.ts # This will deploy a custom LSP7 Token
# update scripts/deployLSP1.ts with the deployed LSP7 token or with any LSP7 token addresses
npx hardhat --network luksoTestnet run scripts/deployLSP1.ts # This will deploy the Custom URD and update your UP to use it
npx hardhat --network luksoTestnet run scripts/deployLSP1Simple.ts # This will deploy the Simpler Custom URD and update your UP to use it
```
