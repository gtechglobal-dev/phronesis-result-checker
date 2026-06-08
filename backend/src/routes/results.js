const express = require('express')
const router = express.Router()
const resultController = require('../controllers/resultController')
const protect = require('../middlewares/auth')
const authorize = require('../middlewares/roleAuth')

router.get('/check', resultController.checkByRegNo)
router.get('/parent-children', protect, authorize('PARENT'), resultController.getParentChildrenResults)
router.get('/my-class', protect, authorize('FORM_TEACHER', 'EXAM_OFFICER'), resultController.getFormTeacherClassResults)
router.get('/:id', protect, resultController.getResult)
router.get('/student/:studentId', protect, resultController.getStudentResults)
router.post('/', protect, authorize('EXAM_OFFICER', 'FORM_TEACHER'), resultController.createResult)
router.put('/:id/comment', protect, authorize('FORM_TEACHER'), resultController.addTeacherComment)
router.put('/:id/withhold', protect, authorize('EXAM_OFFICER'), resultController.toggleWithhold)
router.post('/positions', protect, authorize('EXAM_OFFICER'), resultController.updatePositions)

module.exports = router
