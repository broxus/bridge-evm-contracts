import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) {
  const { deployer } = await getNamedAccounts();
  
  await deployments.deploy('StakingRelayVerifier', {
    from: deployer,
    log: true,
  });
};

// noinspection JSUnusedGlobalSymbols
export default func;

export const tags = ['Deploy_StakingRelayVerifier'];
