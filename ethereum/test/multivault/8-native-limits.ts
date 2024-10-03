import { deployments, ethers, getNamedAccounts } from 'hardhat';
import { expect } from "chai";

import {
    defaultChainId,
    deriveWithdrawalPeriodId,
    encodeEverscaleEvent,
    encodeMultiTokenNativeWithdrawalData,
    getPayloadSignatures
} from "../utils";
import { ERC20, MultiVault } from "../../typechain-types";

describe('Test native withdrawal limits', () => {
    let multivault: MultiVault, token: ERC20;

    const undeclared = ethers.parseUnits('500', 9);
    const daily = ethers.parseUnits('700', 9);

    const native = {
        wid: -1,
        addr: 444
    };

    const meta = {
        name: 'Wrapped EVER',
        symbol: 'WEVER',
        decimals: 9
    };

    it('Setup contracts', async () => {
        await deployments.fixture();

        multivault = await ethers.getContract('MultiVault');
        token = await ethers.getContract('Token');
    });

    it('Save withdraw', async () => {
        const bob = await ethers.getNamedSigner('bob');

        const withdrawalEventData = encodeMultiTokenNativeWithdrawalData({
            native,

            name: meta.name,
            symbol: meta.symbol,
            decimals: meta.decimals,

            amount: 1n,
            recipient: bob.address,
            chainId: defaultChainId,

            callback: {}
        });

        const payload = encodeEverscaleEvent({
            eventData: withdrawalEventData,
            proxy: await multivault.getAddress(),
        });

        const signatures = await getPayloadSignatures(payload);

        await multivault
            .connect(bob)
            .saveWithdrawNative(payload, signatures);

        const tokenAddress = await multivault.getNativeToken(native.wid, native.addr);

        token = await ethers.getContractAt('MultiVaultToken', tokenAddress);
    });

    it('Set limits for token', async () => {
        const owner = await ethers.getNamedSigner('owner');

        await multivault.connect(owner).setDailyWithdrawalLimits(
            await token.getAddress(),
            daily,
        );

        await multivault.connect(owner).setUndeclaredWithdrawalLimits(
            await token.getAddress(),
            undeclared,
        );

        await multivault.connect(owner).enableWithdrawalLimits(
            await token.getAddress(),
        );

        const limits = await multivault.withdrawalLimits(await token.getAddress());

        expect(limits.enabled)
            .to.be.equal(true, 'Wrong limits enabled status');
        expect(limits.undeclared)
            .to.be.equal(undeclared, 'Wrong undeclared limit');
        expect(limits.daily)
            .to.be.equal(daily, 'Wrong daily limit');
    });

    describe('Withdraw more than undeclared limit', async () => {
        const amount = undeclared + 1n;

        const eventTimestamp = 111;

        it('Withdraw', async () => {
            const { bob } = await getNamedAccounts();

            const withdrawalEventData = encodeMultiTokenNativeWithdrawalData({
                native,

                name: meta.name,
                symbol: meta.symbol,
                decimals: meta.decimals,

                amount,
                recipient: bob,
                chainId: defaultChainId,

                callback: {}
            });

            const payload = encodeEverscaleEvent({
                eventData: withdrawalEventData,
                proxy: await multivault.getAddress(),
                eventTimestamp,
            });

            const signatures = await getPayloadSignatures(payload);

            await multivault.getFunction('saveWithdrawNative(bytes,bytes[])')(payload, signatures);
        });

        it('Check pending withdrawal created', async () => {
            const { bob } = await getNamedAccounts();

            const pendingWithdrawal = await multivault.pendingWithdrawals(bob, 0);

            const defaultWithdrawFee = await multivault.defaultNativeWithdrawFee();

            const fee = defaultWithdrawFee * amount / 10000n;

            expect(pendingWithdrawal.token)
                .to.be.equal(await token.getAddress(), 'Wrong token in pending withdrawal');
            expect(pendingWithdrawal.amount)
                .to.be.equal(amount - fee, 'Wrong amount in pending withdrawal');
            expect(pendingWithdrawal.bounty)
                .to.be.equal(0, 'Wrong bounty in pending withdrawal');

            expect(await multivault.pendingWithdrawalsTotal(await token.getAddress()))
                .to.be.equal(amount - fee, 'Wrong total pending withdrawals');

            expect(await multivault.pendingWithdrawalsPerUser(bob))
                .to.be.equal(1, 'Wrong pending withdrawals per user');
        });

        it('Check withdrawal period stats', async () => {
            const withdrawalPeriodId = deriveWithdrawalPeriodId(eventTimestamp);
            const withdrawalPeriod = await multivault.withdrawalPeriods(
                await token.getAddress(),
                withdrawalPeriodId
            );

            expect(withdrawalPeriod.considered)
                .to.be.equal(0, 'Wrong period considered');
            expect(withdrawalPeriod.total)
                .to.be.equal(amount, 'Wrong period total');
        });

        it('Approve pending withdrawal', async () => {
            const owner = await ethers.getNamedSigner('owner');
            const bob = await ethers.getNamedSigner('bob');

            const pendingWithdrawal = await multivault.pendingWithdrawals(bob.address, 0);

            await expect(() => multivault
                .connect(owner)
                .getFunction('setPendingWithdrawalApprove((address,uint256),uint8)')({ recipient: bob.address, id: 0 }, 2)
            ).to.changeTokenBalances(
                token,
                [bob],
                [pendingWithdrawal.amount]
            );
        });

        it('Check pending withdrawal closed', async () => {
            const { bob } = await getNamedAccounts();
            const pendingWithdrawal = await multivault.pendingWithdrawals(bob, 0);

            expect(pendingWithdrawal.amount)
                .to.be.equal(0, 'Wrong amount in pending withdrawal');
            expect(pendingWithdrawal.approveStatus)
                .to.be.equal(2, 'Wrong approve status in pending withdrawal');
        });
    });
});
