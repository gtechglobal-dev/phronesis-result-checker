const { Router } = require('express')
const { body } = require('express-validator')
const classController = require('../controllers/classController')
const auth = require('../middlewares/auth')
const roleAuth = require('../middlewares/roleAuth')

const router = Router()

router.get('/', auth, classController.getClasses)
router.get('/:classId/subjects', auth, classController.getClassSubjects)

router.post('/', auth, roleAuth('EXAM_OFFICER'), [
  body('name').notEmpty().withMessage('Class name is required'),
  body('level').isIn(['MONTESSORI', 'NURSERY', 'PRIMARY', 'SECONDARY']).withMessage('Invalid level')
], classController.createClass)

router.post('/subjects', auth, roleAuth('EXAM_OFFICER', 'FORM_TEACHER'), [
  body('name').notEmpty().withMessage('Subject name is required'),
  body('classId').notEmpty().withMessage('Class ID is required')
], classController.createSubject)

router.post('/assign-teacher', auth, roleAuth('EXAM_OFFICER'), [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('classId').notEmpty().withMessage('Class ID is required')
], classController.assignFormTeacher)

router.get('/teachers/assignments', auth, roleAuth('EXAM_OFFICER'), classController.getFormTeachers)

router.get('/sessions/all', auth, classController.getSessions)

router.post('/sessions', auth, roleAuth('EXAM_OFFICER'), [
  body('name').notEmpty().withMessage('Session name is required')
], classController.createSession)

router.post('/terms', auth, roleAuth('EXAM_OFFICER'), [
  body('name').notEmpty().withMessage('Term name is required'),
  body('sessionId').notEmpty().withMessage('Session ID is required')
], classController.createTerm)

module.exports = router
