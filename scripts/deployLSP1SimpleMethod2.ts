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
 * - deploy our URD implementation (method2/LSP1URDForwarderSimple.sol)
 * - setData on the UP to register URD implementation address
 * - authorizeOperator on the contractsAddr[0] for the URD to transfer the UP's tokens
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
    'contracts/method2/LSP1URDForwarderSimple.sol:LSP1URDForwarderSimple',
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

  // Calculate the correct permission (SUPER_CALL + REENTRANCY)
  const permInt = parseInt(PERMISSIONS.SUPER_CALL, 16) ^ parseInt(PERMISSIONS.REENTRANCY, 16);
  const permHex = '0x' + permInt.toString(16).padStart(64, '0');

  // console.log('keys: ', dataKeys);
  // console.log('values: ', dataValues);

  // execute the tx
  const setDataBatchTx = await UP.connect(signer).setData(URDdataKey, CustomURDAddress);
  await setDataBatchTx.wait();
  console.log('✅ Custom URD has been correctly registered on the UP');

  // ------------------
  // AUTHORIZE OPERATOR
  // ------------------

  console.log('⏳ Authorizing URD on Custom Token');

  // Get the token contract
  const CustomToken = await ethers.getContractAt('CustomToken', contractsAddr[0] as string);

  // Create the function call
  const authBytes = CustomToken.interface.encodeFunctionData('authorizeOperator', [
    CustomURDAddress,
    ethers.MaxUint256,
    '0x',
  ]);
  // Execute the function call as the UP
  const authTxWithBytes = await UP.connect(signer).execute(
    OPERATION_TYPES.CALL,
    await CustomToken.getAddress(),
    0,
    authBytes,
  );
  await authTxWithBytes.wait();
  console.log('✅ URD authorized on Custom Token for UP ', await UP.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
