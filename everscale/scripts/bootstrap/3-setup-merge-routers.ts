import { utils } from 'ethers';
import { Address, WalletTypes, toNano, getRandomNonce } from 'locklift';
import { BigNumber } from 'bignumber.js';
import assert from 'node:assert';

enum Network {
    BSC = 'BSC',
    AVALANCHE = 'AVALANCHE',
    ETHEREUM = 'ETHEREUM',
}

enum Token {
    USDT = 'USDT',
    USDC = 'USDC',
    WBTC = 'WBTC',
    WETH = 'WETH',
}

type MergeRouterInfo = {
    token: Token;
    network: Network;
    address: Address;
}

// Token params on its native network
type TokenParams = {
    network: Network;
    address: string;
    name: string;
    symbol: string;
    decimals: number;
};

type TokensConfig = {
    mergePool?: Address;
    reference: Network;
    tokens: TokenParams[];
};

const networkToId: Record<Network, number> = {
    [Network.BSC]: 56,
    [Network.ETHEREUM]: 1,
    [Network.AVALANCHE]: 43114,
};

const tokenToConfig: Record<string, TokensConfig> = {
    [Token.USDT]: {
        reference: Network.ETHEREUM, // Token of this network will be used as 'main' for EVM->TVM transfers
        mergePool: new Address('0:ceb29b43c331046ed3919d6704d394947d565240d79c2a418bcebb470606767d'), // Set it if merge pool is already deployed. New tokens will be connected to predeployed pool. In other case, new merge pool will be deployed
        tokens: [
            { network: Network.ETHEREUM, address: utils.getAddress('0xdac17f958d2ee523a2206206994597c13d831ec7'), name: 'Tether USD', symbol: 'USDT', decimals: 6 },
            { network: Network.BSC, address: utils.getAddress('0x55d398326f99059fF775485246999027B3197955'), name: 'Tether USD', symbol: 'USDT', decimals: 18 },
            { network: Network.AVALANCHE, address: utils.getAddress('0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7'), name: 'TetherToken', symbol: 'USDt', decimals: 6 },
        ]
    },
    [Token.USDC]: {
        reference: Network.ETHEREUM,
        mergePool: new Address('0:5a683c88d9f223706c21311b81d8e10b53ffd54c70b02874692c32dd38b67f67'),
        tokens: [
            { network: Network.ETHEREUM, address: utils.getAddress('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'), name: 'USD Coin', symbol: 'USDC', decimals: 6 },
            { network: Network.BSC, address: utils.getAddress('0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'), name: 'USD Coin', symbol: 'USDC', decimals: 18 },
            { network: Network.AVALANCHE, address: utils.getAddress('0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'), name: 'USD Coin', symbol: 'USDC', decimals: 6 },
        ]
    },
    [Token.WBTC]: {
        reference: Network.ETHEREUM, // Token of this network will be used as 'main' for EVM->TVM transfers
        mergePool: new Address('0:1b71d9dd53d90d2c1c51c2fef2188b3e158615057696b3fd4981b1cde7f40b8e'), // Set it if merge pool is already deployed. New tokens will be connected to predeployed pool. In other case, new merge pool will be deployed
        tokens: [
            { network: Network.ETHEREUM, address: utils.getAddress('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'), name: 'Wrapped BTC', symbol: 'WBTC', decimals: 8 },
            { network: Network.BSC, address: utils.getAddress('0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c'), name: 'BTCB Token', symbol: 'BTCB', decimals: 18 },
            { network: Network.AVALANCHE, address: utils.getAddress('0x50b7545627a5162f82a992c33b87adc75187b218'), name: 'Wrapped BTC', symbol: 'WBTC.e', decimals: 8 },
        ]
    },
    [Token.WETH]: {
        reference: Network.ETHEREUM, // Token of this network will be used as 'main' for EVM->TVM transfers
        mergePool: new Address('0:80ef2702a33e2dd4d341f3db68140e08760da390ef55250b914304dd22facf04'), // Set it if merge pool is already deployed. New tokens will be connected to predeployed pool. In other case, new merge pool will be deployed
        tokens: [
            { network: Network.ETHEREUM, address: utils.getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'), name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
            { network: Network.BSC, address: utils.getAddress('0x2170Ed0880ac9A755fd29B2688956BD959F933F8'), name: 'Ethereum Token', symbol: 'ETH', decimals: 18 },
            { network: Network.AVALANCHE, address: utils.getAddress('0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB'), name: 'Wrapped Ether', symbol: 'WETH.e', decimals: 18 },
        ]
    }
};

const ALIEN_PROXY_MULTI_VAULT = new Address('0:ab234789f6989a94ed1b9282ee8271a8ad0ca061f943d943f647b573aa6d7287');
const ADMIN = new Address('0:22128f17fef7a538d4a92152db86c4b70f4dd1137ae162d38939a36b724e681b');

const Gas = {
    DEPLOY_ALIEN_TOKEN: toNano(2),
    DEPLOY_MERGE_ROUTER: toNano(2),
    DEPLOY_MERGE_POOL: toNano(2),
    MERGE_POOL_ADD_TOKEN: toNano(0.5),
    MERGE_POOL_ENABLE_ALL: toNano(1),
    MERGE_ROUTER_SET_POOL: toNano(0.5),
};

const main = async (): Promise<void> => {
    await locklift.factory.accounts.addExistingAccount({
        type: WalletTypes.EverWallet,
        address: ADMIN,
    });

    const alienProxyMultiVault = locklift.factory.getDeployedContract('ProxyMultiVaultAlienJetton', ALIEN_PROXY_MULTI_VAULT);
    const alienProxyMultiVaultState = await alienProxyMultiVault.getFullState().then((s) => s.state);

    const tokenToNetworkToAlienToken: Record<string, Record<string, Address>> = {};
    const pendingAlienTokenDeploys: Promise<unknown>[] = [];

    // Derive alien TIP-3 token address from EVM token on different network
    for (const [token, config] of Object.entries(tokenToConfig)) {
        tokenToNetworkToAlienToken[token] = {};
        for (const tokenParams of config.tokens) {
            const alienToken = await alienProxyMultiVault.methods
                .deriveEVMAlienTokenRoot({
                    answerId: 0,
                    chainId: networkToId[tokenParams.network],
                    token: new BigNumber(tokenParams.address.toLowerCase(), 16).toString(10),
                    name: tokenParams.name,
                    symbol: tokenParams.symbol,
                    decimals: tokenParams.decimals,
                })
                .call({ cachedState: alienProxyMultiVaultState })
                .then((r) => r.value0);

            tokenToNetworkToAlienToken[token][tokenParams.network] = alienToken;

            console.log(`Alien token for ${tokenParams.network}-${token} -> ${alienToken.toString()}`);

            const isDeployed = await locklift.provider
                .getFullContractState({ address: alienToken })
                .then((r) => !!r.state?.isDeployed);

            if (!isDeployed) {
                console.log(`Deploying alien token for ${tokenParams.network}-${token}`);

                const deployTx = locklift.transactions.waitFinalized(
                    alienProxyMultiVault.methods
                        .deployEVMAlienToken({
                            chainId: networkToId[tokenParams.network],
                            token: new BigNumber(tokenParams.address.toLowerCase(), 16).toString(10),
                            name: tokenParams.name,
                            symbol: tokenParams.symbol,
                            decimals: tokenParams.decimals,
                            value5: ADMIN,
                        })
                        .send({ from: ADMIN, amount: Gas.DEPLOY_ALIEN_TOKEN, bounce: true }),
                );

                pendingAlienTokenDeploys.push(deployTx);
            }
        }
    }

    await Promise.all(pendingAlienTokenDeploys);

    console.log('[1] All alien tokens are deployed\n');

    const alienTokenToMergeRouter: Record<string, MergeRouterInfo> = {};
    const pendingMergeRouterDeploys: Promise<unknown>[] = [];

    // Derive merge router address for each alien TIP-3 token
    for (const token of Object.keys(tokenToNetworkToAlienToken)) {
        for (const [network, alienToken] of Object.entries(tokenToNetworkToAlienToken[token])) {
            const mergeRouter: MergeRouterInfo = {
                token: token as Token,
                network: network as Network,
                address: await alienProxyMultiVault.methods
                    .deriveMergeRouter({ answerId: 0, token: alienToken })
                    .call({ cachedState: alienProxyMultiVaultState })
                    .then((r) => r.router)
            };

            alienTokenToMergeRouter[alienToken.toString()] = mergeRouter;

            console.log(`Merge router for ${network}-${token} -> ${mergeRouter.address.toString()}`);

            const isDeployed = await locklift.provider
                .getFullContractState({ address: mergeRouter.address })
                .then((r) => !!r.state?.isDeployed);

            if (!isDeployed) {
                console.log(`Deploying merge router for ${network}-${token}`);

                const deployTx = locklift.transactions.waitFinalized(
                    alienProxyMultiVault.methods
                        .deployMergeRouter({ token: alienToken })
                        .send({ from: ADMIN, amount: Gas.DEPLOY_MERGE_ROUTER, bounce: true }),
                );

                pendingMergeRouterDeploys.push(deployTx);
            }
        }
    }

    await Promise.all(pendingMergeRouterDeploys);

    console.log('[2] All merge routers are deployed\n');

    const tokenToMergePool: Record<string, Address> = {};
    const pendingMergePoolTxs: Promise<unknown>[] = [];

    // Derive merge pool address for each token
    for (const [token, networkToAlienToken] of Object.entries(tokenToNetworkToAlienToken)) {
        const alienTokens = Object.values(networkToAlienToken);

        // Reuse old merge pool

        if (tokenToConfig[token].mergePool) {
            tokenToMergePool[token] = tokenToConfig[token].mergePool;

            console.log(`Merge pool for ${token} -> ${tokenToMergePool[token].toString()}`);

            const mergePool = locklift.factory.getDeployedContract('MergePool', tokenToMergePool[token]);
            const addedTokens = await mergePool.methods
                .getTokens({ answerId: 0 })
                .call()
                .then((r) => r._tokens.map((a) => a[0]));

            for (const alienToken of alienTokens) {
                if (!addedTokens.find((a) => a.equals(alienToken))) {
                    console.log(`Add alien token to merge pool ${token} -> ${alienToken}`);

                    const addTokenTx = locklift.transactions.waitFinalized(
                        mergePool.methods
                            .addToken({ token: alienToken })
                            .send({ from: ADMIN, amount: Gas.MERGE_POOL_ADD_TOKEN, bounce: true }),
                    );

                    pendingMergePoolTxs.push(addTokenTx);
                }
            }

            continue;
        }

        // Deploy new merge pool

        const nonce = getRandomNonce();

        const mergePool = await alienProxyMultiVault.methods
            .deriveMergePool({ answerId: 0, nonce: nonce })
            .call({ cachedState: alienProxyMultiVaultState })
            .then((r) => r.pool);

        tokenToMergePool[token] = mergePool;

        console.log(`Merge pool for ${token} -> ${mergePool.toString()}`);

        const isDeployed = await locklift.provider
            .getFullContractState({ address: mergePool })
            .then((r) => !!r.state?.isDeployed);

        if (!isDeployed) {
            const canonIndex = alienTokens.findIndex((a) =>
                a.equals(networkToAlienToken[tokenToConfig[token].reference])
            );

            assert(canonIndex >= 0, `${token} doesn't contain ${tokenToConfig[token].reference} network`);

            console.log(`Deploying merge pool for ${token}. Reference token network ${tokenToConfig[token].reference} -> ${alienTokens[canonIndex].toString()}`);

            const deployTx = locklift.transactions.waitFinalized(
                alienProxyMultiVault.methods
                    .deployMergePool({
                        nonce: nonce,
                        tokens: alienTokens,
                        canonId: canonIndex,
                    })
                    .send({ from: ADMIN, amount: Gas.DEPLOY_MERGE_POOL, bounce: true }),
            );

            pendingMergePoolTxs.push(deployTx);
        }
    }

    await Promise.all(pendingMergePoolTxs);

    console.log('[3] All merge pools are deployed and configured\n');

    const pendingMergeRouterTxs: Promise<unknown>[] = [];

    // Set merge pool to merge routers
    for (const [, mergeRouterInfo] of Object.entries(alienTokenToMergeRouter)) {
        const mergeRouter = locklift.factory.getDeployedContract('MergeRouter', mergeRouterInfo.address);
        const isRightMergePool = await mergeRouter.methods
            .getPool({ answerId: 0 })
            .call()
            .then((r) => r.value0.equals(mergeRouterInfo.address));

        if (!isRightMergePool) {
            console.log(`Set merge pool to ${mergeRouterInfo.network}-${mergeRouterInfo.token} merge router -> ${tokenToMergePool[mergeRouterInfo.token].toString()}`);

            const setPoolTx = locklift.transactions.waitFinalized(
                mergeRouter.methods
                    .setPool({pool_: tokenToMergePool[mergeRouterInfo.token]})
                    .send({from: ADMIN, amount: Gas.MERGE_ROUTER_SET_POOL, bounce: true}),
            );

            pendingMergePoolTxs.push(setPoolTx);
        }
    }

    await Promise.all(pendingMergeRouterTxs);

    console.log('[4] All merge routers are configured\n');

    const pendingMergePoolEnableTxs: Promise<unknown>[] = [];

    for (const [token, mergePoolAddress] of Object.entries(tokenToMergePool)) {
        const mergePool = locklift.factory.getDeployedContract("MergePool", mergePoolAddress);

        console.log(`Enable ${token} merge pool`);

        const enableAllTx = locklift.transactions.waitFinalized(
            mergePool.methods
                .enableAll({})
                .send({ from: ADMIN, amount: Gas.MERGE_POOL_ENABLE_ALL, bounce: true }),
        );

        pendingMergePoolEnableTxs.push(enableAllTx);
    }

    await Promise.all(pendingMergePoolEnableTxs);

    console.log('[5] All merge pools are enabled\n');
};

main().then(() => console.log("Success"));
