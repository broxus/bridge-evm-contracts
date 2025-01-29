import { Address, Contract, toNano, WalletTypes } from "locklift";
import {
  BridgeAbi,
  ProxyMultiVaultAlienJettonAbi,
  RoundDeployerAbi,
  ProxyMultiVaultNativeJettonAbi,
  ConnectorAbi,
  MergeRouterAbi,
  EventCreditFactoryAbi,
  EthereumEverscaleEventConfigurationAbi,
  EverscaleEthereumEventConfigurationAbi,
  MergePoolAbi,
  MediatorAbi,
} from "../../build_prod/factorySource";
import { JettonMinter } from "../../test/utils/jetton";

const ADMIN = new Address(
  "0:22128f17fef7a538d4a92152db86c4b70f4dd1137ae162d38939a36b724e681b",
);
const NEW_OWNER = "";

const BRIDGE =
  "0:22128f17fef7a538d4a92152db86c4b70f4dd1137ae162d38939a36b724e681b";
const STAKING =
  "0:f41de04e5dc943c35528502621a7fea01142c5ad856eb46972ea938fd14aee4f";
const PROXY_MULTIVAULT_ALIEN =
  "0:ab234789f6989a94ed1b9282ee8271a8ad0ca061f943d943f647b573aa6d7287";
const PROXY_MULTIVAULT_NATIVE =
  "0:d25385cbd0d34699ab78c3871663323807f52b8d7f2feb18237e27c30e479784";
const EVENT_CONFIGS_AND_CONNECTORS = [
  {
    group: "STAKING",
    eventConfigs: [
      {
        eventConfigName: "EthereumEverscaleEventConfiguration",
        description: "56",
        eventConfigAddress:
          "0:517cb118c2bd19267a88b6e775d4a0eb7b8feec26d5d3f4eeaffd955b96d315c",
        connector:
          "0:9435ed93c9c3dc03f2e11e0b131f8eb2548dcf480cac137db4d5ebfbfe6ebc06",
      },
      {
        eventConfigName: "EthereumEverscaleEventConfiguration",
        description: "1",
        eventConfigAddress:
          "0:061cb484aa0f9e8b1a79c17982d1a1e906f4b43b6a451c28f3d0737ce0c884a5",
        connector:
          "0:cb25e361387651b66c11167c06a7ca22e043de1ee1dde156f0ca6c31c70e0998",
      },
      {
        eventConfigName: "EthereumEverscaleEventConfiguration",
        description: "43114",
        eventConfigAddress:
          "0:efcb6f0dd8d042f763aafa587d0450f257dc75461e4a4173e3c3d1d4c777013e",
        connector:
          "0:1473fd01a2035791012def686ca70bf22004d23479346b0d6f1cd68156d908e3",
      },
      {
        eventConfigName: "EverscaleEthereumEventConfiguration",
        description: "",
        eventConfigAddress:
          "0:041c1c21c4da21ef1df379cd3e6407c153beb966ecda10cf89f7896fc3386b2a",
        connector:
          "0:95cd673a8e1ed4310e72eb99e17ebaa0698ebe140431a1614506b0e4d56f2adc",
      },
    ],
  },
  {
    group: "COMMON",
    eventConfigs: [
      {
        eventConfigName: "EverscaleEthereumEventConfiguration",
        description: "alien",
        eventConfigAddress:
          "0:00aa6fb4e54575b02bc4f70c7253c6e66830dbefa195a2bc1d09120d1d8bee26",
        connector:
          "0:b839fc386a474c2c55f508dbb5ee0500faf096e17e1ef1d3b293e172b656e94a",
      },
      {
        eventConfigName: "EverscaleEthereumEventConfiguration",
        description: "native",
        eventConfigAddress:
          "0:ac8debaf487f60c9e104bb312bbb16366def81f311a59cc3f39a28ae048ee0fe",
        connector:
          "0:a918277e8709153152a0743f6aee80a96022079a21d158e282005dd1825093d0",
      },
    ],
  },
  {
    group: "ETHEREUM NETWORK (1)",
    eventConfigs: [
      {
        eventConfigName: "EthereumEverscaleEventConfiguration",
        description: "alien",
        eventConfigAddress:
          "0:98066e68fe552fb1789db3afd8eadc27a89662063d61a888a1bfa2568f48d8cc",
        connector:
          "0:ae2d58b7420b82e0a3d4c7603f894c844d67e9bbdabd84bcb56a48da79d8afff",
      },
      {
        eventConfigName: "EthereumEverscaleEventConfiguration",
        description: "native",
        eventConfigAddress:
          "0:20b23ca6e35c4a196764897f78fc33866cfd8df1794511fa825136890a4a00a4",
        connector:
          "0:d8cb6e3588143f413a71afc6a2baf9ef1a1fbffe97ff468a5f14606771a00a71",
      },
    ],
  },
  {
    group: "BSC NETWORK (56)",
    eventConfigs: [
      {
        eventConfigName: "EthereumEverscaleEventConfiguration",
        description: "alien",
        eventConfigAddress:
          "0:dabf328bb9801e5edfffd78abf267ebaf10f77cf1034db709c690b99ed1d4dff",
        connector:
          "0:9022b9f87530ec965e9400398f74b3d59c6b6beeba4ba14b193c01217535a2c3",
      },
      {
        eventConfigName: "EthereumEverscaleEventConfiguration",
        description: "native",
        eventConfigAddress:
          "0:e22c4e195f849980a6406bd809c6ccad25c662474dad957fe8047395143e4266",
        connector:
          "0:fdbb453073340d857f6335aa646db4291d7df1229a789ffaf4b935ad6417fc17",
      },
    ],
  },
  {
    group: "AVALANCHE NETWORK (43114)",
    eventConfigs: [
      {
        eventConfigName: "EthereumEverscaleEventConfiguration",
        description: "alien",
        eventConfigAddress:
          "0:3c94f36562d002b72eb5ad55453d3cff3ce9a0348c9bead6c9e6ebb35f75b32d",
        connector:
          "0:8d4eefb07ac1890e9fc96fd73453470ca6458505e385600a25d1e10274c9964b",
      },
      {
        eventConfigName: "EthereumEverscaleEventConfiguration",
        description: "native",
        eventConfigAddress:
          "0:4b6917b8d9357cee4d24a8605d28327108e0dc06b0fe478614a22a27b9c30805",
        connector:
          "0:775aaa3419e67104b4cb169e85abbb0f0d9186f7632bf2e3e8bf4a5c6dad1de1",
      },
    ],
  },
];
const MERGE_ROUTERS_AND_POOL = [
  {
    description: "USDT",
    mergePool:
      "0:ceb29b43c331046ed3919d6704d394947d565240d79c2a418bcebb470606767d",
    mergeRouters: [
      {
        address:
          "0:8f178a0bf9facbc11812a6c155dd5b81cbdb04f620c4e7c7bf4bb3b42d164a11",
        network: "ETHEREUM",
      },
      {
        address:
          "0:73152f4b54451632b959a3f328a8b2811489e20a910f41a7d5cde96849f41510",
        network: "BSC",
      },
      {
        address:
          "0:9cfb3446b058086ae94fba446f95b30735de7442750c30dce008146f1db03ca8",
        network: "AVALANCHE",
      },
    ],
  },
  {
    description: "USDC",
    mergePool:
      "0:5a683c88d9f223706c21311b81d8e10b53ffd54c70b02874692c32dd38b67f67",
    mergeRouters: [
      {
        address:
          "0:d6fedbacd46997e42c2da4f7ac735fbbf3b5f38213b6254bf409e1ab06724185",
        network: "ETHEREUM",
      },
      {
        address:
          "0:b0ff4bad10aa3b9fdf7d24be78b56858b0f0c45f65c1657a77f0561c3aec80b5",
        network: "BSC",
      },
      {
        address:
          "0:78b049a76dfdfff8c39dfec34304554838e520825ed241d8f4153cecd19ef19c",
        network: "AVALANCHE",
      },
    ],
  },
  {
    description: "WBTC",
    mergePool:
      "0:1b71d9dd53d90d2c1c51c2fef2188b3e158615057696b3fd4981b1cde7f40b8e",
    mergeRouters: [
      {
        address:
          "0:0189aa300c0b4c7c673e95cd1ba77c75a818466d9f2c35d62bdfd80a620d7dea",
        network: "ETHEREUM",
      },
      {
        address:
          "0:89bb10ad77c2fa84536568246866cd22867545b24a4e1521be7af5412478fdf7",
        network: "BSC",
      },
      {
        address:
          "0:4a3a60c99f03c53aa2dd07208d71f21d50712ee975dabf8e0c22310359764325",
        network: "AVALANCHE",
      },
    ],
  },
  {
    description: "WETH",
    mergePool:
      "0:80ef2702a33e2dd4d341f3db68140e08760da390ef55250b914304dd22facf04",
    mergeRouters: [
      {
        address:
          "0:8870f2d219bd74f7c191b88a98ffb6df7b01f23bd4bdf66a36b2b36e0448dd29",
        network: "ETHEREUM",
      },
      {
        address:
          "0:0b6149a400539f7c732daaca8483077ae69b3f4db2eea26522bede98bdbfe715",
        network: "BSC",
      },
      {
        address:
          "0:3b99d651e8b52bcc4911bbdd32c8b8a4ee753cf623354ef0ff46cc0fce741df2",
        network: "AVALANCHE",
      },
    ],
  },
];
const EVENT_CREDIT_FACTORY =
  "0:0e13640a05fd54b50dfa1794a36ea498c983e2119623b6c0e7baec0e03b99544";
const WTON_MINTER =
  "0:4fa2916fc8cb24141b1fa79c3fe6505c52e02782c4a3fc99323ab4a00005fe3e";
const MEDIATOR =
  "0:095762ba75cb724ee2db7affd21ca0f6770d2c06b760e50e9694497235127bd0";

const main = async (): Promise<void> => {
  const admin = await locklift.factory.accounts.addExistingAccount({
    type: WalletTypes.EverWallet,
    address: ADMIN,
  });

  const bridge: Contract<BridgeAbi> =
    await locklift.factory.getDeployedContract("Bridge", new Address(BRIDGE));
  await bridge.methods
    .transferOwnership({ newOwner: NEW_OWNER })
    .send({ from: admin.address, amount: toNano(0.2) });
  console.log(
    "Bridge new owner:",
    await bridge.methods
      .owner({})
      .call()
      .then((a) => a.owner.toString()),
  );

  const staking: Contract<RoundDeployerAbi> =
    await locklift.factory.getDeployedContract(
      "RoundDeployer",
      new Address(STAKING),
    );
  await staking.methods
    .setAdmin({ new_admin: NEW_OWNER, send_gas_to: admin.address })
    .send({ from: admin.address, amount: toNano(0.5) });
  console.log(
    "Staking new owner:",
    await staking.methods
      .getDetails({ answerId: 0 })
      .call()
      .then((a) => a.value0.admin.toString()),
  );

  const proxyAlien: Contract<ProxyMultiVaultAlienJettonAbi> =
    await locklift.factory.getDeployedContract(
      "ProxyMultiVaultAlienJetton",
      new Address(PROXY_MULTIVAULT_ALIEN),
    );
  await proxyAlien.methods
    .transferOwnership({ newOwner: NEW_OWNER })
    .send({ from: admin.address, amount: toNano(0.2) });
  console.log(
    "ProxyMultiVaultAlien new owner:",
    await proxyAlien.methods
      .owner({})
      .call()
      .then((a) => a.owner.toString()),
  );

  const proxyNative: Contract<ProxyMultiVaultNativeJettonAbi> =
    await locklift.factory.getDeployedContract(
      "ProxyMultiVaultAlienNative",
      new Address(PROXY_MULTIVAULT_NATIVE),
    );
  await proxyNative.methods
    .transferOwnership({ newOwner: NEW_OWNER })
    .send({ from: admin.address, amount: toNano(0.2) });
  console.log(
    "ProxyMultiVaultNative new owner:",
    await proxyNative.methods
      .owner({})
      .call()
      .then((a) => a.owner.toString()),
    "\n",
  );

  for (let group of EVENT_CONFIGS_AND_CONNECTORS) {
    console.log(group.group);
    for (let config of group.eventConfigs) {
      const eventConfig: Contract<
        | EthereumEverscaleEventConfigurationAbi
        | EverscaleEthereumEventConfigurationAbi
      > = await locklift.factory.getDeployedContract(
        config.eventConfigName,
        new Address(config.eventConfigAddress),
      );
      await eventConfig.methods
        .transferOwnership({ newOwner: NEW_OWNER })
        .send({ from: admin.address, amount: toNano(0.2) });
      console.log(
        `${config.eventConfigName} (${config.description}) new owner:`,
        await eventConfig.methods
          .owner({})
          .call()
          .then((a) => a.owner.toString()),
      );

      const connector: Contract<ConnectorAbi> =
        await locklift.factory.getDeployedContract(
          "Connector",
          new Address(config.connector),
        );
      await connector.methods
        .transferOwnership({ newOwner: NEW_OWNER })
        .send({ from: admin.address, amount: toNano(0.2) });
      console.log(
        `${config.eventConfigAddress} Connector new owner:`,
        await connector.methods
          .owner({})
          .call()
          .then((a) => a.owner.toString()),
      );
    }
    console.log();
  }

  for (let mergeConfig of MERGE_ROUTERS_AND_POOL) {
    console.log(`Merge Pool for ${mergeConfig.description}`);

    for (let router of mergeConfig.mergeRouters) {
      const mergeRouter: Contract<MergeRouterAbi> =
        await locklift.factory.getDeployedContract(
          "MergeRouter",
          new Address(router.address),
        );
      await mergeRouter.methods
        .transferOwnership({ newOwner: NEW_OWNER })
        .send({ from: admin.address, amount: toNano(0.2) });
      console.log(
        `MergeRouter ${router.network}-${mergeConfig.description} new owner:`,
        await mergeRouter.methods
          .owner({})
          .call()
          .then((a) => a.owner.toString()),
      );
    }

    const mergePool: Contract<MergePoolAbi> =
      await locklift.factory.getDeployedContract(
        "MergePool_V5",
        new Address(mergeConfig.mergePool),
      );
    await mergePool.methods
      .transferOwnership({ newOwner: NEW_OWNER })
      .send({ from: admin.address, amount: toNano(0.2) });
    console.log(
      `MergePool new owner:`,
      await mergePool.methods
        .owner({})
        .call()
        .then((a) => a.owner.toString()),
      "\n",
    );
  }

  const mediator: Contract<MediatorAbi> =
    await locklift.factory.getDeployedContract(
      "Mediator",
      new Address(MEDIATOR),
    );
  await mediator.methods
    .transferOwnership({ newOwner: NEW_OWNER })
    .send({ from: admin.address, amount: toNano(0.2) });
  console.log(
    `Mediator new owner:`,
    await mediator.methods
      .owner({})
      .call()
      .then((a) => a.owner.toString()),
  );

  const eventCreditFactory: Contract<EventCreditFactoryAbi> =
    await locklift.factory.getDeployedContract(
      "EventCreditFactory",
      new Address(EVENT_CREDIT_FACTORY),
    );
  await eventCreditFactory.methods
    .transferOwnership({ newOwner: NEW_OWNER })
    .send({ from: admin.address, amount: toNano(0.2) });
  console.log(
    `EventCreditFactory new owner:`,
    await eventCreditFactory.methods
      .owner({})
      .call()
      .then((a) => a.owner.toString()),
    "\n",
  );

  const wton = new JettonMinter(new Address(WTON_MINTER), admin.address);
  await wton.changeAdmin(new Address(NEW_OWNER), {
    value: toNano(0.2),
    bounce: true,
  });
  console.log(
    `WTON new owner:`,
    await wton.getState().then((a) => a.admin.toString()),
  );
};

main().then(() => console.log("Success"));
