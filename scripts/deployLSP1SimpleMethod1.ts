import hre from 'hardhat';
import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
import { ERC725YDataKeys, LSP1_TYPE_IDS, PERMISSIONS, OPERATION_TYPES } from '@lukso/lsp-smart-contracts';

// load env vars
dotenv.config();

// You can update the value of the allowed LSP7 token
const contractsAddr = ['0x303ae9b19ee9b6fda8c710b7f74b0582bbcc7b81'];

// Update those values in the .env file
const { UP_ADDR, PRIVATE_KEY, UP_RECEIVER, PERCENTAGE } = process.env;

/**
 * In this script, we will:
 * - deploy our URD implementation (method1/LSP1URDForwarderSimple.sol)
 * - setDataBatch on the UP to register URD implementation address + permission for URD contract
 * (Don't forget to give your EOA Add / Edit notification and automation)
 */
async function main() {
  // ----------
  // BASE SETUP
  // ----------

  // setup provider
  const provider = new ethers.JsonRpcProvider('https://rpc.testnet.lukso.network');
  // setup signer (the browser extension controller)
  const signer = new ethers.Wallet(PRIVATE_KEY as string, provider);
  // load the associated UP
  const UP = await ethers.getContractAt('UniversalProfile', UP_ADDR as string);
  console.log('🔑 EOA: ', signer.address);
  console.log('🆙 Universal Profile: ', await UP.getAddress());

  // ----------
  // DEPLOY URD
  // ----------

  console.log('⏳ Deploying the custom URD');
  const CustomURDBytecode = hre.artifacts.readArtifactSync(
    'contracts/method1/LSP1URDForwarderSimple.sol:LSP1URDForwarderSimple',
  ).bytecode;

  // we need to encode the constructor parameters and add them to the contract bytecode
  const abiCoder = new ethers.AbiCoder();
  const params = abiCoder
    .encode(['address', 'uint256', 'address[]'], [UP_RECEIVER as string, PERCENTAGE as string, contractsAddr])
    .slice(2);
  const fullBytecode = CustomURDBytecode + params;

  // get the address of the contract that will be created
  const CustomURDAddress = await UP.connect(signer).execute.staticCall(
    OPERATION_TYPES.CREATE,
    ethers.ZeroAddress,
    0,
    fullBytecode,
  );

  // deploy LSP1URDForwarder as the UP (signed by the browser extension controller)
  const tx1 = await UP.connect(signer).execute(OPERATION_TYPES.CREATE, ethers.ZeroAddress, 0, fullBytecode);
  await tx1.wait();

  console.log('✅ Custom URD successfully deployed at address: ', CustomURDAddress);

  // --------------
  // SET DATA BATCH
  // --------------

  // we need the key to store our custom URD contract address
  // {_LSP1_UNIVERSAL_RECEIVER_DELEGATE_PREFIX + <bytes32 typeId>}
  console.log('⏳ Registering custom URD on the UP');
  const URDdataKey =
    ERC725YDataKeys.LSP1.LSP1UniversalReceiverDelegatePrefix +
    LSP1_TYPE_IDS.LSP7Tokens_RecipientNotification.slice(2).slice(0, 40);

  // we will update the keys for:
  // - the custom URD of specific TYPE_ID (with our custom URD cotract address)
  // - the permission of this custom URD contract (this will create a new controller in the Browser Extension)
  const dataKeys = [
    URDdataKey,
    ERC725YDataKeys.LSP6['AddressPermissions:Permissions'] + CustomURDAddress.slice(2),
  ];

  // Calculate the correct permission (SUPER_CALL + REENTRANCY)
  const permInt = parseInt(PERMISSIONS.SUPER_CALL, 16) ^ parseInt(PERMISSIONS.REENTRANCY, 16);
  const permHex = '0x' + permInt.toString(16).padStart(64, '0');

  const dataValues = [CustomURDAddress, permHex];

  // console.log('keys: ', dataKeys);
  // console.log('values: ', dataValues);

  // execute the tx
  const setDataBatchTx = await UP.connect(signer).setDataBatch(dataKeys, dataValues);
  await setDataBatchTx.wait();
  console.log('✅ Custom URD has been correctly registered on the UP');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
