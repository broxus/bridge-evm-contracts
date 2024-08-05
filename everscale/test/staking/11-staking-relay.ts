export {};

import {FactorySource} from "../../build/factorySource";
import {Address, Contract, Signer} from "locklift";
import {Account} from "everscale-standalone-client/nodejs";
import {expect} from "chai";


import {deployAccount} from "../utils/account";
import {
    deployTokenRoot,
    depositTokens,
    mintTokens
} from "../utils/token";
import {tryIncreaseTime} from "../utils/time";


const logger = require("mocha-logger");
const BigNumber = require("bignumber.js");

let stakingRoot: Contract<FactorySource["StakingV1_2"]>;
let stakingToken: Contract<FactorySource["TokenRoot"]>;
let stakingWallet: Contract<FactorySource["TokenWallet"]>;

let user1: Account;
let user1Data: Contract<FactorySource["UserData"]>;
let user2: Account;
let user2Data: Contract<FactorySource["UserData"]>;
let user3: Account;
let user3Data: Contract<FactorySource["UserData"]>;
let stakingOwner: Account;
let userTokenWallet1: Contract<FactorySource["TokenWallet"]>;
let userTokenWallet2: Contract<FactorySource["TokenWallet"]>;
let userTokenWallet3: Contract<FactorySource["TokenWallet"]>;
let ownerWallet: Contract<FactorySource["TokenWallet"]>;
let userInitialTokenBal = 100000;
let rewardTokensBal = 10000;
let userDeposit = 100;

const DEV_WAIT = 100000;

const RELAY_ROUND_TIME_1 = 10;
const TIME_BEFORE_SET_RELAYS = 9;
const MIN_GAP_TIME = 1;
const MIN_RELAYS = 2;
const RELAY_INITIAL_DEPOSIT = 500;

const TON_KEYS = [
    '12202829195568081425422423948260124242852019668395881766986444912393070385856',
    '35299156567745706574440009662361191298400949783911632401697819217547604473700',
];
const ETH_KEYS = [
    '425968158123259842990157992722812706339536905173',
    '140753720155491120018711504417491442525636555630'
];

describe("Test Staking Relay mechanic", async function () {
    this.timeout(10000000);

    const checkTokenBalances = async function (
        userTokenWallet: Contract<FactorySource["TokenWallet"]>,
        userAccount: Contract<FactorySource["UserData"]>,
        pool_wallet_bal: number,
        pool_bal: number,
        pool_reward_bal: number,
        user_bal: number,
        user_data_bal: number
    ) {
        const staking_details = await stakingRoot.methods
            .getDetails({answerId: 0})
            .call()
            .then((v) => v.value0);

        const _pool_wallet_bal = await stakingWallet.methods
            .balance({answerId: 0})
            .call()
            .then((v) => v.value0);
        const _pool_bal = staking_details.tokenBalance;
        const _pool_reward_bal = staking_details.rewardTokenBalance;

        const _user_bal = await userTokenWallet.methods
            .balance({answerId: 0})
            .call()
            .then((t) => t.value0);
        const user_data = await userAccount.methods
            .getDetails({answerId: 0})
            .call();
        const _user_data_bal = user_data.value0.token_balance;

        expect(_pool_wallet_bal).to.be.equal(
            pool_wallet_bal.toString(),
            "Pool wallet balance bad"
        );
        expect(_pool_bal.toString()).to.be.equal(
            pool_bal.toString(),
            "Pool balance bad"
        );
        expect(_pool_reward_bal.toString()).to.be.equal(
            pool_reward_bal.toString(),
            "Pool reward balance bad"
        );
        expect(_user_bal.toString()).to.be.equal(
            user_bal.toString(),
            "User balance bad"
        );
        expect(_user_data_bal.toString()).to.be.equal(
            user_data_bal.toString(),
            "User data balance bad"
        );
    };

    const getBalance = async function (address: Address) {
        const res = await locklift.provider.getBalance(address);
        return new BigNumber(res);
    };

    const setRelaysOnNewRound = async function (_user: Account, _eth_keys: string[], _ton_keys: string[]) {
        return await stakingRoot.methods
            .setRelaysOnNewRound({eth_keys: _eth_keys, ton_keys: _ton_keys})
            .send({from: _user.address, amount: locklift.utils.toNano(12)});
    };

    const getRelayRound = async function (round_num: number) {
        const addr = await stakingRoot.methods
            .getRelayRoundAddress({
                round_num: round_num,
                answerId: 0,
            })
            .call();
        const round = await locklift.factory.getDeployedContract(
            "RelayRound",
            addr.value0
        );
        return round;
    };


    const setEmergency = async function () {
        return await stakingRoot.methods
            .setEmergency({
                _emergency: true,
                send_gas_to: stakingOwner.address,
            })
            .send({
                from: stakingOwner.address,
                amount: locklift.utils.toNano(11),
            });
    };

    const withdrawTokens = async function (
        user: Account,
        withdraw_amount: number
    ) {
        return await stakingRoot.methods
            .withdraw({
                amount: withdraw_amount,
                send_gas_to: user.address,
            })
            .send({
                from: user.address,
                amount: locklift.utils.toNano(11),
            });
    };

    const withdrawEmergency = async function (amount: number, all: any) {
        return await stakingRoot.methods
            .withdrawTokensEmergency({
                amount: amount,
                receiver: stakingOwner.address,
                all: all,
                send_gas_to: stakingOwner.address,
            })
            .send({
                from: stakingOwner.address,
                amount: locklift.utils.toNano(11),
            });
    };

    const getUserDataAccount = async function (_user: Account) {
        const userData = await locklift.factory.getDeployedContract(
            "UserData",
            await stakingRoot.methods
                .getUserDataAddress({
                    user: _user.address,
                    answerId: 0,
                })
                .call()
                .then((t) => t.value0)
        );
        return userData;
    };

    const waitForDeploy = async function (address: Address) {
        return await getBalance(address);
    };

    describe("Setup contracts", async function () {
        describe("Token", async function () {
            it("Deploy admin", async function () {
                const signer = (await locklift.keystore.getSigner("3"))!;
                stakingOwner = await deployAccount(signer, RELAY_INITIAL_DEPOSIT + 100);
            });

            it("Deploy root", async function () {
                stakingToken = await deployTokenRoot("Farm token", "FT", 9, stakingOwner.address);
            });
        });

        describe("Users", async function () {
            it("Deploy users accounts", async function () {
                let users = [];
                for (const i of [0, 1, 2]) {
                    const keyPair = await locklift.keystore.getSigner(i.toString());
                    const account = await deployAccount(
                        keyPair as Signer,
                        RELAY_INITIAL_DEPOSIT + 50
                    );
                    logger.log(`User address: ${account.address}`);
                    users.push(account);
                }
                [user1, user2, user3] = users;
            });

            it("Deploy users token wallets + mint", async function () {
                [userTokenWallet1, userTokenWallet2, userTokenWallet3, ownerWallet] =
                    await mintTokens(
                        stakingOwner,
                        [user1, user2, user3, stakingOwner],
                        stakingToken,
                        userInitialTokenBal
                    );

                const balance1 = await userTokenWallet1.methods
                    .balance({answerId: 0})
                    .call()
                    .then((t) => parseInt(t.value0, 10));

                const balance2 = await userTokenWallet2.methods
                    .balance({answerId: 0})
                    .call()
                    .then((t) => parseInt(t.value0, 10));

                const balance3 = await userTokenWallet3.methods
                    .balance({answerId: 0})
                    .call()
                    .then((t) => parseInt(t.value0, 10));

                const balance4 = await ownerWallet.methods
                    .balance({answerId: 0})
                    .call()
                    .then((t) => parseInt(t.value0, 10));

                expect(balance1).to.be.equal(
                    userInitialTokenBal,
                    "User ton token wallet empty"
                );
                expect(balance2).to.be.equal(
                    userInitialTokenBal,
                    "User ton token wallet empty"
                );
                expect(balance3).to.be.equal(
                    userInitialTokenBal,
                    "User ton token wallet empty"
                );
                expect(balance4).to.be.equal(
                    userInitialTokenBal,
                    "User ton token wallet empty"
                );
            });
        });

        describe("Staking", async function () {

            it("Deploy staking", async function () {
                const signer = (await locklift.keystore.getSigner("0"))!;

                const {contract: ton_config_mockup} =
                    await locklift.factory.deployContract({
                        contract: "TonConfigMockup",
                        constructorParams: {},
                        initParams: {nonce: locklift.utils.getRandomNonce()},
                        publicKey: signer.publicKey,
                        value: locklift.utils.toNano(1),
                    });

                const {contract: sol_config_mockup} =
                    await locklift.factory.deployContract({
                        contract: "SolConfigMockup",
                        constructorParams: {},
                        initParams: {nonce: locklift.utils.getRandomNonce()},
                        publicKey: signer.publicKey,
                        value: locklift.utils.toNano(1),
                    });

                const stakingRootData = await locklift.factory.getContractArtifacts(
                    "StakingV1_2"
                );
                const {contract: stakingRootDeployer} =
                    await locklift.factory.deployContract({
                        contract: "StakingRootDeployer",
                        constructorParams: {},
                        initParams: {
                            nonce: locklift.utils.getRandomNonce(),
                            stakingCode: stakingRootData.code,
                        },
                        publicKey: signer.publicKey,
                        value: locklift.utils.toNano(50),
                    });

                logger.log(`Deploying stakingRoot`);
                const addr = await stakingRootDeployer.methods
                    .deploy({
                        _admin: stakingOwner.address,
                        _tokenRoot: stakingToken.address,
                        _rewarder: stakingOwner.address,
                        _rescuer: stakingOwner.address,
                        _bridge_event_config_eth_ton: stakingOwner.address,
                        _bridge_event_config_ton_eth: ton_config_mockup.address,
                        _bridge_event_config_ton_sol: sol_config_mockup.address,
                        _deploy_nonce: locklift.utils.getRandomNonce(),
                    })
                    .sendExternal({
                        publicKey: signer.publicKey,
                    });
                stakingRoot = await locklift.factory.getDeployedContract(
                    "StakingV1_2",
                    addr.output?.value0!
                );
                logger.log(`StakingRoot address: ${stakingRoot.address}`);
                logger.log(`StakingRoot owner address: ${stakingOwner.address}`);
                logger.log(`StakingRoot token root address: ${stakingToken.address}`);

                const staking_details = await stakingRoot.methods
                    .getDetails({answerId: 0})
                    .call()
                    .then((v) => v.value0);
                logger.log(`Staking token wallet: ${staking_details.tokenWallet}`);

                stakingWallet = await locklift.factory.getDeployedContract(
                    "TokenWallet",
                    staking_details.tokenWallet
                );

                // call in order to check if wallet is deployed
                const owner_address = await stakingWallet.methods
                    .owner({answerId: 0})
                    .call()
                    .then((t) => t.value0);

                const root_address = await stakingWallet.methods
                    .root({answerId: 0})
                    .call()
                    .then((t) => t.value0);
                expect(owner_address.toString()).to.be.equal(
                    stakingRoot.address.toString(),
                    "Wrong staking token wallet owner"
                );
                expect(root_address.toString()).to.be.equal(
                    stakingToken.address.toString(),
                    "Wrong staking token wallet root"
                );
            });

            it("Installing codes", async function () {
                const UserData = await locklift.factory.getContractArtifacts(
                    "UserData"
                );
                const RelayRound = await locklift.factory.getContractArtifacts(
                    "RelayRound"
                );
                const Platform = await locklift.factory.getContractArtifacts(
                    "Platform"
                );

                logger.log(`Installing Platform code`);
                await stakingRoot.methods
                    .installPlatformOnce({
                        code: Platform.code,
                        send_gas_to: stakingOwner.address,
                    })
                    .send({
                        from: stakingOwner.address,
                        amount: locklift.utils.toNano(11),
                    });

                logger.log(`Installing UserData code`);
                await stakingRoot.methods
                    .installOrUpdateUserDataCode({
                        code: UserData.code,
                        send_gas_to: stakingOwner.address,
                    })
                    .send({
                        from: stakingOwner.address,
                        amount: locklift.utils.toNano(11),
                    });
                logger.log(`Installing RelayRound code`);
                await stakingRoot.methods
                    .installOrUpdateRelayRoundCode({
                        code: RelayRound.code,
                        send_gas_to: stakingOwner.address,
                    })
                    .send({
                        from: stakingOwner.address,
                        amount: locklift.utils.toNano(11),
                    });
                logger.log(`Set staking to Active`);
                await stakingRoot.methods
                    .setActive({
                        new_active: true,
                        send_gas_to: stakingOwner.address,
                    })
                    .send({
                        from: stakingOwner.address,
                        amount: locklift.utils.toNano(11),
                    });

                if (locklift.context.network.name === "dev") {
                    await tryIncreaseTime(DEV_WAIT);
                }

                await tryIncreaseTime(DEV_WAIT);

                const active = await stakingRoot.methods
                    .isActive({answerId: 0})
                    .call()
                    .then((t) => t.value0);
                expect(active).to.be.equal(true, "Staking not active");
            });

            it("Sending reward tokens to staking", async function () {
                const amount = rewardTokensBal;

                await depositTokens(
                    stakingRoot,
                    stakingOwner,
                    ownerWallet,
                    amount,
                    true
                );
                if (locklift.context.network.name === "dev") {
                    await tryIncreaseTime(DEV_WAIT);
                }

                await tryIncreaseTime(DEV_WAIT);

                const staking_balance = await stakingWallet.methods
                    .balance({answerId: 0})
                    .call()
                    .then((v) => v.value0);

                const staking_details = await stakingRoot.methods
                    .getDetails({answerId: 0})
                    .call()
                    .then((v) => v.value0);
                const staking_balance_stored = staking_details.rewardTokenBalance;

                expect(staking_balance.toString()).to.be.equal(
                    amount.toString(),
                    "Farm pool balance empty"
                );
                expect(staking_balance_stored.toString()).to.be.equal(
                    amount.toString(),
                    "Farm pool balance not recognized"
                );
            });

            it("Setting relay config for testing", async function () {
                // super minimal relay config for local testing
                await stakingRoot.methods
                    .setRelayConfig({
                        new_relay_config: {
                            relayRoundTime: RELAY_ROUND_TIME_1,
                            timeBeforeSetRelays: TIME_BEFORE_SET_RELAYS,
                            minRelaysCount: MIN_RELAYS,
                            minRoundGapTime: MIN_GAP_TIME,
                            userRewardPerSecond: 1000000,
                        },
                        send_gas_to: stakingOwner.address,
                    })
                    .send({
                        from: stakingOwner.address,
                        amount: locklift.utils.toNano(11),
                    });

                if (locklift.context.network.name === "dev") {
                    await tryIncreaseTime(DEV_WAIT);
                }

                await tryIncreaseTime(DEV_WAIT);

                const relay_config = await stakingRoot.methods
                    .getRelayConfig({answerId: 0})
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
            let user1_deposit_time;
            let user2_deposit_time;

            it("Users deposit tokens", async function () {
                const tx = await depositTokens(
                    stakingRoot,
                    user1,
                    userTokenWallet1,
                    userDeposit
                );
                user1Data = await getUserDataAccount(user1);
                if (locklift.context.network.name === "dev") {
                    await tryIncreaseTime(DEV_WAIT);
                }

                await tryIncreaseTime(DEV_WAIT);

                await checkTokenBalances(
                    userTokenWallet1,
                    user1Data,
                    rewardTokensBal + userDeposit,
                    userDeposit,
                    rewardTokensBal,
                    userInitialTokenBal - userDeposit,
                    userDeposit
                );

                const staking_details = await stakingRoot.methods
                    .getDetails({answerId: 0})
                    .call()
                    .then((v) => v.value0);
                user1_deposit_time = staking_details.lastRewardTime;

                await depositTokens(
                    stakingRoot,
                    user2,
                    userTokenWallet2,
                    userDeposit * 2
                );
                user2Data = await getUserDataAccount(user2);
                if (locklift.context.network.name === "dev") {
                    await tryIncreaseTime(DEV_WAIT);
                }

                await tryIncreaseTime(DEV_WAIT);

                await checkTokenBalances(
                    userTokenWallet2,
                    user2Data,
                    rewardTokensBal + userDeposit * 3,
                    userDeposit * 3,
                    rewardTokensBal,
                    userInitialTokenBal - userDeposit * 2,
                    userDeposit * 2
                );
                const staking_details_1 = await stakingRoot.methods
                    .getDetails({answerId: 0})
                    .call()
                    .then((v) => v.value0);
                user2_deposit_time = staking_details_1.lastRewardTime;

                await depositTokens(
                    stakingRoot,
                    user3,
                    userTokenWallet3,
                    userDeposit * 3
                );
                user3Data = await getUserDataAccount(user3);
                if (locklift.context.network.name === "dev") {
                    await tryIncreaseTime(DEV_WAIT);
                }

                await tryIncreaseTime(DEV_WAIT);

                await checkTokenBalances(
                    userTokenWallet3,
                    user3Data,
                    rewardTokensBal + userDeposit * 6,
                    userDeposit * 6,
                    rewardTokensBal,
                    userInitialTokenBal - userDeposit * 3,
                    userDeposit * 3
                );
            });

            it("Creating origin relay round", async function () {
                const staking_details_0 = await stakingRoot.methods
                    .getDetails({answerId: 0})
                    .call()
                    .then((v) => v.value0);
                const reward_rounds = staking_details_0.rewardRounds;

                await setRelaysOnNewRound(stakingOwner, ETH_KEYS, TON_KEYS);

                // await tryIncreaseTime(500);

                await tryIncreaseTime(1000);

                const round = await getRelayRound(0);
                await waitForDeploy(round.address);
                if (locklift.context.network.name === "dev") {
                    await tryIncreaseTime(DEV_WAIT);
                }

                await tryIncreaseTime(DEV_WAIT);

                const events = await stakingRoot
                    .getPastEvents({filter: "RelayRoundInitialized"})
                    .then((e) => e.events);
                const [
                    {
                        data: {
                            round_num: _round_num,
                            round_start_time: _round_start_time,
                            round_end_time: _round_end_time,
                            relays_count: _relays_count,
                            round_addr: _round_address
                        },
                    },
                ] = events;

                expect(_round_address.toString()).to.be.equal(round.address.toString(), "Wrong round address")

                expect(_round_num.toString()).to.be.equal("0", "Bad event");

                expect(_relays_count.toString()).to.be.equal(
                    TON_KEYS.length.toString(),
                    "Relay creation fail - relays count"
                );
                expect(Number(_round_start_time) + RELAY_ROUND_TIME_1).to.be.equal(Number(_round_end_time),
                    "Wrong relay round time"
                );
            });

            it("New round initialized", async function () {
                // await tryIncreaseTime(3000);
                await tryIncreaseTime(9000);

                const stakingFields = await stakingRoot
                    .getFields().then((res) => res.fields!);

                const {traceTree} = await locklift.tracing.trace(
                    setRelaysOnNewRound(stakingOwner, ETH_KEYS, TON_KEYS)
                );

                const tonDeployCalls = traceTree?.findCallsForContract({
                    contract: locklift.factory.getDeployedContract(
                        "TonConfigMockup",
                        stakingFields.base_details.bridge_event_config_ton_eth
                    ),
                    name: "deployEvent" as const
                });
                const solDeployCalls = traceTree?.findCallsForContract({
                    contract: locklift.factory.getDeployedContract(
                        "SolConfigMockup",
                        stakingFields.bridge_event_config_ton_sol
                    ),
                    name: "deployEvent" as const
                });
                expect(tonDeployCalls?.length).to.be.equal(1, "Failed ton deployEvent call");
                expect(solDeployCalls?.length).to.be.equal(1, "Failed sol deployEvent call");
            });
        });

        describe("Late round start", async function () {
            it("Set relays too late", async function () {
                // make sure current round ends after prev round end
                await tryIncreaseTime(RELAY_ROUND_TIME_1 * 3 * 1000);

                const root_round_details = await stakingRoot.methods
                    .getRelayRoundsDetails({answerId: 0})
                    .call()
                    .then((t) => t.value0);

                await setRelaysOnNewRound(stakingOwner, ETH_KEYS, TON_KEYS);

                const events = await stakingRoot
                    .getPastEvents({filter: "RelayRoundInitialized"})
                    .then((e) => e.events);
                const [
                    {
                        data: {
                            round_num: _round_num1,
                            round_start_time: _round_start_time,
                            round_end_time: _round_end_time,
                            relays_count: _relays_count,
                        },
                    },
                ] = events;

                const root_round_details_1 = await stakingRoot.methods
                    .getRelayRoundsDetails({answerId: 0})
                    .call()
                    .then((t) => t.value0);
                expect(
                    Number(root_round_details_1.currentRelayRoundStartTime)
                ).to.be.gt(
                    Number(root_round_details.currentRelayRoundEndTime),
                    "Bad new round start time"
                );
                expect(
                    Number(root_round_details_1.currentRelayRound)
                ).to.be.equal(
                    Number(root_round_details.currentRelayRound) + 1,
                    "Bad new round number"
                );
                expect(_round_start_time).to.be.equal(root_round_details_1.currentRelayRoundStartTime,
                    "Bad event, wrong start time"
                );
                expect(_round_end_time).to.be.equal(root_round_details_1.currentRelayRoundEndTime,
                    "Bad event, wrong end time"
                );
                expect(_round_num1).to.be.equal(root_round_details_1.currentRelayRound,
                    "Bad event, wrong round number"
                );
            });
        });

        describe("Emergency situation", async function () {
            it("Set emergency", async function () {
                await setEmergency();
                const details = await stakingRoot.methods
                    .getDetails({answerId: 0})
                    .call()
                    .then((v) => v.value0);
                expect(details.emergency).to.be.true;
            });

            it("User withdraw tokens", async function () {
                const prev_details = await stakingRoot.methods
                    .getDetails({answerId: 0})
                    .call()
                    .then((v) => v.value0);
                const tx = await withdrawTokens(user2, userDeposit);
                // await tryIncreaseTime(1000);
                await tryIncreaseTime(1000);
                const after_details = await stakingRoot.methods
                    .getDetails({answerId: 0})
                    .call()
                    .then((v) => v.value0);

                const expected_bal = Number(prev_details.tokenBalance) - userDeposit;
                expect(Number(after_details.tokenBalance)).to.be.equal(expected_bal);
            });

            it("Rescuer withdraw all tokens", async function () {
                const prev_details = await stakingRoot.methods
                    .getDetails({answerId: 0})
                    .call()
                    .then((v) => v.value0);
                await withdrawEmergency(100, false);
                // await tryIncreaseTime(1000);
                await tryIncreaseTime(1000);
                const after_details = await stakingRoot.methods
                    .getDetails({answerId: 0})
                    .call()
                    .then((v) => v.value0);
                expect(Number(after_details.tokenBalance)).to.be.equal(
                    Number(prev_details.tokenBalance) - 100
                );

                await withdrawEmergency(0, true);
                // await tryIncreaseTime(1000);
                await tryIncreaseTime(1000);
                const after_details_2 = await stakingRoot.methods
                    .getDetails({answerId: 0})
                    .call()
                    .then((v) => v.value0);
                expect(after_details_2.tokenBalance).to.be.equal("0");
                expect(after_details_2.rewardTokenBalance).to.be.equal("0");
            });
        });
    });
});
