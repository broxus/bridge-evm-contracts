import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deterministicDeployment = "multivault-ton-main";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { deployer, owner } = await getNamedAccounts();

  const bridge = await deployments.get("Bridge");

  console.log(`DAO owner: ${owner}`);

  await deployments.deploy("DAO", {
    from: deployer,
    log: true,
    deterministicDeployment: ethers.encodeBytes32String(
      deterministicDeployment,
    ),
    proxy: {
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [owner, bridge.address],
      },
    },
  });
};

// noinspection JSUnusedGlobalSymbols
export default func;

func.tags = ["Deploy_DAO"];
