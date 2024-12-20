import { deployments, getNamedAccounts } from "hardhat";

const main = async () => {
    const { deployer } = await getNamedAccounts();

    await deployments.execute(
        "MultiVault",
        { from: deployer, log: true },
        "addPredeployedToken",
        ["0", "1485964644044902029379366325111601310947727015793334109634373504816903004807"],
        "0x9cDD44107055b6259c2a5407318b39F85379DDA6",
        ["PikaTon", "PKTN", 9],
    );
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
