// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;



import "./../ITVM.sol";


interface IBridge is ITVM {
    struct Round {
        uint32 end;
        uint32 ttl;
        uint32 relays;
        uint32 requiredSignatures;
    }

    function updateMinimumRequiredSignatures(uint32 _minimumRequiredSignatures) external;
    function setConfiguration(TvmAddress calldata _roundRelaysConfiguration) external;
    function updateRoundTTL(uint32 _roundTTL) external;

    function decodeRoundRelaysEventData(
        bytes memory payload
    ) external pure returns (
        uint32 round,
        uint160[] memory _relays,
        uint32 roundEnd
    );

    function decodeTvmEvent(
        bytes memory payload
    ) external returns (TvmEvent memory _event);

    function isRelay(
        uint32 round,
        address candidate
    ) external view returns (bool);

    function isBanned(
        address candidate
    ) external view returns (bool);

    function isRoundRotten(
        uint32 round
    ) external view returns (bool);

    function verifySignedTvmEvent(
        bytes memory payload,
        bytes[] memory signatures
    ) external view returns (uint32);

    function setRoundRelays(
        bytes calldata payload,
        bytes[] calldata signatures
    ) external;

    function forceRoundRelays(
        uint160[] calldata _relays,
        uint32 roundEnd
    ) external;

    function banRelays(
        address[] calldata _relays
    ) external;

    function unbanRelays(
        address[] calldata _relays
    ) external;

    function pause() external;
    function unpause() external;

    function setRoundSubmitter(address _roundSubmitter) external;

    event UpdateMinimumRequiredSignatures(uint32 value);
    event UpdateRoundTTL(uint32 value);
    event UpdateRoundRelaysConfiguration(TvmAddress configuration);
    event UpdateRoundSubmitter(address _roundSubmitter);

    event NewRound(uint32 indexed round, Round meta);
    event RoundRelay(uint32 indexed round, address indexed relay);
    event BanRelay(address indexed relay, bool status);
}
