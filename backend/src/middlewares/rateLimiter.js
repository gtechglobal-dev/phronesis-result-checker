const rateLimit = require('express-rate-limit')

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const pinCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many result checks. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { message: 'Too many requests. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

module.exports = { loginLimiter, pinCheckLimiter, apiLimiter }
