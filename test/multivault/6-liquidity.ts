import { deployments, ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";

import {
    defaultChainId,
    encodeTvmEvent,
    encodeMultiTokenAlienWithdrawalData,
    getPayloadSignatures,
} from "../utils";
import {
    ERC20,
    MultiVault
} from "../../typechain-types";

const recipient = {
    wid: 0,
    addr: 123123
};
const LP_BPS = 10_000_000_000n;


describe('Test multivault liquidity supply', () => {
    let multivault: MultiVault;
    let token: ERC20, lp_token: ERC20;

    const deposit_amount = ethers.parseUnits('20000', 18);
    const liquidity_deposit = ethers.parseUnits('100000', 18);
    const interest = 100; // 1%

    it('Setup contracts', async () => {
        await deployments.fixture();

        multivault = await ethers.getContract('MultiVault');
        token = await ethers.getContract('Token');
    });

    it('Set default liquidity interest', async () => {
        const owner = await ethers.getNamedSigner('owner');

        await multivault.connect(owner).getFunction('setDefaultInterest(uint256)')(interest);
    });

    it('Set Bob as governance', async () => {
        const owner = await ethers.getNamedSigner('owner');
        const bob = await ethers.getNamedSigner('bob');

        await multivault.connect(owner).getFunction('setGovernance(address)')(bob.address);
        await multivault.connect(bob).getFunction('acceptGovernance()')();
    });

    it('Alice deposits alien token', async () => {
        const alice = await ethers.getNamedSigner('alice');

        await token
            .connect(alice)
            .approve(await multivault.getAddress(), deposit_amount);

        const deposit = multivault
            .connect(alice)
            .getFunction('deposit(((int8,uint256),address,uint256,uint256,bytes))');

        const deposit_value = ethers.parseEther("0.1");
        const deposit_expected_gas = 33;
        const deposit_payload = "0x001122";

        await deposit({
            recipient,
            token: await token.getAddress(),
            amount: deposit_amount,
            expected_gas: deposit_expected_gas,
            payload: deposit_payload
        }, { value: deposit_value });
    });

    describe('Bob supplies liquidity', () => {
        it('Mint LPs', async () => {
            const bob = await ethers.getNamedSigner('bob');

            await token
                .connect(bob)
                .approve(await multivault.getAddress(), liquidity_deposit);

            await expect(async () => multivault
                .connect(bob)
                .getFunction('mintLP(address,uint256,address)')(await token.getAddress(), liquidity_deposit, bob.address)
            ).to.changeTokenBalances(
                token,
                [bob, multivault],
                [0n - liquidity_deposit, liquidity_deposit]
            );
        });

        it('Check LP token initialized', async () => {
            const liquidity = await multivault.getFunction('liquidity(address)')(await token.getAddress());

            expect(liquidity.interest)
                .to.be.equal(interest, 'Wrong token liquidity interest');
            expect(liquidity.activation)
                .to.be.greaterThan(0, 'Wrong token activation');
            expect(liquidity.supply)
                .to.be.equal(liquidity.cash)
                .to.be.equal(liquidity_deposit);
        });

        it('Check exchange rate', async () => {
            const exchange_rate = await multivault.getFunction('exchangeRateCurrent(address)')(await token.getAddress());

            expect(exchange_rate)
                .to.be.equal(LP_BPS, 'Wrong initial exchange rate');
        });

        it('Check LP token initialized', async () => {
            const lp_token_address = await multivault.getFunction('getLPToken(address)')(await token.getAddress());
            const bob = await ethers.getNamedSigner('bob');

            lp_token = await ethers.getContractAt('MultiVaultToken', lp_token_address);

            const name_prefix = await multivault.DEFAULT_NAME_LP_PREFIX();
            const symbol_prefix = await multivault.DEFAULT_SYMBOL_LP_PREFIX();

            expect(await lp_token.name())
                .to.be.equal(`${name_prefix}${await token.name()}`);
            expect(await lp_token.symbol())
                .to.be.equal(`${symbol_prefix}${await token.symbol()}`);

            expect(await lp_token.totalSupply())
                .to.be.equal(liquidity_deposit);
            expect(await lp_token.balanceOf(bob.address))
                .to.be.equal(liquidity_deposit);
        });
    });

    describe('Alice withdraws alien token', async () => {
        const amount = ethers.parseUnits('10000', 18);

        let payload: string, signatures: string[];

        it('Build payload and signatures', async () => {
            const { alice } = await getNamedAccounts();

            const withdrawalEventData = encodeMultiTokenAlienWithdrawalData({
                token: await token.getAddress(),
                amount: amount,
                recipient: alice,
                chainId: defaultChainId,
                callback: {}
            });

            payload = encodeTvmEvent({
                eventData: withdrawalEventData,
                proxy: await multivault.getAddress(),
            });

            signatures = await getPayloadSignatures(payload);
        });

        it('Alice withdraws tokens', async () => {
            const alice = await ethers.getNamedSigner('alice');

            const {
                withdrawFee
            } = await multivault.getFunction('tokens(address)')(await token.getAddress());

            const fee = withdrawFee * amount / 10000n;

            // expect(fee)
            //     .to.be.greaterThan(ethers.BigNumber.from(0), 'Expected non zero withdraw fee');

            await expect(() => multivault.getFunction('saveWithdrawAlien(bytes,bytes[])')(payload, signatures))
                .to.changeTokenBalances(
                    token,
                    [multivault, alice],
                    [0n - (amount - fee), amount - fee]
                );
        });

        it('Check token cash increased', async () => {
            const liquidity = await multivault.getFunction('liquidity(address)')(await token.getAddress());

            expect(liquidity.cash)
                .to.be.gt(liquidity_deposit, 'Wrong liquidity cash');
            expect(liquidity.supply)
                .to.be.equal(liquidity_deposit, 'Wrong liquidity cash');
        });

        it('Check exchange rate increased', async () => {
            const exchange_rate = await multivault.getFunction('exchangeRateCurrent(address)')(await token.getAddress());

            expect(exchange_rate)
                .to.be.gt(LP_BPS, 'Wrong initial exchange rate');
        });
    });

    describe('Bob removes LPs', () => {
        it('Redeem LPs', async () => {
            const bob = await ethers.getNamedSigner('bob');
            const lp_balance = await lp_token.balanceOf(bob.address);

            const expected_tokens = await multivault.getFunction('convertLPToUnderlying(address,uint256)')(await token.getAddress(), lp_balance);

            expect(expected_tokens)
                .to.be.gt(liquidity_deposit, 'Wrong expected amount before LP redeem');

            await expect(async () => multivault.connect(bob).getFunction('redeemLP(address,uint256,address)')(await token.getAddress(), lp_balance, bob.address))
                .to.changeTokenBalances(
                    token,
                    [multivault, bob],
                    [0n - expected_tokens, expected_tokens]
                );
        });
    });
});
