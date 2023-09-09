import hre from 'hardhat';
import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
import * as LSP0ABI from '@lukso/lsp-smart-contracts/artifacts/LSP0ERC725Account.json';
import * as LSP7ABI from '@lukso/lsp-smart-contracts/artifacts/LSP7Mintable.json';
import { ERC725YDataKeys, LSP1_TYPE_IDS, PERMISSIONS } from '@lukso/lsp-smart-contracts';

// load env vars
dotenv.config();

const recipientAddr = '0x0183fCbeDCa8ab45c8eD688cD28a6DBf548efC64';
const contractsAddr = [
  '0xc3eb450aa16153c948ddcc6f42a76bcf856ea92d',
  '0x71c72c837AE9C7191Ec0E335b523a6494b2ebc0D',
];

/**
 * In this script, we will:
 * - deploy the specific URD implementation (LSP1URDForwarder.sol)
 * - setDataBatch on the UP to register URD implementation + new permission array info (length) + permission for URD contract
 * (Don't forget to give your EOA Add notification & edit notification)
 */
async function main() {
  // ----------
  // BASE SETUP
  // ----------

  // setup provider
  const provider = new ethers.JsonRpcProvider('https://rpc.testnet.lukso.network');
  // setup signer (the browser extension controller)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
  console.log('Deploying contracts with EOA: ', signer.address);

  // load the associated UP
  const UP = new ethers.Contract(process.env.UP_ADDR as string, LSP0ABI.abi, signer);

  // ----------
  // DEPLOY URD
  // ----------

  // const CustomURDBytecode = hre.artifacts.readArtifactSync('LSP1URDForwarder').bytecode;

  // // we need to encode the constructor parameters and add them to the contract bytecode
  // const abiCoder = new ethers.AbiCoder();
  // const params = abiCoder.encode(['address', 'address[]'], [recipientAddr, contractsAddr]).substring(2);
  // const fullBytecode = CustomURDBytecode + params;

  // // get the address of the contract that will be created
  // const CustomURDAddress = await UP.connect(signer)
  //   .getFunction('execute')
  //   .staticCall(1, ethers.ZeroAddress, 0, fullBytecode);

  // // deploy LSP1URDForwarder as the UP (signed by the browser extension controller)
  // const tx1 = await UP.connect(signer).getFunction('execute')(1, ethers.ZeroAddress, 0, fullBytecode);
  // await tx1.wait();

  // console.log('✅ Custom URD successfully deployed at address: ', CustomURDAddress);
  const CustomURDAddress = '0xa04d2e4a104c698a11e2f0608af0bfa18f3715a0';

  // we need to approve our new CustomURD contract to spend our tokens
  // load the LSP7
  const LSP7Contract = new ethers.Contract(contractsAddr[0], LSP7ABI.abi, provider);
  const authorizeTx = await LSP7Contract.connect(signer).getFunction('authorizeOperator')(
    CustomURDAddress,
    '200000000000000000000000000000000000000000',
  );
  authorizeTx.wait();

  // --------------
  // SET DATA BATCH
  // --------------

  // we need the key to store our new URD contract address
  // the dataKey should be 64 chars long (tips: use erc725.js)
  const URDdataKey =
    ERC725YDataKeys.LSP1.LSP1UniversalReceiverDelegatePrefix +
    LSP1_TYPE_IDS.LSP7Tokens_RecipientNotification.slice(2).slice(0, 40);

  // we need to give permission to this new URD contract in our UP
  // to do that, we need:
  // - the current length of the permission array
  const addrPermCurrentLengthHex = await UP.getFunction('getData')(
    ERC725YDataKeys.LSP6['AddressPermissions[]'].length,
  );

  // - the new array length (current length + 1)
  const addrPermNewLength = BigInt(addrPermCurrentLengthHex) + BigInt(1);

  // - new array length in hex
  const addrPermNewLengthHex = '0x' + Number(addrPermNewLength).toString(16).padStart(32, '0');

  // - the index of the new perm
  const newElementIndexHex = addrPermCurrentLengthHex.substring(2);

  const dataKeys = [
    URDdataKey,
    ERC725YDataKeys.LSP6['AddressPermissions[]'].length,
    ERC725YDataKeys.LSP6['AddressPermissions[]'].index + newElementIndexHex,
    ERC725YDataKeys.LSP6['AddressPermissions:Permissions'] + CustomURDAddress.substring(2),
  ];
  const dataValues = [CustomURDAddress, addrPermNewLengthHex, CustomURDAddress, PERMISSIONS.SUPER_CALL];

  console.log('keys: ', dataKeys);
  console.log('values: ', dataValues);
  // execute the tx
  // const setDataBatchTx = await UP.connect(signer).getFunction('setDataBatch')(dataKeys, dataValues);
  // await setDataBatchTx.wait();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
