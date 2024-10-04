import { JettonMinter } from '../../test/utils/jetton';
import { Address, toNano, WalletTypes } from 'locklift';
import MinterCode from '../../jetton-contracts/jetton-minter.compiled.json';

const owner = new Address("0:a0a606886db07fb46042832ea1b65ff62377f8f892a67d0de6f7b58616d3783b");
const MINTER_CODE = Buffer.from(
  MinterCode.hex,
  "hex"
).toString("base64");

const main = async () => {
  await locklift.factory.accounts.addExistingAccount({
    type: WalletTypes.EverWallet,
    address: owner,
  });

  const jetton = new JettonMinter(
    new Address("0:81e2288e62ff29557fad9087f1018507534b1670804c9446da11a70e2e2ed9dc"),
    owner
  );

  console.log('Upgrading jetton...');

  await jetton.upgrade(
    MINTER_CODE,
    { value: toNano(0.2), bounce: true },
  );

  console.log(`Jetton ${jetton.minter} was upgraded`);
};

main().then(() => console.log("Success"));
