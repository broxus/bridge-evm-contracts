import { deployments } from "hardhat";

const main = async () => {
    await deployments.all()
        .then((a) => Object.entries(a))
        .then((a) => a.map((b) => [b[0], b[1].address]))
        .then((a) => a.forEach((b) => console.log(b[0] + ': ```' + b[1] + '```\n')));
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
