import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

import { getInitialRelays } from "../test/utils";

const deterministicDeployment = "chainconnect-ton-prod";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { deployer, owner, roundSubmitter } = await getNamedAccounts();

  const initialRelays = await getInitialRelays();
  const week = 604800;

  //FIXME
  const initialRoundEnd = 1737763200;

  console.log(`Bridge owner: ${owner}`);
  console.log(`Round submitter: ${roundSubmitter}`);
  console.log(`Initial relays amount: ${initialRelays.length}`);
  console.log(`Initial relays: ${initialRelays.map((a) => a.address)}`);
  console.log(`Initial round end: ${new Date(initialRoundEnd * 1000)}`);

  await deployments.deploy("Bridge", {
    from: deployer,
    log: true,
    deterministicDeployment: ethers.encodeBytes32String(
      deterministicDeployment,
    ),
    proxy: {
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [
          owner, // Bridge owner
          roundSubmitter, // Round submitter
          Math.floor((initialRelays.length * 2) / 3) + 1, // Minimum required signatures
          week * 2, // Initial round end, 2 weeks
          0, // Initial round number
          initialRoundEnd, // Initial round end, after 1 week
          initialRelays.map((a) => a.address), // Initial relays
        ],
      },
    },
  });
};

// noinspection JSUnusedGlobalSymbols
export default func;

func.tags = ["Deploy_Bridge"];
