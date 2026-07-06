const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/subjectAssignmentController')
const protect = require('../middlewares/auth')
const authorize = require('../middlewares/roleAuth')

router.post('/', protect, authorize('EXAM_OFFICER'), ctrl.create)
router.get('/', protect, authorize('EXAM_OFFICER'), ctrl.list)
router.get('/my', protect, ctrl.getMyAssignment)
router.delete('/:id', protect, authorize('EXAM_OFFICER'), ctrl.remove)

module.exports = router
