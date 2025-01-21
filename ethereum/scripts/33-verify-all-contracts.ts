import { deployments, run } from "hardhat";

const main = async () => {
    const deploys = await deployments.all().then((a) => Object.entries(a));

    for (const dep of deploys) {
        console.log(`Verify ${dep[0]}: ${dep[1].address}`);

        await run("verify:verify", {
            address: dep[1].address,
            constructorArguments: dep[1].args,
        });
    }
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
