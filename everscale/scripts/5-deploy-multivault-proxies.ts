import { logContract } from "../test/utils/logger";
import { isValidTonAddress } from "../test/utils";
import prompts from "prompts";
import ora from "ora";

const main = async () => {
  const response = await prompts([
    {
      type: "text",
      name: "owner",
      message: "Proxies owner (can be changed later)",
      validate: (value: any) =>
        isValidTonAddress(value) ? true : "Invalid address",
    },
  ]);

  const _randomNonce = locklift.utils.getRandomNonce();

  const signer = (await locklift.keystore.getSigner("2"))!;

  const spinner = ora("Deploying alien proxy").start();

  // Deploy proxy
  const { contract: proxyAlien } = await locklift.factory.deployContract({
    contract: "ProxyMultiVaultAlienJetton",
    constructorParams: { owner_: response.owner },
    initParams: { _randomNonce },
    publicKey: signer.publicKey,
    value: locklift.utils.toNano(1.1),
  });

  spinner.stop();

  await logContract("ProxyMultiVaultAlienJetton", proxyAlien.address);

  spinner.start("Deploy native proxy");

  // Deploy proxy
  const { contract: proxyNative } = await locklift.factory.deployContract({
    contract: "ProxyMultiVaultNativeJetton",
    constructorParams: { owner_: response.owner },
    initParams: { _randomNonce },
    publicKey: signer.publicKey,
    value: locklift.utils.toNano(1.1),
  });

  spinner.stop();

  await logContract("ProxyMultiVaultNativeJetton", proxyNative.address);
};

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
