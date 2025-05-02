// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (access/Ownable.sol)

pragma solidity 0.8.0;

import "./Context.sol";

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract MultiOwnable is Context {
    address[] private _owners;
    mapping(address => bool) private _isOwner;


    event OwnershipTransferred(address[] previousOwners, address[] newOwners);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor (address initialOwner) {
        address[] memory t = new address[](1);
        t[0] = initialOwner;

        _transferOwnership(t);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owners() public view virtual returns (address[] memory) {
        return _owners;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(_isOwner[_msgSender()], "Ownable: caller is not the owner");
        _;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(new address[](0));
    }

    /**
     * @dev Transfers ownership of the contract to a new accounts (`newOwners`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address[] memory newOwners) public virtual onlyOwner {
        require(
            newOwners.length > 0 &&
            !(newOwners.length == 1 && newOwners[0] == address(0)),
            "Ownable: new owner is the zero address"
        );
        _transferOwnership(newOwners);
    }

    /**
     * @dev Transfers ownership of the contract to a new accounts (`newOwners`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address[] memory newOwners) internal virtual {
        address[] memory oldOwners = _owners;

        for (uint256 i = 0; i < oldOwners.length; i++) {
            _isOwner[oldOwners[i]] = false;
        }
        _owners = newOwners;

        for (uint256 i = 0; i < newOwners.length; i++) {
            address owner = newOwners[i];

            require(owner != address(0), "invalid owner");
            require(!_isOwner[owner], "owner not unique");

            _isOwner[owner] = true;
        }

        emit OwnershipTransferred(oldOwners, newOwners);
    }
}
