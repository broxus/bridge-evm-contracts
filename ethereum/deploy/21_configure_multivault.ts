import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { defaultConfiguration } from "../test/utils";

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { owner, gasDonor } = await getNamedAccounts();

  await deployments.execute(
    "MultiVault",
    {
      from: owner,
      log: true,
    },
    "setDefaultNativeDepositFee",
    100,
  );

  await deployments.execute(
    "MultiVault",
    {
      from: owner,
      log: true,
    },
    "setDefaultNativeWithdrawFee",
      100,
  );

  await deployments.execute(
    "MultiVault",
    {
      from: owner,
      log: true,
    },
    "setDefaultAlienDepositFee",
      100,
  );

  await deployments.execute(
    "MultiVault",
    {
      from: owner,
      log: true,
    },
    "setDefaultAlienWithdrawFee",
      100,
  );

  await deployments.execute(
    "MultiVault",
    {
      from: owner,
      log: true,
    },
    "setConfigurationAlien",
      {
          wid: 0,
          addr: "9596982276728072944706534558097645686118760608564989067536664306694917587439"
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
          addr: "89724267677931400774945563627652144079668997617928740949412054841719759133635"
      },
  );

  await deployments.execute(
    "MultiVault",
    {
      from: owner,
      log: true,
    },
    "setGasDonor",
    gasDonor,
  );
};

// noinspection JSUnusedGlobalSymbols
export default func;

func.tags = ["Configure_MultiVault"];
