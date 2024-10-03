import { deployments, ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";

import {
    defaultChainId,
    deriveWithdrawalPeriodId,
    encodeEverscaleEvent,
    encodeMultiTokenAlienWithdrawalData,
    getPayloadSignatures,
} from "../utils";
import {
    ERC20,
    MultiVault
} from "../../typechain-types";

describe('Test alien withdrawal limits', () => {
    let multivault: MultiVault, token: ERC20;
    let snapshot: string;

    const deposit_amount = ethers.parseUnits('1000', 18);
    const undeclared = ethers.parseUnits('500', 18);
    const daily = ethers.parseUnits('700', 18);

    it('Setup contracts', async () => {
        await deployments.fixture();

        multivault = await ethers.getContract('MultiVault');
        token = await ethers.getContract('Token');
    });

    it('Alice deposits alien token', async () => {
        const alice = await ethers.getNamedSigner('alice');

        const recipient = {
            wid: 0,
            addr: 123123
        };

        await token
            .connect(alice)
            .approve(await multivault.getAddress(), deposit_amount);

        const deposit = multivault
            .connect(alice)
            .getFunction('deposit(((int8,uint256),address,uint256,uint256,bytes))');

        const deposit_value = ethers.parseEther("0.1");
        const deposit_expected_evers = 33;
        const deposit_payload = "0x001122";

        await deposit({
            recipient,
            token: await token.getAddress(),
            amount: deposit_amount,
            expected_evers: deposit_expected_evers,
            payload: deposit_payload
        }, { value: deposit_value });
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

    it('Save snapshot', async () => {
        snapshot = await ethers.provider.send("evm_snapshot", []);
    });

    describe('Withdraw more than undeclared limit', () => {
        let amount = undeclared + 1n;

        const eventTimestamp = 111;

        it('Withdraw', async () => {
            const { bob } = await getNamedAccounts();

            const withdrawalEventData = encodeMultiTokenAlienWithdrawalData({
                token: await token.getAddress(),
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

            await multivault.getFunction('saveWithdrawAlien(bytes,bytes[])')(payload, signatures);
        });

        it('Check pending withdrawal created', async () => {
            const { bob } = await getNamedAccounts();

            const pendingWithdrawal = await multivault.pendingWithdrawals(bob, 0);

            const defaultWithdrawFee = await multivault.defaultAlienWithdrawFee();

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
                .getFunction('setPendingWithdrawalApprove((address,uint256),uint8)')({ recipient: bob.address, id: 0}, 2)
            ).to.changeTokenBalances(
                token,
                [multivault, bob],
                [0n - pendingWithdrawal.amount, pendingWithdrawal.amount]
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

    describe('Withdraw more than daily limit', () => {
        const amount = daily + 1n;
        const eventTimestamp = 222;

        it('Checkout state', async () => {
            await ethers.provider.send("evm_revert", [snapshot]);
        });

        it('Withdraw', async () => {
            const { bob } = await getNamedAccounts();

            const withdrawalEventData = encodeMultiTokenAlienWithdrawalData({
                token: await token.getAddress(),
                amount,
                recipient: bob,
                chainId: defaultChainId,
                callback: {}
            });

            const payload = encodeEverscaleEvent({
                eventData: withdrawalEventData,
                proxy: await multivault.getAddress(),
                eventTimestamp
            });

            const signatures = await getPayloadSignatures(payload);

            await multivault.getFunction('saveWithdrawAlien(bytes,bytes[])')(payload, signatures);
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
                [multivault, bob],
                [0n - pendingWithdrawal.amount, pendingWithdrawal.amount]
            );
        });

        it('Check withdrawal period stats', async () => {
            const withdrawalPeriodId = deriveWithdrawalPeriodId(eventTimestamp);
            const withdrawalPeriod = await multivault.withdrawalPeriods(
                await token.getAddress(),
                withdrawalPeriodId
            );

            // const bob = await ethers.getNamedSigner('bob');

            expect(withdrawalPeriod.total)
                .to.be.equal(amount, 'Wrong period total');
        });
    });
});
