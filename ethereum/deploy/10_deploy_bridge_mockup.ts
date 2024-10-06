import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deployer } = await getNamedAccounts();

  await deployments.deploy("BridgeMockup", {
    from: deployer,
    log: true,
  });
};

// noinspection JSUnusedGlobalSymbols
export default func;

func.tags = ["Deploy_Bridge_Mockup"];
