pragma solidity ^0.5.8;

import "./ERC20Mock.sol";
import "../lib/Migrations.sol";
import "./AragonCourtMock.sol";
import "./SubscriptionsMock.sol";
import "./JurorsRegistryMock.sol";
import "@aragon/court/contracts/voting/CRVoting.sol";
import "@aragon/court/contracts/treasury/CourtTreasury.sol";
import "@aragon/court/contracts/disputes/DisputeManager.sol";


contract TestImports {
    constructor() public {
        // solium-disable-previous-line no-empty-blocks
    }
}
