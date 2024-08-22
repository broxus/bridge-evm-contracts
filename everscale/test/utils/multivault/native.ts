import { Account } from "everscale-standalone-client/nodejs";
import { Contract } from "locklift";
import {
  EthereumEverscaleEventConfigurationAbi,
  EverscaleEthereumEventConfigurationAbi,
  FactorySource,
  ProxyMultiVaultNativeJettonAbi,
} from "../../../build/factorySource";
import { logContract } from "../logger";
import {
  setupEthereumEverscaleEventConfiguration,
  setupEverscaleEthereumEventConfiguration,
} from "../event-configurations/evm";

export const setupNativeJettonMultiVault = async (
  owner: Account,
  roundDeployer: Contract<FactorySource["RoundDeployerMockup"]>
): Promise<
  [
    Contract<EthereumEverscaleEventConfigurationAbi>,
    Contract<EverscaleEthereumEventConfigurationAbi>,
    Contract<ProxyMultiVaultNativeJettonAbi>
  ]
> => {
  const _randomNonce = locklift.utils.getRandomNonce();
  const signer = (await locklift.keystore.getSigner("2"))!;

  // Deploy proxy
  const { contract: proxy } = await locklift.factory.deployContract({
    contract: "ProxyMultiVaultNativeJetton",
    constructorParams: { owner_: owner.address },
    initParams: { _randomNonce },
    publicKey: signer.publicKey,
    value: locklift.utils.toNano(1.2),
  });

  await logContract("ProxyMultiVaultNativeJetton", proxy.address);

  // Load event contracts
  const ethereumEverscaleEvent = locklift.factory.getContractArtifacts(
    "MultiVaultEVMTONEventNative"
  );
  const everscaleEthereumEvent = locklift.factory.getContractArtifacts(
    "MultiVaultTONEVMEventNative"
  );

  // Deploy configurations
  const ethereumEverscaleEventConfiguration =
    await setupEthereumEverscaleEventConfiguration(
      owner,
      roundDeployer,
      proxy.address,
      ethereumEverscaleEvent.code
    );
  const everscaleEthereumEventConfiguration =
    await setupEverscaleEthereumEventConfiguration(
      owner,
      roundDeployer,
      proxy.address,
      everscaleEthereumEvent.code
    );

  // Set proxy EVM configuration
  await locklift.transactions.waitFinalized(
    proxy.methods
      .setEVMConfiguration({
        _config: {
          everscaleConfiguration: everscaleEthereumEventConfiguration.address,
          evmConfigurations: [ethereumEverscaleEventConfiguration.address],
        },
        remainingGasTo: owner.address,
      })
      .send({ from: owner.address, amount: locklift.utils.toNano(0.01) })
  );

  return [
    ethereumEverscaleEventConfiguration,
    everscaleEthereumEventConfiguration,
    proxy,
  ];
};
