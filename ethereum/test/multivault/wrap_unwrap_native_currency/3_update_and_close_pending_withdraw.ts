import { deployments, ethers, getNamedAccounts, web3 } from "hardhat";
import { expect } from "chai";
import { EventLog } from 'ethers';

import {
    encodeEverscaleEvent,
    encodeMultiTokenAlienWithdrawalData,
    defaultChainId,
    getPayloadSignatures,
} from '../../utils';
import {
    IWETH,
    MultiVault,
    UnwrapNativeToken
} from "../../../typechain-types";

describe.skip('Test deposit-withdraw-with-pending for native token', () => {
    let multivault: MultiVault;
    let weth: IWETH, unwrapNativeToken: UnwrapNativeToken;

    it('Setup contracts', async () => {
        await deployments.fixture();

        multivault = await ethers.getContract('MultiVault');
        unwrapNativeToken = await ethers.getContract('UnwrapNativeToken');

        weth = await ethers.getNamedSigner("weth")
            .then(({ address }) => ethers.getContractAt("IWETH", address))
    });

    describe("Pending withdraw", () => {
        const amount = ethers.parseUnits('0.9', 'ether')
        const partialCancelWithdrawAmount = ethers.parseUnits('0.1', 'ether')

        it('Setup contracts', async () => {
            await deployments.fixture();

            multivault = await ethers.getContract('MultiVault');
            unwrapNativeToken = await ethers.getContract('UnwrapNativeToken');
            weth = await ethers.getNamedSigner("weth")
                .then(({ address }) => ethers.getContractAt("IWETH", address))
        });

        it('Check MultiVault balance', async () => {
            expect(await weth.balanceOf(await multivault.getAddress()))
                .to.be.equal(0, 'Wrong MultiVault token balance after deposit');
        });

        describe('Bob withdraw weth, when the vault weth balance is empty', () => {
            let payload: string, signatures: string[], bobsPendingWithdrawId: string;

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
                payload = encodeEverscaleEvent({
                    eventData: withdrawalEventData,
                    proxy: await multivault.getAddress(),
                });

                signatures = await getPayloadSignatures(payload)
            });

            it('Bob makes pending withdraw', async () => {
                const {
                    withdrawFee
                } = await multivault.tokens(await weth.getAddress());

                const fee = withdrawFee * amount / 10000n;

                const withdrawTransaction = await multivault.getFunction('saveWithdrawAlien(bytes,bytes[])')(payload, signatures)

                const receipt = await withdrawTransaction.wait();

                const [{
                    args: {
                        id: pendingWithdrawalId,
                        payloadId
                    }
                }] = receipt!.logs as EventLog[];

                await expect(withdrawTransaction)
                    .to
                    .emit(multivault, 'PendingWithdrawalCreated')
                    .withArgs(await unwrapNativeToken.getAddress(), pendingWithdrawalId, await weth.getAddress(), amount - fee, payloadId);

                const {args: {id}} = await withdrawTransaction
                  .wait()
                  .then((receipt) => (receipt!.logs as EventLog[]).find((log) => log.fragment.name === "PendingWithdrawalCreated")!);

                bobsPendingWithdrawId = id;
                const pendingWithdrawState = await multivault.pendingWithdrawals(await unwrapNativeToken.getAddress(), bobsPendingWithdrawId);
                expect(pendingWithdrawState.bounty).to.be.equal(0, "initial bounty should be equal to 0")
            });

            it("Bob set bounty for pending withdraw request", async () => {
                const NEW_BOUNTY = 10
                const bob = await ethers.getNamedSigner('bob');
                await expect(
                    await unwrapNativeToken
                        .connect(bob)
                        .setPendingWithdrawalBounty(bobsPendingWithdrawId, NEW_BOUNTY)
                )
                    .to
                    .emit(multivault, 'PendingWithdrawalUpdateBounty')
                    .withArgs(await unwrapNativeToken.getAddress(), bobsPendingWithdrawId, NEW_BOUNTY)

                const pendingWithdrawState = await multivault.pendingWithdrawals(await unwrapNativeToken.getAddress(), bobsPendingWithdrawId);
                expect(pendingWithdrawState.bounty).to.be.equal(NEW_BOUNTY, "bounty value should be updated")
            });

            it('Bob should partially cancel withdraw request', async () => {
                const bob = await ethers.getNamedSigner('bob');
                const recipient = {
                    wid: 0,
                    addr: 123123
                };
                const deposit_expected_evers = 33;
                const deposit_payload = "0x001122";

                await expect(
                    await unwrapNativeToken
                        .connect(bob)
                        .cancelPendingWithdrawal(
                            bobsPendingWithdrawId,
                            partialCancelWithdrawAmount,
                            recipient,
                            deposit_expected_evers,
                            deposit_payload,
                            0
                        )
                )
                    .to
                    .emit(multivault, 'PendingWithdrawalCancel')
                    .withArgs(await unwrapNativeToken.getAddress(), bobsPendingWithdrawId, partialCancelWithdrawAmount)
                const pendingWithdrawState = await multivault.pendingWithdrawals(await unwrapNativeToken.getAddress(), bobsPendingWithdrawId);
                expect(pendingWithdrawState.amount).to.be.equal(amount - partialCancelWithdrawAmount, "withdraw amount should be decreased")
            });

            it('Alice makes deposit', async () => {
                const depositAmount = amount * 2n;

                const alice = await ethers.getNamedSigner('alice');

                const recipient = {
                    wid: 0,
                    addr: 123123
                };

                const defaultDepositFee = await multivault.defaultAlienDepositFee();
                const fee = defaultDepositFee * depositAmount / 10000n;
                const deposit = multivault
                    .connect(alice)
                    .getFunction('depositByNativeToken(((int8,uint256),uint256,uint256,bytes))');


                const deposit_value = ethers.parseEther("0.1");


                const deposit_expected_evers = 33;
                const deposit_payload = "0x001122";

                const depResult = await deposit({
                    recipient,
                    amount: depositAmount,
                    expected_evers: deposit_expected_evers,
                    payload: deposit_payload
                }, { value: depositAmount + deposit_value })
                await expect(depResult)
                    .to.emit(multivault, 'AlienTransfer')
                    .withArgs(
                        defaultChainId,
                        await weth.getAddress(),
                        await weth.name(),
                        await weth.symbol(),
                        await weth.decimals(),
                        depositAmount - fee,
                        recipient.wid,
                        recipient.addr,
                        deposit_value,
                        deposit_expected_evers,
                        deposit_payload
                    );
            });

            it('Bob run force withdraw', async () => {
                const bob = await ethers.getNamedSigner('bob');

                let forceWithdrawTransaction;
                await expect(async () => {
                    forceWithdrawTransaction = multivault
                        .connect(bob)
                        .forceWithdraw([{
                            recipient: await unwrapNativeToken.getAddress(),
                            id: bobsPendingWithdrawId
                        }])
                    return forceWithdrawTransaction
                }).to.changeTokenBalances(
                    weth,
                    [multivault],
                    [0n - (amount - partialCancelWithdrawAmount)]
                )
                await expect(forceWithdrawTransaction)
                    .to
                    .emit(multivault,"PendingWithdrawalForce")
                    .withArgs({
                        recipient: await unwrapNativeToken.getAddress(),
                        id: bobsPendingWithdrawId
                    })
                    .to
                    .changeEtherBalance(
                        bob,
                        amount - partialCancelWithdrawAmount
                    )
            });
        });

    })
});
