import { Ed25519KeyPair } from "nekoton-wasm";
import { Contract } from "locklift";
import { Account } from "everscale-standalone-client/nodejs";
import { expect } from "chai";

import {
  CellEncoderStandaloneAbi,
  EverscaleEthereumEventConfigurationAbi,
  FactorySource,
  ProxyMultiVaultAlienJettonAbi,
  RoundDeployerMockupAbi,
} from "../../../../build/factorySource";

import { setupBridge, setupRelays } from "../../../utils/bridge";
import { deployAccount } from "../../../utils/account";
import { logContract } from "../../../utils/logger";
import { setupAlienJettonMultiVault } from "../../../utils/multivault/alien";

const logger = require("mocha-logger");

describe("Test event contract behaviour when Alien token is incorrect", function () {
  this.timeout(10000000);

  let relays: Ed25519KeyPair[];
  let cellEncoder: Contract<CellEncoderStandaloneAbi>;
  let roundDeployer: Contract<RoundDeployerMockupAbi>;
  let bridgeOwner: Account;
  let everscaleEthereumEventConfiguration: Contract<EverscaleEthereumEventConfigurationAbi>;
  let initializer: Account;
  let proxy: Contract<ProxyMultiVaultAlienJettonAbi>;

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

  describe("Call proxy burn callback from arbitrary account", () => {
    const recipient = 888;
    const amount = 100;

    let eventContract: Contract<FactorySource["MultiVaultTONEVMEventAlien"]>;

    it("Call burn callback on proxy", async () => {
      const burnPayload = await cellEncoder.methods
        .encodeAlienJettonBurnPayloadEthereum({
          recipient,
          callback: {
            recipient: 0,
            payload: "",
            strict: false,
          },
          remainingGasTo: initializer.address,
        })
        .call();

      const tx = await proxy.methods
        .onAcceptTokensBurn({
          amount,
          sender: initializer.address,
          value2: initializer.address,
          value3: initializer.address,
          payload: burnPayload.value0,
        })
        .send({
          from: initializer.address,
          amount: locklift.utils.toNano(10),
        })
        .then((tx) => locklift.transactions.waitFinalized(tx))
        .then((tx) => tx.extTransaction);

      logger.log(`Burn tx: ${tx.id.hash}`);

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

    it("Check event contract rejected and relays are loaded", async () => {
      const details = await eventContract.methods
        .getDetails({ answerId: 0 })
        .call();

      expect(details._status).to.be.equal(
        "0",
        "Event contract should be Rejected"
      );
      expect(details._requiredVotes).to.be.not.equal(
        0,
        "Event contract failed to load relays"
      );
    });
  });
});
