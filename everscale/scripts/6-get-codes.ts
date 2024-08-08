import { FactorySource } from "../build/factorySource";

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
  const MergePool = await getNamedContract("MergePool_V3");
  const MergePoolPlatform = await getNamedContract("MergePoolPlatform");

  // Load round
  const roundEverscaleEthereumEvent = await getNamedContract(
    "RoundEverscaleEthereumEvent"
  );
  const roundEthereumEverscaleEvent = await getNamedContract(
    "RoundEthereumEverscaleEvent"
  );

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
