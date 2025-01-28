import { Address, toNano, WalletTypes } from 'locklift';

type InitialBalance = ['EverscaleEthereumEventConfiguration' | 'EthereumEverscaleEventConfiguration', string];

const initialBalances: Record<string, InitialBalance> = {
    // Ethereum
    '0:1dbe60fbeae7aef6751d35154eb4203531c04cff9e5d206363101b4fc8165fa1': ['EthereumEverscaleEventConfiguration', toNano(0.3)],
    '0:0f7c5fba232bf46ae1eeac0b8cecbe5dc8e83e262141a1ba7f36d0410b28c1d8': ['EthereumEverscaleEventConfiguration', toNano(0.3)],
    '0:1f1aaa8a0cf3c9851ec5496ad88cf0dbb50cb48fde75d08ca91247512eb33495': ['EverscaleEthereumEventConfiguration', toNano(0.3)],
    '0:3dc467e95a433fd2905e3b2d893116eb4dad7f0bbbecd96d7ba97eefc45bbe14': ['EverscaleEthereumEventConfiguration', toNano(0.3)],

    // BSC
    '0:5b6affb7658d55c20612bdff74d23b95f45341ed154a2e595843ac2542358706': ['EthereumEverscaleEventConfiguration', toNano(0.3)],
    '0:27659b94045b39225294f84fb9ae72e1334ea52316d3745d51d7d626f06523d5': ['EthereumEverscaleEventConfiguration', toNano(0.3)],

    // Avalanche
    '0:070d9c22b7d85e08c28e8c6fbd633da849e61e2e21167d7352aeecbc32a72553': ['EthereumEverscaleEventConfiguration', toNano(0.3)],
    '0:21f57eb5223b839f374b01ec35b9fe059c25f9e4b6a8f5233c5450ac000740fe': ['EthereumEverscaleEventConfiguration', toNano(0.3)],
};

const ADMIN = new Address('0:22128f17fef7a538d4a92152db86c4b70f4dd1137ae162d38939a36b724e681b');

const Gas = {
    CONFIGURATION_SET_INITIAL_BALANCE: toNano(0.1),
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
