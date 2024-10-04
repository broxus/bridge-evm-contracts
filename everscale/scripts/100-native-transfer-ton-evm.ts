import { Address, toNano, WalletTypes } from 'locklift';
import { BigNumber } from "bignumber.js";

import { JettonWallet } from "../test/utils/jetton";

const CELL_ENCODER_ADDRESS =
  "0:f3f2e616773fc907d85887e132cb80b64f825e693feb8e15203eea6192c534cc";
const PROXY =
  "0:31f98edaf5cd92e674799c0e4bc5cd8e050e4e9401e29f1766f4d27ccc87377d";
const JETTON =
  "0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe";
const CHAIN_ID = 56; // BSC
const WALLET =
  new Address("0:23e7bc1740bce56178ddc32d89ff24754de1755734bfc6c3f470c533279a2b50");

const JETTON_META = { name: "Tether USD", symbol: "USD₮", decimals: 18 };
const EVM_CALLBACK_PARAMS = { recipient: 0, strict: false, payload: "" };

const SENDER =
  new Address("0:a0a606886db07fb46042832ea1b65ff62377f8f892a67d0de6f7b58616d3783b");
const RECIPIENT = "0x7596D0774993fF05C36f891D9F49617DFfDA98a5";
const AMOUNT = "100";

const main = async (): Promise<void> => {
  const cellEncoder = locklift.factory.getDeployedContract(
    "CellEncoderStandalone",
    new Address(CELL_ENCODER_ADDRESS)
  );

  const params = {
    recipient: new BigNumber(RECIPIENT.toLowerCase(), 16).toString(10),
    chainId: CHAIN_ID,
    callback: EVM_CALLBACK_PARAMS,
    name: JETTON_META.name,
    symbol: JETTON_META.symbol,
    decimals: JETTON_META.decimals,
    token: new Address(JETTON),
    remainingGasTo: SENDER
  };

  console.log(
    "Calling encodeNativeJettonTransferPayloadEthereum with params:",
    JSON.stringify(params, null, 2)
  );

  const payload = await cellEncoder.methods
    .encodeNativeJettonTransferPayloadEthereum(params)
    .call()
    .then((t) => t.value0);

  console.log("Payload:", payload);
  console.log(
    `Transfer ${AMOUNT} tokens from ${SENDER} to native proxy ${PROXY}`
  );

  await locklift.factory.accounts.addExistingAccount({
    type: WalletTypes.EverWallet,
    address: SENDER,
  });

  const wallet = new JettonWallet(WALLET, SENDER);

  const { extTransaction } = await locklift.transactions.waitFinalized(
    wallet.transfer(
      AMOUNT,
      new Address(PROXY),
      { value: toNano(2.8), payload: payload },
      { value: locklift.utils.toNano(3), bounce: true }
    )
  );

  console.log(`Token transfer tx: ${extTransaction.id.hash}`);
};

main().then(() => console.log("Success"));
