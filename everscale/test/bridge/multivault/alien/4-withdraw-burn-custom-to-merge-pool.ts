import { Ed25519KeyPair } from "nekoton-wasm";
import { Contract, toNano } from "locklift";
import { Account } from "everscale-standalone-client/nodejs";
import { expect } from "chai";

import {
  CellEncoderStandaloneAbi,
  EverscaleEthereumEventConfigurationAbi,
  MergePoolAbi,
  MergeRouterAbi,
  MultiVaultTONEVMEventAlienAbi,
  RoundDeployerMockupAbi,
  ProxyMultiVaultAlienJettonAbi,
} from "../../../../build/factorySource";

import { setupBridge, setupRelays } from "../../../utils/bridge";
import { deployAccount } from "../../../utils/account";
import { logContract } from "../../../utils/logger";
import { setupAlienJettonMultiVault } from "../../../utils/multivault/alien";
import { EventAction, EventType, processEvent } from "../../../utils/events";
import { JettonMinter, JettonWallet } from "../../../utils/jetton";

const logger = require("mocha-logger");

describe("Withdraw custom jettons by burning in favor of merge pool", function () {
  this.timeout(10000000);

  let relays: Ed25519KeyPair[];
  let cellEncoder: Contract<CellEncoderStandaloneAbi>;
  let roundDeployer: Contract<RoundDeployerMockupAbi>;
  let bridgeOwner: Account;

  let everscaleEthereumEventConfiguration: Contract<EverscaleEthereumEventConfigurationAbi>;
  let initializer: Account;
  let proxy: Contract<ProxyMultiVaultAlienJettonAbi>;

  let alienTokenRoot: JettonMinter;
  let customTokenRoot: JettonMinter;
  let initializerCustomTokenWallet: JettonWallet;
  let mergeRouter: Contract<MergeRouterAbi>;
  let mergePool: Contract<MergePoolAbi>;
  let eventContract: Contract<MultiVaultTONEVMEventAlienAbi>;

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

  const mintAmount = 100000;
  const amount = 33300;
  const recipient = 888;

  it("Setup bridge", async () => {
    let bridge, ethereumEverscaleEventConfiguration;

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
      "ETHTONEventConfiguration",
      ethereumEverscaleEventConfiguration.address
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

    await logContract("Custom token root", customTokenRoot.minter);
  });

  it("Mint custom tokens to initializer", async () => {
    await customTokenRoot.mint(
      mintAmount,
      initializer.address,
      0,
      { value: 0 },
      { value: toNano(2), bounce: true }
    );
  });

  it("Transfer custom token ownership to proxy", async () => {
    await customTokenRoot.changeAdmin(proxy.address, {
      value: toNano(0.05),
      bounce: true,
    });
  });

  it("Check initializer custom token balance", async () => {
    initializerCustomTokenWallet = await customTokenRoot.getWalletOf(
      initializer.address
    );

    const balance = await initializerCustomTokenWallet
      .getState()
      .then((s) => s.tokenBalance);

    expect(Number(balance)).to.be.equal(
      mintAmount,
      "Wrong initializer token balance after mint"
    );
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
    await mergePool.methods.enableAll().send({
      from: bridgeOwner.address,
      amount: locklift.utils.toNano(1),
    });

    const tokens = await mergePool.methods
      .getTokens({
        answerId: 0,
      })
      .call();

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

  it("Burn tokens in favor of merge pool", async () => {
    const burnPayload = await cellEncoder.methods
      .encodeMergePoolBurnWithdrawPayloadEthereum({
        targetToken: alienTokenRoot.minter,
        recipient,
        callback: {
          recipient: 0,
          strict: false,
          payload: "",
        },
      })
      .call();

    const tx = await initializerCustomTokenWallet.burn(
      amount,
      mergePool.address,
      burnPayload.value0,
      { value: toNano(10), bounce: true }
    );

    logger.log(`Event initialization tx: ${tx.id.hash}`);

    const events = await everscaleEthereumEventConfiguration
      .getPastEvents({ filter: "NewEventContract" })
      .then((e) => e.events);

    expect(events).to.have.lengthOf(
      1,
      "Everscale event configuration failed to deploy event"
    );

    const [
      {
        data: { eventContract: expectedEventContract },
      },
    ] = events;

    logger.log(`Expected event address: ${expectedEventContract}`);

    eventContract = locklift.factory.getDeployedContract(
      "MultiVaultTONEVMEventAlien",
      expectedEventContract
    );
  });

  it("Check event contract exists", async () => {
    expect(
      Number(await locklift.provider.getBalance(eventContract.address))
    ).to.be.greaterThan(0, "Event contract balance is zero");
  });

  it("Check total supply reduced", async () => {
    const totalSupply = await customTokenRoot.getState().then((s) => s.supply);

    expect(Number(totalSupply)).to.be.equal(
      mintAmount - amount,
      "Wrong total supply after burn"
    );
  });

  it("Check initializer token balance reduced", async () => {
    const balance = await initializerCustomTokenWallet
      .getState()
      .then((s) => s.tokenBalance);

    expect(Number(balance)).to.be.equal(
      mintAmount - amount,
      "Wrong initializer token balance after burn"
    );
  });

  it("Check sender address", async () => {
    const sender = await eventContract.methods.sender({}).call();

    expect(sender.toString()).to.be.equal(
      initializer.toString(),
      "Wrong sender"
    );
  });

  it("Check event data after mutation", async () => {
    const decodedData = await eventContract.methods
      .getDecodedData({
        answerId: 0,
      })
      .call();

    expect(Number(decodedData.base_token_)).to.be.equal(
      alienTokenBase.token,
      "Wrong alien base token"
    );
    expect(Number(decodedData.base_chainId_)).to.be.equal(
      alienTokenBase.chainId,
      "Wrong alien base chain id"
    );

    const eventInitData = await eventContract.methods
      .getEventInitData({
        answerId: 0,
      })
      .call();

    const decodedEventData = await cellEncoder.methods
      .decodeMultiVaultAlienEverscaleEthereum({
        data: eventInitData.value0.voteData.eventData,
      })
      .call();

    expect(Number(decodedEventData.base_token)).to.be.equal(
      alienTokenBase.token,
      "Wrong event data base token"
    );
    expect(Number(decodedEventData.base_chainId)).to.be.equal(
      alienTokenBase.chainId,
      "Wrong event data base chain id"
    );
    expect(Number(decodedEventData.amount)).to.be.equal(
      Math.floor(
        amount / 10 ** (customTokenMeta.decimals - alienTokenMeta.decimals)
      ),
      "Wrong event data amount"
    );
    expect(Number(decodedEventData.recipient)).to.be.equal(
      recipient,
      "Wrong event data recipient"
    );
  });

  it("Confirm event", async () => {
    await processEvent(
      relays,
      eventContract.address,
      EventType.EverscaleEthereum,
      EventAction.Confirm
    );
  });

  it("Close event", async () => {
    const balance = await locklift.provider.getBalance(eventContract.address);

    const { traceTree } = await locklift.tracing.trace(
      eventContract.methods.close().send({
        from: initializer.address,
        amount: locklift.utils.toNano(0.1),
      })
    );

    expect(
      Number(await locklift.provider.getBalance(eventContract.address))
    ).to.be.equal(0, "Event contract balance should be 0 after close");

    expect(
      Number(traceTree?.getBalanceDiff(initializer.address))
    ).to.be.greaterThan(
      Number(balance) - Number(locklift.utils.toNano(1)), // Greater than balance - 1 ton for fees
      "Initializer should get money back after close"
    );
  });
});
