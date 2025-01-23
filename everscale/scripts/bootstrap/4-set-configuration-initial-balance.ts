import { Address, toNano, WalletTypes } from 'locklift';

type InitialBalance = ['EverscaleEthereumEventConfiguration' | 'EthereumEverscaleEventConfiguration', string];

const initialBalances: Record<string, InitialBalance> = {
    // Ethereum
    '0:e38847934cae1f401f515af321a99729db797c6655a7cb0e56e4fa9be65d02ca': ['EthereumEverscaleEventConfiguration', toNano(0.3)],
    '0:d5bcc3a6c76520b200026f958ea2037bb9a590e01766363cbbd60e740c6db570': ['EthereumEverscaleEventConfiguration', toNano(0.3)],
    '0:1537b310e3870c1effb3cc4f2a37697b69e984b02909f3e19d23d4f936ba01ef': ['EverscaleEthereumEventConfiguration', toNano(0.3)],
    '0:c65e22c75e7bdd2e9d95fbab9ea75008af5345214ea5720e0d7fc059392d5bc3': ['EverscaleEthereumEventConfiguration', toNano(0.3)],

    // BSC
    '0:5c3b2268f8944cca603aeaef8efdc422974a43e848780759fe9665a9e39d49df': ['EthereumEverscaleEventConfiguration', toNano(0.3)],
    '0:c5abe7f9da85a49ff71270616e19ff0ed2280defa0418ace0b0b90cfd3a3b362': ['EthereumEverscaleEventConfiguration', toNano(0.3)],
    '0:9f9e3c7bb283c21b5a7318c617246674bd6a57bea0a5bf964f0b4ca909e1dfab': ['EverscaleEthereumEventConfiguration', toNano(0.3)],
    '0:8af4ce3a20cf226f012fd11c6a6d926a5a516f8942c56c7ccf85313c8d6bddb0': ['EverscaleEthereumEventConfiguration', toNano(0.3)],

    // Avalanche
    '0:9dcbb2ae503cfccc1cee704ba84e1b2fcef5c17f38adf0d1af03abfb70fc1247': ['EthereumEverscaleEventConfiguration', toNano(0.3)],
    '0:e3c5e3f1f7c59706490e86b5db447d4a7ce71c7fdc324b2ef7cf2381878a358e': ['EthereumEverscaleEventConfiguration', toNano(0.3)],
    '0:6f4a0b9175bbac603c63a641fbc69406129cec0b53be78a4f552a116d800eeab': ['EverscaleEthereumEventConfiguration', toNano(0.3)],
    '0:315ab3901e1217d92e2dfbb38f11e6be189809c3a9308ed741ec752e174cd571': ['EverscaleEthereumEventConfiguration', toNano(0.3)],
};

const ADMIN = new Address('0:22128f17fef7a538d4a92152db86c4b70f4dd1137ae162d38939a36b724e681b');

const Gas = {
    CONFIGURATION_SET_INITIAL_BALANCE: toNano(0.2),
};

const main = async (): Promise<void> => {
    await locklift.factory.accounts.addExistingAccount({
        type: WalletTypes.EverWallet,
        address: ADMIN,
    });

    const pendingConfigurationTxs: Promise<unknown>[] = [];

    for (const [configurationAddress, [configurationType, initialBalance]] of Object.entries(initialBalances)) {
        const configuration = locklift.factory.getDeployedContract(configurationType, new Address(configurationAddress));
        const currentInitialBalance = await configuration.methods
            .getDetails({ answerId: 0 })
            .call()
            .then((r) => r._basicConfiguration.eventInitialBalance);

        if (currentInitialBalance === initialBalance) {
            continue;
        }

        const tx = locklift.transactions.waitFinalized(
            configuration.methods
                .setEventInitialBalance({ eventInitialBalance: initialBalance })
                .send({ from: ADMIN, amount: Gas.CONFIGURATION_SET_INITIAL_BALANCE, bounce: true }),
        ).then(() => console.log(`${configurationAddress} -> ${initialBalance}`));

        pendingConfigurationTxs.push(tx);
    }

    await Promise.all(pendingConfigurationTxs);
};

main().then(() => console.log('Success'));
