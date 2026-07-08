const { Router } = require('express')
const pinController = require('../controllers/pinController')
const protect = require('../middlewares/auth')
const authorize = require('../middlewares/roleAuth')

const router = Router()

router.post('/generate', protect, authorize('EXAM_OFFICER'), pinController.generate)
router.get('/', protect, authorize('EXAM_OFFICER'), pinController.list)
router.delete('/:id', protect, authorize('EXAM_OFFICER'), pinController.deletePin)

module.exports = router
