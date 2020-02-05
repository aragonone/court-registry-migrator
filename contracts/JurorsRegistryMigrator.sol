pragma solidity ^0.5.8;

import "@aragon/court/contracts/lib/os/ERC20.sol";
import "@aragon/court/contracts/registry/JurorsRegistry.sol";
import "@aragon/court/contracts/disputes/IDisputeManager.sol";
import "@aragon/court/contracts/court/controller/Controlled.sol";


contract JurorsRegistryMigrator is IDisputeManager {
    uint64 constant internal ZERO_TERM = 0;
    uint64 constant internal FIRST_TERM = 1;
    bytes32 constant internal ACTIVATE_DATA = keccak256("activate(uint256)");

    string constant internal ERROR_TOKEN_DOES_NOT_MATCH = "JRM_TOKEN_DOES_NOT_MATCH";
    string constant internal ERROR_CONTROLLER_DOES_NOT_MATCH = "JRM_CONTROLLER_DOES_NOT_MATCH";
    string constant internal ERROR_BALANCE_TO_MIGRATE_ZERO = "JRM_BALANCE_TO_MIGRATE_ZERO";
    string constant internal ERROR_ANJ_APPROVAL_FAILED = "JRM_ANJ_APPROVAL_FAILED";
    string constant internal ERROR_MIGRATION_IN_PROGRESS = "JRM_MIGRATION_IN_PROGRESS";
    string constant internal ERROR_CLOSE_TRANSFER_FAILED = "JRM_CLOSE_TRANSFER_FAILED";
    string constant internal ERROR_SENDER_NOT_FUNDS_GOVERNOR = "JRM_SENDER_NOT_FUNDS_GOVERNOR";

    ERC20 public token;
    JurorsRegistry public oldRegistry;
    JurorsRegistry public newRegistry;
    mapping (address => uint256) internal migrations;

    event TokensMigrated(address indexed juror, uint256 amount);
    event MigrationClosed(uint256 amount);

    modifier onlyFundsGovernor() {
        Controller controller = newRegistry.getController();
        address fundsGovernor = controller.getFundsGovernor();
        require(fundsGovernor == msg.sender, ERROR_SENDER_NOT_FUNDS_GOVERNOR);
        _;
    }

    constructor (JurorsRegistry _oldRegistry, JurorsRegistry _newRegistry) public {
        address oldRegistryToken = _oldRegistry.token();
        address newRegistryToken = _newRegistry.token();

        require(oldRegistryToken == newRegistryToken, ERROR_TOKEN_DOES_NOT_MATCH);
        require(_oldRegistry.getController() == _newRegistry.getController(), ERROR_CONTROLLER_DOES_NOT_MATCH);

        token = ERC20(oldRegistryToken);
        oldRegistry = _oldRegistry;
        newRegistry = _newRegistry;
    }

    function migrate(address _juror) external {
        // Note that this migration will only work for the precedence campaign
        // This is, jurors that activated tokens during term 0 becoming active on term 1
        uint256 balanceToBeMigrated = oldRegistry.activeBalanceOfAt(_juror, FIRST_TERM);
        require(balanceToBeMigrated > 0, ERROR_BALANCE_TO_MIGRATE_ZERO);

        // Note that we are forcing the tokens collection to occur on term 0, which means the tree will be cleaned for term 1
        oldRegistry.collectTokens(_juror, balanceToBeMigrated, ZERO_TERM);
        emit TokensMigrated(_juror, balanceToBeMigrated);

        require(token.approve(address(newRegistry), balanceToBeMigrated), ERROR_ANJ_APPROVAL_FAILED);
        newRegistry.stakeFor(_juror, balanceToBeMigrated, abi.encodePacked(ACTIVATE_DATA));
    }

    function close() external onlyFundsGovernor {
        uint256 balance = token.balanceOf(address(this));
        require(token.transfer(address(oldRegistry), balance), ERROR_CLOSE_TRANSFER_FAILED);
        emit MigrationClosed(balance);
    }

    /** DISPUTE MANAGER METHODS **/

    function createDispute(IArbitrable /* _subject */, uint8 /* _possibleRulings */, bytes calldata /* _metadata */) external returns (uint256) {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }

    function closeEvidencePeriod(IArbitrable /* _subject */, uint256 /* _disputeId */) external {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }

    function draft(uint256 /* _disputeId */) external {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }

    function createAppeal(uint256 /* _disputeId */, uint256 /* _roundId */, uint8 /* _ruling */) external {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }

    function confirmAppeal(uint256 /* _disputeId */, uint256 /* _roundId */, uint8 /* _ruling */) external {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }

    function computeRuling(uint256 /* _disputeId */) external returns (IArbitrable /* subject */, uint8 /* finalRuling */) {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }

    function settlePenalties(uint256 /* _disputeId */, uint256 /* _roundId */, uint256 /* _jurorsToSettle */) external {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }

    function settleReward(uint256 /* _disputeId */, uint256 /* _roundId */, address /* _juror */) external {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }

    function settleAppealDeposit(uint256 /* _disputeId */, uint256 /* _roundId */) external {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }

    function getDisputeFees() external view returns (ERC20 /* feeToken */, uint256 /* feeAmount */) {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }

    function getDispute(uint256 /* _disputeId */) external view
        returns (
            IArbitrable /* subject */,
            uint8 /* possibleRulings */,
            DisputeState /* state */,
            uint8 /* finalRuling */,
            uint256 /* lastRoundId */,
            uint64 /* createTermId */
        )
    {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }

    function getRound(uint256 /* _disputeId */, uint256 /* _roundId */) external view
        returns (
            uint64 /* draftTerm */,
            uint64 /* delayedTerms */,
            uint64 /* jurorsNumber */,
            uint64 /* selectedJurors */,
            uint256 /* jurorFees */,
            bool /* settledPenalties */,
            uint256 /* collectedTokens */,
            uint64 /* coherentJurors */,
            AdjudicationState /* state */
        )
    {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }

    function getAppeal(uint256 /* _disputeId */, uint256 /* _roundId */) external view
        returns (address /* maker */, uint64 /* appealedRuling */, address /* taker */, uint64 /* opposedRuling */)
    {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }

    function getNextRoundDetails(uint256 /* _disputeId */, uint256 /* _roundId */) external view
        returns (
            uint64 /* nextRoundStartTerm */,
            uint64 /* nextRoundJurorsNumber */,
            DisputeState /* newDisputeState */,
            ERC20 /* feeToken */,
            uint256 /* totalFees */,
            uint256 /* jurorFees */,
            uint256 /* appealDeposit */,
            uint256 /* confirmAppealDeposit */
        )
    {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }

    function getJuror(uint256 /* _disputeId */, uint256 /* _roundId */, address /* _juror */) external view
        returns (uint64 /* weight */, bool /* rewarded */)
    {
        revert(ERROR_MIGRATION_IN_PROGRESS);
    }
}
