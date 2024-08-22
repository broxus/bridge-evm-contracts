import { FactorySource } from "../build/factorySource";

import MinterCode from "../jetton-contracts/jetton-minter.compiled.json";
import WalletCode from "../jetton-contracts/jetton-wallet.compiled.json";

export const getNamedContract = async (name: keyof FactorySource) => {
  return {
    name,
    ...locklift.factory.getContractArtifacts(name),
  };
};

const main = async () => {
  // Load alien contracts
  const ethereumEverscaleEventAlien = await getNamedContract(
    "MultiVaultEVMTONEventAlien"
  );
  const everscaleEthereumEventAlien = await getNamedContract(
    "MultiVaultTONEVMEventAlien"
  );

  // Load native contracts
  const ethereumEverscaleEventNative = await getNamedContract(
    "MultiVaultEVMTONEventNative"
  );
  const everscaleEthereumEventNative = await getNamedContract(
    "MultiVaultTONEVMEventNative"
  );

  // Load alien merging
  const MergeRouter = await getNamedContract("MergeRouter");
  const MergePool = await getNamedContract("MergePool");
  const MergePoolPlatform = await getNamedContract("MergePoolPlatform");

  // Load round
  const roundEverscaleEthereumEvent = await getNamedContract(
    "RoundEverscaleEthereumEvent"
  );
  const roundEthereumEverscaleEvent = await getNamedContract(
    "RoundEthereumEverscaleEvent"
  );
  const roundDeployer = await getNamedContract("RoundDeployer");

  // Load jetton
  const MINTER_CODE = Buffer.from(MinterCode.hex, "hex").toString("base64");
  const WALLET_CODE = Buffer.from(WalletCode.hex, "hex").toString("base64");

  const jettonMinter = { name: "JettonMinter", code: MINTER_CODE };
  const jettonWallet = { name: "JettonWallet", code: WALLET_CODE };

  for (const contract of [
    ethereumEverscaleEventAlien,
    everscaleEthereumEventAlien,

    ethereumEverscaleEventNative,
    everscaleEthereumEventNative,

    MergeRouter,
    MergePool,
    MergePoolPlatform,

    roundEverscaleEthereumEvent,
    roundEthereumEverscaleEvent,
    roundDeployer,

    jettonMinter,
    jettonWallet,
  ]) {
    console.log(contract.name);
    console.log(contract.code);
    console.log("");
  }
};

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
