// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;


import "../../interfaces/multivault/IMultiVaultFacetTokens.sol";

// import "../MultiVaultToken.sol";
import "../storage/MultiVaultStorage.sol";

import "../helpers/MultiVaultHelperActors.sol";
import "../helpers/MultiVaultHelperTokens.sol";


contract MultiVaultFacetTokens is
    MultiVaultHelperActors,
    MultiVaultHelperTokens,
    IMultiVaultFacetTokens
{
    /// @notice Get token prefix
    /// @dev Used to set up in advance prefix for the ERC20 native token
    /// @param _token Token address
    /// @return Name and symbol prefix
    function prefixes(
        address _token
    ) external view override returns (IMultiVaultFacetTokens.TokenPrefix memory) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        return s.prefixes_[_token];
    }

    /// @notice Get token information
    /// @param _token Token address
    function tokens(
        address _token
    ) external view override returns (IMultiVaultFacetTokens.Token memory) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        return s.tokens_[_token];
    }

    /// @notice Get native Everscale token address for EVM token
    /// @param _token Token address
    function natives(
        address _token
    ) external view override returns (IEverscale.EverscaleAddress memory) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        return s.natives_[_token];
    }

    function predeployed(
        IEverscale.EverscaleAddress memory tvmToken
    ) external view override returns (address) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        return s.predeployed_[keccak256(abi.encodePacked(tvmToken.wid, tvmToken.addr))];
    }

    function getLPToken(
        address token
    ) external view returns (address lp) {
        lp = address(uint160(uint(keccak256(abi.encodePacked(
            hex'ff',
            address(this),
            keccak256(abi.encodePacked('LP', token)),
            hex'192c19818bebb5c6c95f5dcb3c3257379fc46fb654780cb06f3211ee77e1a360' // MultiVaultToken init code hash
        )))));
    }

    /// @notice Gets the address
    /// @param wid Everscale token address workchain id
    /// @param addr Everscale token address body
    /// @return token Token address
    function getNativeToken(
        int8 wid,
        uint256 addr
    ) external view returns (address token) {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        bytes32 hash = keccak256(abi.encodePacked(wid, addr));
        if (s.predeployed_[hash] == address(0)) {
            token = address(uint160(uint(keccak256(abi.encodePacked(
                hex'ff',
                address(this),
                keccak256(abi.encodePacked(wid, addr)),
                hex'192c19818bebb5c6c95f5dcb3c3257379fc46fb654780cb06f3211ee77e1a360' // MultiVaultToken init code hash
            )))));
        } else {
            token = s.predeployed_[hash];
        }
    }

    function setTokenBlacklist(
        address token,
        bool blacklisted
    ) external override onlyGovernance {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        s.tokens_[token].blacklisted = blacklisted;

        emit UpdateTokenBlacklist(token, blacklisted);
    }

    function setDepositLimit(
        address token,
        uint limit
    ) external override onlyGovernance {
        MultiVaultStorage.Storage storage s = MultiVaultStorage._storage();

        s.tokens_[token].depositLimit = limit;

        emit UpdateTokenDepositLimit(token, limit);
    }
}
