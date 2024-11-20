import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deployer, owner } = await getNamedAccounts();

  await deployments.deploy("MultiOwnerToken", {
    from: deployer,
    log: true,
  });

  await deployments.execute(
    "MultiOwnerToken",
    {
      from: deployer,
      log: true,
    },
    "initialize",
    "MultiOwnerToken",
    "MOT",
    9,
  );
};

// noinspection JSUnusedGlobalSymbols
export default func;

func.tags = ["Deploy_Multi_Owner_Token"];
