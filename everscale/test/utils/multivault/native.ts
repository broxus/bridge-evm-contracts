import { Account } from "everscale-standalone-client/nodejs";
import { Contract } from "locklift";
import {
  EthereumEverscaleEventConfigurationAbi,
  EverscaleEthereumEventConfigurationAbi,
  EverscaleSolanaEventConfigurationAbi,
  FactorySource,
  ProxyMultiVaultNative_V6Abi,
  ProxyMultiVaultNativeJettonAbi,
  SolanaEverscaleEventConfigurationAbi,
} from "../../../build/factorySource";
import { logContract } from "../logger";
import {
  setupEthereumEverscaleEventConfiguration,
  setupEverscaleEthereumEventConfiguration,
} from "../event-configurations/evm";
import {
  setupEverscaleSolanaEventConfiguration,
  setupSolanaEverscaleEventConfiguration,
} from "../event-configurations/solana";

export const setupNativeMultiVault = async (
  owner: Account,
  staking: Contract<FactorySource["StakingMockup"]>
): Promise<
  [
    Contract<EthereumEverscaleEventConfigurationAbi>,
    Contract<EverscaleEthereumEventConfigurationAbi>,
    Contract<SolanaEverscaleEventConfigurationAbi>,
    Contract<EverscaleSolanaEventConfigurationAbi>,
    Contract<ProxyMultiVaultNative_V6Abi>
  ]
> => {
  const _randomNonce = locklift.utils.getRandomNonce();
  const signer = (await locklift.keystore.getSigner("2"))!;

  // Deploy proxy
  const { contract: proxy } = await locklift.factory.deployContract({
    contract: "ProxyMultiVaultNative_V6",
    constructorParams: {
      owner_: owner.address,
    },
    initParams: {
      _randomNonce,
    },
    publicKey: signer.publicKey,
    value: locklift.utils.toNano(15),
  });

  await logContract("ProxyMultiVaultNative_V6", proxy.address);

  // Load event contracts
  const ethereumEverscaleEvent = await locklift.factory.getContractArtifacts(
    "MultiVaultEVMEverscaleEventNative"
  );
  const everscaleEthereumEvent = await locklift.factory.getContractArtifacts(
    "MultiVaultEverscaleEVMEventNative"
  );
  const solanaEverscaleEvent = await locklift.factory.getContractArtifacts(
    "MultiVaultSolanaEverscaleEventNative"
  );
  const everscaleSolanaEvent = await locklift.factory.getContractArtifacts(
    "MultiVaultEverscaleSolanaEventNative"
  );

  // Deploy configurations
  const ethereumEverscaleEventConfiguration =
    await setupEthereumEverscaleEventConfiguration(
      owner,
      staking,
      proxy.address,
      ethereumEverscaleEvent.code
    );
  const everscaleEthereumEventConfiguration =
    await setupEverscaleEthereumEventConfiguration(
      owner,
      staking,
      proxy.address,
      everscaleEthereumEvent.code
    );
  const solanaEverscaleEventConfiguration =
    await setupSolanaEverscaleEventConfiguration(
      owner,
      staking,
      proxy.address,
      solanaEverscaleEvent.code
    );
  const everscaleSolanaEventConfiguration =
    await setupEverscaleSolanaEventConfiguration(
      owner,
      staking,
      proxy.address,
      everscaleSolanaEvent.code
    );

  // Set proxy EVM configuration
  await proxy.methods
    .setEVMConfiguration({
      _config: {
        everscaleConfiguration: everscaleEthereumEventConfiguration.address,
        evmConfigurations: [ethereumEverscaleEventConfiguration.address],
      },
      remainingGasTo: owner.address,
    })
    .send({
      from: owner.address,
      amount: locklift.utils.toNano(0.5),
    });

  // Set proxy Solana configuration
  await proxy.methods
    .setSolanaConfiguration({
      _config: {
        everscaleConfiguration: everscaleSolanaEventConfiguration.address,
        solanaConfiguration: solanaEverscaleEventConfiguration.address,
      },
      remainingGasTo: owner.address,
    })
    .send({
      from: owner.address,
      amount: locklift.utils.toNano(0.5),
    });

  return [
    ethereumEverscaleEventConfiguration,
    everscaleEthereumEventConfiguration,
    solanaEverscaleEventConfiguration,
    everscaleSolanaEventConfiguration,
    proxy,
  ];
};

export const setupNativeJettonMultiVault = async (
  owner: Account,
  staking: Contract<FactorySource["StakingMockup"]>
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
    value: locklift.utils.toNano(15),
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
      staking,
      proxy.address,
      ethereumEverscaleEvent.code
    );
  const everscaleEthereumEventConfiguration =
    await setupEverscaleEthereumEventConfiguration(
      owner,
      staking,
      proxy.address,
      everscaleEthereumEvent.code
    );

  // Set proxy EVM configuration
  await proxy.methods
    .setEVMConfiguration({
      _config: {
        everscaleConfiguration: everscaleEthereumEventConfiguration.address,
        evmConfigurations: [ethereumEverscaleEventConfiguration.address],
      },
      remainingGasTo: owner.address,
    })
    .send({ from: owner.address, amount: locklift.utils.toNano(0.5) });

  return [
    ethereumEverscaleEventConfiguration,
    everscaleEthereumEventConfiguration,
    proxy,
  ];
};
