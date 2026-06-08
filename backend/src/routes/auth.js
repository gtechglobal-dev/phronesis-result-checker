const { Router } = require('express')
const { body } = require('express-validator')
const authController = require('../controllers/authController')
const auth = require('../middlewares/auth')

const router = Router()

router.post('/register', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('role').isIn(['FORM_TEACHER', 'PARENT', 'EXAM_OFFICER']).withMessage('Valid role is required')
], authController.register)

router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], authController.login)

router.get('/me', auth, authController.getMe)

module.exports = router
