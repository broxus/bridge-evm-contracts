import { ethers } from "hardhat";

const tvmToken: Record<string, string | number> = {
    wid: 0,
    addr: 0
};

const main = async () => {
    const multivault = await ethers.getContract("MultiVault");

    const nativeToken = await multivault.getNativeToken(tvmToken.wid, tvmToken.addr);
    console.log("Native token address:", nativeToken);
};

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
