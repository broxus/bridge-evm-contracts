import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deterministicDeployment = "chainconnect-ton-prod";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { deployer } = await getNamedAccounts();

  // Deploy diamond
  await deployments.deploy("MultiVaultFacetFees", {
    from: deployer,
    log: true,
    deterministicDeployment: ethers.encodeBytes32String(
      deterministicDeployment,
    ),
  });
};

// noinspection JSUnusedGlobalSymbols
export default func;

func.tags = ["Deploy_MultiVault_Facet_Fees"];
