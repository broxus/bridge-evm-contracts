// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;


import "../interfaces/IMultiVaultToken.sol";
import "../MultiVaultToken.sol";


contract MultiVaultFacetTokenFactory {
    string constant public DEFAULT_NAME_LP_PREFIX = 'Venom LP ';
    string constant public DEFAULT_SYMBOL_LP_PREFIX = 'venomLP';

    modifier onlySelfCall() {
        require(msg.sender == address(this), "TokenFactory: not self call");

        _;
    }

    function getInitHash() public pure returns(bytes32) {
        bytes memory bytecode = type(MultiVaultToken).creationCode;
        return keccak256(abi.encodePacked(bytecode));
    }

    function deployTokenForNative(
        int8 wid,
        uint256 addr,
        string calldata name,
        string calldata symbol,
        uint8 decimals
    ) external onlySelfCall returns (address token) {
        bytes memory bytecode = type(MultiVaultToken).creationCode;

        bytes32 salt = keccak256(abi.encodePacked(wid, addr));

        assembly {
            token := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        IMultiVaultToken(token).initialize(name, symbol, decimals);
    }

    function deployLPToken(
        address token
    ) external onlySelfCall returns (address lp) {
        bytes memory bytecode = type(MultiVaultToken).creationCode;

        bytes32 salt = keccak256(abi.encodePacked('LP', token));

        assembly {
            lp := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        string memory name = IERC20Metadata(token).name();
        string memory symbol = IERC20Metadata(token).symbol();
        uint8 decimals = IERC20Metadata(token).decimals();

        IMultiVaultToken(lp).initialize(
            string(abi.encodePacked(DEFAULT_NAME_LP_PREFIX, name)),
            string(abi.encodePacked(DEFAULT_SYMBOL_LP_PREFIX, symbol)),
            decimals
        );
    }

    function mint(
        address token,
        address recipient,
        uint256 amount
    ) external onlySelfCall {
        IMultiVaultToken(token).mint(recipient, amount);
    }

    function burn(
        address token,
        address owner,
        uint256 amount
    ) external onlySelfCall {
        IMultiVaultToken(token).burn(owner, amount);
    }
}