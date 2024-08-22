import { Contract, zeroAddress } from "locklift";
import { Ed25519KeyPair } from "nekoton-wasm";
import { Account } from "everscale-standalone-client/nodejs";
import { expect } from "chai";

import {
  CellEncoderStandaloneAbi,
  EthereumEverscaleEventConfigurationAbi,
  MergeRouterAbi,
  MultiVaultEVMTONEventAlienAbi,
  ProxyMultiVaultAlienJettonAbi,
  RoundDeployerMockupAbi,
} from "../../../../build/factorySource";

import { setupBridge, setupRelays } from "../../../utils/bridge";
import { setupAlienJettonMultiVault } from "../../../utils/multivault/alien";
import { deployAccount } from "../../../utils/account";
import { logContract } from "../../../utils/logger";
import { EventAction, EventType, processEvent } from "../../../utils/events";
import { JettonMinter } from "../../../utils/jetton";

const logger = require("mocha-logger");

type EventVoteDataParam = Parameters<
  Contract<EthereumEverscaleEventConfigurationAbi>["methods"]["deployEvent"]
>[0]["eventVoteData"];
type EncodeMultiVaultAlienEVMEverscaleParam = Parameters<
  Contract<CellEncoderStandaloneAbi>["methods"]["encodeMultiVaultAlienEVMEverscale"]
>[0];

describe("Deposit Alien jetton to TON with no merging", function () {
  this.timeout(10000000);

  let relays: Ed25519KeyPair[];
  let cellEncoder: Contract<CellEncoderStandaloneAbi>;
  let roundDeployer: Contract<RoundDeployerMockupAbi>;
  let bridgeOwner: Account;

  let ethereumEverscaleEventConfiguration: Contract<EthereumEverscaleEventConfigurationAbi>;
  let initializer: Account;
  let proxy: Contract<ProxyMultiVaultAlienJettonAbi>;

  let jetton: JettonMinter;
  let mergeRouter: Contract<MergeRouterAbi>;

  const alienTokenBase = {
    chainId: 111,
    token: 222,
  };

  const tokenMeta = {
    name: "Giga Chad",
    symbol: "GIGA_CHAD",
    decimals: 6,
  };

  it("Setup bridge", async () => {
    let bridge, everscaleEthereumEventConfiguration;

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
    ] = await setupAlienJettonMultiVault(bridgeOwner, roundDeployer);

    await logContract(
      "EverscaleEthereumEventConfiguration",
      everscaleEthereumEventConfiguration.address
    );
  });

  describe("Transfer alien jetton from EVM to TON", () => {
    let eventContract: Contract<MultiVaultEVMTONEventAlienAbi>;
    let eventDataStructure: EncodeMultiVaultAlienEVMEverscaleParam;
    let eventVoteData: EventVoteDataParam;
    let eventDataEncoded: string;

    it("Initialize event", async () => {
      eventDataStructure = {
        base_chainId: alienTokenBase.chainId,
        base_token: alienTokenBase.token,
        ...tokenMeta,

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

      const tx = await ethereumEverscaleEventConfiguration.methods
        .deployEvent({ eventVoteData })
        .send({
          from: initializer.address,
          amount: locklift.utils.toNano(3),
        });

      logger.log(`Event initialization tx: ${tx.id}`);

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
      const state = await locklift.provider
        .getFullContractState({ address: eventContract.address })
        .then((s) => s.state!);

      expect(state.isDeployed).to.be.true;
    });

    it("Check event state before confirmation", async () => {
      const details = await eventContract.methods
        .getDetails({ answerId: 0 })
        .call();

      expect(
        details._eventInitData.voteData.eventTransaction.toString()
      ).to.be.equal(
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

      expect(
        details._eventInitData.voteData.eventBlockNumber.toString()
      ).to.be.equal(
        eventVoteData.eventBlockNumber.toString(),
        "Wrong event block number"
      );

      expect(details._eventInitData.voteData.eventBlock.toString()).to.be.equal(
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

    it("Check event initialization pipeline passed", async () => {
      const decodedData = await eventContract.methods
        .getDecodedData({ answerId: 0 })
        .call();

      expect(decodedData.proxy_).to.not.be.equal(
        zeroAddress.toString(),
        "Event contract failed to fetch the proxy"
      );
      expect(decodedData.token_).to.not.be.equal(
        zeroAddress.toString(),
        "Event contract failed to fetch the token"
      );
    });

    it("Fetch alien jetton", async () => {
      const tokenAddress = await proxy.methods
        .deriveEVMAlienTokenRoot({
          answerId: 0,
          chainId: eventDataStructure.base_chainId,
          token: eventDataStructure.base_token,
          name: eventDataStructure.name,
          symbol: eventDataStructure.symbol,
          decimals: eventDataStructure.decimals,
        })
        .call();

      jetton = new JettonMinter(tokenAddress.value0, proxy.address);

      await logContract("Alien jetton", jetton.minter);
    });

    it("Check alien jetton exists", async () => {
      const state = await jetton.getState();

      expect(+state.balance).to.be.greaterThan(
        0,
        "Alien token root balance is zero"
      );
    });

    it("Check alien jetton meta", async () => {
      const state = await jetton.getState();

      expect(state.chainId).to.be.equal(
        eventDataStructure.base_chainId.toString(),
        "Wrong alien token base chain id"
      );
      expect(state.baseToken).to.be.equal(
        eventDataStructure.base_token.toString(),
        "Wrong alien token base token"
      );
      expect(state.name).to.be.equal(
        eventDataStructure.name,
        "Wrong alien token name"
      );
      expect(state.symbol).to.be.equal(
        eventDataStructure.symbol,
        "Wrong alien token symbol"
      );
      expect(state.decimals).to.be.equal(
        eventDataStructure.decimals.toString(),
        "Wrong alien token decimals"
      );
      expect(state.admin.toString()).to.be.equal(
        proxy.address.toString(),
        "Wrong alien token owner"
      );
    });

    it("Fetch merge router", async () => {
      const mergeRouterAddress = await proxy.methods
        .deriveMergeRouter({
          token: jetton.minter,
          answerId: 0,
        })
        .call();

      mergeRouter = locklift.factory.getDeployedContract(
        "MergeRouter",
        mergeRouterAddress.router
      );

      await logContract("Merge router", mergeRouter.address);
    });

    it("Check merge router exists", async () => {
      const state = await locklift.provider
        .getFullContractState({ address: mergeRouter.address })
        .then((s) => s.state!);

      expect(state.isDeployed).to.be.true;
    });

    it("Check merge router data", async () => {
      const details = await mergeRouter.methods
        .getDetails({
          answerId: 0,
        })
        .call();

      expect(details._proxy.toString()).to.be.equal(
        proxy.address.toString(),
        "Wrong proxy address in merge router"
      );
      expect(details._token.toString()).to.be.equal(
        jetton.minter.toString(),
        "Wrong token address in merge router"
      );
      expect(details._pool.toString()).to.be.equal(
        zeroAddress.toString(),
        "Wrong pool address in merge router"
      );

      expect(
        await mergeRouter.methods
          .owner()
          .call()
          .then((t) => t.owner.toString())
      ).to.be.equal(
        await proxy.methods
          .owner()
          .call()
          .then((t) => t.owner.toString()),
        "Wrong router owner"
      );
      expect(
        await mergeRouter.methods
          .manager()
          .call()
          .then((t) => t.manager.toString())
      ).to.be.equal(
        await proxy.methods
          .manager()
          .call()
          .then((t) => t.manager.toString()),
        "Wrong router manager"
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

    it("Check event round number", async () => {
      const roundNumber = await eventContract.methods.round_number({}).call();

      expect(parseInt(roundNumber.round_number, 10)).to.be.equal(
        0,
        "Wrong round number"
      );
    });

    describe("Confirm event", () => {
      it("Confirm event enough times", async () => {
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

      it("Check total supply", async () => {
        const state = await jetton.getState();

        expect(Number(state.supply)).to.be.equal(
          eventDataStructure.amount,
          "Wrong total supply"
        );
      });

      it("Check initializer jetton wallet exists", async () => {
        const walletData = await jetton
          .getWalletOf(initializer.address)
          .then((w) => w.getState());

        expect(Number(walletData.balance)).to.be.greaterThan(
          0,
          "Initializer token wallet balance is zero"
        );
      });

      it("Check initializer received tokens", async () => {
        const walletData = await jetton
          .getWalletOf(initializer.address)
          .then((w) => w.getState());

        expect(Number(walletData.tokenBalance)).to.be.equal(
          eventDataStructure.amount,
          "Initializer failed to received tokens"
        );
      });
    });
  });
});
