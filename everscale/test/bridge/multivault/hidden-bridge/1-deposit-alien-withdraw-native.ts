import { Ed25519KeyPair } from "nekoton-wasm";
import { Contract } from "locklift";
import { Account } from "everscale-standalone-client/nodejs";
import { expect } from "chai";

import {
  CellEncoderStandaloneAbi,
  EthereumEverscaleEventConfigurationAbi,
  EverscaleEthereumEventConfigurationAbi,
  MediatorAbi,
  MultiVaultTONEVMEventNativeAbi,
  MultiVaultEVMTONEventAlienAbi,
  ProxyMultiVaultNativeJettonAbi,
  RoundDeployerMockupAbi,
  ProxyMultiVaultAlienJettonAbi,
} from "../../../../build/factorySource";

import { EventAction, EventType, processEvent } from "../../../utils/events";
import { setupBridge, setupRelays } from "../../../utils/bridge";
import { deployAccount } from "../../../utils/account";
import { logContract } from "../../../utils/logger";
import { setupAlienJettonMultiVault } from "../../../utils/multivault/alien";
import {
  MediatorOperation,
  setupHiddenBridge,
} from "../../../utils/hidden-bridge";
import { setupNativeJettonMultiVault } from "../../../utils/multivault/native";

type EventVoteDataParam = Parameters<
  Contract<EthereumEverscaleEventConfigurationAbi>["methods"]["deployEvent"]
>[0]["eventVoteData"];
type EncodeMultiVaultAlienEVMEverscaleParam = Parameters<
  Contract<CellEncoderStandaloneAbi>["methods"]["encodeMultiVaultAlienEVMEverscale"]
>[0];

describe("Test EVM-EVM bridge transfers, deposit alien withdraw native token", () => {
  let relays: Ed25519KeyPair[];
  let cellEncoder: Contract<CellEncoderStandaloneAbi>;
  let staking: Contract<RoundDeployerMockupAbi>;
  let bridgeOwner: Account;

  let mediator: Contract<MediatorAbi>;

  let alienEthereumEverscaleEventConfiguration: Contract<EthereumEverscaleEventConfigurationAbi>;
  let initializer: Account;

  let nativeEverscaleEthereumEventConfiguration: Contract<EverscaleEthereumEventConfigurationAbi>;
  let nativeProxy: Contract<ProxyMultiVaultNativeJettonAbi>;
  let alienProxy: Contract<ProxyMultiVaultAlienJettonAbi>;

  const alienTokenBase = {
    chainId: 111,
    token: 222,
  };

  const alienTokenMeta = {
    name: "Giga Chad",
    symbol: "GIGA_CHAD",
    decimals: 6,
  };

  it("Setup bridge", async () => {
    relays = await setupRelays();
    [, bridgeOwner, staking, cellEncoder] = await setupBridge(relays);

    const signer = (await locklift.keystore.getSigner("0"))!;

    initializer = await deployAccount(signer, 50);
    await logContract("Initializer", initializer.address);
  });

  it("Setup alien pipeline", async () => {
    [
      alienEthereumEverscaleEventConfiguration,
      ,
      alienProxy,
    ] = await setupAlienJettonMultiVault(bridgeOwner, staking);
  });

  it("Setup native pipeline", async () => {
    [
      ,
      nativeEverscaleEthereumEventConfiguration,
      nativeProxy,
    ] = await setupNativeJettonMultiVault(bridgeOwner, staking);
  });

  it("Setup mediator", async () => {
    [mediator] = await setupHiddenBridge(bridgeOwner, nativeProxy);

    await logContract("Mediator", mediator.address);
  });

  describe("Deposit Alien token, withdraw Native (WBNB BNB -> FTM)", () => {
    let depositEventContract: Contract<MultiVaultEVMTONEventAlienAbi>;
    let withdrawEventContract: Contract<MultiVaultTONEVMEventNativeAbi>;

    let eventDataStructure: EncodeMultiVaultAlienEVMEverscaleParam;
    let eventVoteData: EventVoteDataParam;

    let eventDataEncoded: string;

    const callback = {
      recipient: 123,
      strict: false,
      payload: "",
    };

    let payload: string;

    it("Build withdrawal payload", async () => {
      const jetton = await alienProxy.methods
        .deriveEVMAlienTokenRoot({
          answerId: 0,
          name: alienTokenMeta.name,
          symbol: alienTokenMeta.symbol,
          decimals: alienTokenMeta.decimals,
          chainId: alienTokenBase.chainId,
          token: alienTokenBase.token,
        })
        .call()
        .then((a) => a.value0);

      const nativeWithdrawalPayload = await cellEncoder.methods
        .encodeNativeJettonTransferPayloadEthereum({
          recipient: 123,
          chainId: 1,
          callback,
          name: alienTokenMeta.name,
          symbol: alienTokenMeta.symbol,
          decimals: alienTokenMeta.decimals,
          remainingGasTo: initializer.address,
          token: jetton,
        })
        .call()
        .then((t) => t.value0);

      payload = await cellEncoder.methods
        .encodeMediatorPayload({
          operation: MediatorOperation.TransferToNativeProxy,
          proxy: nativeProxy.address,
          payload: nativeWithdrawalPayload,
        })
        .call()
        .then((t) => t.value0);
    });

    it("Deploy", async () => {
      eventDataStructure = {
        base_chainId: alienTokenBase.chainId,
        base_token: alienTokenBase.token,
        ...alienTokenMeta,

        amount: 333,
        recipient_wid: mediator.address.toString().split(":")[0],
        recipient_addr: `0x${mediator.address.toString().split(":")[1]}`,

        value: 10000,
        expected_evers: 1000,
        payload,
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

      const tx = await alienEthereumEverscaleEventConfiguration.methods
        .deployEvent({ eventVoteData })
        .send({
          from: initializer.address,
          amount: locklift.utils.toNano(10),
        });

      console.log(`Event initialization tx: ${tx.id.hash}`);

      const expectedEventContract =
        await alienEthereumEverscaleEventConfiguration.methods
          .deriveEventAddress({
            eventVoteData: eventVoteData,
            answerId: 0,
          })
          .call();

      console.log(`Expected event: ${expectedEventContract.eventContract}`);

      depositEventContract = locklift.factory.getDeployedContract(
        "MultiVaultEVMTONEventAlien",
        expectedEventContract.eventContract
      );
    });

    it("Confirm event", async () => {
      await processEvent(
        relays,
        depositEventContract.address,
        EventType.EthereumEverscale,
        EventAction.Confirm
      );
    });

    it("Check withdraw event contract deployed", async () => {
      const events = await nativeEverscaleEthereumEventConfiguration
        .getPastEvents({ filter: "NewEventContract" as const })
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

      console.log(`Expected event address: ${expectedEventContract}`);

      withdrawEventContract = locklift.factory.getDeployedContract(
        "MultiVaultTONEVMEventNative",
        expectedEventContract
      );
    });

    it("Check event contract nonce", async () => {
      const { nonce: depositNonce } = await depositEventContract.methods
        .nonce({})
        .call();

      const { nonce: withdrawNonce } = await withdrawEventContract.methods
        .nonce({})
        .call();

      expect(depositNonce).to.be.equal(
        withdrawNonce,
        "Wrong deposit and withdraw nonces"
      );
    });

    it("Check withdraw event sender", async () => {
      const { sender } = await withdrawEventContract.methods.sender({}).call();

      expect(sender.toString()).to.be.equal(
        mediator.address.toString(),
        "Withdraw sender should be mediator"
      );
    });
  });
});
