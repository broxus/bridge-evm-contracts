import { deployments, getNamedAccounts } from "hardhat";

const main = async () => {
    const { deployer } = await getNamedAccounts();

    await deployments.execute('Bridge',
        { from: deployer, log: true },
        'forceRoundRelays',
        [
            "0x7f96d32f752507b03d48baad1dee0fc92b6373d8",
            "0xf3abcaf556d2a63c70039ff45670544bd28e6056",
            "0xbf26930e84b6378eb6938b4b6018ea67d608ae5f"
        ],
        '1745373385'
    );
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
