import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deterministicDeployment = "chainconnect-ton-prod";

const func: DeployFunction = async function ({
  getNamedAccounts,
  ethers,
  deployments,
}: HardhatRuntimeEnvironment) {
  const {
    deployer,
    weth,
    multivault: multivault_,
    owner,
  } = await getNamedAccounts();

  // - Get multivault address
  let multivault_address;

  if (multivault_ === ethers.ZeroAddress) {
    const MultiVault = await deployments.get("MultiVault");

    multivault_address = MultiVault.address;
  } else {
    multivault_address = multivault_;
  }

  await deployments.deploy("UnwrapNativeToken", {
    from: deployer,
    log: true,
    deterministicDeployment: ethers.encodeBytes32String(
      deterministicDeployment,
    ),
    proxy: {
      proxyContract: "EIP173ProxyWithReceive",
    },
  });

  await deployments.execute(
    "UnwrapNativeToken",
    {
      from: deployer,
      log: true,
    },
    "initialize",
    weth,
    multivault_address,
  );

  await deployments.execute(
    "UnwrapNativeToken",
    {
      from: deployer,
      log: true,
    },
    "transferOwnership",
    owner,
  );
};

// noinspection JSUnusedGlobalSymbols
export default func;

func.tags = ["Deploy_Unwrap_Native_Token"];
