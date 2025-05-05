import { deployments, ethers, web3, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { EventLog } from 'ethers';

import {
    encodeTvmEvent,
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
    let multivault: MultiVault, weth: IWETH, unwrapNativeToken: UnwrapNativeToken;

    it('Setup contracts', async () => {
        await deployments.fixture();

        multivault = await ethers.getContract('MultiVault');
        unwrapNativeToken = await ethers.getContract('UnwrapNativeToken');

        weth = await ethers.getNamedSigner("weth")
            .then(({ address }) => ethers.getContractAt("IWETH", address))
    });


    describe("Pending withdraw", () => {
        const amount = ethers.parseUnits('0.9', 'ether')

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
            let payload: string, signatures: string[], pendingWithdrawId: string;

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

            it('Bob makes pending withdraw', async () => {
                const {
                    withdrawFee
                } = await multivault.tokens(await weth.getAddress());

                const fee = withdrawFee * amount / 10000n;

                const withdrawTransaction = await multivault.getFunction('saveWithdrawAlien(bytes,bytes[])')(payload, signatures)

                const { args } = await withdrawTransaction
                    .wait()
                    .then((receipt) => (receipt!.logs as EventLog[]).find((log) => log.fragment.name === "PendingWithdrawalCreated")!);

                expect(args.amount)
                    .to.be.equal(amount - fee, 'Emitted amount is wrong');
                expect(args.recipient)
                    .to.be.equal(await unwrapNativeToken.getAddress(), 'Emitted recipient is wrong');
                expect(args.token)
                    .to.be.equal(await weth.getAddress(), 'Emitted token is wrong');

                pendingWithdrawId = args.id;
            });

            it("Alice makes close of the bob's pending withdraw", async () => {
                const bob = await ethers.getNamedSigner('bob');
                const alice = await ethers.getNamedSigner('alice');
                const recipient = {
                    wid: 0,
                    addr: 123123
                };
                const deposit = multivault
                    .connect(alice)
                    .getFunction('depositByNativeToken(((int8,uint256),uint256,uint256,bytes),uint256,(address,uint256)[])');

                const deposit_expected_gas = 33;
                const deposit_payload = "0x001122";
                let depResult;

                await expect(async () => {
                    depResult = deposit(
                        {
                            recipient,
                            amount: amount,
                            expected_gas: deposit_expected_gas,
                            payload: deposit_payload
                        },
                        0,
                        [
                            {
                                recipient: await unwrapNativeToken.getAddress(),
                                id: pendingWithdrawId
                            }
                        ],
                        {value: amount})
                    return depResult
                })
                    .to
                    .changeTokenBalances(
                        weth,
                        [multivault],
                        [0]
                    )

                await expect(depResult)
                    .to
                    .changeEtherBalances(
                        [alice, bob],
                        [0n - amount, amount]
                    );
            });
        });

    })
});
