const { Router } = require('express')
const { body, validationResult } = require('express-validator')
const classController = require('../controllers/classController')
const auth = require('../middlewares/auth')
const roleAuth = require('../middlewares/roleAuth')

const router = Router()

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array().map(e => e.msg).join(', ') })
  }
  next()
}

router.get('/', classController.getClasses)
router.get('/:classId/subjects', auth, classController.getClassSubjects)

router.post('/', auth, roleAuth('EXAM_OFFICER'), [
  body('name').notEmpty().withMessage('Class name is required'),
  body('level').isIn(['MONTESSORI', 'NURSERY', 'PRIMARY', 'SECONDARY']).withMessage('Invalid level'),
  validate
], classController.createClass)

router.delete('/:id', auth, roleAuth('EXAM_OFFICER'), classController.deleteClass)
router.delete('/subjects/:id', auth, roleAuth('EXAM_OFFICER'), classController.deleteSubject)

router.post('/subjects', auth, roleAuth('EXAM_OFFICER', 'FORM_TEACHER'), [
  body('name').notEmpty().withMessage('Subject name is required'),
  body('classId').notEmpty().withMessage('Class ID is required'),
  validate
], classController.createSubject)

router.post('/subjects/bulk', auth, roleAuth('EXAM_OFFICER'), [
  body('names').isArray({ min: 1 }).withMessage('Subject names are required'),
  body('classId').notEmpty().withMessage('Class ID is required'),
  validate
], classController.bulkCreateSubjects)

router.post('/assign-teacher', auth, roleAuth('EXAM_OFFICER'), [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('classId').notEmpty().withMessage('Class ID is required'),
  validate
], classController.assignFormTeacher)

router.get('/teachers/assignments', auth, roleAuth('EXAM_OFFICER'), classController.getFormTeachers)

router.get('/my-assignment', auth, roleAuth('FORM_TEACHER', 'SUBJECT_TEACHER'), classController.getMyAssignment)
router.get('/sessions/all', classController.getSessions)

router.post('/sessions', auth, roleAuth('EXAM_OFFICER'), [
  body('name').notEmpty().withMessage('Session name is required'),
  validate
], classController.createSession)

router.post('/terms', auth, roleAuth('EXAM_OFFICER'), [
  body('name').notEmpty().withMessage('Term name is required'),
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  validate
], classController.createTerm)

router.delete('/sessions/:id', auth, roleAuth('EXAM_OFFICER'), classController.deleteSession)
router.delete('/terms/:id', auth, roleAuth('EXAM_OFFICER'), classController.deleteTerm)

router.post('/subjects/copy', auth, roleAuth('EXAM_OFFICER'), classController.copySubjectsFromSession)
router.post('/sessions/reactivate', auth, roleAuth('EXAM_OFFICER'), classController.reactivateSession)

module.exports = router
