import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) {
    const { deployer } = await getNamedAccounts();

    // Deploy diamond
    await deployments.deploy('MultiVaultFacetWithdraw', {
        from: deployer,
        log: true,
    });
};

// noinspection JSUnusedGlobalSymbols
export default func;

export const tags = ['Deploy_MultiVault_Facet_Withdraw'];
