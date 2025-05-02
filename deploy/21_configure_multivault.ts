import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { defaultConfiguration } from "../test/utils";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { owner, gasDonor } = await getNamedAccounts();

  // await deployments.execute(
  //   "MultiVault",
  //   {
  //     from: owner,
  //     log: true,
  //   },
  //   "setDefaultNativeDepositFee",
  //   100,
  // );
  //
  // await deployments.execute(
  //   "MultiVault",
  //   {
  //     from: owner,
  //     log: true,
  //   },
  //   "setDefaultNativeWithdrawFee",
  //     100,
  // );
  //
  // await deployments.execute(
  //   "MultiVault",
  //   {
  //     from: owner,
  //     log: true,
  //   },
  //   "setDefaultAlienDepositFee",
  //     100,
  // );
  //
  // await deployments.execute(
  //   "MultiVault",
  //   {
  //     from: owner,
  //     log: true,
  //   },
  //   "setDefaultAlienWithdrawFee",
  //     100,
  // );

  await deployments.execute(
    "MultiVault",
    {
      from: owner,
      log: true,
    },
    "setConfigurationAlien",
      {
          wid: 0,
          addr: "301134971792308039032421595411762228723840698140131322645251629745414336038"
      },
  );

  await deployments.execute(
    "MultiVault",
    {
      from: owner,
      log: true,
    },
    "setConfigurationNative",
      {
          wid: 0,
          addr: "78048562028472618827633212252422056427181746103622745051525366064922017849598"
      },
  );
  //
  // await deployments.execute(
  //   "MultiVault",
  //   {
  //     from: owner,
  //     log: true,
  //   },
  //   "setGasDonor",
  //   gasDonor,
  // );
};

// noinspection JSUnusedGlobalSymbols
export default func;

func.tags = ["Configure_MultiVault"];
