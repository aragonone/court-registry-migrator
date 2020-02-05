const { bigExp } = require('@aragon/court/test/helpers/lib/numbers')
const { assertBn } = require('@aragon/court/test/helpers/asserts/assertBn')
const { assertRevert } = require('@aragon/court/test/helpers/asserts/assertThrow')
const { buildHelper } = require('@aragon/court/test/helpers/wrappers/court')(web3, artifacts)
const { assertEvent, assertAmountOfEvents } = require('@aragon/court/test/helpers/asserts/assertEvent')

const JurorsRegistry = artifacts.require('JurorsRegistry')
const Migrator = artifacts.require('JurorsRegistryMigrator')
const ERC20 = artifacts.require('ERC20Mock')

contract('JurorsRegistryMigrator', ([_, modulesGovernor, configGovernor, fundsGovernor, juror10000, juror50000, juror35123, juror200, newJuror, anotherNewJuror]) => {
  let courtHelper, controller, oldJurorsRegistry, newJurorsRegistry, disputeManager, migrator, token

  const jurors = [
    { address: juror10000, initialActiveBalance: bigExp(10000, 18) },
    { address: juror50000, initialActiveBalance: bigExp(50000, 18) },
    { address: juror35123, initialActiveBalance: bigExp(35123, 18) },
  ]

  const FIRST_TERM = 1
  const SECOND_TERM = 2

  const STAKED_BALANCE = bigExp(200, 18)
  const ACTIVE_BALANCE = bigExp(95123, 18)

  const assertBalance = async (juror, registry, expectedBalances = { active: 0, locked: 0, available: 0, pendingDeactivation: 0 }, term = undefined) => {
    const { active, available, locked, pendingDeactivation } = term ? await registry.balanceOfAt(juror, term) : await registry.balanceOf(juror)
    assertBn(active, expectedBalances.active || 0, `juror ${juror} active balance does not match`)
    assertBn(available, expectedBalances.available || 0, `juror ${juror} available balance does not match`)
    assertBn(locked, expectedBalances.locked || 0, `juror ${juror} locked balance does not match`)
    assertBn(pendingDeactivation, expectedBalances.pendingDeactivation || 0, `juror ${juror} deactivation balance does not match`)
  }

  before('deploy full court', async () => {
    courtHelper = buildHelper()
    controller = await courtHelper.deploy({ fundsGovernor, configGovernor, modulesGovernor })

    assertBn(await controller.getCurrentTermId(), 0, 'current court term is not zero')
  })

  before('activate some jurors', async () => {
    oldJurorsRegistry = await JurorsRegistry.at(await controller.getJurorsRegistry())
    await courtHelper.activate(jurors)

    for(const juror of jurors) {
      await assertBalance(juror.address, oldJurorsRegistry, { active: juror.initialActiveBalance })
    }
  })

  before('stake some tokens', async () => {
    token = await ERC20.at(await oldJurorsRegistry.token())
    const balance = bigExp(200, 18)
    await token.generateTokens(juror200, balance)
    await token.approveAndCall(oldJurorsRegistry.address, balance, '0x', { from: juror200 })

    await assertBalance(juror200, oldJurorsRegistry, { available: balance })
  })

  before('move to first term', async () => {
    await courtHelper.passTerms(1)

    assertBn(await controller.getCurrentTermId(), 1, 'current court term is not one')
  })

  before('deploy and set new registry', async () => {
    const totalJurorsActiveBalanceLimit = await oldJurorsRegistry.totalJurorsActiveBalanceLimit()
    newJurorsRegistry = await JurorsRegistry.new(controller.address, token.address, totalJurorsActiveBalanceLimit)
    await controller.setJurorsRegistry(newJurorsRegistry.address, { from: modulesGovernor })
    courtHelper.jurorsRegistry = newJurorsRegistry
  })

  before('deploy and set migrator', async () => {
    migrator = await Migrator.new(oldJurorsRegistry.address, newJurorsRegistry.address)
    disputeManager = courtHelper.disputeManager
    await controller.setDisputeManager(migrator.address, { from: modulesGovernor })
    courtHelper.disputeManager = migrator
    await oldJurorsRegistry.recoverFunds(token.address, migrator.address, { from: fundsGovernor })
  })

  it('holds all the funds from the old registry', async () => {
    assertBn(await token.balanceOf(oldJurorsRegistry.address), 0, 'old registry should not hold any balances initially')
    assertBn(await token.balanceOf(newJurorsRegistry.address), 0, 'new registry should not hold any balances initially')
    assertBn(await token.balanceOf(migrator.address), ACTIVE_BALANCE.add(STAKED_BALANCE), 'migrator should hold all the old registry balances')
  })

  it('is possible to activate new jurors on the new registry', async () => {
    const newBalance = bigExp(100000, 18)
    await courtHelper.activate([{ address: newJuror, initialActiveBalance: newBalance}])

    assertBn(await token.balanceOf(oldJurorsRegistry.address), 0, 'old registry should not hold any balances')
    assertBn(await token.balanceOf(newJurorsRegistry.address), newBalance, 'new registry should hold new active balances')
    assertBn(await token.balanceOf(migrator.address), ACTIVE_BALANCE.add(STAKED_BALANCE), 'migrator should hold all the old registry balances')

    await assertBalance(newJuror, newJurorsRegistry, { active: newBalance })
  })

  it('migrates active balances', async () => {
    const previousNewRegistryBalance = await token.balanceOf(newJurorsRegistry.address)

    for (const juror of jurors) {
      const receipt = await migrator.migrate(juror.address)

      assertAmountOfEvents(receipt, 'TokensMigrated')
      assertEvent(receipt, 'TokensMigrated', { juror: juror.address, amount: juror.initialActiveBalance })

      await assertBalance(juror.address, newJurorsRegistry, { active: 0 }, FIRST_TERM)
      await assertBalance(juror.address, newJurorsRegistry, { active: juror.initialActiveBalance }, SECOND_TERM)
    }

    assertBn(await token.balanceOf(oldJurorsRegistry.address), 0, 'old registry should not hold any balances')
    assertBn(await token.balanceOf(newJurorsRegistry.address), ACTIVE_BALANCE.add(previousNewRegistryBalance), 'new registry should hold active balances')
    assertBn(await token.balanceOf(migrator.address), STAKED_BALANCE, 'migrator should hold only-staked balances')
  })

  it('cannot migrate twice', async () => {
    for (const juror of jurors) {
      await assertRevert(migrator.migrate(juror.address), 'JRM_BALANCE_TO_MIGRATE_ZERO')
    }
  })

  it('leaves the old registry active jurors clean', async () => {
    for (const juror of jurors) {
      await assertBalance(juror.address, oldJurorsRegistry)
    }
  })

  it('does not clean the old registry only-staked jurors', async () => {
      await assertBalance(juror200, newJurorsRegistry, { available: 0 })
      await assertBalance(juror200, oldJurorsRegistry, { available: bigExp(200, 18) })
  })

  it('disables completely the dispute manager module', async () => {
    await assertRevert(courtHelper.dispute(), 'JRM_MIGRATION_IN_PROGRESS')
  })

  it('sends the remaining balance back to the old jurors registry', async () => {
    const previousNewRegistryBalance = await token.balanceOf(newJurorsRegistry.address)

    await assertRevert(migrator.close(), 'JRM_SENDER_NOT_FUNDS_GOVERNOR')
    const receipt = await migrator.close({ from: fundsGovernor })

    assertAmountOfEvents(receipt, 'MigrationClosed')
    assertEvent(receipt, 'MigrationClosed', { amount: STAKED_BALANCE })

    assertBn(await token.balanceOf(migrator.address), 0, 'migrator should not hold any more tokens')
    assertBn(await token.balanceOf(oldJurorsRegistry.address), STAKED_BALANCE, 'old registry should hold the only-staked balances')
    assertBn(await token.balanceOf(newJurorsRegistry.address), previousNewRegistryBalance, 'new registry balance should not have changed')
  })

  it('enables the dispute manager module back', async () => {
    await controller.setDisputeManager(disputeManager.address, { from: modulesGovernor })
    courtHelper.disputeManager = disputeManager

    const disputeId = await courtHelper.dispute()
    assertBn(disputeId, 0, 'dispute ID does not match')
  })

  it('allows only-staked jurors to migrate their tokens manually', async () => {
    const balance = await oldJurorsRegistry.totalStakedFor(juror200)

    await oldJurorsRegistry.unstake(balance, '0x', { from: juror200 })
    await token.approveAndCall(newJurorsRegistry.address, balance, '0x', { from: juror200 })

    await assertBalance(juror200, oldJurorsRegistry, { available: 0 })
    await assertBalance(juror200, newJurorsRegistry, { available: balance })
  })
})
