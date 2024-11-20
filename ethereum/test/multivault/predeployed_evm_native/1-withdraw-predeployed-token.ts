import { deployments, ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";

import {
  encodeEverscaleEvent,
  encodeMultiTokenNativeWithdrawalData,
  defaultChainId,
  getPayloadSignatures,
} from "../../utils";
import { ERC20, MultiVault } from "../../../typechain-types";

describe("Test withdraw for predeployed native token", () => {
  let multivault: MultiVault, token: ERC20;

  const native = {
    wid: -1,
    addr: 444,
  };

  let meta: {
    name: string;
    symbol: string;
    decimals: string;
  } = {};

  it("Setup contracts", async () => {
    await deployments.fixture();

    multivault = await ethers.getContract("MultiVault");
    token = await ethers.getContract("MultiOwnerToken");

    meta.name = await token.name();
    meta.symbol = await token.symbol();
    meta.decimals = (await token.decimals()).toString();

    const { deployer, owner } = await getNamedAccounts();
    await deployments.execute(
      "MultiOwnerToken",
      {
        from: deployer,
        log: true,
      },
      "transferOwnership",
      [await multivault.getAddress()],
    );

    const tx = await deployments.execute(
      "MultiVault",
      {
        from: owner,
        log: true,
      },
      "addPredeployedToken",
      native,
      await token.getAddress(),
      meta,
    );
  });

  describe("Withdraw WEVER Token", async () => {
    it("Check EVM token address", async () => {
      const tokenAddress = await multivault.getNativeToken(
        native.wid,
        native.addr,
      );
      expect(tokenAddress).to.be.equal(
        await token.getAddress(),
        "Wrong token address",
      );
    });

    it("Check native token status", async () => {
      const tokenAddress = await multivault.getNativeToken(
        native.wid,
        native.addr,
      );

      const tokenDetails = await multivault.tokens(tokenAddress);

      expect(tokenDetails.isNative).to.be.equal(
        true,
        "Wrong token native flag",
      );
      expect(tokenDetails.depositFee).to.be.equal(
        await multivault.defaultNativeDepositFee(),
        "Wrong token deposit fee",
      );
      expect(tokenDetails.withdrawFee).to.be.equal(
        await multivault.defaultNativeWithdrawFee(),
        "Wrong token withdraw fee",
      );
    });

    let payload, signatures;
    const amount = ethers.parseUnits("500", meta.decimals);

    it("Save withdraw", async () => {
      const bob = await ethers.getNamedSigner("bob");

      const withdrawalEventData = encodeMultiTokenNativeWithdrawalData({
        native,

        name: meta.name,
        symbol: meta.symbol,
        decimals: meta.decimals,

        amount,
        recipient: bob.address,
        chainId: defaultChainId,

        callback: {},
      });

      payload = encodeEverscaleEvent({
        eventData: withdrawalEventData,
        proxy: await multivault.getAddress(),
      });

      signatures = await getPayloadSignatures(payload);

      await multivault.connect(bob).getFunction("saveWithdrawNative")(
        payload,
        signatures,
      );
    });

    it("Check recipient balance and total supply", async () => {
      const { bob } = await getNamedAccounts();

      const { withdrawFee } = await multivault.tokens(await token.getAddress());

      const fee = (amount * withdrawFee) / 10000n;

      expect(await token.balanceOf(bob)).to.be.equal(
        amount - fee,
        "Wrong recipient balance after withdraw",
      );

      expect(await token.totalSupply()).to.be.equal(
        amount - fee,
        "Wrong token total supply",
      );
    });

    it("Bob transfers 100 ERC20 WEVER to Alice", async () => {
      const bob = await ethers.getNamedSigner("bob");
      const { alice } = await getNamedAccounts();

      await token
        .connect(bob as any)
        .transfer(alice, ethers.parseUnits("100", BigInt(meta.decimals)));
    });

    it("Skim native fees", async () => {
      const owner = await ethers.getNamedSigner("owner");

      const fee = await multivault.fees(await token.getAddress());

      await expect(async () =>
        multivault.connect(owner).skim(await token.getAddress()),
      ).to.changeTokenBalances(token, [multivault, owner], [0, fee]);

      expect(await multivault.fees(token.getAddress())).to.be.equal(0);
    });
  });

  describe("Remove predeployed token", async () => {
    it("Remove predeployed token", async () => {
      const { owner } = await getNamedAccounts();

      const tx = await deployments.execute(
        "MultiVault",
        {
          from: owner,
          log: true,
        },
        "removePredeployedToken",
        native,
        await token.getAddress(),
      );

      const predeployed = await multivault.predeployed(native);
      const storageTokenData = await multivault.tokens(
        await token.getAddress(),
      );
      const storageNativeData = await multivault.getNativeToken(
        native.wid,
        native.addr,
      );
      expect(predeployed).to.be.equal(ethers.ZeroAddress);
      expect(storageTokenData.isNative).to.be.equal(false);
      expect(storageNativeData).to.be.not.equal(await token.getAddress());
    });
  });
});
