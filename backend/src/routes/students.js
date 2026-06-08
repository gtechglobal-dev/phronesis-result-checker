const express = require('express')
const router = express.Router()
const studentController = require('../controllers/studentController')
const protect = require('../middlewares/auth')
const authorize = require('../middlewares/roleAuth')

router.get('/', protect, studentController.getStudents)
router.get('/unlinked', studentController.getUnlinkedStudents)
router.get('/my-children', protect, authorize('PARENT'), studentController.getMyChildren)
router.get('/by-class/:classId', protect, authorize('EXAM_OFFICER', 'FORM_TEACHER'), studentController.getStudentsByClass)
router.get('/:id', protect, studentController.getStudent)
router.post('/', protect, authorize('EXAM_OFFICER', 'FORM_TEACHER'), studentController.createStudent)
router.post('/bulk', protect, authorize('EXAM_OFFICER'), studentController.bulkCreateStudents)
router.put('/:id', protect, authorize('EXAM_OFFICER', 'FORM_TEACHER'), studentController.updateStudent)

module.exports = router
