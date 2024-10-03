import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) {
  const { deployer, owner } = await getNamedAccounts();
  
  await deployments.execute('DefaultProxyAdmin',
    {
      from: deployer,
      log: true,
    },
    'transferOwnership',
    owner
  );
};

// noinspection JSUnusedGlobalSymbols
export default func;

export const tags = ['Execute_DefaultProxyAdmin_transferOwnership'];
