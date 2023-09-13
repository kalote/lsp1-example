# LSP1 examples hardhat project

This project is used to showcase an example of usage of LSP1 - UniversalReceiverDelegate. The scenario is as follow:

- When my Universal Profile receives a LSP7 token
- If it's part of my allowed token
- Transfer 10% to my recepient address

```bash
npm i
cp .env.sample .env # provide the value for PRIVATE_KEY, UP_ADDR and UP_RECEIVER
npm run build
npx hardhat --network luksoTestnet run scripts/deployToken.ts # This will deploy a custom LSP7 Token
# update scripts/deployLSP1.ts with the deployed LSP7 token
npx hardhat --network luksoTestnet run scripts/deployLSP1.ts # This will deploy the Custom URD and update your UP to use it
```
