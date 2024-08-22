import { Account } from "everscale-standalone-client/nodejs";
import { Contract } from "locklift";
import {
  EthereumEverscaleEventConfigurationAbi,
  EverscaleEthereumEventConfigurationAbi,
  FactorySource,
  ProxyMultiVaultAlienJettonAbi,
} from "../../../build/factorySource";
import { logContract } from "../logger";
import {
  setupEthereumEverscaleEventConfiguration,
  setupEverscaleEthereumEventConfiguration,
} from "../event-configurations/evm";
import JettonMinter from "../../../jetton-contracts/jetton-minter.compiled.json";
import JettonWallet from "../../../jetton-contracts/jetton-wallet.compiled.json";

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
    value: locklift.utils.toNano(1.2),
  });

  await logContract("ProxyMultiVaultAlienJetton", proxy.address);

  // Load event contracts
  const ethereumEverscaleEvent = locklift.factory.getContractArtifacts(
    "MultiVaultEVMTONEventAlien"
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
  await locklift.transactions.waitFinalized(
    proxy.methods
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
      .send({ from: owner.address, amount: locklift.utils.toNano(0.01) })
  );

  // Set merging
  const MergeRouter = locklift.factory.getContractArtifacts("MergeRouter");
  const MergePool = locklift.factory.getContractArtifacts("MergePool");
  const MergePoolPlatform =
    locklift.factory.getContractArtifacts("MergePoolPlatform");

  await locklift.transactions.waitFinalized(
    proxy.methods
      .setMergeRouter({ _mergeRouter: MergeRouter.code })
      .send({ from: owner.address, amount: locklift.utils.toNano(0.01) })
  );

  await locklift.transactions.waitFinalized(
    proxy.methods
      .setMergePool({ _mergePool: MergePool.code })
      .send({ from: owner.address, amount: locklift.utils.toNano(0.01) })
  );

  await locklift.transactions.waitFinalized(
    proxy.methods
      .setMergePoolPlatform({ _mergePoolPlatform: MergePoolPlatform.code })
      .send({ from: owner.address, amount: locklift.utils.toNano(0.01) })
  );

  return [
    ethereumEverscaleEventConfiguration,
    everscaleEthereumEventConfiguration,
    proxy,
  ];
};
