import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function ({ getNamedAccounts, ethers, deployments }: HardhatRuntimeEnvironment) {
    const {
        deployer,
        multivault: multivault_,
    } = await getNamedAccounts();

    // - Get multivault address
    let multivault;

    if (multivault_ === ethers.ZeroAddress) {
        const MultiVault = await deployments.get('MultiVault');

        multivault = MultiVault.address;
    } else {
        multivault = multivault_;
    }

    // Deploy diamond
    await deployments.deploy('BatchSaver', {
        from: deployer,
        log: true,
        deterministicDeployment: true,
        args: [
            ethers.ZeroAddress,
            multivault
        ]
    });
};

// noinspection JSUnusedGlobalSymbols
export default func;

export const tags = ['Deploy_Batch_Saver'];

