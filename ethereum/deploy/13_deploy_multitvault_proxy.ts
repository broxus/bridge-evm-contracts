import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Diamond } from "../typechain-types";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, ethers }: HardhatRuntimeEnvironment) {
    const { deployer } = await getNamedAccounts();

    // Deploy diamond
    await deployments.deploy('MultiVaultDiamond', {
        contract: 'contracts/multivault/Diamond.sol:Diamond',
        from: deployer,
        log: true,
        deterministicDeployment: true
    });
    
    const MultiVaultDiamond = await deployments.get('MultiVaultDiamond');
    const diamond = await ethers.getContract<Diamond>('MultiVaultDiamond');

    const {
        data: diamondInitialize
    } = await diamond.initialize.populateTransaction(deployer);

    // Deploy proxy with diamond implementation
    await deployments.deploy('MultiVaultProxy', {
        contract: 'TransparentUpgradeableProxy',
        from: deployer,
        log: true,
        deterministicDeployment: true,
        args: [
            MultiVaultDiamond.address,
            deployer,
            diamondInitialize
        ]
    });
};

// noinspection JSUnusedGlobalSymbols
export default func;

export const tags = ['Deploy_MultiVault_Proxy'];
