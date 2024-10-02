import { Ed25519KeyPair } from "nekoton-wasm";
import { Contract, toNano } from "locklift";
import { Account } from "everscale-standalone-client/nodejs";
import { expect } from "chai";

import {
  CellEncoderStandaloneAbi,
  EthereumEverscaleEventConfigurationAbi,
  EverscaleEthereumEventConfigurationAbi,
  MediatorAbi,
  MultiVaultTONEVMEventNativeAbi,
  MultiVaultEVMTONEventNativeAbi,
  ProxyMultiVaultNativeJettonAbi,
  RoundDeployerMockupAbi,
} from "../../../../build/factorySource";

import { setupBridge, setupRelays } from "../../../utils/bridge";
import { deployAccount } from "../../../utils/account";
import { logContract } from "../../../utils/logger";
import { setupNativeJettonMultiVault } from "../../../utils/multivault/native";
import {
  MediatorOperation,
  setupHiddenBridge,
} from "../../../utils/hidden-bridge";
import { EventAction, EventType, processEvent } from "../../../utils/events";
import { JettonMinter, JettonWallet } from "../../../utils/jetton";

type EventVoteDataParam = Parameters<
  Contract<EthereumEverscaleEventConfigurationAbi>["methods"]["deployEvent"]
>[0]["eventVoteData"];
type EncodeMultiVaultAlienEVMEverscaleParam = Parameters<
  Contract<CellEncoderStandaloneAbi>["methods"]["encodeMultiVaultNativeEVMEverscale"]
>[0];

describe("Test EVM-EVM bridge transfers, deposit native withdraw native token", () => {
  let relays: Ed25519KeyPair[];
  let cellEncoder: Contract<CellEncoderStandaloneAbi>;
  let staking: Contract<RoundDeployerMockupAbi>;
  let bridgeOwner: Account;
  let mediator: Contract<MediatorAbi>;

  let nativeEthereumEverscaleEventConfiguration: Contract<EthereumEverscaleEventConfigurationAbi>;
  let nativeEverscaleEthereumEventConfiguration: Contract<EverscaleEthereumEventConfigurationAbi>;
  let nativeProxy: Contract<ProxyMultiVaultNativeJettonAbi>;

  let initializer: Account;
  let jetton: JettonMinter;
  let initializerTokenWallet: JettonWallet;

  const tokenMeta = {
    name: "Custom Giga Chad",
    symbol: "CUSTOM_GIGA_CHAD",
    decimals: 9,
  };

  const mintAmount = 1000;
  const amount = 500;

  it("Setup bridge", async () => {
    relays = await setupRelays();

    [, bridgeOwner, staking, cellEncoder] = await setupBridge(relays);

    const signer = (await locklift.keystore.getSigner("0"))!;

    initializer = await deployAccount(signer, 50);

    await logContract("Initializer", initializer.address);

    [
      nativeEthereumEverscaleEventConfiguration,
      nativeEverscaleEthereumEventConfiguration,
      nativeProxy,
    ] = await setupNativeJettonMultiVault(bridgeOwner, staking);
  });

  it("Deploy native token root", async () => {
    jetton = await JettonMinter.deploy(
      bridgeOwner.address,
      {
        name: tokenMeta.name,
        symbol: tokenMeta.symbol,
        decimals: tokenMeta.decimals,
      },
      { value: toNano(1.2), bounce: true }
    );

    await logContract("Custom token root", jetton.minter);
  });

  it("Mint tokens to initializer", async () => {
    await jetton.mint(
      mintAmount,
      initializer.address,
      toNano(0.1),
      { value: 0 },
      { value: toNano(1), bounce: true }
    );

    initializerTokenWallet = await jetton.getWalletOf(initializer.address);
  });

  it("Setup mediator", async () => {
    [mediator] = await setupHiddenBridge(bridgeOwner, nativeProxy);

    await logContract("Mediator", mediator.address);
  });

  it("Send tokens to native proxy without notification", async () => {
    await initializerTokenWallet.transfer(
      amount,
      nativeProxy.address,
      { value: 1, payload: "" },
      { value: toNano(1), bounce: true }
    );
  });

  describe("Deposit native token, withdraw native token (eg WEVER ETH-BNB)", () => {
    let depositEventContract: Contract<MultiVaultEVMTONEventNativeAbi>;
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
      const nativeWithdrawalPayload = await cellEncoder.methods
        .encodeNativeJettonTransferPayloadEthereum({
          recipient: 123,
          chainId: 1,
          callback,
          name: tokenMeta.name,
          symbol: tokenMeta.symbol,
          decimals: tokenMeta.decimals,
          remainingGasTo: initializer.address,
          token: jetton.minter,
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

    it("Deploy event contract (deposit)", async () => {
      eventDataStructure = {
        token_wid: jetton.getWID(),
        token_addr: jetton.getEthAddress(),

        amount: 333,
        recipient_wid: mediator.address.toString().split(":")[0],
        recipient_addr: `0x${mediator.address.toString().split(":")[1]}`,

        value: 10000,
        expected_evers: 1000,
        payload,
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

      const tx = await nativeEthereumEverscaleEventConfiguration.methods
        .deployEvent({
          eventVoteData,
        })
        .send({
          from: initializer.address,
          amount: locklift.utils.toNano(10),
        });

      console.log(`Event initialization tx: ${tx.id.hash}`);

      const expectedEventContract =
        await nativeEthereumEverscaleEventConfiguration.methods
          .deriveEventAddress({
            eventVoteData: eventVoteData,
            answerId: 0,
          })
          .call();

      console.log(`Expected event: ${expectedEventContract.eventContract}`);

      depositEventContract = locklift.factory.getDeployedContract(
        "MultiVaultEVMTONEventNative",
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
