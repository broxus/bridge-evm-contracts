import { JettonMinter } from "../../test/utils/jetton";
import { Address, toNano, WalletTypes } from 'locklift';

const owner = new Address("0:a0a606886db07fb46042832ea1b65ff62377f8f892a67d0de6f7b58616d3783b");

const main = async () => {
  await locklift.factory.accounts.addExistingAccount({
    type: WalletTypes.EverWallet,
    address: owner,
  });

  console.log('Deploying jetton...');

  const minter = await JettonMinter.deploy(
    owner,
    { name: "Evil Jetton", symbol: "EVIL", decimals: 9 },
    { value: toNano(0.2), bounce: true },
  );

  console.log(`Jetton deployed: ${minter.minter}`);
}

main().then(() => console.log("Success"));
