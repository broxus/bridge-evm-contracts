// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;


import "../../interfaces/multivault/IMultiVaultFacetLiquidity.sol";
import "../../interfaces/multivault/IMultiVaultFacetTokenFactory.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../storage/MultiVaultStorage.sol";

import "../helpers/MultiVaultHelperReentrancyGuard.sol";
import "../helpers/MultiVaultHelperLiquidity.sol";
import "../helpers/MultiVaultHelperEmergency.sol";
import "../helpers/MultiVaultHelperFee.sol";
import "../helpers/MultiVaultHelperActors.sol";


contract MultiVaultFacetLiquidity is
    MultiVaultHelperEmergency,
    MultiVaultHelperReentrancyGuard,
    MultiVaultHelperLiquidity,
    MultiVaultHelperActors,
    MultiVaultHelperFee,
    IMultiVaultFacetLiquidity
{
    using SafeERC20 for IERC20;

    /// @notice The mint function transfers an asset into the protocol,
    /// which begins accumulating interest based on the current Supply Rate for the asset.
    /// @param token Underlying asset address
    /// @param amount The amount of the asset to be supplied, in units of the underlying asset
    function mintLP(
        address token,
        uint amount,
        address recipient
    ) external override onlyEmergencyDisabled nonReentrant {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        require(s.tokens_[token].isNative == false, "Liquidity: token is native");

        uint balanceBefore = IERC20(token).balanceOf(address(this));

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint balanceAfter = IERC20(token).balanceOf(address(this));

        amount = balanceAfter - balanceBefore;

        address lp;

        if (s.liquidity[token].activation == 0) {
            require(msg.sender == s.governance || msg.sender == s.management, "Liquidity: only governance or management");
            require(amount >= 1000 wei, "Liquidity: amount is too small");
            require(recipient == s.governance, "Liquidity: recipient is not governance");
            lp = IMultiVaultFacetTokenFactory(address(this)).deployLPToken(token);

            s.liquidity[token].activation = block.number;
            s.liquidity[token].interest = s.defaultInterest;
        } else {
            lp = _getLPToken(token);
        }

        uint lp_amount = _convertUnderlyingToLP(token, amount);

        s.liquidity[token].cash += amount;
        s.liquidity[token].supply += lp_amount;

        emit MintLiquidity(msg.sender, token, amount, lp_amount);

        IMultiVaultFacetTokenFactory(address(this)).mint(
            lp,
            recipient,
            lp_amount
        );
    }

    /// @notice The redeem function converts a specified quantity of LP tokens
    /// into the underlying asset, and returns them to the user.
    /// @param token Underlying asset address
    /// @param amount The number of LP tokens to be redeemed
    function redeemLP(
        address token,
        uint amount,
        address recipient
    ) external override onlyEmergencyDisabled nonReentrant onlyActivatedLP(token) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        address lp = _getLPToken(token);

        IMultiVaultFacetTokenFactory(address(this)).burn(
            lp,
            msg.sender,
            amount
        );

        uint underlying_amount = _convertLPToUnderlying(token, amount);

        s.liquidity[token].cash -= underlying_amount;
        s.liquidity[token].supply -= amount;

        emit RedeemLiquidity(msg.sender, token, amount, underlying_amount);

        IERC20(token).safeTransfer(recipient, underlying_amount);
    }

    /// @notice Each LP token is convertible into a native tvm token increasing quantity of the underlying asset,
    /// as interest accrues in the market.
    /// @param token Underlying token address
    function exchangeRateCurrent(
        address token
    ) external view override returns (uint) {
        return _exchangeRateCurrent(token);
    }

    /// @notice Cash is the amount of underlying balance owned by this LP token contract.
    /// @param token The address of underlying asset
    /// @return The quantity of underlying asset owned by the contract
    function getCash(
        address token
    ) external view override returns (uint) {
        return _getCash(token);
    }

    function getSupply(
        address token
    ) external view override returns (uint) {
        return _getSupply(token);
    }

    function setTokenInterest(
        address token,
        uint interest
    ) external override onlyGovernanceOrManagement respectFeeLimit(interest) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        s.liquidity[token].interest = interest;

        emit UpdateTokenLiquidityInterest(token, interest);
    }

    function setDefaultInterest(
        uint interest
    ) external override onlyGovernanceOrManagement respectFeeLimit(interest) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        s.defaultInterest = interest;

        emit UpdateDefaultLiquidityInterest(interest);
    }

    function liquidity(
        address token
    ) external view override returns (Liquidity memory) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        return s.liquidity[token];
    }

    function convertLPToUnderlying(
        address token,
        uint amount
    ) external view override returns (uint) {
        return _convertLPToUnderlying(token, amount);
    }

    function convertUnderlyingToLP(
        address token,
        uint amount
    ) external view override returns (uint) {
        return _convertUnderlyingToLP(token, amount);
    }
}
