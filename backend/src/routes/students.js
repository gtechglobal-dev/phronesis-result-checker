const { Router } = require('express')
const { body } = require('express-validator')
const studentController = require('../controllers/studentController')
const auth = require('../middlewares/auth')
const roleAuth = require('../middlewares/roleAuth')

const router = Router()

router.get('/', auth, studentController.getStudents)
router.get('/my-children', auth, roleAuth('PARENT'), studentController.getMyChildren)
router.get('/class/:classId', auth, studentController.getStudentsByClass)
router.get('/:id', auth, studentController.getStudent)

router.post('/', auth, roleAuth('EXAM_OFFICER'), [
  body('regNo').notEmpty().withMessage('Registration number is required'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('classId').notEmpty().withMessage('Class ID is required')
], studentController.createStudent)

router.put('/:id', auth, roleAuth('EXAM_OFFICER'), studentController.updateStudent)

module.exports = router
