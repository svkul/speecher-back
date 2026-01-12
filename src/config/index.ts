import * as Joi from 'joi';

export const configSchema = () => ({
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,

  // Logger
  LOG_CONTEXTS_ALLOW: process.env.LOG_CONTEXTS_ALLOW,
  LOG_CONTEXTS_DENY: process.env.LOG_CONTEXTS_DENY,
  LOG_LEVELS: process.env.LOG_LEVELS,
});

export const configValidationSchema = Joi.object({
  PORT: Joi.string().required(),
  NODE_ENV: Joi.string().valid('development', 'production').required(),

  // Logger
  LOG_CONTEXTS_ALLOW: Joi.string().optional().allow(''),
  LOG_CONTEXTS_DENY: Joi.string().optional().allow(''),
  LOG_LEVELS: Joi.string().default('log,error,warn,debug,verbose'),
});
