import Joi from 'joi';

/**
 * Generic validation middleware
 */
export const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, '')
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    next();
  };
};

/**
 * User registration validation schema
 */
export const userRegistrationSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.alphanum': 'Username must contain only alphanumeric characters',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username cannot exceed 50 characters',
      'any.required': 'Username is required'
    }),
    
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    
  password: Joi.string()
    .min(6)
    .max(128)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.max': 'Password cannot exceed 128 characters',
      'any.required': 'Password is required'
    }),
    
  firstName: Joi.string()
    .max(50)
    .required()
    .messages({
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required'
    }),
    
  lastName: Joi.string()
    .max(50)
    .required()
    .messages({
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required'
    }),
    
  organization: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Organization name cannot exceed 100 characters'
    }),
    
  role: Joi.string()
    .valid('scientist', 'admin', 'researcher')
    .default('scientist')
    .messages({
      'any.only': 'Role must be one of: scientist, admin, researcher'
    })
});

/**
 * User login validation schema
 */
export const userLoginSchema = Joi.object({
  identifier: Joi.string()
    .required()
    .messages({
      'any.required': 'Username or email is required'
    }),
    
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});

/**
 * File upload validation
 */
export const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || ['.xlsx', '.xls'];
  const fileExtension = req.file.originalname.toLowerCase().substr(req.file.originalname.lastIndexOf('.'));

  if (!allowedTypes.includes(fileExtension)) {
    return res.status(400).json({
      success: false,
      message: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
    });
  }

  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB default
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: `File size too large. Maximum size: ${maxSize / 1024 / 1024}MB`
    });
  }

  next();
};

/**
 * Pagination validation
 */
export const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1) {
    return res.status(400).json({
      success: false,
      message: 'Page number must be greater than 0'
    });
  }

  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      message: 'Limit must be between 1 and 100'
    });
  }

  req.pagination = {
    page,
    limit,
    skip: (page - 1) * limit
  };

  next();
};

export default {
  validate,
  userRegistrationSchema,
  userLoginSchema,
  validateFileUpload,
  validatePagination
};