import { ethers } from "hardhat";

const main = async () => {
    const wallet = ethers.Wallet.createRandom();
    console.log(wallet.mnemonic?.phrase);
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
