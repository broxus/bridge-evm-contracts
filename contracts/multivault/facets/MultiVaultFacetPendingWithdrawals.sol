// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;


import "../../interfaces/multivault/IMultiVaultFacetPendingWithdrawals.sol";
import "../../interfaces/multivault/IMultiVaultFacetPendingWithdrawalsEvents.sol";
import "../../interfaces/multivault/IMultiVaultFacetWithdraw.sol";
import "../../interfaces/IMultiVaultToken.sol";
import "../../interfaces/ITVM.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../helpers/MultiVaultHelperEmergency.sol";
import "../helpers/MultiVaultHelperActors.sol";
import "../helpers/MultiVaultHelperPendingWithdrawal.sol";
import "../helpers/MultiVaultHelperReentrancyGuard.sol";
import "../helpers/MultiVaultHelperTokenBalance.sol";
import "../helpers/MultiVaultHelperTVM.sol";
import "../helpers/MultiVaultHelperCallback.sol";
import "../helpers/MultiVaultHelperGas.sol";

import "../storage/MultiVaultStorage.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract MultiVaultFacetPendingWithdrawals is
    MultiVaultHelperEmergency,
    MultiVaultHelperGas,
    MultiVaultHelperActors,
    MultiVaultHelperTVM,
    MultiVaultHelperTokenBalance,
    MultiVaultHelperPendingWithdrawal,
    MultiVaultHelperReentrancyGuard,
    IMultiVaultFacetPendingWithdrawals,
    MultiVaultHelperCallback
{
    using SafeERC20 for IERC20;

    function pendingWithdrawals(
        address user,
        uint256 id
    ) external view override returns (PendingWithdrawalParams memory) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        return s.pendingWithdrawals_[user][id];
    }

    function withdrawalLimits(
        address token
    ) external view override returns(WithdrawalLimits memory) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        return s.withdrawalLimits_[token];
    }

    function withdrawalPeriods(
        address token,
        uint256 withdrawalPeriodId
    ) external view override returns (WithdrawalPeriodParams memory) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        return s.withdrawalPeriods_[token][withdrawalPeriodId];
    }

    /// @notice Changes pending withdrawal bounty for specific pending withdrawal
    /// @param id Pending withdrawal ID.
    /// @param bounty The new value for pending withdrawal bounty.
    function setPendingWithdrawalBounty(
        uint256 id,
        uint256 bounty
    )
        public
        override
    {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        PendingWithdrawalParams memory pendingWithdrawal = _pendingWithdrawal(msg.sender, id);

        require(!s.tokens_[pendingWithdrawal.token].isNative, "Pending: native token");
        require(bounty <= pendingWithdrawal.amount, "Pending: bounty too large");

        s.pendingWithdrawals_[msg.sender][id].bounty = bounty;

        emit PendingWithdrawalUpdateBounty(
            msg.sender,
            id,
            bounty
        );
    }

    function forceWithdraw(
        PendingWithdrawalId[] memory pendingWithdrawalIds
    )
        external
        override
        nonReentrant
        onlyEmergencyDisabled
    {
        for (uint i = 0; i < pendingWithdrawalIds.length; i++) {
            PendingWithdrawalId memory pendingWithdrawalId = pendingWithdrawalIds[i];
            PendingWithdrawalParams memory pendingWithdrawal = _pendingWithdrawal(pendingWithdrawalId);

            require(pendingWithdrawal.amount > 0, "Pending: zero amount");

            _pendingWithdrawalAmountReduce(
                pendingWithdrawalId,
                pendingWithdrawal.amount
            );

            emit PendingWithdrawalForce(
                pendingWithdrawalId.recipient,
                pendingWithdrawalId.id
            );

            IERC20(pendingWithdrawal.token).safeTransfer(
                pendingWithdrawalId.recipient,
                pendingWithdrawal.amount
            );

            _callbackAlienWithdrawal(
                IMultiVaultFacetWithdraw.AlienWithdrawalParams({
                    token: pendingWithdrawal.token,
                    amount: pendingWithdrawal.amount,
                    recipient: pendingWithdrawalId.recipient,
                    chainId: pendingWithdrawal.chainId,
                    callback: pendingWithdrawal.callback
                }),
                pendingWithdrawal.amount
            );
        }
    }

    /// @notice Cancel pending withdrawal partially or completely.
    /// This may only be called by pending withdrawal recipient.
    /// @param id Pending withdrawal ID
    /// @param amount Amount to cancel, should be less or equal than pending withdrawal amount
    /// @param recipient Tokens recipient, in TVM network
    /// @param bounty New value for bounty
    function cancelPendingWithdrawal(
        uint256 id,
        uint256 amount,
        ITVM.TvmAddress memory recipient,
        uint expected_gas,
        bytes memory payload,
        uint bounty
    )
        external
        payable
        override
        onlyEmergencyDisabled
        nonReentrant
        drainGas
    {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();
        PendingWithdrawalParams memory pendingWithdrawal = _pendingWithdrawal(msg.sender, id);

        require(!s.tokens_[pendingWithdrawal.token].isNative, "Pending: native token");
        require(amount > 0 && amount <= pendingWithdrawal.amount, "Pending: wrong amount");

        _pendingWithdrawalAmountReduce(
            PendingWithdrawalId(msg.sender, id),
            amount
        );

        IMultiVaultFacetDeposit.DepositParams memory deposit = IMultiVaultFacetDeposit.DepositParams({
            recipient: recipient,
            token: pendingWithdrawal.token,
            amount: amount,
            expected_gas: expected_gas,
            payload: payload
        });

        _transferToTvmAlien(deposit, 0, msg.value);

        emit PendingWithdrawalCancel(msg.sender, id, amount);

        setPendingWithdrawalBounty(id, bounty);
    }

    /**
        @notice Set approve status for pending withdrawal.
            Pending withdrawal must be in `Required` (1) approve status, so approve status can be set only once.
            If Vault has enough tokens on its balance - withdrawal will be filled immediately.
            This may only be called by `governance` or `withdrawGuardian`.
        @param pendingWithdrawalId Pending withdrawal ID.
        @param approveStatus Approve status. Must be `Approved` (2) or `Rejected` (3).
    */
    function setPendingWithdrawalApprove(
        PendingWithdrawalId memory pendingWithdrawalId,
        ApproveStatus approveStatus
    )
        public
        override
        onlyGovernanceOrWithdrawGuardian
        pendingWithdrawalOpened(pendingWithdrawalId)
    {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();
        PendingWithdrawalParams memory pendingWithdrawal = _pendingWithdrawal(pendingWithdrawalId);

        require(pendingWithdrawal.approveStatus == ApproveStatus.Required, "Pending: wrong current approve status");

        require(
            approveStatus == ApproveStatus.Approved ||
            approveStatus == ApproveStatus.Rejected,
            "Pending: wrong approve status"
        );

        _pendingWithdrawalApproveStatusUpdate(pendingWithdrawalId, approveStatus);

        bool isNative = s.tokens_[pendingWithdrawal.token].isNative;

        // Fill approved withdrawal
        if (
            approveStatus == ApproveStatus.Approved &&
            (pendingWithdrawal.amount <= _vaultTokenBalance(pendingWithdrawal.token) || isNative)
        ) {
            _pendingWithdrawalAmountReduce(
                pendingWithdrawalId,
                pendingWithdrawal.amount
            );

            if (!isNative) {
                IERC20(pendingWithdrawal.token).safeTransfer(
                    pendingWithdrawalId.recipient,
                    pendingWithdrawal.amount
                );
            } else {
                IMultiVaultToken(pendingWithdrawal.token).mint(
                    pendingWithdrawalId.recipient,
                    pendingWithdrawal.amount
                );
            }

            emit PendingWithdrawalWithdraw(
                pendingWithdrawalId.recipient,
                pendingWithdrawalId.id,
                pendingWithdrawal.amount
            );
        }

        // Update withdrawal period considered amount
        uint withdrawalPeriodId = _withdrawalPeriodDeriveId(pendingWithdrawal.timestamp);

        s.withdrawalPeriods_[pendingWithdrawal.token][withdrawalPeriodId].considered += pendingWithdrawal.amount;
    }

    /**
        @notice Multicall for `setPendingWithdrawalApprove`.
        @param pendingWithdrawalId List of pending withdrawals IDs.
        @param approveStatus List of approve statuses.
    */
    function setPendingWithdrawalApprove(
        PendingWithdrawalId[] memory pendingWithdrawalId,
        ApproveStatus[] memory approveStatus
    ) external override {
        require(pendingWithdrawalId.length == approveStatus.length, "Pending: params mismatch");

        for (uint i = 0; i < pendingWithdrawalId.length; i++) {
            setPendingWithdrawalApprove(pendingWithdrawalId[i], approveStatus[i]);
        }
    }

    function pendingWithdrawalsTotal(address _token) external view override returns (uint) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        return s.pendingWithdrawalsTotal[_token];
    }

    function pendingWithdrawalsPerUser(address user) external view override returns(uint) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        return s.pendingWithdrawalsPerUser[user];
    }
}
