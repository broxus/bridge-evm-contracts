import { Address, getRandomNonce, Transaction } from "locklift";
import { BigNumber } from "bignumber.js";

import MinterCode from "../../jetton-contracts/jetton-minter.compiled.json";
import WalletCode from "../../jetton-contracts/jetton-wallet.compiled.json";

type Metadata = { name: string; symbol: string; decimals: number };
type AlienMeta = { baseToken: string; chainId: string };
type SendParams = { value: BigNumber.Value; bounce: boolean };
type CallbackParams = { value: BigNumber.Value; payload?: string };
type CommonState = { balance: string; codeHash?: string };
type MinterState = {
  supply: string;
  admin: Address;
} & AlienMeta &
  Metadata &
  CommonState;
type WalletState = {
  tokenBalance: string;
  owner: Address;
  minter: Address;
} & CommonState;

const MINTER_CONTENT_STRUCTURE = [
  { name: "name", type: "string" },
  { name: "symbol", type: "string" },
  { name: "decimals", type: "uint8" },
  { name: "chainId", type: "uint256" },
  { name: "baseToken", type: "uint160" },
] as const;
const MINTER_STATE_STRUCTURE = [
  { name: "supply", type: "gram" },
  { name: "admin", type: "address" },
  { name: "content", type: "cell" },
  { name: "walletCode", type: "cell" },
] as const;
const MINTER_MINT_STRUCTURE = [
  { name: "functionId", type: "uint32" },
  { name: "callId", type: "uint64" },
  { name: "amount", type: "gram" },
  { name: "admin", type: "address" },
  { name: "remainingGasTo", type: "address" },
  { name: "callbackValue", type: "gram" },
  { name: "payload", type: "optional(cell)" },
] as const;
const WALLET_STATE_STRUCTURE = [
  { name: "balance", type: "gram" },
  { name: "walletOwner", type: "address" },
  { name: "minter", type: "address" },
  { name: "walletCode", type: "cell" },
] as const;
const STATE_AND_DATA_STRUCTURE = [
  { name: "code", type: "cell" },
  { name: "data", type: "cell" },
] as const;

const OPCODES = {
  INTERNAL_TRANSFER: "0x178d4519",
  MINT: "0x00000015",
  TRANSFER: "0xf8a7ea5",
  BURN: "0x595f07bc",
  CHANGE_ADMIN: "0x00000003",
};

const MinterAbi = {
  "ABI version": 2,
  version: "2.1",
  header: [],
  functions: [
    {
      name: "mint",
      id: OPCODES.MINT,
      inputs: [
        { name: "_callId", type: "uint64" },
        { name: "_recipient", type: "address" },
        { name: "_deployWalletValue", type: "varuint16" },
        { name: "_payload", type: "cell" },
      ],
      outputs: [],
    },
    {
      name: "changeAdmin",
      id: OPCODES.CHANGE_ADMIN,
      inputs: [
        { name: "_callId", type: "uint64" },
        { name: "_newAdmin", type: "address" },
      ],
      outputs: [],
    },
  ],
  data: [],
  events: [],
  fields: [],
};
const WalletAbi = {
  "ABI version": 2,
  version: "2.1",
  header: [],
  functions: [
    {
      name: "transfer",
      id: OPCODES.TRANSFER,
      inputs: [
        { name: "_callId", type: "uint64" },
        { name: "_amount", type: "varuint16" },
        { name: "_recipient", type: "address" },
        { name: "_remainingGasTo", type: "address" },
        { name: "_customPayload", type: "optional(cell)" },
        { name: "_callbackValue", type: "varuint16" },
        { name: "_payload", type: "optional(cell)" },
      ],
      outputs: [],
    },
    {
      name: "burn",
      id: OPCODES.BURN,
      inputs: [
        { name: "_callId", type: "uint64" },
        { name: "_amount", type: "varuint16" },
        { name: "_recipient", type: "address" },
        { name: "_payload", type: "optional(cell)" },
      ],
      outputs: [],
    },
  ],
  data: [],
  events: [],
  fields: [],
};

export class JettonMinter {
  private static readonly MINTER_CODE = Buffer.from(
    MinterCode.hex,
    "hex"
  ).toString("base64");
  private static readonly WALLET_CODE = Buffer.from(
    WalletCode.hex,
    "hex"
  ).toString("base64");
  private static readonly ABI_STRINGIFIED = JSON.stringify(MinterAbi);

  constructor(
    public readonly minter: Address,
    public readonly admin: Address
  ) {}

  static async deploy(
    admin: Address,
    meta: Metadata,
    sendParams: SendParams
  ): Promise<JettonMinter> {
    const content = await locklift.provider.packIntoCell({
      abiVersion: "2.1",
      structure: MINTER_CONTENT_STRUCTURE,
      data: {
        name: meta.name,
        symbol: meta.symbol,
        decimals: meta.decimals,
        chainId: getRandomNonce(),
        baseToken: getRandomNonce(),
      },
    });
    const state = await locklift.provider.packIntoCell({
      abiVersion: "2.1",
      structure: MINTER_STATE_STRUCTURE,
      data: {
        supply: 0,
        admin: admin,
        content: content.boc,
        walletCode: JettonMinter.WALLET_CODE,
      },
    });
    const { tvc, hash } = await locklift.provider.mergeTvc({
      data: state.boc,
      code: JettonMinter.MINTER_CODE,
    });

    const jetton = new Address(`0:${hash}`);

    await locklift.transactions.waitFinalized(
      locklift.provider.sendMessage({
        sender: admin,
        recipient: jetton,
        bounce: sendParams.bounce,
        amount: new BigNumber(sendParams.value).toString(),
        stateInit: tvc,
      })
    );

    return new JettonMinter(jetton, admin);
  }

  static async getWalletOf(
    minter: Address,
    owner: Address
  ): Promise<JettonWallet> {
    const state = await locklift.provider.packIntoCell({
      abiVersion: "2.1",
      structure: WALLET_STATE_STRUCTURE,
      data: {
        balance: 0,
        walletOwner: owner,
        minter: minter,
        walletCode: JettonMinter.WALLET_CODE,
      },
    });

    const { hash } = await locklift.provider.mergeTvc({
      data: state.boc,
      code: JettonMinter.WALLET_CODE,
    });

    return new JettonWallet(new Address(`0:${hash}`), owner);
  }

  async getWalletOf(owner: Address): Promise<JettonWallet> {
    return JettonMinter.getWalletOf(this.minter, owner);
  }

  static async getState(minter: Address): Promise<MinterState> {
    const state = await locklift.provider
      .getFullContractState({ address: minter })
      .then((s) => s.state!);

    const { data } = await locklift.provider.unpackFromCell({
      abiVersion: "2.1",
      allowPartial: true,
      boc: state.boc,
      structure: STATE_AND_DATA_STRUCTURE,
    });

    const { data: tokenData } = await locklift.provider.unpackFromCell({
      abiVersion: "2.1",
      allowPartial: true,
      boc: data.data,
      structure: MINTER_STATE_STRUCTURE,
    });

    const { data: metaData } = await locklift.provider.unpackFromCell({
      abiVersion: "2.1",
      allowPartial: true,
      boc: tokenData.content,
      structure: MINTER_CONTENT_STRUCTURE,
    });

    return {
      balance: state.balance,
      codeHash: state.codeHash,
      supply: tokenData.supply,
      admin: tokenData.admin,
      name: metaData.name,
      symbol: metaData.symbol,
      decimals: metaData.decimals,
      chainId: metaData.chainId,
      baseToken: metaData.baseToken,
    };
  }

  async getState(): Promise<MinterState> {
    return JettonMinter.getState(this.minter);
  }

  static getEthAddress(minter: Address): string {
    return `0x${minter.toString().split(":")[1]}`;
  }

  getEthAddress(): string {
    return JettonMinter.getEthAddress(this.minter);
  }

  static getWID(minter: Address): string {
    return minter.toString().split(":")[0];
  }

  getWID(): string {
    return JettonMinter.getWID(this.minter);
  }

  async mint(
    amount: BigNumber.Value,
    recipient: Address,
    deployWalletValue: BigNumber.Value,
    callbackParams: CallbackParams,
    sendParams: SendParams
  ): Promise<Transaction> {
    const masterMsg = await locklift.provider.packIntoCell({
      abiVersion: "2.1",
      structure: MINTER_MINT_STRUCTURE,
      data: {
        functionId: OPCODES.INTERNAL_TRANSFER,
        callId: 0,
        amount: new BigNumber(amount).toString(),
        admin: this.admin,
        remainingGasTo: this.admin,
        callbackValue: new BigNumber(callbackParams.value).toString(),
        payload: callbackParams.payload || null,
      },
    });

    const { extTransaction } = await locklift.transactions.waitFinalized(
      locklift.provider.sendMessage({
        sender: this.admin,
        recipient: this.minter,
        payload: {
          abi: JettonMinter.ABI_STRINGIFIED,
          method: "mint",
          params: {
            _callId: 0,
            _deployWalletValue: new BigNumber(deployWalletValue).toString(),
            _recipient: recipient,
            _payload: masterMsg.boc,
          },
        },
        bounce: sendParams.bounce,
        amount: new BigNumber(sendParams.value).toString(),
      })
    );

    return extTransaction.transaction;
  }

  async changeAdmin(
    newAdmin: Address,
    sendParams: SendParams
  ): Promise<Transaction> {
    const { extTransaction } = await locklift.transactions.waitFinalized(
      locklift.provider.sendMessage({
        sender: this.admin,
        recipient: this.minter,
        payload: {
          abi: JettonMinter.ABI_STRINGIFIED,
          method: "changeAdmin",
          params: {
            _callId: 0,
            _newAdmin: newAdmin,
          },
        },
        bounce: sendParams.bounce,
        amount: new BigNumber(sendParams.value).toString(),
      })
    );

    return extTransaction.transaction;
  }
}

export class JettonWallet {
  private static readonly ABI_STRINGIFIED = JSON.stringify(WalletAbi);

  constructor(
    public readonly wallet: Address,
    public readonly owner: Address
  ) {}

  static async getState(wallet: Address): Promise<WalletState> {
    const state = await locklift.provider
      .getFullContractState({ address: wallet })
      .then((s) => s.state!);

    const { data } = await locklift.provider.unpackFromCell({
      abiVersion: "2.1",
      allowPartial: true,
      boc: state.boc,
      structure: STATE_AND_DATA_STRUCTURE,
    });

    const { data: walletData } = await locklift.provider.unpackFromCell({
      abiVersion: "2.1",
      allowPartial: true,
      boc: data.data,
      structure: WALLET_STATE_STRUCTURE,
    });

    return {
      balance: state.balance,
      codeHash: state.codeHash,
      tokenBalance: walletData.balance,
      owner: walletData.walletOwner,
      minter: walletData.minter,
    };
  }

  async getState(): Promise<WalletState> {
    return JettonWallet.getState(this.wallet);
  }

  async transfer(
    amount: BigNumber.Value,
    recipient: Address,
    callbackParams: CallbackParams,
    sendParams: SendParams
  ): Promise<Transaction> {
    const { extTransaction } = await locklift.transactions.waitFinalized(
      locklift.provider.sendMessage({
        sender: this.owner,
        recipient: this.wallet,
        payload: {
          abi: JettonWallet.ABI_STRINGIFIED,
          method: "transfer",
          params: {
            _callId: 0,
            _amount: new BigNumber(amount).toString(),
            _recipient: recipient,
            _remainingGasTo: this.owner,
            _customPayload: null,
            _callbackValue: new BigNumber(callbackParams.value).toString(),
            _payload: callbackParams.payload || null,
          },
        },
        bounce: sendParams.bounce,
        amount: new BigNumber(sendParams.value).toString(),
      })
    );

    return extTransaction.transaction;
  }

  async burn(
    amount: BigNumber.Value,
    recipient: Address,
    payload: string,
    sendParams: SendParams
  ): Promise<Transaction> {
    const { extTransaction } = await locklift.transactions.waitFinalized(
      locklift.provider.sendMessage({
        sender: this.owner,
        recipient: this.wallet,
        payload: {
          abi: JettonWallet.ABI_STRINGIFIED,
          method: "burn",
          params: {
            _callId: 0,
            _amount: new BigNumber(amount).toString(),
            _recipient: recipient,
            _payload: payload,
          },
        },
        bounce: sendParams.bounce,
        amount: new BigNumber(sendParams.value).toString(),
      })
    );

    return extTransaction.transaction;
  }
}
