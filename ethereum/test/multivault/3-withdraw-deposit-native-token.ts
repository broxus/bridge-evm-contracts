import { deployments, ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";

import {
    encodeEverscaleEvent,
    encodeMultiTokenNativeWithdrawalData,
    defaultChainId,
    getPayloadSignatures,
} from '../utils';
import {
    ERC20,
    MultiVault
} from "../../typechain-types";

describe('Test deposit-withdraw for native token', () => {
    let multivault: MultiVault, token: ERC20;

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
    });

    describe('Withdraw WEVER Token', async () => {
        let payload, signatures;

        const amount = ethers.parseUnits('500', 18);

        it('Save withdraw', async () => {
            const bob = await ethers.getNamedSigner('bob');

            const withdrawalEventData = encodeMultiTokenNativeWithdrawalData({
                native,

                name: meta.name,
                symbol: meta.symbol,
                decimals: meta.decimals,

                amount,
                recipient: bob.address,
                chainId: defaultChainId,

                callback: {}
            });

            payload = encodeEverscaleEvent({
                eventData: withdrawalEventData,
                proxy: await multivault.getAddress(),
            });

            signatures = await getPayloadSignatures(payload);

            await multivault
                .connect(bob)
                .getFunction('saveWithdrawNative')(payload, signatures);
        });

        it('Check EVM token meta', async () => {
            const tokenAddress = await multivault.getNativeToken(native.wid, native.addr);

            token = await ethers.getContractAt('MultiVaultToken', tokenAddress);

            expect(await token.name())
                .to.be.equal(`${meta.name}`, 'Wrong token name');
            expect(await token.symbol())
                .to.be.equal(`${meta.symbol}`, 'Wrong token symbol');
            expect(await token.decimals())
                .to.be.equal(meta.decimals, 'Wrong token decimals');
        });

        it('Check native token status', async () => {
            const tokenAddress = await multivault.getNativeToken(native.wid, native.addr);

            const tokenDetails = await multivault.tokens(tokenAddress);

            expect(tokenDetails.isNative)
                .to.be.equal(true, 'Wrong token native flag');
            expect(tokenDetails.depositFee)
                .to.be.equal(await multivault.defaultNativeDepositFee(), 'Wrong token deposit fee');
            expect(tokenDetails.withdrawFee)
                .to.be.equal(await multivault.defaultNativeWithdrawFee(), 'Wrong token withdraw fee');
        });

        it('Check recipient balance and total supply', async () => {
            const { bob } = await getNamedAccounts();

            const {
                withdrawFee
            } = await multivault.tokens(await token.getAddress());

            const fee = amount * withdrawFee / 10000n;

            expect(await token.balanceOf(bob))
                .to.be.equal(amount - fee, 'Wrong recipient balance after withdraw');

            expect(await token.totalSupply())
                .to.be.equal(amount - fee, 'Wrong token total supply');
        });

        it('Bob transfers 100 ERC20 WEVER to Alice', async () => {
            const bob = await ethers.getNamedSigner('bob');
            const { alice } = await getNamedAccounts();

            await token.connect(bob as any).transfer(alice, ethers.parseUnits('100', 18));
        });

        it('Skim native fees', async () => {
            const owner = await ethers.getNamedSigner('owner');

            const fee = await multivault.fees(await token.getAddress());

            await expect(async () => multivault.connect(owner).skim(await token.getAddress()))
                .to.changeTokenBalances(
                    token,
                    [multivault, owner],
                    [0, fee]
                );

            expect(await multivault.fees(token.getAddress()))
                .to.be.equal(0);
        });
    });

    describe('Deposit WEVER token', async () => {
        const amount = ethers.parseUnits('300', 18);

        let fee;

        it('Bob deposits 300 WEVER', async () => {
            const bob = await ethers.getNamedSigner('bob');

            const recipient = {
                wid: 0,
                addr: 123123
            };

            const tokenDetails = await multivault.tokens(await token.getAddress());

            fee = tokenDetails.depositFee * amount / 10000n;

            const deposit = multivault
                .connect(bob)
              .getFunction('deposit(((int8,uint256),address,uint256,uint256,bytes))');

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
                .to.emit(multivault, 'NativeTransfer')
                .withArgs(
                    native.wid,
                    native.addr,
                    amount - fee,
                    recipient.wid,
                    recipient.addr,
                    deposit_value,
                    deposit_expected_evers,
                    deposit_payload
                );
        });

        it('Check MultiVault balance', async () => {
            expect(await token.balanceOf(await multivault.getAddress()))
                .to.be.equal(0, 'MultiVault balance should be zero');
        });
    });
});
