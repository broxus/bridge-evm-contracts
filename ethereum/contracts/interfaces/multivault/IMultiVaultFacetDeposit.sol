// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;


import "../ITVM.sol";
import "./IMultiVaultFacetPendingWithdrawals.sol";


interface IMultiVaultFacetDeposit {
    struct DepositParams {
        ITVM.TvmAddress recipient;
        address token;
        uint amount;
        uint expected_gas;
        bytes payload;
    }

    struct DepositNativeTokenParams {
        ITVM.TvmAddress recipient;
        uint amount;
        uint expected_gas;
        bytes payload;
    }

    function depositByNativeToken(
        DepositNativeTokenParams memory d
    ) external payable;

    function depositByNativeToken(
        DepositNativeTokenParams memory d,
        uint256 expectedMinBounty,
        IMultiVaultFacetPendingWithdrawals.PendingWithdrawalId[] memory pendingWithdrawalIds
    ) external payable;

    function deposit(
        DepositParams memory d
    ) external payable;

    function deposit(
        DepositParams memory d,
        uint256 expectedMinBounty,
        IMultiVaultFacetPendingWithdrawals.PendingWithdrawalId[] memory pendingWithdrawalIds
    ) external payable;
}
