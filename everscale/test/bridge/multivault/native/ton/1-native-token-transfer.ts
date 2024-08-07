import { Ed25519KeyPair } from "nekoton-wasm";
import { expect } from "chai";
import { Contract } from "locklift";
import { Account } from "everscale-standalone-client/nodejs";
import { BigNumber } from "bignumber.js";

import {
  CellEncoderStandaloneAbi,
  EthereumEverscaleEventConfigurationAbi,
  EverscaleEthereumEventConfigurationAbi,
  MultiVaultEverscaleEVMEventNativeAbi,
  MultiVaultEVMEverscaleEventNativeAbi,
  ProxyMultiVaultNativeJettonAbi,
  RoundDeployerMockupAbi,
} from "../../../../../build/factorySource";

import { logContract } from "../../../../utils/logger";
import { setupBridge, setupRelays } from "../../../../utils/bridge";
import { setupNativeJettonMultiVault } from "../../../../utils/multivault/native";
import { deployAccount } from "../../../../utils/account";
import { EventAction, EventType, processEvent } from "../../../../utils/events";
import { JettonMinter } from "../../../../utils/jetton";

const logger = require("mocha-logger");

type EncodeMultiVaultNativeEVMEverscaleParam = Parameters<
  Contract<CellEncoderStandaloneAbi>["methods"]["encodeMultiVaultNativeEVMEverscale"]
>[0];
type EventVoteDataParam = Parameters<
  Contract<EthereumEverscaleEventConfigurationAbi>["methods"]["deployEvent"]
>[0]["eventVoteData"];

describe("Test EVM native multivault pipeline", function () {
  this.timeout(10000000);

  let relays: Ed25519KeyPair[];
  let cellEncoder: Contract<CellEncoderStandaloneAbi>;
  let roundDeployer: Contract<RoundDeployerMockupAbi>;
  let bridgeOwner: Account;

  let ethereumEverscaleEventConfiguration: Contract<EthereumEverscaleEventConfigurationAbi>;
  let everscaleEthereumEventConfiguration: Contract<EverscaleEthereumEventConfigurationAbi>;
  let proxy: Contract<ProxyMultiVaultNativeJettonAbi>;
  let initializer: Account;
  let eventCloser: Account;

  let jetton: JettonMinter;

  const tokenMeta = {
    name: "Custom Giga Chad",
    symbol: "CUSTOM_GIGA_CHAD",
    decimals: 9,
  };

  const callback = {
    recipient: 123,
    strict: false,
    payload: "",
  };

  const mintAmount = 1000;
  const amount = 500;

  it("Setup bridge", async () => {
    let bridge;

    relays = await setupRelays();
    [bridge, bridgeOwner, roundDeployer, cellEncoder] = await setupBridge(
      relays
    );

    const signer = (await locklift.keystore.getSigner("0"))!;

    initializer = await deployAccount(signer, 50);

    await logContract("Initializer", initializer.address);
    await logContract("Bridge", bridge.address);

    [
      ethereumEverscaleEventConfiguration,
      everscaleEthereumEventConfiguration,
      proxy,
    ] = await setupNativeJettonMultiVault(bridgeOwner, roundDeployer);

    eventCloser = await deployAccount(
      (await locklift.keystore.getSigner("1"))!,
      50
    );
  });

  it("Deploy native jetton", async () => {
    jetton = await JettonMinter.deploy(
      bridgeOwner.address,
      {
        name: tokenMeta.name,
        symbol: tokenMeta.symbol,
        decimals: tokenMeta.decimals,
      },
      { bounce: true, value: locklift.utils.toNano(2) }
    );

    await logContract("Custom jetton", jetton.minter);
  });

  it("Mint tokens to initializer", async () => {
    await jetton.mint(
      mintAmount,
      initializer.address,
      locklift.utils.toNano(1.5),
      { value: 0 },
      { bounce: true, value: locklift.utils.toNano(2) }
    );
  });

  it("Check initializer token balance", async () => {
    const walletData = await jetton
      .getWalletOf(initializer.address)
      .then((w) => w.getState());

    expect(Number(walletData.tokenBalance)).to.be.equal(
      mintAmount,
      "Wrong initializer token balance after mint"
    );
  });

  describe("Transfer native token from TON to EVM", () => {
    const recipient = 111;
    const chainId = 222;

    let eventContract: Contract<MultiVaultEverscaleEVMEventNativeAbi>;

    it("Transfer tokens to the Native Proxy", async () => {
      const payload = await cellEncoder.methods
        .encodeNativeJettonTransferPayloadEthereum({
          recipient,
          chainId,
          callback,
          name: tokenMeta.name,
          symbol: tokenMeta.symbol,
          decimals: tokenMeta.decimals,
          token: jetton.minter,
        })
        .call()
        .then((t) => t.value0);

      const tx = await locklift.tracing.trace(
        jetton
          .getWalletOf(initializer.address)
          .then((w) =>
            w.transfer(
              amount,
              proxy.address,
              { value: locklift.utils.toNano(9.2), payload: payload },
              { value: locklift.utils.toNano(10), bounce: true }
            )
          )
      );

      logger.log(`Token transfer tx: ${tx.id.hash}`);

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
        "MultiVaultEverscaleEVMEventNative",
        expectedEventContract
      );
    });

    it("Check initializer token balance", async () => {
      const state = await jetton
        .getWalletOf(initializer.address)
        .then((w) => w.getState());

      expect(Number(state.tokenBalance)).to.be.equal(
        mintAmount - amount,
        "Wrong initializer token balance"
      );
    });

    it("Check native proxy token balance", async () => {
      const state = await jetton
        .getWalletOf(proxy.address)
        .then((w) => w.getState());

      expect(Number(state.tokenBalance)).to.be.equal(
        amount,
        "Wrong initializer token balance"
      );
    });

    it("Check event contract exists", async () => {
      expect(
        Number(await locklift.provider.getBalance(eventContract.address))
      ).to.be.greaterThan(0, "Event contract balance is zero");
    });

    it("Check sender address", async () => {
      const sender = await eventContract.methods.sender({}).call();

      expect(sender.toString()).to.be.equal(
        initializer.toString(),
        "Wrong sender"
      );
    });

    it("Check initial balance", async () => {
      const { initial_balance } = await eventContract.methods
        .initial_balance({})
        .call();

      expect(Number(initial_balance)).to.be.greaterThan(
        Number(locklift.utils.toNano(9)),
        "Wrong event contract initial balance"
      );
    });

    it("Check event state before confirmation", async () => {
      const details = await eventContract.methods
        .getDetails({ answerId: 0 })
        .call();

      expect(details._eventInitData.configuration.toString()).to.be.equal(
        everscaleEthereumEventConfiguration.address.toString(),
        "Wrong event configuration"
      );

      expect(details._status).to.be.equal("1", "Wrong status");

      expect(details._confirms).to.have.lengthOf(
        0,
        "Wrong amount of confirmations"
      );

      expect(details._signatures).to.have.lengthOf(
        0,
        "Wrong amount of signatures"
      );

      expect(details._rejects).to.have.lengthOf(0, "Wrong amount of rejects");

      expect(details._initializer.toString()).to.be.equal(
        proxy.address.toString(),
        "Wrong initializer"
      );
    });

    it("Check event data after mutation", async () => {
      const decodedData = await eventContract.methods
        .getDecodedData({ answerId: 0 })
        .call();

      const proxyTokenWallet = await jetton.getWalletOf(proxy.address);

      expect(decodedData.proxy_.toString()).to.be.equal(
        proxy.address.toString(),
        "Wrong event decoded proxy"
      );

      expect(decodedData.tokenWallet_.toString()).to.be.equal(
        proxyTokenWallet.wallet.toString(),
        "Wrong event decoded data token wallet"
      );

      expect(decodedData.token_.toString()).to.be.equal(
        jetton.minter.toString(),
        "Wrong event decoded token root"
      );

      expect(decodedData.remainingGasTo_.toString()).to.be.equal(
        initializer.address.toString(),
        "Wrong event decoded remaining gas to"
      );

      expect(decodedData.amount_.toString()).to.be.equal(
        amount.toString(),
        "Wrong event decoded amount"
      );

      expect(decodedData.recipient_.toString()).to.be.equal(
        recipient.toString(),
        "Wrong event decoded recipient"
      );

      expect(decodedData.chainId_.toString()).to.be.equal(
        chainId.toString(),
        "Wrong event decoded amount"
      );

      const tokenData = await jetton.getState();

      expect(decodedData.name_).to.be.equal(
        tokenData.name,
        "Wrong event decoded root name"
      );
      expect(decodedData.symbol_).to.be.equal(
        tokenData.symbol,
        "Wrong event decoded root symbol"
      );
      expect(decodedData.decimals_).to.be.equal(
        tokenData.decimals,
        "Wrong event decoded root decimals"
      );
    });

    it("Check mutated event data", async () => {
      const eventInitData = await eventContract.methods
        .getEventInitData({ answerId: 0 })
        .call();

      const decodedData = await cellEncoder.methods
        .decodeMultiVaultNativeEverscaleEthereum({
          data: eventInitData.value0.voteData.eventData,
        })
        .call();

      expect(decodedData.token_wid).to.be.equal(
        jetton.getWID(),
        "Wrong event data token wid"
      );
      expect(
        new BigNumber(decodedData.token_addr).eq(
          new BigNumber(jetton.getEthAddress(), 16)
        )
      ).to.be.true;

      expect(decodedData.amount).to.be.equal(
        amount.toString(),
        "Wrong event data amount"
      );

      expect(decodedData.recipient).to.be.equal(
        recipient.toString(),
        "Wrong event data recipient"
      );

      expect(decodedData.chainId).to.be.equal(
        chainId.toString(),
        "Wrong event data amount"
      );

      const tokenData = await jetton.getState();

      expect(decodedData.name).to.be.equal(
        tokenData.name,
        "Wrong event data root name"
      );
      expect(decodedData.symbol).to.be.equal(
        tokenData.symbol,
        "Wrong event data root symbol"
      );
      expect(decodedData.decimals).to.be.equal(
        tokenData.decimals,
        "Wrong event data root decimals"
      );
    });

    it("Check event required votes", async () => {
      const requiredVotes = await eventContract.methods
        .requiredVotes()
        .call()
        .then((t) => parseInt(t.requiredVotes, 10));

      const relays = await eventContract.methods
        .getVoters({
          vote: 1,
          answerId: 0,
        })
        .call();

      expect(requiredVotes).to.be.greaterThan(
        0,
        "Too low required votes for event"
      );
      expect(relays.voters.length).to.be.greaterThanOrEqual(
        requiredVotes,
        "Too many required votes for event"
      );
    });

    it("Confirm event enough times", async () => {
      await processEvent(
        relays,
        eventContract.address,
        EventType.EverscaleEthereum,
        EventAction.Confirm
      );
    });

    it("Check event confirmed", async () => {
      const details = await eventContract.methods
        .getDetails({ answerId: 0 })
        .call();

      const requiredVotes = await eventContract.methods
        .requiredVotes()
        .call()
        .then((t) => parseInt(t.requiredVotes, 10));

      expect(Number(details.balance)).to.be.greaterThan(0, "Wrong balance");

      expect(details._status).to.be.equal("2", "Wrong status");

      expect(details._confirms).to.have.lengthOf(
        requiredVotes,
        "Wrong amount of relays confirmations"
      );

      expect(details._signatures).to.have.lengthOf(
        requiredVotes,
        "Wrong amount of signatures"
      );

      expect(details._rejects).to.have.lengthOf(
        0,
        "Wrong amount of relays rejects"
      );
    });

    it("Close event", async () => {
      await eventContract.methods.close({}).send({
        from: eventCloser.address,
        amount: locklift.utils.toNano(1),
      });
    });
  });

  describe("Transfer native token from EVM to TON", () => {
    let eventDataStructure: EncodeMultiVaultNativeEVMEverscaleParam;
    let eventVoteData: EventVoteDataParam;
    let eventDataEncoded;
    let eventContract: Contract<MultiVaultEVMEverscaleEventNativeAbi>;

    it("Initialize event", async () => {
      eventDataStructure = {
        token_wid: jetton.getWID(),
        token_addr: jetton.getEthAddress(),
        amount,
        recipient_wid: initializer.address.toString().split(":")[0],
        recipient_addr: `0x${initializer.address.toString().split(":")[1]}`,
        value: 0,
        expected_evers: 100,
        payload: "",
      };

      eventDataEncoded = await cellEncoder.methods
        .encodeMultiVaultNativeEVMEverscale(eventDataStructure)
        .call()
        .then((t) => t.value0);

      eventVoteData = {
        eventTransaction: 111,
        eventIndex: 222,
        eventData: eventDataEncoded,
        eventBlockNumber: 333,
        eventBlock: 444,
      };

      const tx = await ethereumEverscaleEventConfiguration.methods
        .deployEvent({ eventVoteData })
        .send({ from: initializer.address, amount: locklift.utils.toNano(6) });

      logger.log(`Event initialization tx: ${tx.id}`);

      const expectedEventContract =
        await ethereumEverscaleEventConfiguration.methods
          .deriveEventAddress({
            eventVoteData: eventVoteData,
            answerId: 0,
          })
          .call();

      logger.log(
        `Expected event address: ${expectedEventContract.eventContract}`
      );

      eventContract = locklift.factory.getDeployedContract(
        "MultiVaultEVMEverscaleEventNative",
        expectedEventContract.eventContract
      );
    });

    it("Check event contract exists", async () => {
      expect(
        Number(await locklift.provider.getBalance(eventContract.address))
      ).to.be.greaterThan(0, "Event contract balance is zero");
    });

    it("Check event state before confirmation", async () => {
      const details = await eventContract.methods
        .getDetails({ answerId: 0 })
        .call();

      expect(details._eventInitData.voteData.eventTransaction).to.be.equal(
        eventVoteData.eventTransaction.toString(),
        "Wrong event transaction"
      );

      expect(details._eventInitData.voteData.eventIndex.toString()).to.be.equal(
        eventVoteData.eventIndex.toString(),
        "Wrong event index"
      );

      expect(details._eventInitData.voteData.eventData).to.be.equal(
        eventVoteData.eventData,
        "Wrong event data"
      );

      expect(details._eventInitData.voteData.eventBlockNumber).to.be.equal(
        eventVoteData.eventBlockNumber.toString(),
        "Wrong event block number"
      );

      expect(details._eventInitData.voteData.eventBlock).to.be.equal(
        eventVoteData.eventBlock.toString(),
        "Wrong event block"
      );

      expect(details._eventInitData.configuration.toString()).to.be.equal(
        ethereumEverscaleEventConfiguration.address.toString(),
        "Wrong event configuration"
      );

      expect(details._eventInitData.roundDeployer.toString()).to.be.equal(
        roundDeployer.address.toString(),
        "Wrong staking"
      );

      expect(details._status).to.be.equal("1", "Wrong status");

      expect(details._confirms).to.have.lengthOf(
        0,
        "Wrong amount of relays confirmations"
      );

      expect(details._rejects).to.have.lengthOf(
        0,
        "Wrong amount of relays rejects"
      );

      expect(details._initializer.toString()).to.be.equal(
        initializer.address.toString(),
        "Wrong initializer"
      );
    });

    it("Check event decoded data", async () => {
      const decodedData = await eventContract.methods
        .getDecodedData({ answerId: 0 })
        .call();

      expect(decodedData.token_.toString()).to.be.equal(
        jetton.minter.toString(),
        "Wrong event decoded data token"
      );
      expect(decodedData.amount_).to.be.equal(
        amount.toString(),
        "Wrong event decoded data amount"
      );
      expect(decodedData.recipient_.toString()).to.be.equal(
        initializer.address.toString(),
        "Wrong event decoded data recipient"
      );
      expect(decodedData.proxy_.toString()).to.be.equal(
        proxy.address.toString(),
        "Wrong event decoded data proxy"
      );

      const proxyTokenWallet = await jetton.getWalletOf(proxy.address);

      expect(decodedData.tokenWallet_.toString()).to.be.equal(
        proxyTokenWallet.wallet.toString(),
        "Wrong event decoded data token wallet"
      );
    });

    it("Check event required votes", async () => {
      const requiredVotes = await eventContract.methods
        .requiredVotes()
        .call()
        .then((t) => parseInt(t.requiredVotes, 10));

      const relays = await eventContract.methods
        .getVoters({ vote: 1, answerId: 0 })
        .call();

      expect(requiredVotes).to.be.greaterThan(
        0,
        "Too low required votes for event"
      );
      expect(relays.voters.length).to.be.greaterThanOrEqual(
        requiredVotes,
        "Too many required votes for event"
      );
    });

    it("Check event round number", async () => {
      const roundNumber = await eventContract.methods.round_number({}).call();

      expect(roundNumber.round_number).to.be.equal("0", "Wrong round number");
    });

    it("Confirm event", async () => {
      await processEvent(
        relays,
        eventContract.address,
        EventType.EthereumEverscale,
        EventAction.Confirm
      );
    });

    it("Check event confirmed", async () => {
      const details = await eventContract.methods
        .getDetails({ answerId: 0 })
        .call();

      const requiredVotes = await eventContract.methods
        .requiredVotes()
        .call()
        .then((t) => parseInt(t.requiredVotes, 10));

      expect(details._status).to.be.equal("2", "Wrong status");

      expect(details._confirms).to.have.lengthOf(
        requiredVotes,
        "Wrong amount of relays confirmations"
      );

      expect(details._rejects).to.have.lengthOf(
        0,
        "Wrong amount of relays rejects"
      );
    });

    it("Check initializer token balance", async () => {
      const state = await jetton
        .getWalletOf(initializer.address)
        .then((w) => w.getState());

      expect(parseInt(state.tokenBalance, 10)).to.be.equal(
        mintAmount,
        "Wrong initializer token balance"
      );
    });

    it("Check Native Proxy token balance is zero", async () => {
      const proxyTokenWallet = await jetton
        .getWalletOf(proxy.address)
        .then((w) => w.getState());

      expect(proxyTokenWallet.tokenBalance).to.be.equal(
        "0",
        "Wrong Native Proxy token balance"
      );
    });
  });
});
