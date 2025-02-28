import { ethers, getNamedAccounts } from "hardhat";

const tokens: Record<string, string[]> = {
  main: [],
  bsc: [],
  fantom: [],
  polygon: [],
  avalanche: [],
};

const main = async () => {
  const { name: networkName, chainId } = await ethers.provider.getNetwork();
  console.log(`Network name: ${networkName}`);

  const networkTokens = tokens[networkName];

  const { management } = await getNamedAccounts();
  console.log(`Management: ${management}`);

  const multivault = await ethers.getContract("MultiVault");

  const transactions = [];
  for (const token of networkTokens) {
    transactions.push({
      to: await multivault.getAddress(),
      value: "0",
      data: null,
      contractMethod: {
        inputs: [{ internalType: "address", name: "token", type: "address" }],
        name: "skim",
        payable: false,
      },
      contractInputsValues: { token: token },
    });
  }

  const json = {
    version: "1.0",
    chainId: chainId.toString(),
    createdAt: new Date().getTime(),
    meta: {
      name: "Skim Batch",
      description: "",
      txBuilderVersion: "1.18.0",
      createdFromSafeAddress: management.toString(),
      createdFromOwnerAddress: "",
      checksum: "0x2278322fc7e9159d3d46832c1866c94311186dd9920f6d31c15af0242f0f4e35",
    },
    transactions: transactions,
  };

  console.log(JSON.stringify(json));
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
