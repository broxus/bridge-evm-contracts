import { deployments, getNamedAccounts } from "hardhat";

const main = async () => {
    const { deployer } = await getNamedAccounts();

    await deployments.execute('Bridge',
        { from: deployer, log: true },
        'forceRoundRelays',
        [
            "0x0649e690377a9f317b3590968052ef1718c24e31",
            "0x85f9738d6ef12a530fdafafe458aa0d93b4edf34",
            "0x25ef9bfa3700ba40e8509f6b84f27cd2f0c61a9b"
        ],
        '1735583405'
    );
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
