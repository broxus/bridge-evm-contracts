// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;


import "./../interfaces/bridge/IBridge.sol";
import "./../utils/Cache.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";


library PrefixBytes {
    function toBytesPrefixed(bytes32 hash)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
    }
}


/// @title EVM Bridge contract
/// @author https://github.com/broxus
/// @notice Stores relays for each round, implements relay slashing, helps in validating TVM-EVM events
contract Bridge is OwnableUpgradeable, PausableUpgradeable, Cache, IBridge {
    using ECDSA for bytes32;
    using PrefixBytes for bytes32;

    // NOTE: round number -> address -> is relay?
    mapping (uint32 => mapping(address => bool)) public relays;

    // NOTE: is relay banned or not
    mapping (address => bool) public blacklist;

    // NOTE: round meta data
    mapping (uint32 => Round) public rounds;

    // NOTE: The required signatures per round can't be less than this
    uint32 public minimumRequiredSignatures;

    // NOTE: how long round signatures are considered valid after the end of the round
    uint32 public roundTTL;

    // NOTE: initial round number
    uint32 public initialRound;

    // NOTE: last round with known relays
    uint32 public lastRound;

    // NOTE: special address, can set up rounds without relays's signatures
    address public roundSubmitter;

    // NOTE: Broxus Bridge TVM-ETH configuration address, that emits event with round relays
    TvmAddress public roundRelaysConfiguration;

    constructor() {
        _disableInitializers();
    }

    function renounceOwnership() public override {
        revert("Bridge: renounce ownership is not allowed");
    }

    /**
        @notice Bridge initializer
        @dev `roundRelaysConfiguration` should be specified after deploy, since it's an TVM contract,
        which needs EVM Bridge address to be deployed.
        @param _owner Bridge owner
        @param _roundSubmitter Round submitter
        @param _minimumRequiredSignatures Minimum required signatures per round.
        @param _roundTTL Round TTL after round end.
        @param _initialRound Initial round number. Useful in case new EVM network is connected to the bridge.
        @param _initialRoundEnd Initial round end timestamp.
        @param _relays Initial (genesis) set of relays. Encode addresses as uint160.
    */
    function initialize(
        address _owner,
        address _roundSubmitter,
        uint32 _minimumRequiredSignatures,
        uint32 _roundTTL,
        uint32 _initialRound,
        uint32 _initialRoundEnd,
        uint160[] calldata _relays
    ) external initializer {
        __Pausable_init();
        __Ownable_init(_owner);

        roundSubmitter = _roundSubmitter;
        emit UpdateRoundSubmitter(_roundSubmitter);

        minimumRequiredSignatures = _minimumRequiredSignatures;
        emit UpdateMinimumRequiredSignatures(minimumRequiredSignatures);

        roundTTL = _roundTTL;
        emit UpdateRoundTTL(roundTTL);

        require(
            _initialRoundEnd >= block.timestamp,
            "Bridge: initial round end should be in the future"
        );

        initialRound = _initialRound;
        _setRound(initialRound, _relays, _initialRoundEnd);

        lastRound = initialRound;
    }

    /**
        @notice Update address of configuration, that emits event with relays for next round.
        @param _roundRelaysConfiguration TVM address of configuration contract
    */
    function setConfiguration(
        TvmAddress calldata _roundRelaysConfiguration
    ) external override onlyOwner {
        emit UpdateRoundRelaysConfiguration(_roundRelaysConfiguration);

        roundRelaysConfiguration = _roundRelaysConfiguration;
    }

    /**
        @notice Pause Bridge contract.
        Can be called only by `owner`.
        @dev When Bridge paused, any signature verification TVM-EVM event fails.
    */
    function pause() external override onlyOwner {
        _pause();
    }

    /**
        @notice Unpause Bridge contract.
    */
    function unpause() external override onlyOwner {
        _unpause();
    }

    /**
        @notice Update minimum amount of required signatures per round
        This parameter limits the minimum amount of signatures to be required for TVM-EVM event.
        @param _minimumRequiredSignatures New value
    */
    function updateMinimumRequiredSignatures(
        uint32 _minimumRequiredSignatures
    ) external override onlyOwner {
        minimumRequiredSignatures = _minimumRequiredSignatures;

        emit UpdateMinimumRequiredSignatures(_minimumRequiredSignatures);
    }

    /**
        @notice Update round TTL
        @dev This affects only future rounds. Rounds, that were already set, keep their current TTL.
        @param _roundTTL New TTL value
    */
    function updateRoundTTL(
        uint32 _roundTTL
    ) external override onlyOwner {
        roundTTL = _roundTTL;

        emit UpdateRoundTTL(_roundTTL);
    }

    /// @notice Check if relay is banned.
    /// Ban is global. If the relay is banned it means it lost relay power in all rounds, past and future.
    /// @param candidate Address to check
    function isBanned(
        address candidate
    ) override public view returns (bool) {
        return blacklist[candidate];
    }

    /// @notice Check if some address is relay at specific round
    /// @dev Even if relay was banned, this method still returns `true`.
    /// @param round Round id
    /// @param candidate Address to check
    function isRelay(
        uint32 round,
        address candidate
    ) override public view returns (bool) {
        return relays[round][candidate];
    }

    /// @dev Check if round is rotten
    /// @param round Round id
    function isRoundRotten(
        uint32 round
    ) override public view returns (bool) {
        return block.timestamp > rounds[round].ttl;
    }


    /// @notice Verify `TvmEvent` signatures.
    /// @dev Signatures should be sorted by the ascending signers.
    /// Error codes:
    /// 0. Verification passed (no error)
    /// 1. Specified round is less than initial round
    /// 2. Specified round is greater than last round
    /// 3. Not enough correct signatures. Possible reasons:
    /// - Some of the signers are not relays at the specified round
    /// - Some of the signers are banned
    /// 4. Round is rotten.
    /// 5. Verification passed, but bridge is in "paused" mode
    /// @param payload Bytes encoded `TvmEvent` structure
    /// @param signatures Payload signatures
    /// @return errorCode Error code
    function verifySignedTvmEvent(
        bytes memory payload,
        bytes[] memory signatures
    )
        override
        public
        view
    returns (
        uint32 errorCode
    ) {
        (TvmEvent memory _event) = abi.decode(payload, (TvmEvent));

        uint32 round = _event.round;

        // Check round is greater than initial round
        if (round < initialRound) return 1;

        // Check round is less than last initialized round
        if (round > lastRound) return 2;

        // Check there are enough correct signatures
        uint32 count = _countRelaySignatures(payload, signatures, round);
        if (count < rounds[round].requiredSignatures) return 3;

        // Check round rotten
        if (isRoundRotten(round)) return 4;

        // Check bridge has been paused
        if (paused()) return 5;

        return 0;
    }

    /**
        @notice
            Recover signer from the payload and signature
        @param payload Payload
        @param signature Signature
    */
    function recoverSignature(
        bytes memory payload,
        bytes memory signature
    ) public pure returns (address) {
        (address signer, ECDSA.RecoverError e,) = keccak256(payload)
            .toBytesPrefixed()
            .tryRecover(signature);
    
        require(signer != address(0) && e == ECDSA.RecoverError.NoError, "Bridge: signature recover failed");

        return signer;
    }

    /**
        @notice Forced set of next round relays
        @dev Can be called only by `roundSubmitter`
        @param _relays Next round relays
        @param roundEnd Round end
    */
    function forceRoundRelays(
        uint160[] calldata _relays,
        uint32 roundEnd
    ) override external {
        require(msg.sender == roundSubmitter, "Bridge: sender not round submitter");

        _setRound(lastRound + 1, _relays, roundEnd);

        lastRound++;
    }

    /**
        @notice Set round submitter
        @dev Can be called only by owner
        @param _roundSubmitter New round submitter address
    */
    function setRoundSubmitter(
        address _roundSubmitter
    ) override external onlyOwner {
        roundSubmitter = _roundSubmitter;

        emit UpdateRoundSubmitter(roundSubmitter);
    }

    /**
        @notice Grant relay permission for set of addresses at specific round
        @param payload Bytes encoded TvmEvent structure
        @param signatures Payload signatures
    */
    function setRoundRelays(
        bytes calldata payload,
        bytes[] calldata signatures
    ) override external notCached(payload) {
        require(
            verifySignedTvmEvent(
                payload,
                signatures
            ) == 0,
            "Bridge: signatures verification failed"
        );

        (TvmEvent memory _event) = abi.decode(payload, (TvmEvent));

        require(
            _event.configurationWid == roundRelaysConfiguration.wid &&
            _event.configurationAddress == roundRelaysConfiguration.addr,
            "Bridge: wrong event configuration"
        );

        (uint32 round, uint160[] memory _relays, uint32 roundEnd) = decodeRoundRelaysEventData(payload);

        require(round == lastRound + 1, "Bridge: wrong round");

        _setRound(round, _relays, roundEnd);

        lastRound++;
    }

    function decodeRoundRelaysEventData(
        bytes memory payload
    ) public override pure returns (
        uint32 round,
        uint160[] memory _relays,
        uint32 roundEnd
    ) {
        (TvmEvent memory TvmEvent) = abi.decode(payload, (TvmEvent));

        (round, _relays, roundEnd) = abi.decode(
            TvmEvent.eventData,
            (uint32, uint160[], uint32)
        );
    }

    function decodeTvmEvent(
        bytes memory payload
    ) external override pure returns (TvmEvent memory _event) {
        (_event) = abi.decode(payload, (TvmEvent));
    }

    /**
        @notice
            Ban relays
        @param _relays List of relay addresses to ban
    */
    function banRelays(
        address[] calldata _relays
    ) override external onlyOwner {
        for (uint i=0; i<_relays.length; i++) {
            blacklist[_relays[i]] = true;

            emit BanRelay(_relays[i], true);
        }
    }

    /**
        @notice
            Unban relays
        @param _relays List of relay addresses to unban
    */
    function unbanRelays(
        address[] calldata _relays
    ) override external onlyOwner {
        for (uint i=0; i<_relays.length; i++) {
            blacklist[_relays[i]] = false;

            emit BanRelay(_relays[i], false);
        }
    }

    function _setRound(
        uint32 round,
        uint160[] memory _relays,
        uint32 roundEnd
    ) internal {
        uint32 requiredSignatures = uint32(_relays.length * 2 / 3) + 1;

        rounds[round] = Round(
            roundEnd,
            roundEnd + roundTTL,
            uint32(_relays.length),
            requiredSignatures < minimumRequiredSignatures ? minimumRequiredSignatures : requiredSignatures
        );

        emit NewRound(round, rounds[round]);

        for (uint i=0; i<_relays.length; i++) {
            address relay = address(_relays[i]);

            relays[round][relay] = true;

            emit RoundRelay(round, relay);
        }
    }

    function _countRelaySignatures(
        bytes memory payload,
        bytes[] memory signatures,
        uint32 round
    ) internal view returns (uint32) {
        address lastSigner = address(0);
        uint32 count = 0;

        for (uint i=0; i<signatures.length; i++) {
            address signer = recoverSignature(payload, signatures[i]);

            require(signer > lastSigner, "Bridge: signatures sequence wrong");
            lastSigner = signer;

            if (isRelay(round, signer) && !isBanned(signer)) {
                count++;
            }
        }

        return count;
    }
}
