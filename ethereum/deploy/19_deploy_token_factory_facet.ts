import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deterministicDeployment = "multivault-ton-main";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { deployer } = await getNamedAccounts();

  // Deploy diamond
  await deployments.deploy("MultiVaultFacetTokenFactory", {
    from: deployer,
    log: true,
    deterministicDeployment: ethers.encodeBytes32String(
      deterministicDeployment,
    ),
  });
};

// noinspection JSUnusedGlobalSymbols
export default func;

func.tags = ["Deploy_MultiVault_Facet_TokenFactory"];
