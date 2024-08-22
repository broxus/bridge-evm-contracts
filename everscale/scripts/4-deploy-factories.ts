import { logContract } from "../test/utils/logger";
import ora from "ora";

async function main() {
  const signer = (await locklift.keystore.getSigner("0"))!;

  const _randomNonce = locklift.utils.getRandomNonce();

  const spinner = ora();

  spinner.start("Deploying Ethereum Everscale event configuration factory");

  const EthereumEverscaleEventConfiguration =
    locklift.factory.getContractArtifacts(
      "EthereumEverscaleEventConfiguration"
    );

  const { contract: ethereumEverscaleEventConfigurationFactory } =
    await locklift.factory.deployContract({
      contract: "EthereumEverscaleEventConfigurationFactory",
      constructorParams: {
        _configurationCode: EthereumEverscaleEventConfiguration.code,
      },
      initParams: { _randomNonce },
      publicKey: signer.publicKey,
      value: locklift.utils.toNano(1.1),
    });

  spinner.stop();

  await logContract(
    "ethereumEverscaleEventConfigurationFactory address",
    ethereumEverscaleEventConfigurationFactory.address
  );

  // Everscale configuration factory
  const EverscaleEthereumEventConfiguration =
    locklift.factory.getContractArtifacts(
      "EverscaleEthereumEventConfiguration"
    );

  spinner.start("Deploying Everscale EVM event configuration factory");

  const { contract: everscaleEthereumEventConfigurationFactory } =
    await locklift.factory.deployContract({
      contract: "EverscaleEthereumEventConfigurationFactory",
      constructorParams: {
        _configurationCode: EverscaleEthereumEventConfiguration.code,
      },
      initParams: { _randomNonce },
      publicKey: signer.publicKey,
      value: locklift.utils.toNano(1.1),
    });

  spinner.stop();

  await logContract(
    "everscaleEthereumEventConfigurationFactory address",
    everscaleEthereumEventConfigurationFactory.address
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
