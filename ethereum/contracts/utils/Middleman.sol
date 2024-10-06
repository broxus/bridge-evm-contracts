// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/multivault/IMultiVaultFacetDeposit.sol";
import "../interfaces/multivault/IMultiVaultFacetWithdraw.sol";
import "../interfaces/multivault/IOctusCallback.sol";

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract Middleman is Initializable, IOctusCallbackAlien, ReentrancyGuardUpgradeable {

    event MiddlemanDeposit(address srcToken, uint256 depositAmount, address dstMultiVault);

    using SafeERC20 for IERC20;

    constructor() {}

    function onAlienWithdrawal(
        IMultiVaultFacetWithdraw.AlienWithdrawalParams memory payload,
        uint256 withdrawAmount
    ) external override nonReentrant {
        require(payload.recipient == address(this), "Wrong withdrawal recipient");

        (
            address dstMultiVault,
            IEverscale.EverscaleAddress memory recipientAddress,
            bytes memory depositData
        ) = abi.decode(payload.callback.payload, (
            address,
            IEverscale.EverscaleAddress,
            bytes
        ));

        emit MiddlemanDeposit(payload.token, withdrawAmount, dstMultiVault);

        IERC20(payload.token).approve(dstMultiVault, withdrawAmount);

        IMultiVaultFacetDeposit(dstMultiVault).deposit(IMultiVaultFacetDeposit.DepositParams(
            recipientAddress,
            payload.token,
            withdrawAmount,
            0,
            depositData
        ));
    }

    function onAlienWithdrawalPendingCreated(
        IMultiVaultFacetWithdraw.AlienWithdrawalParams memory /*_payload*/,
        uint /*pendingWithdrawalId*/
    ) external override nonReentrant {}
}
