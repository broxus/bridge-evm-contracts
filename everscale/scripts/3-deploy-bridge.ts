import { isValidTonAddress } from "../test/utils";
import { logContract } from "../test/utils/logger";
import prompts from "prompts";
import ora from "ora";

const main = async () => {
  const signer = (await locklift.keystore.getSigner("0"))!;

  const response = await prompts([
    {
      type: "text",
      name: "owner",
      message: "Bridge initial owner (can be changed later)",
      validate: (value: any) =>
        isValidTonAddress(value) ? true : "Invalid address",
    },
    {
      type: "text",
      name: "roundDeployer",
      message: "RoundDeployer contract",
      validate: (value: any) =>
        isValidTonAddress(value) ? true : "Invalid address",
    },
    {
      type: "text",
      name: "manager",
      message: "Bridge initial manager",
      validate: (value: any) =>
        isValidTonAddress(value) ? true : "Invalid address",
    },
    {
      type: "number",
      name: "connectorDeployValue",
      initial: 100,
      message: "Connector deploy value (in TONs)",
    },
    {
      type: "number",
      name: "value",
      initial: 1,
      message: "Bridge deploy value (in TONs)",
    },
  ]);

  const spinner = ora("Deploying bridge").start();

  const Connector = locklift.factory.getContractArtifacts("Connector");

  const { contract: bridge } = await locklift.factory.deployContract({
    contract: "Bridge",
    constructorParams: {
      _owner: response.owner,
      _manager: response.manager,
      _roundDeployer: response.roundDeployer,
      _connectorCode: Connector.code,
      _connectorDeployValue: locklift.utils.toNano(
        response.connectorDeployValue
      ),
    },
    initParams: { _randomNonce: locklift.utils.getRandomNonce() },
    publicKey: signer.publicKey,
    value: locklift.utils.toNano(response.value),
  });

  spinner.stop();

  await logContract("bridge address", bridge.address);
};

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
