import { deployments, run } from "hardhat";

const main = async () => {
    const deploys = await deployments.all().then((a) => Object.entries(a));

    for (const dep of deploys) {
        if (dep[1].bytecode) {
            console.log(`Verify ${dep[0]}: ${dep[1].address}`);
            try {
                await run("verify:verify", {
                    address: dep[1].address,
                    constructorArguments: dep[1].args,
                });
            } catch (e) {
                console.log(e);
            }
        }
    }
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
