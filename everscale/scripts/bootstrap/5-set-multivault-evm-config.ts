import PlatformCode from "../../jetton-contracts/jetton-platform.compiled.json";
import MinterCode from "../../jetton-contracts/jetton-minter.compiled.json";
import WalletCode from "../../jetton-contracts/jetton-wallet.compiled.json";
import { Address, toNano, WalletTypes } from "locklift";

const BRIDGE_ADMIN = "0:22128f17fef7a538d4a92152db86c4b70f4dd1137ae162d38939a36b724e681b";
const PROXY_MULTI_VAULT_ALIEN = "0:ab234789f6989a94ed1b9282ee8271a8ad0ca061f943d943f647b573aa6d7287";
const PROXY_MULTI_VAULT_NATIVE = "0:d25385cbd0d34699ab78c3871663323807f52b8d7f2feb18237e27c30e479784";

const ALIEN_MULTIVAULT_CONFIGURATIONS = {
    everscaleConfiguration: new Address('0:1f1aaa8a0cf3c9851ec5496ad88cf0dbb50cb48fde75d08ca91247512eb33495'),
    evmConfigurations: [
        new Address('0:1dbe60fbeae7aef6751d35154eb4203531c04cff9e5d206363101b4fc8165fa1'),
        new Address('0:5b6affb7658d55c20612bdff74d23b95f45341ed154a2e595843ac2542358706'),
        new Address('0:070d9c22b7d85e08c28e8c6fbd633da849e61e2e21167d7352aeecbc32a72553')
    ],
};

const NATIVE_MULTIVAULT_CONFIGURATIONS = {
    everscaleConfiguration: new Address('0:3dc467e95a433fd2905e3b2d893116eb4dad7f0bbbecd96d7ba97eefc45bbe14'),
    evmConfigurations: [
        new Address('0:0f7c5fba232bf46ae1eeac0b8cecbe5dc8e83e262141a1ba7f36d0410b28c1d8'),
        new Address('0:27659b94045b39225294f84fb9ae72e1334ea52316d3745d51d7d626f06523d5'),
        new Address('0:21f57eb5223b839f374b01ec35b9fe059c25f9e4b6a8f5233c5450ac000740fe')
    ],
};

const DISABLE_CONFIGURATIONS = [
    // { address: new Address(''), endBlock: '123' },
    // { address: new Address(''), endTimestamp: '123' }
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
