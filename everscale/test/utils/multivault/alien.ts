import { Account } from "everscale-standalone-client/nodejs";
import { Contract } from "locklift";
import {
  EthereumEverscaleEventConfigurationAbi,
  EverscaleEthereumEventConfigurationAbi,
  EverscaleSolanaEventConfigurationAbi,
  FactorySource,
  ProxyMultiVaultAlien_V8Abi,
  ProxyMultiVaultAlienJettonAbi,
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
import JettonMinter from "../../../jetton-contracts/jetton-minter.compiled.json";
import JettonWallet from "../../../jetton-contracts/jetton-wallet.compiled.json";

export const setupAlienMultiVault = async (
  owner: Account,
  roundDeployer: Contract<FactorySource["RoundDeployerMockup"]>
): Promise<
  [
    Contract<EthereumEverscaleEventConfigurationAbi>,
    Contract<EverscaleEthereumEventConfigurationAbi>,
    Contract<SolanaEverscaleEventConfigurationAbi>,
    Contract<EverscaleSolanaEventConfigurationAbi>,
    Contract<ProxyMultiVaultAlien_V8Abi>
  ]
> => {
  const _randomNonce = locklift.utils.getRandomNonce();
  const signer = (await locklift.keystore.getSigner("2"))!;

  // Deploy proxy
  const { contract: proxy } = await locklift.factory.deployContract({
    contract: "ProxyMultiVaultAlien_V8",
    constructorParams: {
      owner_: owner.address,
    },
    initParams: {
      _randomNonce,
    },
    publicKey: signer.publicKey,
    value: locklift.utils.toNano(15),
  });

  await logContract("ProxyMultiVaultAlien_V8", proxy.address);

  // Load event contracts
  const ethereumEverscaleEvent = locklift.factory.getContractArtifacts(
    "MultiVaultEVMEverscaleEventAlien"
  );
  const everscaleEthereumEvent = locklift.factory.getContractArtifacts(
    "MultiVaultEverscaleEVMEventAlien"
  );
  const solanaEverscaleEvent = locklift.factory.getContractArtifacts(
    "MultiVaultSolanaEverscaleEventAlien"
  );
  const everscaleSolanaEvent = locklift.factory.getContractArtifacts(
    "MultiVaultEverscaleSolanaEventAlien"
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
  const solanaEverscaleEventConfiguration =
    await setupSolanaEverscaleEventConfiguration(
      owner,
      roundDeployer,
      proxy.address,
      solanaEverscaleEvent.code
    );
  const everscaleSolanaEventConfiguration =
    await setupEverscaleSolanaEventConfiguration(
      owner,
      roundDeployer,
      proxy.address,
      everscaleSolanaEvent.code
    );

  // Load proxy settings
  const alienTokenRootEVM =
    locklift.factory.getContractArtifacts("TokenRootAlienEVM");
  const alienTokenRootSolana = locklift.factory.getContractArtifacts(
    "TokenRootAlienSolana"
  );

  const alienTokenWalletUpgradeableData = locklift.factory.getContractArtifacts(
    "AlienTokenWalletUpgradeable"
  );
  const alienTokenWalletPlatformData = locklift.factory.getContractArtifacts(
    "AlienTokenWalletPlatform"
  );

  // Set proxy EVM configuration
  await proxy.methods
    .setEVMConfiguration({
      _config: {
        everscaleConfiguration: everscaleEthereumEventConfiguration.address,
        evmConfigurations: [ethereumEverscaleEventConfiguration.address],
        alienTokenRootCode: alienTokenRootEVM.code,
        alienTokenWalletCode: alienTokenWalletUpgradeableData.code,
        alienTokenWalletPlatformCode: alienTokenWalletPlatformData.code,
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
        alienTokenRootCode: alienTokenRootSolana.code,
        alienTokenWalletCode: alienTokenWalletUpgradeableData.code,
        alienTokenWalletPlatformCode: alienTokenWalletPlatformData.code,
      },
      remainingGasTo: owner.address,
    })
    .send({
      from: owner.address,
      amount: locklift.utils.toNano(0.5),
    });

  // Set merging
  const MergeRouter = locklift.factory.getContractArtifacts("MergeRouter");
  const MergePool = locklift.factory.getContractArtifacts("MergePool_V5");
  const MergePoolPlatform =
    locklift.factory.getContractArtifacts("MergePoolPlatform");

  await proxy.methods
    .setMergeRouter({
      _mergeRouter: MergeRouter.code,
    })
    .send({
      from: owner.address,
      amount: locklift.utils.toNano(1),
    });

  await proxy.methods
    .setMergePool({
      _mergePool: MergePool.code,
    })
    .send({
      from: owner.address,
      amount: locklift.utils.toNano(1),
    });

  await proxy.methods
    .setMergePoolPlatform({
      _mergePoolPlatform: MergePoolPlatform.code,
    })
    .send({
      from: owner.address,
      amount: locklift.utils.toNano(1),
    });

  return [
    ethereumEverscaleEventConfiguration,
    everscaleEthereumEventConfiguration,
    solanaEverscaleEventConfiguration,
    everscaleSolanaEventConfiguration,
    proxy,
  ];
};

export const setupAlienJettonMultiVault = async (
  owner: Account,
  roundDeployer: Contract<FactorySource["RoundDeployerMockup"]>
): Promise<
  [
    Contract<EthereumEverscaleEventConfigurationAbi>,
    Contract<EverscaleEthereumEventConfigurationAbi>,
    Contract<ProxyMultiVaultAlienJettonAbi>
  ]
> => {
  const _randomNonce = locklift.utils.getRandomNonce();
  const signer = (await locklift.keystore.getSigner("2"))!;

  // Deploy proxy
  const { contract: proxy } = await locklift.factory.deployContract({
    contract: "ProxyMultiVaultAlienJetton",
    constructorParams: { owner_: owner.address },
    initParams: { _randomNonce },
    publicKey: signer.publicKey,
    value: locklift.utils.toNano(15),
  });

  await logContract("ProxyMultiVaultAlienJetton", proxy.address);

  // Load event contracts
  const ethereumEverscaleEvent = locklift.factory.getContractArtifacts(
    "MultiVaultEVMEverscaleEventAlien"
  );
  const everscaleEthereumEvent = locklift.factory.getContractArtifacts(
    "MultiVaultTONEVMEventAlien"
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

  // Load proxy settings
  const alienJettonMinterCode = Buffer.from(JettonMinter.hex, "hex").toString(
    "base64"
  );
  const alienJettonWalletCode = Buffer.from(JettonWallet.hex, "hex").toString(
    "base64"
  );

  // Set proxy EVM configuration
  await proxy.methods
    .setEVMConfiguration({
      _config: {
        everscaleConfiguration: everscaleEthereumEventConfiguration.address,
        evmConfigurations: [ethereumEverscaleEventConfiguration.address],
        alienTokenRootCode: alienJettonMinterCode,
        alienTokenWalletCode: alienJettonWalletCode,
        alienTokenWalletPlatformCode: "",
      },
      remainingGasTo: owner.address,
    })
    .send({ from: owner.address, amount: locklift.utils.toNano(0.5) });

  // Set merging
  const MergeRouter = locklift.factory.getContractArtifacts("MergeRouter");
  const MergePool = locklift.factory.getContractArtifacts("MergePool_V5");
  const MergePoolPlatform =
    locklift.factory.getContractArtifacts("MergePoolPlatform");

  await proxy.methods
    .setMergeRouter({ _mergeRouter: MergeRouter.code })
    .send({ from: owner.address, amount: locklift.utils.toNano(1) });

  await proxy.methods
    .setMergePool({ _mergePool: MergePool.code })
    .send({ from: owner.address, amount: locklift.utils.toNano(1) });

  await proxy.methods
    .setMergePoolPlatform({ _mergePoolPlatform: MergePoolPlatform.code })
    .send({ from: owner.address, amount: locklift.utils.toNano(1) });

  return [
    ethereumEverscaleEventConfiguration,
    everscaleEthereumEventConfiguration,
    proxy,
  ];
};
