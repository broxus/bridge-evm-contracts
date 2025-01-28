import {ethers} from "hardhat";

const main = async () => {
    const owner = await ethers.getNamedSigner('owner');

    const newOwner = "";

    const defaultProxyAdmin = await ethers.getContract('DefaultProxyAdmin');
    await defaultProxyAdmin.connect(owner).transferOwnership(newOwner);
    console.log("DefaultProxyAdmin new owner:", await defaultProxyAdmin.owner());

    const dao = await ethers.getContract('DAO');
    await dao.connect(owner).transferOwnership(newOwner);
    console.log("DAO new owner:", await dao.owner());

    const bridge = await ethers.getContract('Bridge');
    await bridge.connect(owner).transferOwnership(newOwner);
    console.log("Bridge new owner:", await bridge.owner());

    const multivault = await ethers.getContract('MultiVault');
    await multivault.connect(owner).transferOwnership(newOwner);
    console.log("MultiVault new owner:", await multivault.owner());
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
