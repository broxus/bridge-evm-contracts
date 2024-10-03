import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { defaultConfiguration } from "../test/utils";

const func: DeployFunction = async function ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) {
    const { owner, gasDonor } = await getNamedAccounts();

    await deployments.execute('MultiVault',
        {
            from: owner,
            log: true,
        },
        'setDefaultNativeDepositFee',
        100,
    );

    await deployments.execute('MultiVault',
        {
            from: owner,
            log: true,
        },
        'setDefaultNativeWithdrawFee',
        200,
    );

    await deployments.execute('MultiVault',
        {
            from: owner,
            log: true,
        },
        'setDefaultAlienDepositFee',
        300,
    );

    await deployments.execute('MultiVault',
        {
            from: owner,
            log: true,
        },
        'setDefaultAlienWithdrawFee',
        400,
    );

    await deployments.execute('MultiVault',
        {
            from: owner,
            log: true,
        },
        'setConfigurationAlien',
        defaultConfiguration,
    );

    await deployments.execute('MultiVault',
        {
            from: owner,
            log: true,
        },
        'setConfigurationNative',
        defaultConfiguration,
    );

    await deployments.execute('MultiVault',
        {
            from: owner,
            log: true
        },
        'setGasDonor',
        gasDonor
    );
}

// noinspection JSUnusedGlobalSymbols
export default func;

export const tags = ['Configure_MultiVault'];
