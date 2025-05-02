import { deployments, ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";

import {
    defaultChainId,
    defaultTonRecipient,
    encodeEverscaleEvent,
    encodeMultiTokenAlienWithdrawalData,
    getPayloadSignatures,
} from "../utils";
import {
    ERC20,
    MultiVault
} from "../../typechain-types";

describe('Alice creates pending withdrawal', () => {
    let multivault: MultiVault;
    let token: ERC20;
    let snapshot: string;

    const amount = ethers.parseUnits('1000', 18);

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
            .approve(await multivault.getAddress(), ethers.parseUnits('1000000000000', 18));

        const deposit = multivault
            .connect(alice)
            .getFunction('deposit(((int8,uint256),address,uint256,uint256,bytes))');

        const deposit_value = ethers.parseEther("0.1");
        const deposit_expected_evers = 33;
        const deposit_payload = "0x001122";

        await deposit({
            recipient,
            token: await token.getAddress(),
            amount: amount - 1n,
            expected_evers: deposit_expected_evers,
            payload: deposit_payload
        }, { value: deposit_value });
    });

    it('Save withdrawal to Bob', async () => {
        const { bob } = await getNamedAccounts();

        const withdrawalEventData = encodeMultiTokenAlienWithdrawalData({
            token: await token.getAddress(),
            amount: amount,
            recipient: bob,
            chainId: defaultChainId,
            callback: {}
        });

        const payload = encodeEverscaleEvent({
            eventData: withdrawalEventData,
            proxy: await multivault.getAddress(),
        });

        const signatures = await getPayloadSignatures(payload);

        await multivault.getFunction('saveWithdrawAlien(bytes,bytes[])')(payload, signatures);
    });

    it('Check pending withdrawal', async () => {
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

        snapshot = await ethers.provider.send("evm_snapshot", []);
    });

    describe('Cancel pending withdrawal', async () => {
        const amountToCancel = 100n;
        const newBounty = 12;

        it('Checkout state', async () => {
            await ethers.provider.send("evm_revert", [snapshot]);
        });

        it('Cancel pending withdrawal', async () => {
            const bob = await ethers.getNamedSigner('bob');

            const cancel_value = ethers.parseEther("0.1");
            const cancel_expected_evers = 33;
            const cancel_payload = "0x001122";

            await expect(
                multivault
                    .connect(bob as any)
                    .cancelPendingWithdrawal(
                        0,
                        amountToCancel,
                        defaultTonRecipient,
                        cancel_expected_evers,
                        cancel_payload,
                        newBounty,
                        { value: cancel_value }
                    )
            )
                .to.emit(multivault, 'AlienTransfer')
                .withArgs(
                    defaultChainId,
                    await token.getAddress(),
                    await token.name(),
                    await token.symbol(),
                    await token.decimals(),
                    amountToCancel,
                    defaultTonRecipient.wid,
                    defaultTonRecipient.addr,
                    cancel_value,
                    cancel_expected_evers,
                    cancel_payload
                );
        });

        it('Check pending withdrawal', async () => {
            const { bob } = await getNamedAccounts();

            const pendingWithdrawal = await multivault.pendingWithdrawals(bob, 0);

            expect(pendingWithdrawal.bounty)
                .to.be.equal(newBounty, 'Wrong bounty after cancel');

            const defaultWithdrawFee = await multivault.defaultAlienWithdrawFee();

            const fee = defaultWithdrawFee * amount / 10000n;

            expect(pendingWithdrawal.amount)
                .to.be.equal(amount - fee - amountToCancel, 'Wrong pending amount after cancel');
        });
    });
});
