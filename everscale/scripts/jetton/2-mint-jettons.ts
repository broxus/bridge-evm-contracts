import { JettonMinter } from '../../test/utils/jetton';
import { Address, toNano, WalletTypes } from 'locklift';

const owner = new Address("0:a0a606886db07fb46042832ea1b65ff62377f8f892a67d0de6f7b58616d3783b");
const recipient = new Address("0:492bb2e8c2fce173d5eb64b5fbef1ffaef40fb48f27bb10be9729279265a47dd");

const main = async () => {
  await locklift.factory.accounts.addExistingAccount({
    type: WalletTypes.EverWallet,
    address: owner,
  });

  const jetton = new JettonMinter(
    new Address("0:81e2288e62ff29557fad9087f1018507534b1670804c9446da11a70e2e2ed9dc"),
    owner
  );

  console.log('Minting...');

  await jetton.mint(
    toNano(1000),
    recipient,
    toNano(0.2),
    { value: 0 },
    { value: toNano(0.3), bounce: true },
  );

  console.log(`Minted 1000 tokens to ${recipient}`);
};

main().then(() => console.log('Success'));
