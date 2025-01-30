import { deployments, getNamedAccounts } from "hardhat";

import {BigNumber} from "bignumber.js";

BigNumber.config({ EXPONENTIAL_AT: 1e+9 })

const main = async () => {
    const { deployer } = await getNamedAccounts();

    await deployments.execute(
        "MultiVault",
        { from: deployer, log: true },
        "addPredeployedToken",
        ["0", new BigNumber('0:09f2e59dec406ab26a5259a45d7ff23ef11f3e5c7c21de0b0d2a1cbe52b76b3d'.split(':')[1], 16).toString()],
        "0xa62dc6Aa3faf4b8e29FeD4c25b844E0B0D552E5d",
        ["Hamster Kombat", "HMSTR", 9],
    );
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
