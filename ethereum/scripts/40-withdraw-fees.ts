import { deployments, ethers, getNamedAccounts } from "hardhat";

const tokens: Record<string, string[]> = {
    main: [],
    bsc: [],
    fantom: [],
    polygon: [],
    avalanche: [],
};

const main = async () => {
    const { name: networkName } = await ethers.provider.getNetwork();
    console.log(`Network name: ${networkName}`);

    const networkTokens = tokens[networkName];

    const { management } = await getNamedAccounts();
    console.log(`Management: ${management}`);

    for (const token of networkTokens) {
        console.log(`Skim ${token}`);
        const tx = await deployments.execute("MultiVault", { from: management, log: true }, "skim", [token]);
        console.log(`Tx hash: ${tx.transactionHash}`)
    }
};

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
