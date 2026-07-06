const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/formTeacherController')
const protect = require('../middlewares/auth')
const authorize = require('../middlewares/roleAuth')

router.get('/broadsheet', protect, authorize('FORM_TEACHER'), ctrl.getBroadsheet)
router.put('/comment', protect, authorize('FORM_TEACHER'), ctrl.updateComment)
router.post('/settings', protect, authorize('FORM_TEACHER'), ctrl.updateSettings)
router.post('/attendance', protect, authorize('FORM_TEACHER'), ctrl.updateAttendance)
router.post('/submit', protect, authorize('FORM_TEACHER'), ctrl.submitBroadsheet)

module.exports = router
