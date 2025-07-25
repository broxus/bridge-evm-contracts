// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;


import "./interfaces/bridge/IBridge.sol";
import "./interfaces/ITVM.sol";
import "./interfaces/IDAO.sol";

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./utils/Cache.sol";


/// @title DAO contract for TVM-EVM bridge
/// @dev Executes proposals confirmed in TVM Bridge DAO.
/// Proposals are submitted in form of payloads and signatures
contract DAO is IDAO, ITVM, ReentrancyGuardUpgradeable, OwnableUpgradeable, Cache {
    address public bridge;
    TvmAddress public configuration;

    constructor() {
        _disableInitializers();
    }

    function renounceOwnership() public override {
        revert("DAO: renounce ownership is not allowed");
    }

    modifier notZeroAddress(address addr) {
        require(addr != address(0), "DAO: zero address");

        _;
    }

    /**
        @notice Initializer
        @param _owner DAO owner. Should be used only for initial set up,
            than ownership should be transferred to DAO itself.
        @param _bridge Bridge address
    */
    function initialize(
        address _owner,
        address _bridge
    ) public initializer notZeroAddress(_owner) notZeroAddress(_bridge) {
        bridge = _bridge;

        __Ownable_init(_owner);
    }

    /**
        @notice Update address of the TVM configuration, that emits actions for this DAO
        @param _configuration New configuration TVM address
    */
    function setConfiguration(
        TvmAddress calldata _configuration
    ) public override onlyOwner {
        configuration = _configuration;
    }

    /// @dev Update bridge address
    /// @param _bridge New bridge address
    function setBridge(
        address _bridge
    ) override external onlyOwner notZeroAddress(_bridge) {
        bridge = _bridge;
    }

    function decodeEthActionsEventData(
        bytes memory payload
    ) public override pure returns (
        int8 _wid,
        uint256 _addr,
        uint32 chainId,
        EthAction[] memory actions
    ) {
        (TvmEvent memory _event) = abi.decode(payload, (TvmEvent));

        return abi.decode(
            _event.eventData,
            (int8, uint256, uint32, EthAction[])
        );
    }

    /**
        @notice Execute set of actions.
        @param payload Encoded TVM event with payload details
        @param signatures Payload signatures
        @return responses Bytes-encoded payload action responses
    */
    function execute(
        bytes calldata payload,
        bytes[] calldata signatures
    )
        override
        external
        nonReentrant
        notCached(payload)
    returns (
        bytes[] memory responses
    ) {
        require(
            IBridge(bridge).verifySignedTvmEvent(
                payload,
                signatures
            ) == 0,
            "DAO: signatures verification failed"
        );

        (TvmEvent memory _event) = abi.decode(payload, (TvmEvent));

        require(
            _event.configurationWid == configuration.wid &&
            _event.configurationAddress == configuration.addr,
            "DAO: wrong event configuration"
        );

        (
            ,,
            uint32 chainId,
            EthAction[] memory actions
        ) = decodeEthActionsEventData(payload);

        require(
            chainId == block.chainid,
            "DAO: wrong chain id"
        );

        responses = new bytes[](actions.length);

        for (uint i=0; i<actions.length; i++) {
            EthAction memory action = actions[i];

            bytes memory callData;

            if (bytes(action.signature).length == 0) {
                callData = action.data;
            } else {
                callData = abi.encodePacked(
                    bytes4(keccak256(bytes(action.signature))),
                    action.data
                );
            }

            (bool success, bytes memory response) = address(action.target)
                .call{value: action.value}(callData);

            require(success, "DAO: execution fail");

            responses[i] = response;
        }
    }
}
