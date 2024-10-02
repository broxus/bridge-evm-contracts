import { expect } from "chai";
import { Contract, zeroAddress } from "locklift";
import {
  BridgeAbi,
  FactorySource,
  RoundDeployerMockupAbi,
} from "../../../build/factorySource";
import { Account } from "everscale-standalone-client/nodejs";
import { setupBridge, setupRelays } from "../../utils/bridge";
import {
  setupEthereumEverscaleEventConfiguration,
  setupEverscaleEthereumEventConfiguration,
} from "../../utils/event-configurations/evm";

let bridge: Contract<BridgeAbi>;
let roundDeployer: Contract<RoundDeployerMockupAbi>;
let bridgeOwner: Account;

describe("Test setting configuration end", async function () {
  this.timeout(10000000);

  const proxy = zeroAddress;
  const emptyCell = "te6ccgEBAQEAAgAAAA==";

  it("Setup bridge", async () => {
    const relays = await setupRelays();

    [bridge, bridgeOwner, roundDeployer, ] = await setupBridge(
      relays
    );
  });

  describe("Ethereum Everscale event configuration", async () => {
    let ethereumEverscaleEventConfiguration: Contract<
      FactorySource["EthereumEverscaleEventConfiguration"]
    >;

    it("Setup Ethereum Everscale event configuration", async () => {
      ethereumEverscaleEventConfiguration =
        await setupEthereumEverscaleEventConfiguration(
          bridgeOwner,
          roundDeployer,
          proxy,
          ""
        );
    });

    it("Set Ethereum Everscale end block", async () => {
      await ethereumEverscaleEventConfiguration.methods
        .setEndBlockNumber({
          endBlockNumber: 1,
        })
        .send({
          from: bridgeOwner.address,
          amount: locklift.utils.toNano(1),
        });
    });

    it("Check Ethereum Everscale configuration end block", async () => {
      expect(
        await bridge.methods
          .active()
          .call()
          .then((t) => t.active)
      ).to.be.equal(true, "Wrong active status");

      const details = await ethereumEverscaleEventConfiguration.methods
        .getDetails({ answerId: 0 })
        .call();

      expect(details._networkConfiguration.endBlockNumber).to.be.equal(
        "1",
        "Wrong end block number"
      );
    });

    it("Set Ethereum Everscale meta", async () => {
      await ethereumEverscaleEventConfiguration.methods
        .setMeta({
          _meta: "",
        })
        .send({
          from: bridgeOwner.address,
          amount: locklift.utils.toNano(1),
        });
    });

    it("Check Ethereum Everscale configuration meta", async () => {
      const details = await ethereumEverscaleEventConfiguration.methods
        .getDetails({ answerId: 0 })
        .call();

      expect(details._meta.toString()).to.be.equal(emptyCell, "Wrong meta");
    });
  });

  describe("Everscale Ethereum event configuration", async () => {
    let everscaleEthereumEventConfiguration: Contract<
      FactorySource["EverscaleEthereumEventConfiguration"]
    >;

    it("Setup Everscale Ethereum event configuration", async () => {
      everscaleEthereumEventConfiguration =
        await setupEverscaleEthereumEventConfiguration(
          bridgeOwner,
          roundDeployer,
          proxy,
          ""
        );
    });

    it("Set Everscale Ethereum end timestamp", async () => {
      await everscaleEthereumEventConfiguration.methods
        .setEndTimestamp({
          endTimestamp: 1,
        })
        .send({
          from: bridgeOwner.address,
          amount: locklift.utils.toNano(1),
        });
    });

    it("Check Everscale Ethereum configuration end timestamp", async () => {
      const details = await everscaleEthereumEventConfiguration.methods
        .getDetails({ answerId: 0 })
        .call();

      expect(details._networkConfiguration.endTimestamp).to.be.equal(
        "1",
        "Wrong end timestamps"
      );
    });

    it("Set Everscale Ethereum meta", async () => {
      await everscaleEthereumEventConfiguration.methods
        .setMeta({
          _meta: "",
        })
        .send({
          from: bridgeOwner.address,
          amount: locklift.utils.toNano(1),
        });
    });

    it("Check Everscale Ethereum configuration meta", async () => {
      const details = await everscaleEthereumEventConfiguration.methods
        .getDetails({ answerId: 0 })
        .call();

      expect(details._meta.toString()).to.be.equal(emptyCell, "Wrong meta");
    });
  });
});
