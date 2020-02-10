module.exports = registry => async function () {
  const jurors = require('./jurors').data.jurors

  for (const juror of jurors) {
    const { id, activeBalance, availableBalance, lockedBalance, deactivationBalance } = juror
    const result = await registry.balanceOf(id)
    const { active, available, locked, pendingDeactivation } = result

    let activeMatch = active.toString() === activeBalance;
    let availableMatch = available.toString() === availableBalance;
    let lockedMatch = locked.toString() === lockedBalance;
    let dMatch = deactivationBalance === pendingDeactivation.toString();

    console.log(`JUROR ${juror.id}:`)
    if (activeMatch && availableMatch && lockedMatch && dMatch) console.log('fine')
    else {
      if (!activeMatch) console.log(`active does not match: expected ${activeBalance} actual ${active.toString()}`)
      if (!availableMatch) console.log(`available does not match: expected ${availableBalance} actual ${available.toString()}`)
      if (!lockedMatch) console.log(`locked balance does not match: expected ${locked} actual ${lockedBalance.toString()}`)
      if (!dMatch) console.log(`deactivation balance does not match: expected ${deactivationBalance} actual ${pendingDeactivation.toString()} `)
    }
  }
}
