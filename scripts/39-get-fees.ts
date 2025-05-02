import { ethers } from "hardhat";

const tokens: Record<string, string[]> = {
  main: [],
  bsc: [],
  fantom: [],
  polygon: [],
  avalanche: [],
};

const main = async () => {
  const { name: networkName } = await ethers.provider.getNetwork();
  console.log(`Network name: ${networkName}`);

  const networkTokens = tokens[networkName];

  const multivault = await ethers.getContract("MultiVault");

  for (const token of networkTokens) {
    const Token = await ethers.getContractAt("ERC20", token);
    console.log(`${await Token.name()}: ${token}`);
    console.log(`Fee: ${Number(await multivault.fees(token)) / Math.pow(10, Number(await Token.decimals()))}`);
  }
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
