import { Ed25519KeyPair } from "nekoton-wasm";
import { Contract, toNano } from "locklift";
import { Account } from "everscale-standalone-client/nodejs";
import { expect } from "chai";

import {
  CellEncoderStandaloneAbi,
  EthereumEverscaleEventConfigurationAbi,
  MergePoolAbi,
  MergeRouterAbi,
  MultiVaultEVMTONEventAlienAbi,
  ProxyMultiVaultAlienJettonAbi,
  RoundDeployerMockupAbi,
} from "../../../../build/factorySource";

import { JettonMinter } from "../../../utils/jetton";
import { setupBridge, setupRelays } from "../../../utils/bridge";
import { deployAccount } from "../../../utils/account";
import { logContract } from "../../../utils/logger";
import { setupAlienJettonMultiVault } from "../../../utils/multivault/alien";
import { EventAction, EventType, processEvent } from "../../../utils/events";

const logger = require("mocha-logger");

type EventVoteDataParam = Parameters<
  Contract<EthereumEverscaleEventConfigurationAbi>["methods"]["deployEvent"]
>[0]["eventVoteData"];

type EncodeMultiVaultAlienEVMEverscaleParam = Parameters<
  Contract<CellEncoderStandaloneAbi>["methods"]["encodeMultiVaultAlienEVMEverscale"]
>[0];

describe("Deposit Alien jetton with merging with custom jetton", function () {
  this.timeout(10000000);

  let relays: Ed25519KeyPair[];
  let cellEncoder: Contract<CellEncoderStandaloneAbi>;
  let roundDeployer: Contract<RoundDeployerMockupAbi>;
  let bridgeOwner: Account;

  let ethereumEverscaleEventConfiguration: Contract<EthereumEverscaleEventConfigurationAbi>;
  let initializer: Account;
  let proxy: Contract<ProxyMultiVaultAlienJettonAbi>;

  let alienTokenRoot: JettonMinter;
  let customTokenRoot: JettonMinter;
  let mergeRouter: Contract<MergeRouterAbi>;
  let mergePool: Contract<MergePoolAbi>;

  let eventContract: Contract<MultiVaultEVMTONEventAlienAbi>;
  let eventDataStructure: EncodeMultiVaultAlienEVMEverscaleParam;
  let eventVoteData: EventVoteDataParam;

  let eventDataEncoded: string;

  const alienTokenBase = {
    chainId: 111,
    token: 222,
  };

  const alienTokenMeta = {
    name: "Giga Chad",
    symbol: "GIGA_CHAD",
    decimals: 6,
  };

  const customTokenMeta = {
    name: "Custom Giga Chad",
    symbol: "CUSTOM_GIGA_CHAD",
    decimals: 9,
  };

  const amount = 333;

  it("Setup bridge", async () => {
    let bridge, everscaleEthereumEventConfiguration;

    relays = await setupRelays();
    [bridge, bridgeOwner, roundDeployer, cellEncoder] = await setupBridge(
      relays
    );

    const signer = (await locklift.keystore.getSigner("0"))!;

    initializer = await deployAccount(signer, 50);

    await logContract("Initializer", initializer.address);

    [
      ethereumEverscaleEventConfiguration,
      everscaleEthereumEventConfiguration,
      proxy,
    ] = await setupAlienJettonMultiVault(bridgeOwner, roundDeployer);

    await logContract("Bridge", bridge.address);
    await logContract(
      "TONETHEventConfiguration",
      everscaleEthereumEventConfiguration.address
    );
  });

  it("Deploy custom token root", async () => {
    customTokenRoot = await JettonMinter.deploy(
      bridgeOwner.address,
      {
        name: customTokenMeta.name,
        symbol: customTokenMeta.symbol,
        decimals: customTokenMeta.decimals,
      },
      { value: toNano(1.2), bounce: true }
    );

    await customTokenRoot.changeAdmin(proxy.address, {
      value: toNano(0.05),
      bounce: true,
    });

    await logContract("Custom token root", customTokenRoot.minter);
  });

  it("Deploy alien token root", async () => {
    await proxy.methods
      .deployEVMAlienToken({
        ...alienTokenBase,
        ...alienTokenMeta,
        value5: initializer.address,
      })
      .send({
        from: initializer.address,
        amount: locklift.utils.toNano(5),
      });

    const alienTokenRootAddress = await proxy.methods
      .deriveEVMAlienTokenRoot({
        ...alienTokenBase,
        ...alienTokenMeta,
        answerId: 0,
      })
      .call();

    alienTokenRoot = new JettonMinter(
      alienTokenRootAddress.value0,
      proxy.address
    );

    await logContract("Alien token root", alienTokenRoot.minter);
  });

  it("Deploy merge router", async () => {
    await proxy.methods
      .deployMergeRouter({
        token: alienTokenRoot.minter,
      })
      .send({
        from: initializer.address,
        amount: locklift.utils.toNano(5),
      });

    const mergeRouterAddress = await proxy.methods
      .deriveMergeRouter({
        answerId: 0,
        token: alienTokenRoot.minter,
      })
      .call();

    mergeRouter = locklift.factory.getDeployedContract(
      "MergeRouter",
      mergeRouterAddress.router
    );

    await logContract("Merge router", mergeRouter.address);
  });

  it("Deploy merge pool", async () => {
    const nonce = locklift.utils.getRandomNonce();

    await proxy.methods
      .deployMergePool({
        nonce,
        tokens: [alienTokenRoot.minter, customTokenRoot.minter],
        canonId: 1,
      })
      .send({
        from: initializer.address,
        amount: locklift.utils.toNano(5),
      });

    const mergePoolAddress = await proxy.methods
      .deriveMergePool({
        nonce,
        answerId: 0,
      })
      .call();

    mergePool = locklift.factory.getDeployedContract(
      "MergePool",
      mergePoolAddress.pool
    );

    await logContract("MergePool", mergePool.address);
  });

  it("Enable merge pool tokens", async () => {
    await locklift.transactions.waitFinalized(
      mergePool.methods.enableAll().send({
        from: bridgeOwner.address,
        amount: locklift.utils.toNano(1),
      })
    );

    const tokens = await mergePool.methods.getTokens({ answerId: 0 }).call();

    expect(tokens._tokens[0][1].enabled).to.be.equal(
      true,
      "Wrong alien status"
    );
    expect(tokens._tokens[1][1].enabled).to.be.equal(
      true,
      "Wrong canon status"
    );

    expect(tokens._canon.toString()).to.be.equal(
      customTokenRoot.minter.toString(),
      "Wrong canon token"
    );
  });

  it("Set merge pool in router", async () => {
    await mergeRouter.methods
      .setPool({
        pool_: mergePool.address,
      })
      .send({
        from: bridgeOwner.address,
        amount: locklift.utils.toNano(1),
      });

    const pool = await mergeRouter.methods
      .getPool({
        answerId: 0,
      })
      .call();

    expect(pool.value0.toString()).to.be.equal(
      mergePool.address.toString(),
      "Wrong pool in router"
    );
  });

  it("Initialize event", async () => {
    eventDataStructure = {
      base_chainId: alienTokenBase.chainId,
      base_token: alienTokenBase.token,
      ...alienTokenMeta,

      amount: 333,
      recipient_wid: initializer.address.toString().split(":")[0],
      recipient_addr: `0x${initializer.address.toString().split(":")[1]}`,

      value: 10000,
      expected_evers: 1000,
      payload: "",
    };

    eventDataEncoded = await cellEncoder.methods
      .encodeMultiVaultAlienEVMEverscale(eventDataStructure)
      .call()
      .then((t) => t.value0);

    eventVoteData = {
      eventTransaction: 111,
      eventIndex: 222,
      eventData: eventDataEncoded,
      eventBlockNumber: 333,
      eventBlock: 444,
    };

    const tx = await locklift.tracing.trace(
      ethereumEverscaleEventConfiguration.methods
        .deployEvent({
          eventVoteData,
        })
        .send({
          from: initializer.address,
          amount: locklift.utils.toNano(6),
        }),
      { raise: false }
    );

    // await tx.traceTree?.beautyPrint();

    logger.log(`Event initialization tx: ${tx.id.hash}`);

    const expectedEventContract =
      await ethereumEverscaleEventConfiguration.methods
        .deriveEventAddress({
          eventVoteData: eventVoteData,
          answerId: 0,
        })
        .call();

    logger.log(`Expected event: ${expectedEventContract.eventContract}`);

    eventContract = locklift.factory.getDeployedContract(
      "MultiVaultEVMTONEventAlien",
      expectedEventContract.eventContract
    );
  });

  it("Check event contract exists", async () => {
    expect(
      Number(await locklift.provider.getBalance(eventContract.address))
    ).to.be.greaterThan(0, "Event contract balance is zero");
  });

  it("Check init pipeline passed", async () => {
    const details = await eventContract.methods
      .getDetails({ answerId: 0 })
      .call();

    expect(details._status).to.be.equal("1", "Wrong status");
  });

  it("Confirm event", async () => {
    await processEvent(
      relays,
      eventContract.address,
      EventType.EthereumEverscale,
      EventAction.Confirm
    );
  });

  it("Check alien total supply is zero", async () => {
    const totalSupply = await alienTokenRoot.getState().then((s) => s.supply);

    expect(Number(totalSupply)).to.be.equal(
      0,
      "Alien total supply should remain zero"
    );
  });

  it("Check custom total supply", async () => {
    const totalSupply = await customTokenRoot.getState().then((s) => s.supply);

    expect(Number(totalSupply)).to.be.equal(
      amount * 10 ** (customTokenMeta.decimals - alienTokenMeta.decimals),
      "Wrong total supply after burn"
    );
  });
});
