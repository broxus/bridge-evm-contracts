import { BigNumber } from 'bignumber.js';
import _ from 'underscore';
import { ethers, getNamedAccounts, web3 } from "hardhat";
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

const defaultChainId = 1111;

const defaultConfiguration = {
  wid: 0,
  addr: 123456789
};

const defaultEventContract = {
  wid: 0,
  addr: 22222222,
};

const defaultTonRecipient = {
  wid: 0,
  addr: 33333333,
};

const defaultEventTimestamp = 1639923130;

const signReceipt = async (receipt: string, signer: SignerWithAddress) => {
  const receiptHash = web3.utils.soliditySha3(receipt)!;

  const messageHashBytes = ethers.getBytes(receiptHash);

  return signer.signMessage(messageHashBytes);
};


const deriveWithdrawalPeriodId = (timestamp: number) => {
  return Math.floor(timestamp / (60 * 60 * 24));
};


const sortAccounts = (accounts: SignerWithAddress[]) => accounts
  .sort((a, b) => b.address.toLowerCase() > a.address.toLowerCase() ? -1 : 1);


const addressToU160 = (address: string) => (new BigNumber(address.toLowerCase())).toString(10);

const encodeTvmEvent = (params: Record<string, string | number>) => {
  return web3.eth.abi.encodeParameters(
    [{
      'TvmEvent': {
        'eventTransactionLt': 'uint64',
        'eventTimestamp': 'uint32',
        'eventData': 'bytes',
        'configurationWid': 'int8',
        'configurationAddress': 'uint256',
        'eventContractWid': 'int8',
        'eventContractAddress': 'uint256',
        'proxy': 'address',
        'round': 'uint32',
      }
    }],
    [{
      'eventTransactionLt': params.eventTransactionLt || 0,
      'eventTimestamp': params.eventTimestamp || defaultEventTimestamp,
      'eventData': params.eventData || '',
      'configurationWid': params.configurationWid || defaultConfiguration.wid,
      'configurationAddress': params.configurationAddress || defaultConfiguration.addr,
      'eventContractWid': params.eventContractWid || defaultEventContract.wid,
      'eventContractAddress': params.eventContractAddress || defaultEventContract.addr,
      'proxy': params.proxy || ethers.ZeroAddress,
      'round': params.round || 0,
    }]
  );
};

type DaoAction = {
  value?: string | number;
  target: string;
  signature?: string;
  data: string;
};

const encodeDaoActions = (actions: DaoAction[], chainId=defaultChainId) => web3.eth.abi.encodeParameters(
  [
    'int8',
    'uint256',
    'uint32',
    {
      'EthAction[]': {
        'value': 'uint256',
        'target': 'uint160',
        'signature': 'string',
        'data': 'bytes'
      }
    }
  ],
  [
    1,
    2,
    chainId,
    actions.map(action => new Object({
      'value': action.value || 0,
      'target': (new BigNumber(action.target.toLowerCase())).toString(10),
      'signature': action.signature || '',
      'data': action.data || ''
    }))
  ]
);

const generateWallets = async (amount: number) => Promise.all(_
  .range(amount)
  .map(async () => ethers.Wallet.createRandom())
);

type AlienWithdrawalData = {
  token: string;
  amount: string | bigint;
  recipient: string;
  chainId: string | number;
  callback: {
    recipient?: string;
    payload?: string;
    strict?: boolean;
  };
};

const encodeMultiTokenAlienWithdrawalData = (params: AlienWithdrawalData) => {
  return web3.eth.abi.encodeParameters(
    [
      'uint160',
      'uint128',
      'uint160',
      'uint256',
      'uint160',
      'bytes',
      'bool'
    ],
    [
      params.token,
      params.amount,
      params.recipient,
      params.chainId || defaultChainId,
      params.callback.recipient || ethers.ZeroAddress,
      params.callback.payload || "0x00",
      params.callback.strict || false
    ]
  );
};

type NativeWithdrawalData = {
  native: {
    wid: string | number;
    addr: string | number;
  };
  name: string;
  symbol: string;
  decimals: string | number;
  amount: string | bigint;
  recipient: string;
  chainId: string | number;
  callback: {
    recipient?: string;
    payload?: string;
    strict?: boolean;
  };
};

const encodeMultiTokenNativeWithdrawalData = (params: NativeWithdrawalData) => {
  return web3.eth.abi.encodeParameters(
      [
          'int8', 'uint256',
          'string', 'string', 'uint8',
          'uint128', 'uint160', 'uint256',
          'uint160', 'bytes', 'bool'
      ],
      [
          params.native.wid,
          params.native.addr,

          params.name,
          params.symbol,
          params.decimals,

          params.amount,
          params.recipient,
          params.chainId || defaultChainId,

          params.callback.recipient || ethers.ZeroAddress,
          params.callback.payload || "0x00",
          params.callback.strict || false
      ]
  );
}

const getInitialRelays = async () => {
  const relay_keys = Object
    .keys(await getNamedAccounts())
    .filter(x => x.startsWith('relay_'));

  return Promise.all(relay_keys.map(async (k) => ethers.getNamedSigner(k)));
};

const getPayloadSignatures = async (payload: string) => {
  const initialRelays = sortAccounts(await ethers.getSigners());

  return Promise.all(initialRelays.map(async (account) => signReceipt(payload, account)));
};

export {
  signReceipt,
  sortAccounts,
  encodeTvmEvent,
  encodeDaoActions,
  addressToU160,
  defaultChainId,
  defaultConfiguration,
  defaultEventContract,
  defaultTonRecipient,
  defaultEventTimestamp,
  generateWallets,
  getInitialRelays,
  deriveWithdrawalPeriodId,
  getPayloadSignatures,
  encodeMultiTokenAlienWithdrawalData,
  encodeMultiTokenNativeWithdrawalData,
};
