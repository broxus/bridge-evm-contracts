import { FactorySource } from "../../build/factorySource";
import { Address, Contract } from "locklift";
import { Account } from "everscale-standalone-client/nodejs";
import { expect } from "chai";
import { deployAccount } from "../utils/account";
import { tryIncreaseTime } from "../utils/time";

const logger = require("mocha-logger");
const BigNumber = require("bignumber.js");

let roundDeployer: Contract<FactorySource["RoundDeployer"]>;

let roundDeployerOwner: Account;

const DEV_WAIT = 100000;

const RELAY_ROUND_TIME_1 = 10;
const TIME_BEFORE_SET_RELAYS = 9;
const MIN_GAP_TIME = 1;
const MIN_RELAYS = 2;

const TON_KEYS = [
  "12202829195568081425422423948260124242852019668395881766986444912393070385856",
  "35299156567745706574440009662361191298400949783911632401697819217547604473700",
];
const ETH_KEYS = [
  "425968158123259842990157992722812706339536905173",
  "140753720155491120018711504417491442525636555630",
];

describe("Test Relay round mechanic", async function () {
  this.timeout(10000000);

  const getBalance = async function (address: Address) {
    const res = await locklift.provider.getBalance(address);
    return new BigNumber(res);
  };

  const setRelaysOnNewRound = async function (
    _user: Account,
    _eth_keys: string[],
    _ton_keys: string[]
  ) {
    return roundDeployer.methods
      .setRelaysOnNewRound({ eth_keys: _eth_keys, ton_keys: _ton_keys })
      .send({ from: _user.address, amount: locklift.utils.toNano(12) });
  };

  const getRelayRound = async function (round_num: number) {
    const addr = await roundDeployer.methods
      .getRelayRoundAddress({
        round_num: round_num,
        answerId: 0,
      })
      .call();

    return locklift.factory.getDeployedContract("RelayRound", addr.value0);
  };

  const waitForDeploy = async function (address: Address) {
    return await getBalance(address);
  };

  describe("Setup contracts", async function () {
    describe("Admin", async function () {
      it("Deploy admin", async function () {
        const signer = (await locklift.keystore.getSigner("3"))!;
        roundDeployerOwner = await deployAccount(signer, 1000);
      });
    });

    describe("Rounds", async function () {
      it("Deploy roundDeployer", async function () {
        const signer = (await locklift.keystore.getSigner("0"))!;

        const { contract: ton_config_mockup } =
          await locklift.factory.deployContract({
            contract: "TonConfigMockup",
            constructorParams: {},
            initParams: { nonce: locklift.utils.getRandomNonce() },
            publicKey: signer.publicKey,
            value: locklift.utils.toNano(1),
          });

        const { contract: sol_config_mockup } =
          await locklift.factory.deployContract({
            contract: "SolConfigMockup",
            constructorParams: {},
            initParams: { nonce: locklift.utils.getRandomNonce() },
            publicKey: signer.publicKey,
            value: locklift.utils.toNano(1),
          });

        const contract = await locklift.factory.deployContract({
          contract: "RoundDeployer",
          constructorParams: {
            _admin: roundDeployerOwner.address,
            _bridge_event_config_ton_eth: ton_config_mockup.address,
            _bridge_event_config_ton_sol: sol_config_mockup.address,
          },
          initParams: {
            deploy_nonce: locklift.utils.getRandomNonce(),
          },
          publicKey: signer.publicKey,
          value: locklift.utils.toNano(50),
        });
        roundDeployer = contract.contract;

        logger.log(`RoundDeployer address: ${roundDeployer.address}`);
        logger.log(
          `RoundDeployer owner address: ${roundDeployerOwner.address}`
        );
      });

      it("Installing codes", async function () {
        const RelayRound = await locklift.factory.getContractArtifacts(
          "RelayRound"
        );
        const Platform = await locklift.factory.getContractArtifacts(
          "Platform"
        );

        logger.log(`Installing Platform code`);
        await roundDeployer.methods
          .installPlatformOnce({
            code: Platform.code,
            send_gas_to: roundDeployerOwner.address,
          })
          .send({
            from: roundDeployerOwner.address,
            amount: locklift.utils.toNano(11),
          });

        logger.log(`Installing RelayRound code`);
        await roundDeployer.methods
          .installOrUpdateRelayRoundCode({
            code: RelayRound.code,
            send_gas_to: roundDeployerOwner.address,
          })
          .send({
            from: roundDeployerOwner.address,
            amount: locklift.utils.toNano(11),
          });
        logger.log(`Set staking to Active`);
        await roundDeployer.methods
          .setActive({
            new_active: true,
            send_gas_to: roundDeployerOwner.address,
          })
          .send({
            from: roundDeployerOwner.address,
            amount: locklift.utils.toNano(11),
          });

        if (locklift.context.network.name === "dev") {
          await tryIncreaseTime(DEV_WAIT);
        }

        await tryIncreaseTime(DEV_WAIT);

        const active = await roundDeployer.methods
          .isActive({ answerId: 0 })
          .call()
          .then((t) => t.value0);
        expect(active).to.be.equal(true, "Staking not active");
      });

      it("Setting relay config for testing", async function () {
        // super minimal relay config for local testing
        await roundDeployer.methods
          .setRelayConfig({
            new_relay_config: {
              relayRoundTime: RELAY_ROUND_TIME_1,
              timeBeforeSetRelays: TIME_BEFORE_SET_RELAYS,
              minRelaysCount: MIN_RELAYS,
              minRoundGapTime: MIN_GAP_TIME,
            },
            send_gas_to: roundDeployerOwner.address,
          })
          .send({
            from: roundDeployerOwner.address,
            amount: locklift.utils.toNano(11),
          });

        if (locklift.context.network.name === "dev") {
          await tryIncreaseTime(DEV_WAIT);
        }

        await tryIncreaseTime(DEV_WAIT);

        const relay_config = await roundDeployer.methods
          .getRelayConfig({ answerId: 0 })
          .call()
          .then((t) => t.value0);
        expect(relay_config.minRelaysCount.toString()).to.be.equal(
          MIN_RELAYS.toString(),
          "Relay config not installed"
        );
      });
    });
  });

  describe("Relay pipeline testing", async function () {
    describe("Standard case", async function () {
      it("Creating origin relay round", async function () {
        await setRelaysOnNewRound(roundDeployerOwner, ETH_KEYS, TON_KEYS);

        // await tryIncreaseTime(500);

        await tryIncreaseTime(1000);

        const round = await getRelayRound(0);
        await waitForDeploy(round.address);
        if (locklift.context.network.name === "dev") {
          await tryIncreaseTime(DEV_WAIT);
        }

        await tryIncreaseTime(DEV_WAIT);

        const events = await roundDeployer
          .getPastEvents({ filter: "RelayRoundInitialized" })
          .then((e) => e.events);
        const [
          {
            data: {
              round_num: _round_num,
              round_start_time: _round_start_time,
              round_end_time: _round_end_time,
              relays_count: _relays_count,
              round_addr: _round_address,
            },
          },
        ] = events;

        expect(_round_address.toString()).to.be.equal(
          round.address.toString(),
          "Wrong round address"
        );

        expect(_round_num.toString()).to.be.equal("0", "Bad event");

        expect(_relays_count.toString()).to.be.equal(
          TON_KEYS.length.toString(),
          "Relay creation fail - relays count"
        );
        expect(Number(_round_start_time) + RELAY_ROUND_TIME_1).to.be.equal(
          Number(_round_end_time),
          "Wrong relay round time"
        );
      });

      it("New round initialized", async function () {
        // await tryIncreaseTime(3000);
        await tryIncreaseTime(9000);

        const stakingFields = await roundDeployer
          .getFields()
          .then((res) => res.fields!);

        const { traceTree } = await locklift.tracing.trace(
          setRelaysOnNewRound(roundDeployerOwner, ETH_KEYS, TON_KEYS)
        );

        const tonDeployCalls = traceTree?.findCallsForContract({
          contract: locklift.factory.getDeployedContract(
            "TonConfigMockup",
            stakingFields.base_details.bridge_event_config_ton_eth
          ),
          name: "deployEvent" as const,
        });
        const solDeployCalls = traceTree?.findCallsForContract({
          contract: locklift.factory.getDeployedContract(
            "SolConfigMockup",
            stakingFields.bridge_event_config_ton_sol
          ),
          name: "deployEvent" as const,
        });
        expect(tonDeployCalls?.length).to.be.equal(
          1,
          "Failed ton deployEvent call"
        );
        expect(solDeployCalls?.length).to.be.equal(
          1,
          "Failed sol deployEvent call"
        );
      });
    });

    describe("Late round start", async function () {
      it("Set relays too late", async function () {
        // make sure current round ends after prev round end
        await tryIncreaseTime(RELAY_ROUND_TIME_1 * 3 * 1000);

        const root_round_details = await roundDeployer.methods
          .getRelayRoundsDetails({ answerId: 0 })
          .call()
          .then((t) => t.value0);

        await locklift.transactions.waitFinalized(
          setRelaysOnNewRound(roundDeployerOwner, ETH_KEYS, TON_KEYS)
        );

        const events = await roundDeployer
          .getPastEvents({ filter: "RelayRoundInitialized" })
          .then((e) => e.events);
        const [
          {
            data: {
              round_num: _round_num1,
              round_start_time: _round_start_time,
              round_end_time: _round_end_time,
            },
          },
        ] = events;

        const root_round_details_1 = await roundDeployer.methods
          .getRelayRoundsDetails({ answerId: 0 })
          .call()
          .then((t) => t.value0);
        expect(
          Number(root_round_details_1.currentRelayRoundStartTime)
        ).to.be.gt(
          Number(root_round_details.currentRelayRoundEndTime),
          "Bad new round start time"
        );
        expect(Number(root_round_details_1.currentRelayRound)).to.be.equal(
          Number(root_round_details.currentRelayRound) + 1,
          "Bad new round number"
        );
        expect(_round_start_time).to.be.equal(
          root_round_details_1.currentRelayRoundStartTime,
          "Bad event, wrong start time"
        );
        expect(_round_end_time).to.be.equal(
          root_round_details_1.currentRelayRoundEndTime,
          "Bad event, wrong end time"
        );
        expect(_round_num1).to.be.equal(
          root_round_details_1.currentRelayRound,
          "Bad event, wrong round number"
        );
      });
    });
  });
});
