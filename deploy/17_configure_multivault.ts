import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { defaultConfiguration } from "../test/utils";

import {BigNumber} from "bignumber.js";
BigNumber.config({ EXPONENTIAL_AT: 1e+9 })

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
          addr: new BigNumber('0:26413cdd7bb77166bdc2f0e41ad758143ac4484e085aea17e12609ed62fe3527'.split(':')[1], 16).toString()
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
          addr: new BigNumber('0:bb2bd2389a7ce484f718f94c91059de2d1274f4b97e5c436504cea8b12a1921d'.split(':')[1], 16).toString()
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
