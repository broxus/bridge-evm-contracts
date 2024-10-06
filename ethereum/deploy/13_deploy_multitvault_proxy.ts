import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Diamond } from "../typechain-types";

const deterministicDeployment = "multivault-ton-main";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  ethers,
}: HardhatRuntimeEnvironment) {
  const { deployer } = await getNamedAccounts();

  // Deploy diamond
  await deployments.deploy("MultiVaultDiamond", {
    contract: "contracts/multivault/Diamond.sol:Diamond",
    from: deployer,
    log: true,
    deterministicDeployment: ethers.encodeBytes32String(
      deterministicDeployment,
    ),
  });

  const MultiVaultDiamond = await deployments.get("MultiVaultDiamond");
  const diamond = await ethers.getContract<Diamond>("MultiVaultDiamond");

  const { data: diamondInitialize } =
    await diamond.initialize.populateTransaction(deployer);

  // Deploy proxy with diamond implementation
  await deployments.deploy("MultiVaultProxy", {
    contract: "TransparentUpgradeableProxy",
    from: deployer,
    log: true,
    deterministicDeployment: ethers.encodeBytes32String(
      deterministicDeployment,
    ),
    args: [MultiVaultDiamond.address, deployer, diamondInitialize],
  });
};

// noinspection JSUnusedGlobalSymbols
export default func;

func.tags = ["Deploy_MultiVault_Proxy"];
