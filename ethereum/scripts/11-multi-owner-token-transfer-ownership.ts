import { deployments, ethers, getNamedAccounts } from "hardhat";

const main = async () => {
  const token = await ethers.getContract("MultiOwnerToken");

  // IMPORTANT: ADD YOU MULTISIG HERE
  const multiVaults: string[] = [
      '0x457ce30424229411097262c2A3A7f6Bc58BDf284', // TON MultiVaultProxy
      '0x9753Cd3Db2150199F61Fd41a45ECCee73F87c0E6', // HMSTR MultiVaultProxy
      //IMPORTANT
      '0x495064d4aaeeF771b9e89B7fD88C94e680F5E9C0', // TON tmp owner
      '0x0cFcB582D83B7233eC656EC00DB44Eab572890eF' // HMSTR tmp owner
  ];

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
