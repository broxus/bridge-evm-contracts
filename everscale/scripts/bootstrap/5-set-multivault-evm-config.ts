import PlatformCode from "../../jetton-contracts/jetton-platform.compiled.json";
import MinterCode from "../../jetton-contracts/jetton-minter.compiled.json";
import WalletCode from "../../jetton-contracts/jetton-wallet.compiled.json";
import { Address, toNano, WalletTypes } from "locklift";

const BRIDGE_ADMIN = "0:2746d46337aa25d790c97f1aefb01a5de48cc1315b41a4f32753146a1e1aeb7d";
const PROXY_MULTI_VAULT_ALIEN = "0:3d2ee3ff7118b05c7ea39ff6cdefe8101814bc3753ca45654d76b6791611992a";
const PROXY_MULTI_VAULT_NATIVE = "0:abaef59990f979b2f42bfb3ebd85bbe4a9841dc1b489a9dbb3cd73244b95fee8";

const ALIEN_MULTIVAULT_CONFIGURATIONS = {
    everscaleConfiguration: new Address(''),
    evmConfigurations: [new Address('')],
};

const NATIVE_MULTIVAULT_CONFIGURATIONS = {
    everscaleConfiguration: new Address(''),
    evmConfigurations: [new Address('')],
};

const DISABLE_CONFIGURATIONS = [
    { address: new Address(''), endBlock: '123' },
    { address: new Address(''), endTimestamp: '123' }
];

const main = async (): Promise<void> => {
    const admin = await locklift.factory.accounts.addExistingAccount({
        type: WalletTypes.EverWallet,
        address: new Address(BRIDGE_ADMIN),
    });

    const proxyMultiVaultAlien = locklift.factory.getDeployedContract(
        "ProxyMultiVaultAlienJetton",
        new Address(PROXY_MULTI_VAULT_ALIEN),
    );
    const proxyMultiVaultNative = locklift.factory.getDeployedContract(
        "ProxyMultiVaultNativeJetton",
        new Address(PROXY_MULTI_VAULT_NATIVE),
    );

    console.log('Set ProxyMultiVaultAlienJetton EVM configuration...');

    await locklift.tracing.trace(
        proxyMultiVaultAlien.methods
            .setEVMConfiguration({
                _config: {
                    everscaleConfiguration: ALIEN_MULTIVAULT_CONFIGURATIONS.everscaleConfiguration,
                    evmConfigurations: ALIEN_MULTIVAULT_CONFIGURATIONS.evmConfigurations,
                    alienTokenWalletPlatformCode: Buffer.from(PlatformCode.hex, "hex").toString("base64"),
                    alienTokenRootCode: Buffer.from(MinterCode.hex, "hex").toString("base64"),
                    alienTokenWalletCode: Buffer.from(WalletCode.hex, "hex").toString("base64"),
                },
                remainingGasTo: admin.address,
            })
            .send({
                from: admin.address,
                amount: toNano(0.5),
                bounce: true,
            })
    );

    console.log('Set ProxyMultiVaultNativeJetton EVM configuration...');

    await locklift.tracing.trace(
        proxyMultiVaultNative.methods
            .setEVMConfiguration({
                _config: {
                    everscaleConfiguration: NATIVE_MULTIVAULT_CONFIGURATIONS.everscaleConfiguration,
                    evmConfigurations: NATIVE_MULTIVAULT_CONFIGURATIONS.evmConfigurations,
                },
                remainingGasTo: admin.address,
            })
            .send({
                from: admin.address,
                amount: toNano(0.5),
                bounce: true,
            })
    );

    for (const conf of DISABLE_CONFIGURATIONS) {
        if (conf.endBlock) {
            const cont = locklift.factory.getDeployedContract('EthereumEverscaleEventConfiguration', conf.address);

            await locklift.transactions.waitFinalized(
                cont.methods
                    .setEndBlockNumber({ endBlockNumber: conf.endBlock })
                    .send({ from: admin.address, amount: toNano(0.1), bounce: true }),
            );

            console.log(`Disabled configuration ${conf.address.toString()}, end block: ${conf.endBlock}`);

            continue;
        }

        const cont = locklift.factory.getDeployedContract('EverscaleEthereumEventConfiguration', conf.address);

        await locklift.transactions.waitFinalized(
            cont.methods
                .setEndTimestamp({ endTimestamp: conf.endTimestamp! })
                .send({ from: admin.address, amount: toNano(0.1), bounce: true }),
        );

        console.log(`Disabled configuration ${conf.address.toString()}, end timestamp: ${conf.endTimestamp}`)
    }
}

main().then(() => console.log('Success'));
