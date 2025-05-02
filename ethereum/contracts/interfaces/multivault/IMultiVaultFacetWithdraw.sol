// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;


import "./IMultiVaultFacetTokens.sol";
import "../ITVM.sol";


interface IMultiVaultFacetWithdraw {
    struct Callback {
        address recipient;
        bytes payload;
        bool strict;
    }

    struct NativeWithdrawalParams {
        ITVM.TvmAddress native;
        IMultiVaultFacetTokens.TokenMeta meta;
        uint256 amount;
        address recipient;
        uint256 chainId;
        Callback callback;
    }

    struct AlienWithdrawalParams {
        address token;
        uint256 amount;
        address recipient;
        uint256 chainId;
        Callback callback;
    }

    function withdrawalIds(bytes32) external view returns (bool);

    function saveWithdrawNative(
        bytes memory payload,
        bytes[] memory signatures
    ) external;

    function saveWithdrawAlien(
        bytes memory payload,
        bytes[] memory signatures
    ) external;

    function saveWithdrawAlien(
        bytes memory payload,
        bytes[] memory signatures,
        uint bounty
    ) external;

    function addPredeployedToken(
        ITVM.TvmAddress memory tvmToken,
        address evmToken,
        IMultiVaultFacetTokens.TokenMeta memory meta
    ) external;

    function removePredeployedToken(
        ITVM.TvmAddress memory tvmToken,
        address evmToken
    ) external;
}
