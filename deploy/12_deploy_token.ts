import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { deployer, owner } = await getNamedAccounts();

  await deployments.deploy("Token", {
    from: deployer,
    log: true,
    args: [ethers.parseUnits("1000000", 18), owner],
  });

  // - Airdrop token
  const actors = ["alice", "bob", "eve"];

  for (const actor of actors) {
    const actorSigner = await ethers.getNamedSigner(actor);

    await deployments.execute(
      "Token",
      {
        from: owner,
        log: true,
      },
      "transfer",
      actorSigner.address,
      ethers.parseUnits("100000"),
    );
  }
};

// noinspection JSUnusedGlobalSymbols
export default func;

func.tags = ["Deploy_Token"];
