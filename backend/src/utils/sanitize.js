const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id)

const isString = (val) => typeof val === 'string'

const sanitizeString = (val) => {
  if (!isString(val)) return ''
  return val
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
}

const escapeRegex = (str) => {
  if (!isString(str)) return ''
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = { isValidObjectId, isString, sanitizeString, escapeRegex }
