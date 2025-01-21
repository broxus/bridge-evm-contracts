import { deployments } from "hardhat";

const main = async () => {
    await deployments.all()
        .then((a) => Object.entries(a))
        .then((a) => a.map((b) => [b[0], b[1].address]))
        .then((a) => console.table(a));
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
