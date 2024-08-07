import {logContract} from "../test/utils/logger";
import {isValidTonAddress} from "../test/utils";
import {deployAccount} from "../test/utils/account";

const prompts = require("prompts");
const ora = require("ora");


async function main() {
  // bright
  console.log("\x1b[1m", "\n\nSetting roundDeployer deployment params:");
  const deploy_params = await prompts([
    {
      type: "text",
      name: "admin",
      message:
        "RoundDeployer admin (can upgrade contracts code, set event config addresses)",
      validate: (value: any) =>
        isValidTonAddress(value) ? true : "Invalid address",
    },
    {
      type: "text",
      name: "tonEthEventConfig",
      initial:
        "0:0000000000000000000000000000000000000000000000000000000000000001",
      message:
        "Ever->Eth event configuration (broadcast RelayRoundCreation event with eth keys from round deployer). Could be omitted",
      validate: (value: any) =>
        isValidTonAddress(value) ? true : "Invalid address",
    },
    {
      type: "text",
      name: "tonSolEventConfig",
      initial:
        "0:0000000000000000000000000000000000000000000000000000000000000001",
      message:
        "Ever->Sol event configuration (broadcast RelayRoundCreation event with ton keys from round deployer). Could be omitted",
      validate: (value: any) =>
        isValidTonAddress(value) ? true : "Invalid address",
    },
  ]);
  console.log("\x1b[1m", "\n\nNow setting relay configs:");
  const relay_config = await prompts([
    {
      type: "number",
      name: "relayRoundTime",
      initial: 604800,
      message: "Relay round time (in seconds)",
    },
    {
      type: "number",
      name: "timeBeforeSetRelays",
      message: "Time before init new round after round starts (in seconds)",
      initial: 345600,
    },
    {
      type: "number",
      name: "minRoundGapTime",
      message:
        "Min delta between next round start and current election end (in seconds)",
      initial: 3600,
    },
    {
      type: "number",
      name: "minRelaysCount",
      message: "Min relays count",
      initial: 14,
    }
  ]);
  console.log("\x1b[1m", "\nSetup complete! ✔\n");

  const spinner = ora("Deploying round deployer...").start();

  const signer = (await locklift.keystore.getSigner("0"))!;

  spinner.start("Deploying temporary admin for initial setup...");

  const admin = await deployAccount(signer, 100);

  spinner.succeed(`Temporary admin address: ${admin.address}`);

  const r =
    await locklift.transactions.waitFinalized(
      locklift.factory.deployContract({
        contract: "RoundDeployer",
        constructorParams: {
          _admin: admin.address,
          _bridge_event_config_ton_eth: deploy_params.tonEthEventConfig,
          _bridge_event_config_ton_sol: deploy_params.tonSolEventConfig,
        },
        initParams: {
          deploy_nonce: locklift.utils.getRandomNonce()
        },
        publicKey: signer.publicKey,
        value: locklift.utils.toNano(5),
      })
    );

  const {
    extTransaction: {
      contract: roundDeployer
    }
  } = r;

  spinner.succeed(`Round deployer address: ${roundDeployer.address}`);

  const RelayRound = await locklift.factory.getContractArtifacts("RelayRound");
  const Platform = await locklift.factory.getContractArtifacts("Platform");

  spinner.start("Installing dependant contracts code...");
  await roundDeployer.methods
    .installPlatformOnce({ code: Platform.code, send_gas_to: admin.address })
    .send({
      from: admin.address,
      amount: locklift.utils.toNano(15),
    });
  await roundDeployer.methods
    .installOrUpdateRelayRoundCode({
      code: RelayRound.code,
      send_gas_to: admin.address,
    })
    .send({
      from: admin.address,
      amount: locklift.utils.toNano(15),
    });
  spinner.succeed("Dependant contracts code installed ✔");

  spinner.start("Setting relay config...");
  await roundDeployer.methods
    .setRelayConfig({
      new_relay_config: relay_config,
      send_gas_to: admin.address,
    })
    .send({
      from: admin.address,
      amount: locklift.utils.toNano(15),
    });
  spinner.succeed("Relay config set ✔");

  spinner.start("Setting active flag to true...");
  await roundDeployer.methods
    .setActive({ new_active: true, send_gas_to: admin.address })
    .send({
      from: admin.address,
      amount: locklift.utils.toNano(15),
    });
  spinner.succeed("Active flag set ✔");

  spinner.start("Setting real admin...");
  await roundDeployer.methods
    .setAdmin({ new_admin: deploy_params.admin, send_gas_to: admin.address })
    .send({
      from: admin.address,
      amount: locklift.utils.toNano(15),
    });
  spinner.succeed("Real admin set ✔");

  spinner.start("Sending remaining evers from temporary admin to real admin...");

  const adminContract = await locklift.factory.getDeployedContract(
    "Wallet",
    admin.address
  );

  await adminContract.methods
    .sendTransaction({
      dest: deploy_params.admin,
      value: 0,
      bounce: false,
      flags: 128,
      payload: "",
    })
    .send({
      from: admin.address,
      amount: locklift.utils.toNano(15),
    });

  spinner.succeed("Remaining evers sent ✔");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
