import { readFileSync } from "fs";
import { ethers, getNamedAccounts } from "hardhat";

const RECEIVER = "";

const main = async () => {
  const { name: networkName, chainId } = await ethers.provider.getNetwork();
  console.log(`Network name: ${networkName}`);

  const { management } = await getNamedAccounts();
  console.log(`Management: ${management}`);

  const fees = JSON.parse(readFileSync(`./withdrawn-fees-${networkName}.json`).toString());

  const transactions = [];
  for (const feeData of fees) {
    transactions.push({
      to: feeData.token,
      value: "0",
      data: null,
      contractMethod: {
        inputs: [
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256", name: "value", type: "uint256" },
        ],
        name: "transfer",
        payable: false,
      },
      contractInputsValues: { to: RECEIVER, value: feeData.fee },
    });
  }

  const json = {
    version: "1.0",
    chainId: chainId.toString(),
    createdAt: new Date().getTime(),
    meta: {
      name: "Transfer Batch",
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
