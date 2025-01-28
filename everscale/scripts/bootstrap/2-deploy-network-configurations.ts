import { Address, Contract, toNano, WalletTypes } from 'locklift';
import { BigNumber } from 'bignumber.js';
import { Account } from 'everscale-standalone-client/nodejs';
import { BridgeAbi, MultiVaultEVMTONEventAlienAbi, MultiVaultTONEVMEventAlienAbi } from '../../build/factorySource';

const BRIDGE_ADMIN = "0:22128f17fef7a538d4a92152db86c4b70f4dd1137ae162d38939a36b724e681b";
const BRIDGE = "0:7ce794235d7081538276e5e5e5cddc7f1ded13d8de248ad3253654a4d2a9678c";
const STAKING = "0:f41de04e5dc943c35528502621a7fea01142c5ad856eb46972ea938fd14aee4f";
const ETH_EVER_EVENT_CONFIG_FACTORY = "0:630e1171ad9d0ee19adf92ff461e34fee2e65d015ea3ddc46b2f26088f3532f9";
const EVER_ETH_EVER_EVENT_CONFIG_FACTORY = "0:7b62dfe7e73719bef1f250966f1f54716178589172b918172dc234442a0e0587";
const PROXY_MULTI_VAULT_ALIEN = "0:ab234789f6989a94ed1b9282ee8271a8ad0ca061f943d943f647b573aa6d7287";
const PROXY_MULTI_VAULT_NATIVE = "0:d25385cbd0d34699ab78c3871663323807f52b8d7f2feb18237e27c30e479784";

// const CHAIN_ID = 1;
// const START_BLOCK_NUMBER = 21719231;
// const BLOCKS_TO_CONFIRM = 12;

// const CHAIN_ID = 56;
// const START_BLOCK_NUMBER = 46146776;
// const BLOCKS_TO_CONFIRM = 30;

const CHAIN_ID = 43114;
const START_BLOCK_NUMBER = 56450811;
const BLOCKS_TO_CONFIRM = 30;

const START_TIMESTAMP = Math.floor(Date.now() / 1000);
const MULTI_VAULT_PROXY = "0x457ce30424229411097262c2A3A7f6Bc58BDf284";

const DEPLOY_EVER_CONFIGURATIONS = false;

const ALIEN_TRANSFER_EVENT_ABI = {
  anonymous: false,
  inputs: [
    { indexed: false, internalType: "uint256", name: "base_chainId", type: "uint256" },
    { indexed: false, internalType: "uint160", name: "base_token", type: "uint160" },
    { indexed: false, internalType: "string", name: "name", type: "string" },
    { indexed: false, internalType: "string", name: "symbol", type: "string" },
    { indexed: false, internalType: "uint8", name: "decimals", type: "uint8" },
    { indexed: false, internalType: "uint128", name: "amount", type: "uint128" },
    { indexed: false, internalType: "int8", name: "recipient_wid", type: "int8" },
    { indexed: false, internalType: "uint256", name: "recipient_addr", type: "uint256" },
    { indexed: false, internalType: "uint256", name: "value", type: "uint256" },
    { indexed: false, internalType: "uint256", name: "expected_evers", type: "uint256" },
    { indexed: false, internalType: "bytes", name: "payload", type: "bytes" }
  ],
  name: "AlienTransfer",
  type: "event"
};

const NATIVE_TRANSFER_EVENT_ABI = {
  anonymous: false,
  inputs: [
    { indexed: false, internalType: "int8", name: "native_wid", type: "int8" },
    { indexed: false, internalType: "uint256", name: "native_addr", type: "uint256" },
    { indexed: false, internalType: "uint128", name: "amount", type: "uint128" },
    { indexed: false, internalType: "int8", name: "recipient_wid", type: "int8" },
    { indexed: false, internalType: "uint256", name: "recipient_addr", type: "uint256" },
    { indexed: false, internalType: "uint256", name: "value", type: "uint256" },
    { indexed: false, internalType: "uint256", name: "expected_evers", type: "uint256" },
    { indexed: false, internalType: "bytes", name: "payload", type: "bytes" }
  ],
  name: "NativeTransfer",
  type: "event"
};

const EVER_ALIEN_TRANSFER_EVENT_ABI = [
  { name: "token", type: "uint160" },
  { name: "amount", type: "uint128" },
  { name: "recipient", type: "uint160" },
  { name: "chainId", type: "uint256" },
  { name: "callback_recipient", type: "uint160" },
  { name: "callback_payload", type: "bytes" },
  { name: "callback_strict", type: "bool" }
];

const EVER_NATIVE_TRANSFER_EVENT_ABI = [
  { name: "token_wid", type: "int8" },
  { name: "token_addr", type: "uint256" },
  { name: "name", type: "string" },
  { name: "symbol", type: "string" },
  { name: "decimals", type: "uint8" },
  { name: "amount", type: "uint128" },
  { name: "recipient", type: "uint160" },
  { name: "chainId", type: "uint256" },
  { name: "callback_recipient", type: "uint160" },
  { name: "callback_payload", type: "bytes" },
  { name: "callback_strict", type: "bool" }
];

const deployConnectors = async (
  admin: Account,
  bridge: Contract<BridgeAbi>,
  configurations: Contract<MultiVaultEVMTONEventAlienAbi | MultiVaultTONEVMEventAlienAbi>[],
): Promise<void> => {
  for (const configuration of configurations) {
    const { traceTree: ttConnector } = await locklift.tracing.trace(
      bridge.methods
        .deployConnector({ _eventConfiguration: configuration.address })
        .send({
          from: admin.address,
          amount: toNano(2),
          bounce: true,
        }),
    );

    const connector = locklift.factory.getDeployedContract(
      "Connector",
      ttConnector!.findEventsForContract({ contract: bridge, name: "ConnectorDeployed" as const })[0].connector,
    );

    await locklift.tracing.trace(
      connector.methods
        .enable({})
        .send({
          from: admin.address,
          amount: toNano(0.5),
          bounce: true,
        }),
    );

    console.log(`${configuration.address} Connector: ${connector.address}`);
  }
};

const main = async (): Promise<void> => {
  const admin = await locklift.factory.accounts.addExistingAccount({
    type: WalletTypes.EverWallet,
    address: new Address(BRIDGE_ADMIN),
  });

  const ethEverEventConfigFactory = locklift.factory.getDeployedContract(
    "EthereumEverscaleEventConfigurationFactory",
    new Address(ETH_EVER_EVENT_CONFIG_FACTORY),
  );
  const everEthEventConfigFactory = locklift.factory.getDeployedContract(
    "EverscaleEthereumEventConfigurationFactory",
    new Address(EVER_ETH_EVER_EVENT_CONFIG_FACTORY),
  );
  const proxyMultiVaultAlien = locklift.factory.getDeployedContract(
    "ProxyMultiVaultAlienJetton",
    new Address(PROXY_MULTI_VAULT_ALIEN),
  );
  const proxyMultiVaultNative = locklift.factory.getDeployedContract(
    "ProxyMultiVaultNativeJetton",
    new Address(PROXY_MULTI_VAULT_NATIVE),
  );

  const ethEverAlienConfiguration = {
    _owner: admin.address,
    _flags: 2,
    basicConfiguration: {
      eventABI: Buffer.from(JSON.stringify(ALIEN_TRANSFER_EVENT_ABI)).toString("base64"),
      roundDeployer: new Address(STAKING),
      eventInitialBalance: toNano(1),
      eventCode: locklift.factory.getContractArtifacts("MultiVaultEVMTONEventAlien").code,
    },
    networkConfiguration: {
      chainId: CHAIN_ID,
      eventEmitter: new BigNumber(MULTI_VAULT_PROXY.toLowerCase(), 16).toString(10),
      eventBlocksToConfirm: BLOCKS_TO_CONFIRM,
      proxy: proxyMultiVaultAlien.address,
      startBlockNumber: START_BLOCK_NUMBER,
      endBlockNumber: 0,
    },
  };

  await locklift.tracing.trace(
    ethEverEventConfigFactory.methods
      .deploy(ethEverAlienConfiguration)
      .send({
        from: admin.address,
        amount: toNano(2),
        bounce: true,
      }),
  );

  const ethEverAlienConfig = await ethEverEventConfigFactory.methods
    .deriveConfigurationAddress({
      networkConfiguration: ethEverAlienConfiguration.networkConfiguration,
      basicConfiguration: ethEverAlienConfiguration.basicConfiguration,
    })
    .call()
    .then((r) => locklift.factory.getDeployedContract("EthereumEverscaleEventConfiguration", r.value0));

  console.log(`EthEverAlienEventConfig: ${ethEverAlienConfig.address}`);

  const ethEverNativeConfiguration = {
    _owner: admin.address,
    _flags: 10,
    basicConfiguration: {
      eventABI: Buffer.from(JSON.stringify(NATIVE_TRANSFER_EVENT_ABI)).toString("base64"),
      roundDeployer: new Address(STAKING),
      eventInitialBalance: toNano(1),
      eventCode: locklift.factory.getContractArtifacts("MultiVaultEVMTONEventNative").code,
    },
    networkConfiguration: {
      chainId: CHAIN_ID,
      eventEmitter: new BigNumber(MULTI_VAULT_PROXY.toLowerCase(), 16).toString(10),
      eventBlocksToConfirm: BLOCKS_TO_CONFIRM,
      proxy: proxyMultiVaultNative.address,
      startBlockNumber: START_BLOCK_NUMBER,
      endBlockNumber: 0,
    },
  };

  await locklift.tracing.trace(
    ethEverEventConfigFactory.methods
      .deploy(ethEverNativeConfiguration)
      .send({
        from: admin.address,
        amount: toNano(2),
        bounce: true,
      }),
  );

  const ethEverNativeConfig = await ethEverEventConfigFactory.methods
    .deriveConfigurationAddress({
      basicConfiguration: ethEverNativeConfiguration.basicConfiguration,
      networkConfiguration: ethEverNativeConfiguration.networkConfiguration,
    })
    .call()
    .then((r) => locklift.factory.getDeployedContract("EthereumEverscaleEventConfiguration", r.value0));

  console.log(`EthEverNativeEventConfig: ${ethEverNativeConfig.address}`);

  if (DEPLOY_EVER_CONFIGURATIONS) {
    const everEthAlienConfiguration = {
      _owner: admin.address,
      _flags: 0,
      basicConfiguration: {
        eventABI: Buffer.from(JSON.stringify(EVER_ALIEN_TRANSFER_EVENT_ABI)).toString("base64"),
        roundDeployer: new Address(STAKING),
        eventInitialBalance: toNano(1),
        eventCode: locklift.factory.getContractArtifacts("MultiVaultTONEVMEventAlien").code,
      },
      networkConfiguration: {
        eventEmitter: proxyMultiVaultAlien.address,
        proxy: new BigNumber(MULTI_VAULT_PROXY.toLowerCase(), 16).toString(10),
        startTimestamp: START_TIMESTAMP,
        endTimestamp: 0,
      },
    };

    await locklift.tracing.trace(
        everEthEventConfigFactory.methods
            .deploy(everEthAlienConfiguration)
            .send({
              from: admin.address,
              amount: toNano(2),
              bounce: true,
            }),
    );

    const everEthAlienConfig = await everEthEventConfigFactory.methods
        .deriveConfigurationAddress({
          basicConfiguration: everEthAlienConfiguration.basicConfiguration,
          networkConfiguration: everEthAlienConfiguration.networkConfiguration,
        })
        .call()
        .then((r) => locklift.factory.getDeployedContract("EverscaleEthereumEventConfiguration", r.value0));

    console.log(`EverEthAlienEventConfig: ${everEthAlienConfig.address}`);

    await deployConnectors(
        admin,
        locklift.factory.getDeployedContract("Bridge", new Address(BRIDGE)),
        [everEthAlienConfig] as never[],
    );
  }

  if (DEPLOY_EVER_CONFIGURATIONS) {
    const everEthNativeConfiguration = {
      _owner: admin.address,
      _flags: 1,
      basicConfiguration: {
        eventABI: Buffer.from(JSON.stringify(EVER_NATIVE_TRANSFER_EVENT_ABI)).toString("base64"),
        roundDeployer: new Address(STAKING),
        eventInitialBalance: toNano(1),
        eventCode: locklift.factory.getContractArtifacts("MultiVaultTONEVMEventNative").code,
      },
      networkConfiguration: {
        eventEmitter: proxyMultiVaultNative.address,
        proxy: new BigNumber(MULTI_VAULT_PROXY.toLowerCase(), 16).toString(10),
        startTimestamp: START_TIMESTAMP,
        endTimestamp: 0,
      },
    };

    await locklift.tracing.trace(
        everEthEventConfigFactory.methods
            .deploy(everEthNativeConfiguration)
            .send({
              from: admin.address,
              amount: toNano(2),
              bounce: true,
            }),
    );

    const everEthNativeConfig = await everEthEventConfigFactory.methods
        .deriveConfigurationAddress({
          basicConfiguration: everEthNativeConfiguration.basicConfiguration,
          networkConfiguration: everEthNativeConfiguration.networkConfiguration,
        })
        .call()
        .then((r) => locklift.factory.getDeployedContract("EverscaleEthereumEventConfiguration", r.value0));

    console.log(`EverEthNativeEventConfig: ${everEthNativeConfig.address}`);

    await deployConnectors(
        admin,
        locklift.factory.getDeployedContract("Bridge", new Address(BRIDGE)),
        [everEthNativeConfig] as never[],
    );
  }

  await deployConnectors(
    admin,
    locklift.factory.getDeployedContract("Bridge", new Address(BRIDGE)),
    [ethEverAlienConfig, ethEverNativeConfig] as never[],
  );
};

main().then(() => console.log("Success"));
