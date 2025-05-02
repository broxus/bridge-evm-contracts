// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;


import "../../interfaces/ITVM.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../../interfaces/multivault/IMultiVaultFacetDepositEvents.sol";
import "../../interfaces/multivault/IMultiVaultFacetDeposit.sol";

import "../storage/MultiVaultStorage.sol";


abstract contract MultiVaultHelperTVM is IMultiVaultFacetDepositEvents {
    modifier checkDepositAmount(uint amount) {
        require(amount < type(uint128).max, "Deposit amount too is large");

        _;
    }

    function _transferToTvmNative(
        IMultiVaultFacetDeposit.DepositParams memory deposit,
        uint fee,
        uint value
    ) internal checkDepositAmount(deposit.amount) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        ITVM.TvmAddress memory native = s.natives_[deposit.token];

        emit NativeTransfer(
            native.wid,
            native.addr,

            uint128(deposit.amount),
            deposit.recipient.wid,
            deposit.recipient.addr,
            value,
            deposit.expected_gas,
            deposit.payload
        );

        _emitDeposit(deposit, fee, true);
    }

    function _transferToTvmAlien(
        IMultiVaultFacetDeposit.DepositParams memory deposit,
        uint fee,
        uint value
    ) internal checkDepositAmount(deposit.amount) {
        emit AlienTransfer(
            block.chainid,
            uint160(deposit.token),
            IERC20Metadata(deposit.token).name(),
            IERC20Metadata(deposit.token).symbol(),
            IERC20Metadata(deposit.token).decimals(),

            uint128(deposit.amount),
            deposit.recipient.wid,
            deposit.recipient.addr,
            value,
            deposit.expected_gas,
            deposit.payload
        );

        _emitDeposit(deposit, fee, false);
    }

    function _emitDeposit(
        IMultiVaultFacetDeposit.DepositParams memory deposit,
        uint fee,
        bool isNative
    ) internal {
        emit Deposit(
            isNative ? IMultiVaultFacetTokens.TokenType.Native : IMultiVaultFacetTokens.TokenType.Alien,
            msg.sender,
            deposit.token,
            deposit.recipient.wid,
            deposit.recipient.addr,
            deposit.amount + fee,
            fee
        );
    }
}
