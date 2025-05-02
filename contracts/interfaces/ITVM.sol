// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;


interface ITVM {
    struct TvmAddress {
        int8 wid;
        uint256 addr;
    }

    struct TvmEvent {
        uint64 eventTransactionLt;
        uint32 eventTimestamp;
        bytes eventData;
        int8 configurationWid;
        uint256 configurationAddress;
        int8 eventContractWid;
        uint256 eventContractAddress;
        address proxy;
        uint32 round;
    }
}
