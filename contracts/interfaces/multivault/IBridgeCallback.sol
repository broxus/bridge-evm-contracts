// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "./IMultiVaultFacetWithdraw.sol";


interface IBridgeCallbackNative {
    function onNativeWithdrawal(
        IMultiVaultFacetWithdraw.NativeWithdrawalParams memory payload,
        uint256 withdrawAmount
    ) external;


    function onNativeWithdrawalPendingCreated(
        IMultiVaultFacetWithdraw.NativeWithdrawalParams memory _payload,
        uint pendingWithdrawalId
    ) external;
}

interface IBridgeCallbackAlien {
    function onAlienWithdrawal(
        IMultiVaultFacetWithdraw.AlienWithdrawalParams memory payload,
        uint256 withdrawAmount
    ) external;

    function onAlienWithdrawalPendingCreated(
        IMultiVaultFacetWithdraw.AlienWithdrawalParams memory _payload,
        uint pendingWithdrawalId
    ) external;
}
