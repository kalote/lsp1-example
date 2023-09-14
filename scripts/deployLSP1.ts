import { ethers } from 'hardhat';
import 'dotenv/config';
import { ERC725YDataKeys, LSP1_TYPE_IDS, PERMISSIONS } from '@lukso/lsp-smart-contracts';

// load env vars
const { UP_ADDR, UP_RECEIVER } = process.env;

// You can update the value of the allowed LSP7 token here
const contractsAddr = [
  '0xBD79438C04d768BACb0C5d110eBa5D201D780A87',
  '0xdb9183dda773285d5a4c5b1067a78c9f64fb26e6',
];

/**
 * In this script, we will:
 * - deploy the specific URD implementation (LSP1URDForwarder.sol)
 * - setDataBatch on the UP to register URD implementation + permission for URD contract
 * (Don't forget to give your EOA Add notification & edit notification)
 */
async function main() {
  // ----------
  // BASE SETUP
  // ----------

  // setup signer (the browser extension controller)
  const signer = await ethers.provider.getSigner();
  console.log('Deploying contracts with EOA: ', signer.address);

  // load the associated UP
  const UP = await ethers.getContractAt('UniversalProfile', UP_ADDR as string);
  // ----------
  // DEPLOY URD
  // ----------

  const CustomURDBytecode = (await ethers.getContractFactory('LSP1URDForwarder')).bytecode;

  // we need to encode the constructor parameters and add them to the contract bytecode
  const abiCoder = new ethers.AbiCoder();
  const params = abiCoder.encode(['address', 'address[]'], [UP_RECEIVER as string, contractsAddr]).slice(2);
  const fullBytecode = CustomURDBytecode + params;

  // get the address of the contract that will be created
  const CustomURDAddress = await UP.connect(signer).execute.staticCall(
    1,
    ethers.ZeroAddress,
    0,
    fullBytecode,
  );

  // deploy LSP1URDForwarder as the UP (signed by the browser extension controller)
  const tx = await UP.connect(signer).execute(1, ethers.ZeroAddress, 0, fullBytecode);
  await tx.wait();

  console.log('✅ Custom URD successfully deployed at address: ', CustomURDAddress);

  // --------------
  // SET DATA BATCH
  // --------------

  // we need the key to store our custom URD contract address
  // {_LSP1_UNIVERSAL_RECEIVER_DELEGATE_PREFIX + <bytes32 typeId>}
  const URDdataKey =
    ERC725YDataKeys.LSP1.LSP1UniversalReceiverDelegatePrefix +
    LSP1_TYPE_IDS.LSP7Tokens_RecipientNotification.slice(2).slice(0, 40);

  // we will update the keys for:
  // - the custom URD of specific TYPE_ID (with our custom URD contract address)
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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
