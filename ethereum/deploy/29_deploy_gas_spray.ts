import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deterministicDeployment = "chainconnect-ton-prod";

const func: DeployFunction = async function ({
  getNamedAccounts,
  ethers,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deployer, multivault: multivault_ } = await getNamedAccounts();

  // - Get multivault address
  let multivault;

  if (multivault_ === ethers.ZeroAddress) {
    const MultiVault = await deployments.get("MultiVault");

    multivault = MultiVault.address;
  } else {
    multivault = multivault_;
  }

  // Deploy diamond
  await deployments.deploy("GasSpray", {
    from: deployer,
    log: true,
    deterministicDeployment: ethers.encodeBytes32String(
      deterministicDeployment,
    ),
    args: [multivault, []],
  });
};

// noinspection JSUnusedGlobalSymbols
export default func;

func.tags = ["Deploy_Gas_Spray"];
