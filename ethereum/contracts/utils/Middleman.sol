// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/multivault/IMultiVaultFacetDeposit.sol";
import "../interfaces/multivault/IMultiVaultFacetWithdraw.sol";
import "../interfaces/multivault/IMultiVaultFacetTokens.sol";
import "../interfaces/multivault/IOctusCallback.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract Middleman is Initializable, IOctusCallbackAlien, IOctusCallbackNative, ReentrancyGuardUpgradeable {

    event MiddlemanDeposit(address srcToken, uint256 depositAmount, address dstMultiVault);

    using SafeERC20 for IERC20;

    constructor() {}

    function onAlienWithdrawal(
        IMultiVaultFacetWithdraw.AlienWithdrawalParams memory payload,
        uint256 withdrawAmount
    ) external override nonReentrant {
        _onWithdrawal(
            payload.token,
            payload.recipient,
            payload.callback,
            withdrawAmount
        );
    }

    function onNativeWithdrawal(
        IMultiVaultFacetWithdraw.NativeWithdrawalParams memory payload,
        uint256 withdrawAmount
    ) external override nonReentrant {
        address token = IMultiVaultFacetTokens(msg.sender).getNativeToken(payload.native.wid, payload.native.addr);

        _onWithdrawal(
            token,
            payload.recipient,
            payload.callback,
            withdrawAmount
        );
    }

    function _onWithdrawal(
        address token,
        address recipient,
        IMultiVaultFacetWithdraw.Callback memory callback,
        uint256 withdrawAmount
    ) internal {
        require(recipient == address(this), "Wrong withdrawal recipient");

        (
            address dstMultiVault,
            ITVM.TvmAddress memory recipientAddress,
            bytes memory depositData
        ) = abi.decode(callback.payload, (
            address,
            ITVM.TvmAddress,
            bytes
        ));

        emit MiddlemanDeposit(token, withdrawAmount, dstMultiVault);

        IERC20(token).approve(dstMultiVault, withdrawAmount);

        IMultiVaultFacetDeposit(dstMultiVault).deposit(IMultiVaultFacetDeposit.DepositParams(
            recipientAddress,
            token,
            withdrawAmount,
            0,
            depositData
        ));
    }

    function onNativeWithdrawalPendingCreated(
        IMultiVaultFacetWithdraw.NativeWithdrawalParams memory /*_payload*/,
        uint /*pendingWithdrawalId*/
    ) external override nonReentrant {}

    function onAlienWithdrawalPendingCreated(
        IMultiVaultFacetWithdraw.AlienWithdrawalParams memory /*_payload*/,
        uint /*pendingWithdrawalId*/
    ) external override nonReentrant {}
}
