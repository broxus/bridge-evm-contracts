import { deployments, ethers, getNamedAccounts } from "hardhat";

const main = async () => {
  const token = await ethers.getContract("MultiOwnerToken");

  const multiVaults = [];

  const { deployer, owner } = await getNamedAccounts();
  await deployments.execute(
    "MultiOwnerToken",
    {
      from: deployer,
      log: true,
    },
    "transferOwnership",
    multiVaults,
  );
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
