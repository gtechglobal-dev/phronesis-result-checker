const { Router } = require('express')
const { body } = require('express-validator')
const resultController = require('../controllers/resultController')
const auth = require('../middlewares/auth')
const roleAuth = require('../middlewares/roleAuth')

const router = Router()

router.get('/check', resultController.checkByRegNo)

router.get('/student/:studentId', auth, resultController.getStudentResults)
router.get('/form-teacher', auth, roleAuth('FORM_TEACHER'), resultController.getFormTeacherClassResults)
router.get('/:id', auth, resultController.getResult)

router.post('/', auth, roleAuth('EXAM_OFFICER'), [
  body('studentId').notEmpty().withMessage('Student ID is required'),
  body('classId').notEmpty().withMessage('Class ID is required'),
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('termId').notEmpty().withMessage('Term ID is required'),
  body('scores').isArray({ min: 1 }).withMessage('At least one subject score is required')
], resultController.createResult)

router.put('/:id/comment', auth, roleAuth('FORM_TEACHER'), [
  body('teacherComment').notEmpty().withMessage('Teacher comment is required')
], resultController.addTeacherComment)

router.post('/update-positions', auth, roleAuth('EXAM_OFFICER'), resultController.updatePositions)

module.exports = router
