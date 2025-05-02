import { deployments, ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { ERC20, MultiVault } from "../../../typechain-types";

describe("Test deposit for predeployed native token", () => {
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

    const { bob } = await getNamedAccounts();
    await deployments.execute(
      "MultiOwnerToken",
      {
        from: deployer,
        log: true,
      },
      "mint",
      bob,
      ethers.parseUnits("500", BigInt(meta.decimals)),
    );

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

  describe("Deposit WEVER token", async () => {
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

    it("Bob deposits 300 WEVER", async () => {
      const bob = await ethers.getNamedSigner("bob");

      const amount = ethers.parseUnits("300", BigInt(meta.decimals));
      let fee;

      const recipient = {
        wid: 0,
        addr: 123123,
      };

      const tokenDetails = await multivault.tokens(await token.getAddress());

      fee = (tokenDetails.depositFee * amount) / 10000n;

      const deposit = multivault
        .connect(bob)
        .getFunction("deposit(((int8,uint256),address,uint256,uint256,bytes))");

      const deposit_value = ethers.parseEther("0.1");
      const deposit_expected_evers = 33;
      const deposit_payload = "0x001122";

      await expect(
        deposit(
          {
            recipient,
            token: await token.getAddress(),
            amount,
            expected_evers: deposit_expected_evers,
            payload: deposit_payload,
          },
          { value: deposit_value },
        ),
      )
        .to.emit(multivault, "NativeTransfer")
        .withArgs(
          native.wid,
          native.addr,
          amount - fee,
          recipient.wid,
          recipient.addr,
          deposit_value,
          deposit_expected_evers,
          deposit_payload,
        );
    });

    it("Check MultiVault balance", async () => {
      expect(await token.balanceOf(await multivault.getAddress())).to.be.equal(
        0,
        "MultiVault balance should be zero",
      );
    });
  });
});
