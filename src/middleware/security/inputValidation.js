const { body, query, param, validationResult } = require('express-validator');
const xss = require('xss');
const { validation } = require('../../config/security.config');

// Sanitize input to prevent XSS
const sanitizeInput = (value) => {
  if (typeof value === 'string') {
    return xss(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeInput);
  }
  if (typeof value === 'object' && value !== null) {
    const sanitized = {};
    for (const key in value) {
      sanitized[key] = sanitizeInput(value[key]);
    }
    return sanitized;
  }
  return value;
};

// Generic input sanitization middleware
const sanitizeRequest = (req, res, next) => {
  // Sanitize body
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }

  // Sanitize params
  if (req.params) {
    req.params = sanitizeInput(req.params);
  }

  next();
};

// Validate request results
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  
  next();
};

// Common validation rules
const commonValidations = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),

  password: body('password')
    .isLength({ min: 8, max: 128 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),

  tenantId: body('tenantId')
    .optional()
    .isUUID()
    .withMessage('Invalid tenant ID format'),

  shopifyDomain: body('shopDomain')
    .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/)
    .withMessage('Invalid Shopify domain format'),

  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],

  dateRange: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid start date format'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid end date format'),
  ],

  id: param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
};

// SQL Injection prevention
const preventSQLInjection = (req, res, next) => {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FROM|WHERE)\b)/gi,
    /(--|\||;|\/\*|\*\/|xp_|sp_|0x)/gi,
    /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s*\d+\s*=\s*\d+)/gi,
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    }
    return false;
  };

  const checkObject = (obj) => {
    for (const key in obj) {
      if (checkValue(obj[key])) {
        return true;
      }
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkObject(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };

  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    console.error(`SQL Injection attempt from IP: ${req.ip}`);
    return res.status(400).json({
      error: 'Invalid input',
      message: 'Request contains suspicious patterns',
    });
  }

  next();
};

// File upload validation
const validateFileUpload = (fieldName) => {
  return (req, res, next) => {
    if (!req.files || !req.files[fieldName]) {
      return res.status(400).json({
        error: 'No file uploaded',
      });
    }

    const file = req.files[fieldName];
    const fileExtension = file.name.split('.').pop().toLowerCase();

    // Check file type
    if (!validation.allowedFileTypes.includes(fileExtension)) {
      return res.status(400).json({
        error: 'Invalid file type',
        allowedTypes: validation.allowedFileTypes,
      });
    }

    // Check file size
    if (file.size > validation.maxFileSize) {
      return res.status(400).json({
        error: 'File too large',
        maxSize: `${validation.maxFileSize / (1024 * 1024)}MB`,
      });
    }

    next();
  };
};

// Prevent NoSQL injection for MongoDB (if using)
const preventNoSQLInjection = (req, res, next) => {
  const cleanObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;

    for (const key in obj) {
      if (key.startsWith('$')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        obj[key] = cleanObject(obj[key]);
      }
    }
    return obj;
  };

  req.body = cleanObject(req.body);
  req.query = cleanObject(req.query);
  
  next();
};

module.exports = {
  sanitizeInput,
  sanitizeRequest,
  validateRequest,
  commonValidations,
  preventSQLInjection,
  validateFileUpload,
  preventNoSQLInjection,
};
