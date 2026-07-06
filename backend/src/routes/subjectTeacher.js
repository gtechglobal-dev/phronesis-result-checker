const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/subjectTeacherController')
const protect = require('../middlewares/auth')

router.get('/assignment', protect, ctrl.getAssignment)
router.get('/scores', protect, ctrl.getScores)
router.post('/scores', protect, ctrl.saveScores)
router.post('/submit', protect, ctrl.submitScores)

module.exports = router
