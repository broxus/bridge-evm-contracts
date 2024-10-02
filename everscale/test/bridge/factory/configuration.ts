import { expect } from "chai";
import { Contract, zeroAddress } from "locklift";
import { FactorySource } from "../../../build/factorySource";
import { Account } from "everscale-standalone-client/nodejs";
import { setupBridge, setupRelays } from "../../utils/bridge";
import { logContract } from "../../utils/logger";

let roundDeployer: Contract<FactorySource["RoundDeployerMockup"]>;
let bridgeOwner: Account;

describe("Test configuration factory", async function () {
  this.timeout(10000000);

  it("Setup bridge", async () => {
    const relays = await setupRelays();

    [, bridgeOwner, roundDeployer, ] = await setupBridge(
      relays
    );
  });

  describe("Test Ethereum event configuration", async () => {
    let factory: Contract<
      FactorySource["EthereumEverscaleEventConfigurationFactory"]
    >;

    it("Setup Ethereum event configuration factory", async () => {
      const signer = (await locklift.keystore.getSigner("0"))!;
      const Configuration = locklift.factory.getContractArtifacts(
        "EthereumEverscaleEventConfiguration"
      );

      const _randomNonce = locklift.utils.getRandomNonce();

      const { contract: factory_ } = await locklift.factory.deployContract({
        contract: "EthereumEverscaleEventConfigurationFactory",
        constructorParams: {
          _configurationCode: Configuration.code,
        },
        initParams: {
          _randomNonce,
        },
        publicKey: signer.publicKey,
        value: locklift.utils.toNano(1),
      });

      await logContract("factory address", factory_.address);

      factory = factory_;
    });

    let configuration: Contract<
      FactorySource["EthereumEverscaleEventConfiguration"]
    >;

    it("Deploy configuration", async () => {
      const EthereumEvent = locklift.factory.getContractArtifacts(
        "TokenTransferEthereumEverscaleEvent"
      );

      const basicConfiguration = {
        eventABI: "",
        eventInitialBalance: locklift.utils.toNano("2"),
        roundDeployer: roundDeployer.address,
        eventCode: EthereumEvent.code,
      };

      const networkConfiguration = {
        chainId: 12,
        eventEmitter: 0,
        eventBlocksToConfirm: 1,
        proxy: zeroAddress,
        startBlockNumber: 0,
        endBlockNumber: 0,
      };

      await factory.methods
        .deploy({
          _owner: bridgeOwner.address,
          _flags: 0,
          basicConfiguration,
          networkConfiguration,
        })
        .send({
          from: bridgeOwner.address,
          amount: locklift.utils.toNano(2),
        });

      const ethereumEverscaleEventConfigurationAddress = await factory.methods
        .deriveConfigurationAddress({
          basicConfiguration,
          networkConfiguration,
        })
        .call();

      configuration = locklift.factory.getDeployedContract(
        "EthereumEverscaleEventConfiguration",
        ethereumEverscaleEventConfigurationAddress.value0
      );

      await logContract("configuration address", configuration.address);
    });

    it("Check configuration", async () => {
      const details = await configuration.methods
        .getDetails({ answerId: 0 })
        .call();

      expect(details._basicConfiguration.roundDeployer.toString()).to.be.equal(
        roundDeployer.address.toString(),
        "Wrong round deployer"
      );
      expect(details._networkConfiguration.chainId.toString()).to.be.equal(
        "12",
        "Wrong chain ID"
      );
    });
  });
});
