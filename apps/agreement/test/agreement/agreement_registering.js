const { bn } = require('../helpers/lib/numbers')
const { assertBn } = require('../helpers/assert/assertBn')
const { assertRevert } = require('../helpers/assert/assertThrow')
const { assertEvent, assertAmountOfEvents } = require('../helpers/assert/assertEvent')
const { AGREEMENT_EVENTS } = require('../helpers/utils/events')
const { AGREEMENT_ERRORS, ARAGON_OS_ERRORS } = require('../helpers/utils/errors')

const deployer = require('../helpers/utils/deployer')(web3, artifacts)

contract('Agreement', ([_, someone, owner]) => {
  let disputable

  beforeEach('deploy disputable app', async () => {
    disputable = await deployer.deployAndInitializeWrapperWithDisputable({ owner, register: false })
  })

  describe('register', () => {
    context('when the sender has permissions', () => {
      const from = owner

      context('when the disputable was unregistered', () => {
        it('registers the disputable app', async () => {
          const receipt = await disputable.register({ from })

          assertAmountOfEvents(receipt, AGREEMENT_EVENTS.DISPUTABLE_REGISTERED)
          assertEvent(receipt, AGREEMENT_EVENTS.DISPUTABLE_REGISTERED, { disputable: disputable.disputable.address })

          const { registered, currentCollateralRequirementId } = await disputable.getDisputableInfo()
          assert.isTrue(registered, 'disputable state does not match')
          assertBn(currentCollateralRequirementId, 0, 'disputable current collateral requirement ID does not match')
        })

        it('sets up the initial collateral requirements for the disputable', async () => {
          const receipt = await disputable.register({ from })

          assertAmountOfEvents(receipt, AGREEMENT_EVENTS.COLLATERAL_REQUIREMENT_CHANGED)
          assertEvent(receipt, AGREEMENT_EVENTS.COLLATERAL_REQUIREMENT_CHANGED, { disputable: disputable.disputable.address, id: 0 })

          const { collateralToken, actionCollateral, challengeCollateral, challengeDuration } = await disputable.getCollateralRequirement(0)
          assert.equal(collateralToken.address, disputable.collateralToken.address, 'collateral token does not match')
          assertBn(actionCollateral, disputable.actionCollateral, 'action collateral does not match')
          assertBn(challengeCollateral, disputable.challengeCollateral, 'challenge collateral does not match')
          assertBn(challengeDuration, disputable.challengeDuration, 'challenge duration does not match')
        })
      })

      context('when the disputable was registered', () => {
        beforeEach('register disputable', async () => {
          await disputable.register({ from })
        })

        context('when the disputable is registered', () => {
          it('reverts', async () => {
            await assertRevert(disputable.register({ from }), AGREEMENT_ERRORS.ERROR_DISPUTABLE_APP_ALREADY_EXISTS)
          })
        })

        context('when the disputable is unregistered', () => {
          beforeEach('unregister disputable', async () => {
            await disputable.unregister({ from })
          })

          it('re-registers the disputable app', async () => {
            const receipt = await disputable.register({ from })

            assertAmountOfEvents(receipt, AGREEMENT_EVENTS.DISPUTABLE_REGISTERED)
            assertEvent(receipt, AGREEMENT_EVENTS.DISPUTABLE_REGISTERED, { disputable: disputable.disputable.address })

            const { registered, currentCollateralRequirementId } = await disputable.getDisputableInfo()
            assert.isTrue(registered, 'disputable state does not match')
            assertBn(currentCollateralRequirementId, 1, 'disputable current collateral requirement ID does not match')
          })

          it('sets up another collateral requirement for the disputable', async () => {
            const currentCollateralId = await disputable.getCurrentCollateralRequirementId()
            const receipt = await disputable.register({ from })

            const expectedNewCollateralId = currentCollateralId.add(bn(1))
            assertAmountOfEvents(receipt, AGREEMENT_EVENTS.COLLATERAL_REQUIREMENT_CHANGED)
            assertEvent(receipt, AGREEMENT_EVENTS.COLLATERAL_REQUIREMENT_CHANGED, { disputable: disputable.disputable.address, id: expectedNewCollateralId })

            const { collateralToken, actionCollateral, challengeCollateral, challengeDuration } = await disputable.getCollateralRequirement(expectedNewCollateralId)
            assert.equal(collateralToken.address, disputable.collateralToken.address, 'collateral token does not match')
            assertBn(actionCollateral, disputable.actionCollateral, 'action collateral does not match')
            assertBn(challengeCollateral, disputable.challengeCollateral, 'challenge collateral does not match')
            assertBn(challengeDuration, disputable.challengeDuration, 'challenge duration does not match')
          })
        })
      })
    })

    context('when the sender does not have permissions', () => {
      const from = someone

      it('reverts', async () => {
        await assertRevert(disputable.register({ from }), ARAGON_OS_ERRORS.ERROR_AUTH_FAILED)
      })
    })
  })

  describe('unregister', () => {
    context('when the sender has permissions', () => {
      const from = owner

      context('when the disputable was registered', () => {
        beforeEach('register disputable', async () => {
          await disputable.register({ from })
        })

        const itUnregistersTheDisputableApp = () => {
          it('unregisters the disputable app', async () => {
            const receipt = await disputable.unregister({ from })

            assertAmountOfEvents(receipt, AGREEMENT_EVENTS.DISPUTABLE_UNREGISTERED)
            assertEvent(receipt, AGREEMENT_EVENTS.DISPUTABLE_UNREGISTERED, { disputable: disputable.disputable.address })

            const { registered, currentCollateralRequirementId } = await disputable.getDisputableInfo()
            assert.isFalse(registered, 'disputable state does not match')
            assertBn(currentCollateralRequirementId, 0, 'disputable current collateral requirement ID does not match')
          })
        }

        context('when there were no actions ongoing', () => {
          itUnregistersTheDisputableApp()
        })

        context('when there were some actions ongoing', () => {
          beforeEach('submit action', async () => {
            await disputable.newAction({})
          })

          itUnregistersTheDisputableApp()
        })
      })

      context('when the disputable was not registered', () => {
        it('reverts', async () => {
          await assertRevert(disputable.unregister({ from }), AGREEMENT_ERRORS.ERROR_DISPUTABLE_APP_NOT_REGISTERED)
        })
      })
    })

    context('when the sender does not have permissions', () => {
      const from = someone

      it('reverts', async () => {
        await assertRevert(disputable.unregister({ from }), ARAGON_OS_ERRORS.ERROR_AUTH_FAILED)
      })
    })
  })
})