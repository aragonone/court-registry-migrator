#! /usr/bin/env node

const jurors = require('./jurors').data.jurors
const { bn } = require('@aragon/court/test/helpers/lib/numbers')

const active = jurors.reduce((total, juror) => total.add(bn(juror.activeBalance)), bn(0))
const available = jurors.reduce((total, juror) => total.add(bn(juror.availableBalance)), bn(0))
const locked = jurors.reduce((total, juror) => total.add(bn(juror.lockedBalance)), bn(0))
const deactivation = jurors.reduce((total, juror) => total.add(bn(juror.deactivationBalance)), bn(0))

console.log('active:', active.toString())
console.log('available:', available.toString())
console.log('locked:', locked.toString())
console.log('deactivation:', deactivation.toString())
