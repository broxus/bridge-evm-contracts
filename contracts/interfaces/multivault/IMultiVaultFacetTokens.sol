// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;


import "./../ITVM.sol";


interface IMultiVaultFacetTokens {
    enum TokenType { Native, Alien }

    struct TokenPrefix {
        uint activation;
        string name;
        string symbol;
    }

    struct TokenMeta {
        string name;
        string symbol;
        uint8 decimals;
    }

    struct Token {
        uint activation;
        bool blacklisted;
        uint depositFee;
        uint withdrawFee;
        bool isNative;
        address custom; // deprecated
        uint256 depositLimit;
    }

    function prefixes(address _token) external view returns (TokenPrefix memory);
    function tokens(address _token) external view returns (Token memory);
    function natives(address _token) external view returns (ITVM.TvmAddress memory);

    function getPredeployedToken(ITVM.TvmAddress memory tvmToken) external view returns (address);

    function getLPToken(
        address token
    ) external view returns (address lp);

    function getNativeToken(
        int8 wid,
        uint256 addr
    ) external view returns (address token);

    function setDepositLimit(
        address token,
        uint amount
    ) external;

    function setTokenBlacklist(
        address token,
        bool blacklisted
    ) external;
}
