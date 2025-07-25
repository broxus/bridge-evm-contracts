// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "../../interfaces/multivault/IMultiVaultFacetWithdraw.sol";
import "../../interfaces/multivault/IMultiVaultFacetPendingWithdrawals.sol";
import "../../interfaces/multivault/IMultiVaultFacetTokens.sol";
import "../../interfaces/multivault/IMultiVaultFacetFees.sol";
import "../../interfaces/ITVM.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../helpers/MultiVaultHelperFee.sol";
import "../helpers/MultiVaultHelperReentrancyGuard.sol";
import "../helpers/MultiVaultHelperWithdraw.sol";
import "../helpers/MultiVaultHelperEmergency.sol";
import "../helpers/MultiVaultHelperTokens.sol";
import "../helpers/MultiVaultHelperPendingWithdrawal.sol";
import "../helpers/MultiVaultHelperTokenBalance.sol";
import "../helpers/MultiVaultHelperCallback.sol";
import "../helpers/MultiVaultHelperActors.sol";


contract MultiVaultFacetWithdraw is
    MultiVaultHelperFee,
    MultiVaultHelperReentrancyGuard,
    MultiVaultHelperWithdraw,
    MultiVaultHelperPendingWithdrawal,
    MultiVaultHelperTokens,
    MultiVaultHelperTokenBalance,
    MultiVaultHelperCallback,
    MultiVaultHelperActors,
    IMultiVaultFacetWithdraw
{
    using SafeERC20 for IERC20;

    /// @notice Save withdrawal for native token
    /// @param payload Withdraw payload
    /// @param signatures Payload signatures
    function saveWithdrawNative(
        bytes memory payload,
        bytes[] memory signatures
    )
        external
        override
        nonReentrant
        withdrawalNotSeenBefore(payload)
        onlyEmergencyDisabled
    {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        ITVM.TvmEvent memory _event = _processWithdrawEvent(
            payload,
            signatures,
            s.configurationNative_
        );

        bytes32 payloadId = keccak256(payload);

        // Decode event data
        NativeWithdrawalParams memory withdrawal = decodeNativeWithdrawalEventData(_event.eventData);

        // Ensure chain id is correct
        require(withdrawal.chainId == block.chainid, "Withdraw: wrong chain id");

        // Derive token address
        // Depends on the withdrawn token source
        address token = _getNativeWithdrawalToken(withdrawal);

        // Ensure token is not blacklisted
        require(!s.tokens_[token].blacklisted, "Withdraw: token is blacklisted");

        // Consider movement fee and send it to `rewards_`
        uint256 fee = _calculateMovementFee(
            withdrawal.amount,
            token,
            IMultiVaultFacetFees.Fee.Withdraw
        );

        _increaseTokenFee(token, fee);

        uint withdrawAmount = withdrawal.amount - fee;

        // Consider withdrawal period limit
        IMultiVaultFacetPendingWithdrawals.WithdrawalPeriodParams memory withdrawalPeriod = _withdrawalPeriod(
            token,
            _event.eventTimestamp
        );

        _withdrawalPeriodIncreaseTotalByTimestamp(
            token,
            _event.eventTimestamp,
            withdrawal.amount
        );

        bool withdrawalLimitsPassed = _withdrawalPeriodCheckLimitsPassed(
            token,
            withdrawal.amount,
            withdrawalPeriod
        );

        if (withdrawalLimitsPassed) {
            _withdraw(
                withdrawal.recipient,
                withdrawal.amount,
                fee,
                IMultiVaultFacetTokens.TokenType.Native,
                payloadId,
                token
            );

            _callbackNativeWithdrawal(withdrawal, withdrawal.amount - fee);

            return;
        }

        // Create pending withdrawal
        uint pendingWithdrawalId = s.pendingWithdrawalsPerUser[withdrawal.recipient];

        s.pendingWithdrawalsPerUser[withdrawal.recipient]++;

        s.pendingWithdrawalsTotal[token] += withdrawAmount;

        // - Save withdrawal as pending
        s.pendingWithdrawals_[withdrawal.recipient][pendingWithdrawalId] = IMultiVaultFacetPendingWithdrawals.PendingWithdrawalParams({
            token: token,
            amount: withdrawAmount,
            bounty: 0,
            timestamp: _event.eventTimestamp,
            approveStatus: IMultiVaultFacetPendingWithdrawals.ApproveStatus.NotRequired,
            chainId: withdrawal.chainId,
            callback: withdrawal.callback
        });

        emit PendingWithdrawalCreated(
            withdrawal.recipient,
            pendingWithdrawalId,
            token,
            withdrawAmount,
            payloadId
        );

        _pendingWithdrawalApproveStatusUpdate(
            IMultiVaultFacetPendingWithdrawals.PendingWithdrawalId(withdrawal.recipient, pendingWithdrawalId),
            IMultiVaultFacetPendingWithdrawals.ApproveStatus.Required
        );

        _callbackNativeWithdrawalPendingCreated(withdrawal, pendingWithdrawalId);
    }

    /// @notice Save withdrawal of alien token
    /// @param signatures List of payload signatures
    /// @param bounty Bounty size
    function saveWithdrawAlien(
        bytes memory payload,
        bytes[] memory signatures,
        uint bounty
    )
        public
        override
        nonReentrant
        withdrawalNotSeenBefore(payload)
        onlyEmergencyDisabled
    {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        ITVM.TvmEvent memory _event = _processWithdrawEvent(
            payload,
            signatures,
            s.configurationAlien_
        );

        bytes32 payloadId = keccak256(payload);

        // Decode event data
        AlienWithdrawalParams memory withdrawal = decodeAlienWithdrawalEventData(_event.eventData);

        // Ensure chain id is correct
        require(withdrawal.chainId == block.chainid, "Withdraw: wrong chain id");

        // Ensure token is not blacklisted
        require(!s.tokens_[withdrawal.token].blacklisted, "Withdraw: token is blacklisted");

        // Consider movement fee and send it to `rewards_`
        uint256 fee = _calculateMovementFee(
            withdrawal.amount,
            withdrawal.token,
            IMultiVaultFacetFees.Fee.Withdraw
        );

        _increaseTokenFee(withdrawal.token, fee);

        uint withdrawAmount = withdrawal.amount - fee;

        // Consider withdrawal period limit
        IMultiVaultFacetPendingWithdrawals.WithdrawalPeriodParams memory withdrawalPeriod = _withdrawalPeriod(
            withdrawal.token,
            _event.eventTimestamp
        );

        _withdrawalPeriodIncreaseTotalByTimestamp(
            withdrawal.token,
            _event.eventTimestamp,
            withdrawal.amount
        );

        bool withdrawalLimitsPassed = _withdrawalPeriodCheckLimitsPassed(
            withdrawal.token,
            withdrawal.amount,
            withdrawalPeriod
        );

        // Token balance sufficient and none of the limits are violated
        if (withdrawal.amount <= _vaultTokenBalance(withdrawal.token) && withdrawalLimitsPassed) {

            _withdraw(
                withdrawal.recipient,
                withdrawal.amount,
                fee,
                IMultiVaultFacetTokens.TokenType.Alien,
                payloadId,
                withdrawal.token
            );

            _callbackAlienWithdrawal(withdrawal, withdrawAmount);

            return;
        }

        // Create pending withdrawal
        uint pendingWithdrawalId = s.pendingWithdrawalsPerUser[withdrawal.recipient];

        s.pendingWithdrawalsPerUser[withdrawal.recipient]++;

        s.pendingWithdrawalsTotal[withdrawal.token] += withdrawAmount;

        require(bounty <= withdrawAmount, "Withdraw: bounty > withdraw amount");

        // - Save withdrawal as pending
        s.pendingWithdrawals_[withdrawal.recipient][pendingWithdrawalId] = IMultiVaultFacetPendingWithdrawals.PendingWithdrawalParams({
            token: withdrawal.token,
            amount: withdrawAmount,
            bounty: msg.sender == withdrawal.recipient ? bounty : 0,
            timestamp: _event.eventTimestamp,
            approveStatus: IMultiVaultFacetPendingWithdrawals.ApproveStatus.NotRequired,
            chainId: withdrawal.chainId,
            callback: withdrawal.callback
        });

        emit PendingWithdrawalCreated(
            withdrawal.recipient,
            pendingWithdrawalId,
            withdrawal.token,
            withdrawAmount,
            payloadId
        );

        if (!withdrawalLimitsPassed) {
            _pendingWithdrawalApproveStatusUpdate(
                IMultiVaultFacetPendingWithdrawals.PendingWithdrawalId(withdrawal.recipient, pendingWithdrawalId),
                IMultiVaultFacetPendingWithdrawals.ApproveStatus.Required
            );
        }

        _callbackAlienWithdrawalPendingCreated(withdrawal, pendingWithdrawalId);
    }

    /// @notice Save withdrawal of alien token
    function saveWithdrawAlien(
        bytes memory payload,
        bytes[] memory signatures
    )  external override {
        saveWithdrawAlien(payload, signatures, 0);
    }

    function decodeNativeWithdrawalEventData(
        bytes memory eventData
    ) internal pure returns (NativeWithdrawalParams memory) {
        (
            int8 native_wid,
            uint256 native_addr,

            string memory name,
            string memory symbol,
            uint8 decimals,

            uint128 amount,
            uint160 recipient,
            uint256 chainId,

            uint160 callback_recipient,
            bytes memory callback_payload,
            bool callback_strict
        ) = abi.decode(
            eventData,
            (
                int8, uint256,
                string, string, uint8,
                uint128, uint160, uint256,
                uint160, bytes, bool
            )
        );

        return NativeWithdrawalParams({
            native: ITVM.TvmAddress(native_wid, native_addr),
            meta: IMultiVaultFacetTokens.TokenMeta(name, symbol, decimals),
            amount: amount,
            recipient: address(recipient),
            chainId: chainId,
            callback: Callback(
                address(callback_recipient),
                callback_payload,
                callback_strict
            )
        });
    }

    function decodeAlienWithdrawalEventData(
        bytes memory eventData
    ) internal pure returns (AlienWithdrawalParams memory) {
        (
            uint160 token,
            uint128 amount,
            uint160 recipient,
            uint256 chainId,

            uint160 callback_recipient,
            bytes memory callback_payload,
            bool callback_strict
        ) = abi.decode(
            eventData,
            (
                uint160, uint128, uint160, uint256,
                uint160, bytes, bool
            )
        );

        return AlienWithdrawalParams({
            token: address(token),
            amount: uint256(amount),
            recipient: address(recipient),
            chainId: chainId,
            callback: Callback(
                address(callback_recipient),
                callback_payload,
                callback_strict
            )
        });
    }

    function withdrawalIds(bytes32 id) external view override returns(bool) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        return s.withdrawalIds[id];
    }

    function addPredeployedToken(
        ITVM.TvmAddress memory tvmToken,
        address evmToken,
        IMultiVaultFacetTokens.TokenMeta memory meta
    ) external override onlyGovernance {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();
        mapping (bytes32 => address) storage predeployed = MultiVaultStorage._getPredeployed();

        emit TokenCreated(
            evmToken,
            tvmToken.wid,
            tvmToken.addr,
            string(''),
            string(''),
            meta.name,
            meta.symbol,
            meta.decimals
        );

        _activateToken(evmToken, true);

        predeployed[keccak256(abi.encodePacked(tvmToken.wid, tvmToken.addr))] = evmToken;
        s.natives_[evmToken] = tvmToken;
    }

    function removePredeployedToken(
        ITVM.TvmAddress memory tvmToken,
        address evmToken
    ) external override onlyGovernance {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();
        mapping (bytes32 => address) storage predeployed = MultiVaultStorage._getPredeployed();

        ITVM.TvmAddress memory emptyTvmAddr;
        IMultiVaultFacetTokens.Token memory emptyTokenData;

        predeployed[keccak256(abi.encodePacked(tvmToken.wid, tvmToken.addr))] = address(0);
        s.natives_[evmToken] = emptyTvmAddr;
        s.tokens_[evmToken] = emptyTokenData;
    }
}
