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

  // GOOGLE
  vertex: process.env.VERTEX,

  // Google Cloud (for TTS)
  googleCloud: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilePath: process.env.GOOGLE_CLOUD_KEY_FILE_PATH,
    credentials: process.env.GOOGLE_CLOUD_CREDENTIALS, // JSON credentials as string
  },

  // TTS settings
  tts: {
    defaultLanguage: process.env.TTS_DEFAULT_LANGUAGE || 'en-US',
    defaultVoice: process.env.TTS_DEFAULT_VOICE || 'en-US-Neural2-C',
    defaultModel: process.env.TTS_DEFAULT_MODEL || 'Standard',
    cacheVoicesList: process.env.TTS_CACHE_VOICES !== 'false', // Default true
    cacheVoicesTTL: Number(process.env.TTS_CACHE_VOICES_TTL) || 86400000, // 24h in ms
  },

  // Storage (for audio files)
  storage: {
    type: process.env.STORAGE_TYPE || 'local', // 'gcs' | 's3' | 'r2' | 'local'
    bucketName: process.env.STORAGE_BUCKET_NAME,
    // GCS specific
    gcsProjectId: process.env.GCS_PROJECT_ID,
    // S3/R2 specific
    s3Region: process.env.S3_REGION,
    s3Endpoint: process.env.S3_ENDPOINT, // For R2 or custom S3
    s3AccessKey: process.env.S3_ACCESS_KEY,
    s3SecretKey: process.env.S3_SECRET_KEY,
    // Local storage (for development)
    localPath: process.env.STORAGE_LOCAL_PATH || './uploads',
  },
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

  // GOOGLE
  VERTEX: Joi.string().optional().allow(''),

  // Google Cloud (for TTS)
  GOOGLE_CLOUD_PROJECT_ID: Joi.string().optional().allow(''),
  GOOGLE_CLOUD_KEY_FILE_PATH: Joi.string().optional().allow(''),
  GOOGLE_CLOUD_CREDENTIALS: Joi.string().optional().allow(''),

  // TTS settings
  TTS_DEFAULT_LANGUAGE: Joi.string().default('en-US'),
  TTS_DEFAULT_VOICE: Joi.string().default('en-US-Neural2-C'),
  TTS_DEFAULT_MODEL: Joi.string()
    .valid('Standard', 'WaveNet', 'Neural2', 'Studio', 'Chirp3HD')
    .default('Standard'),
  TTS_CACHE_VOICES: Joi.string().valid('true', 'false').default('true'),
  TTS_CACHE_VOICES_TTL: Joi.number().default(86400000), // 24h

  // Storage
  STORAGE_TYPE: Joi.string().valid('gcs', 's3', 'r2', 'local').default('local'),
  STORAGE_BUCKET_NAME: Joi.string().optional().allow(''),
  GCS_PROJECT_ID: Joi.string().optional().allow(''),
  S3_REGION: Joi.string().optional().allow(''),
  S3_ENDPOINT: Joi.string().optional().allow(''),
  S3_ACCESS_KEY: Joi.string().optional().allow(''),
  S3_SECRET_KEY: Joi.string().optional().allow(''),
  STORAGE_LOCAL_PATH: Joi.string().default('./uploads'),
});
