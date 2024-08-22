import { Address, WalletTypes } from "locklift";
import { BigNumber } from "bignumber.js";

import { JettonMinter } from "../test/utils/jetton";

const CELL_ENCODER_ADDRESS =
  "0:ca7848b62741b9117ca1f6f877f59c4d210074bb867ec843ae22339bfc12df6c";
const PROXY =
  "0:31f98edaf5cd92e674799c0e4bc5cd8e050e4e9401e29f1766f4d27ccc87377d";
const JETTON =
  "0:f6b8e26e3723ce02ab73b86cf01bc4e1e6fffe75a10561266ef371dfd81ef255";
const CHAIN_ID = 56; // BSC

const JETTON_META = { name: "ZALUPA", symbol: "ZLP", decimals: 18 };
const EVM_CALLBACK_PARAMS = { recipient: 0, strict: false, payload: "" };

const SENDER =
  "0:a0a606886db07fb46042832ea1b65ff62377f8f892a67d0de6f7b58616d3783b";
const RECIPIENT = "0x6cE02dC9401960Cf15d6B0B0EA6d70f8af65AA38";
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

  const jetton = new JettonMinter(JETTON);

  const { extTransaction } = await locklift.transactions.waitFinalized(
    jetton
      .getWalletOf(SENDER)
      .then((w) =>
        w.transfer(
          AMOUNT,
          new Address(PROXY),
          { value: 1, payload: payload },
          { value: locklift.utils.toNano(5), bounce: true }
        )
      )
  );

  console.log(`Token transfer tx: ${extTransaction.transaction}`);
};

main().then(() => console.log("Success"));
