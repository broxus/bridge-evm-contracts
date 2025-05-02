import { deployments, ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";

import {
    encodeEverscaleEvent,
    encodeMultiTokenAlienWithdrawalData,
    defaultChainId,
    getPayloadSignatures,
} from '../utils';
import {
    ERC20,
    MultiVault
} from "../../typechain-types";

describe('Test deposit-withdraw for alien token', () => {
    let multivault: MultiVault, token: ERC20;

    it('Setup contracts', async () => {
        await deployments.fixture();

        multivault = await ethers.getContract('MultiVault');
        token = await ethers.getContract('Token');
    });

    describe('Deposit', () => {
        const amount = ethers.parseUnits('1000', 18);

        it('Alice deposits 1000 test token', async () => {
            const alice = await ethers.getNamedSigner('alice');

            const recipient = {
                wid: 0,
                addr: 123123
            };

            const defaultDepositFee = await multivault.getFunction('defaultAlienDepositFee()')();

            const fee = defaultDepositFee * amount / 10000n;

            await token
                .connect(alice)
                .approve(await multivault.getAddress(), ethers.parseUnits('1000000000000', 18));

            const deposit = multivault.connect(alice).getFunction('deposit(((int8,uint256),address,uint256,uint256,bytes))');

            const deposit_value = ethers.parseEther("0.1");
            const deposit_expected_evers = 33;
            const deposit_payload = "0x001122";

            await expect(deposit({
                    recipient,
                    token: await token.getAddress(),
                    amount,
                    expected_evers: deposit_expected_evers,
                    payload: deposit_payload
                }, { value: deposit_value }))
                .to.emit(multivault, 'AlienTransfer')
                .withArgs(
                    defaultChainId,
                    await token.getAddress(),
                    await token.name(),
                    await token.symbol(),
                    await token.decimals(),
                    amount - fee,
                    recipient.wid,
                    recipient.addr,
                    deposit_value,
                    deposit_expected_evers,
                    deposit_payload
                );
        });

        it('Check token details', async () => {
            const tokenDetails = await multivault.tokens(await token.getAddress());

            expect(tokenDetails.isNative)
                .to.be.equal(false, 'Wrong token native flag');
            expect(tokenDetails.depositFee)
                .to.be.equal(await multivault.defaultAlienDepositFee(), 'Wrong token deposit fee');
            expect(tokenDetails.withdrawFee)
                .to.be.equal(await multivault.defaultAlienWithdrawFee(), 'Wrong token withdraw fee');
        });

        it('Check MultiVault balance', async () => {
            expect(await token.balanceOf(await multivault.getAddress()))
                .to.be.equal(amount, 'Wrong MultiVault token balance after deposit');
        });

        it('Skim alien fees in EVM', async () => {
            const owner = await ethers.getNamedSigner('owner');

            const fee = await multivault.fees(await token.getAddress());

            await expect(async () => multivault.connect(owner).getFunction('skim(address)')(await token.getAddress()))
                .to.changeTokenBalances(
                    token,
                    [multivault, owner],
                    [0n - fee, fee]
                );

            expect(await multivault.fees(await token.getAddress()))
                .to.be.equal(0);
        });
    });

    describe('Withdraw', () => {
        const amount = ethers.parseUnits('500', 18);

        let payload: string, signatures: string[];

        it('Prepare payload & signatures', async () => {
            const { bob } = await getNamedAccounts();

            const withdrawalEventData = encodeMultiTokenAlienWithdrawalData({
                token: await token.getAddress(),
                amount: amount,
                recipient: bob,
                chainId: defaultChainId,
                callback: {}
            });

            payload = encodeEverscaleEvent({
                eventData: withdrawalEventData,
                proxy: await multivault.getAddress(),
            });

            signatures = await getPayloadSignatures(payload);
        });

        it('Save withdrawal', async () => {
            const bob = await ethers.getNamedSigner('bob');

            const {
                withdrawFee
            } = await multivault.tokens(await token.getAddress());

            const fee = withdrawFee * amount / 10000n;

            await expect(() => multivault.getFunction('saveWithdrawAlien(bytes,bytes[])')(payload, signatures))
                .to.changeTokenBalances(
                    token,
                    [multivault, bob],
                    [0n - (amount - fee), amount - fee]
                );
        });
    });
});
