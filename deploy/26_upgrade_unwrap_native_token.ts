import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deterministicDeployment = "chainconnect-ton-prod";

const func: DeployFunction = async function ({
  getNamedAccounts,
  ethers,
  deployments,
}: HardhatRuntimeEnvironment) {
  const {owner} = await getNamedAccounts();

  await deployments.deploy("UnwrapNativeToken", {
    from: owner,
    log: true,
    deterministicDeployment: ethers.encodeBytes32String(
      deterministicDeployment,
    ),
    proxy: {
      proxyContract: "EIP173ProxyWithReceive",
    },
  });
};

// noinspection JSUnusedGlobalSymbols
export default func;

func.tags = ["Upgrade_Unwrap_Native_Token"];
