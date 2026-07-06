const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')
const protect = require('../middlewares/auth')
const authorize = require('../middlewares/roleAuth')

router.post('/register', authController.register)
router.post('/login', authController.login)
router.get('/me', protect, authController.getMe)

router.post('/create-teacher', protect, authorize('EXAM_OFFICER'), authController.createTeacher)
router.get('/teachers', protect, authorize('EXAM_OFFICER'), authController.getTeachers)
router.put('/teachers/:id/cancel-assignment', protect, authorize('EXAM_OFFICER'), authController.cancelAssignment)
router.put('/teachers/:id/change-password', protect, authorize('EXAM_OFFICER'), authController.changePassword)

module.exports = router
