import * as Joi from 'joi';

export const configSchema = () => ({
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // Logger
  LOG_CONTEXTS_ALLOW: process.env.LOG_CONTEXTS_ALLOW,
  LOG_CONTEXTS_DENY: process.env.LOG_CONTEXTS_DENY,
  LOG_LEVELS: process.env.LOG_LEVELS,

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY,
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY,
  },

  // OAuth
  oauth: {
    google: {
      clientIdWeb: process.env.OAUTH_GOOGLE_CLIENT_ID_WEB,
      clientIdIos: process.env.OAUTH_GOOGLE_CLIENT_ID_IOS,
      clientIdAndroid: process.env.OAUTH_GOOGLE_CLIENT_ID_ANDROID,
    },
    apple: {
      clientId: process.env.OAUTH_APPLE_CLIENT_ID,
    },
  },

  // Cookies
  cookieDomain: process.env.COOKIE_DOMAIN,
});

export const configValidationSchema = Joi.object({
  PORT: Joi.string().required(),
  NODE_ENV: Joi.string().valid('development', 'production').required(),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Logger
  LOG_CONTEXTS_ALLOW: Joi.string().optional().allow(''),
  LOG_CONTEXTS_DENY: Joi.string().optional().allow(''),
  LOG_LEVELS: Joi.string().default('log,error,warn,debug,verbose'),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_ACCESS_TOKEN_EXPIRY: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('15m'),
  JWT_REFRESH_TOKEN_EXPIRY: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('7d'),

  // OAuth
  OAUTH_GOOGLE_CLIENT_ID_WEB: Joi.string().optional().allow(''),
  OAUTH_GOOGLE_CLIENT_ID_IOS: Joi.string().optional().allow(''),
  OAUTH_GOOGLE_CLIENT_ID_ANDROID: Joi.string().optional().allow(''),
  OAUTH_APPLE_CLIENT_ID: Joi.string().optional().allow(''),

  // Cookies
  COOKIE_DOMAIN: Joi.string().optional().allow(''),
});
