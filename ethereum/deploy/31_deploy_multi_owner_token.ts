import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deterministicDeployment = "chainconnect-ton-prod";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { deployer } = await getNamedAccounts();

  await deployments.deploy("MultiOwnerToken", {
    from: deployer,
    log: true,
    deterministicDeployment: ethers.encodeBytes32String(
      deterministicDeployment,
    ),
    args: [deployer],
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
