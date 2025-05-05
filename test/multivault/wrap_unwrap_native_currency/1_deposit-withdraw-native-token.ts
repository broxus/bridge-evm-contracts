import { deployments, ethers, getNamedAccounts, web3 } from "hardhat";
import { expect } from "chai";

import {
    encodeTvmEvent,
    defaultChainId,
    getPayloadSignatures,
    encodeMultiTokenAlienWithdrawalData,
} from '../../utils';
import {
    IWETH,
    MultiVault,
    UnwrapNativeToken
} from "../../../typechain-types";

describe.skip('Test deposit-withdraw for native token', () => {
    let multivault: MultiVault, weth: IWETH, unwrapNativeToken: UnwrapNativeToken;

    it('Setup contracts', async () => {
        await deployments.fixture();

        multivault = await ethers.getContract('MultiVault');
        unwrapNativeToken = await ethers.getContract('UnwrapNativeToken');

        weth = await ethers.getNamedSigner("weth")
            .then(({address}) => ethers.getContractAt("IWETH", address))
    });

    describe('Deposit', () => {
        const amount = ethers.parseUnits('0.9', 'ether')

        it('should deposit eth as weth', async () => {

            const alice = await ethers.getNamedSigner('alice');

            const recipient = {
                wid: 0,
                addr: 123123
            };

            const defaultDepositFee = await multivault.defaultAlienDepositFee();
            const fee = defaultDepositFee * amount / 10000n;
            const deposit = multivault.connect(alice).getFunction('depositByNativeToken(((int8,uint256),uint256,uint256,bytes))');
            const deposit_value = ethers.parseEther("0.1");


            const deposit_expected_gas = 33;
            const deposit_payload = "0x001122";

            const depResult = await deposit({
                recipient,
                amount: amount,
                expected_gas: deposit_expected_gas,
                payload: deposit_payload
            }, { value: amount + deposit_value });

            await expect(depResult)
                .to.emit(multivault, 'AlienTransfer')
                .withArgs(
                    defaultChainId,
                    await weth.getAddress(),
                    await weth.name(),
                    await weth.symbol(),
                    await weth.decimals(),
                    amount - fee,
                    recipient.wid,
                    recipient.addr,
                    deposit_value,
                    deposit_expected_gas,
                    deposit_payload
                );
        });

        it('Check token details', async () => {
            const tokenDetails = await multivault.tokens(await weth.getAddress());

            expect(tokenDetails.isNative)
                .to.be.equal(false, 'Wrong token native flag');
            expect(tokenDetails.depositFee)
                .to.be.equal(await multivault.defaultAlienDepositFee(), 'Wrong token deposit fee');
            expect(tokenDetails.withdrawFee)
                .to.be.equal(await multivault.defaultAlienWithdrawFee(), 'Wrong token withdraw fee');
        });

        it('Check MultiVault balance', async () => {
            expect(await weth.balanceOf(await multivault.getAddress()))
                .to.be.equal(amount, 'Wrong MultiVault token balance after deposit');
        });

        it('Skim alien fees in EVM', async () => {
            const owner = await ethers.getNamedSigner('owner');

            const fee = await multivault.fees(await weth.getAddress());

            await expect(async () => multivault.connect(owner).getFunction('skim(address)')(await weth.getAddress()))
                .to.changeTokenBalances(
                    weth,
                    [multivault, owner],
                    [0n - fee, fee]
                );

            expect(await multivault.fees(await weth.getAddress()))
                .to.be.equal(0);
        });
    });

    describe('Withdraw', () => {
        const amount = ethers.parseUnits('0.4', 'ether')

        let payload: string, signatures: string[];

        it('Prepare payload & signatures', async () => {
            const {bob} = await getNamedAccounts();

            const withdrawalEventData = encodeMultiTokenAlienWithdrawalData({
                token: await weth.getAddress(),
                amount: amount,
                recipient: await unwrapNativeToken.getAddress(),
                chainId: defaultChainId,
                callback: {
                    recipient: await unwrapNativeToken.getAddress(),
                    payload: web3.eth.abi.encodeParameters(
                        ['address'], [bob]
                    ),
                    strict: true
                }

            });
            payload = encodeTvmEvent({
                eventData: withdrawalEventData,
                proxy: await multivault.getAddress(),
            });

            signatures = await getPayloadSignatures(payload)
        });

        it('Save withdrawal', async () => {
            const bob = await ethers.getNamedSigner('bob');

            const {
                withdrawFee
            } = await multivault.tokens(await weth.getAddress());

            const fee = withdrawFee * amount / 10000n;

            let saveWithdrawAlienTransaction;

            await expect(() => {
                saveWithdrawAlienTransaction = multivault.getFunction('saveWithdrawAlien(bytes,bytes[])')(payload, signatures)
                return saveWithdrawAlienTransaction
            })
                .to.changeTokenBalances(
                    weth,
                    [multivault],
                    [0n - (amount - fee)]
                )

            await expect(saveWithdrawAlienTransaction).to.changeEtherBalance(bob, amount - fee)
        });
    });
});
