// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;


contract BridgeMockup {
    function verifySignedTvmEvent(
        bytes memory /*payload*/,
        bytes[] memory /*signatures*/
    ) external pure returns (uint32) {
        return 0;
    }
}
