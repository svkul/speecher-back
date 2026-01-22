import { SubscriptionTier } from '@prisma/client';

/**
 * TTS Model types available in Google Cloud Text-to-Speech
 */
export enum TtsModel {
  Standard = 'Standard',
  WaveNet = 'WaveNet',
  Neural2 = 'Neural2',
  Studio = 'Studio',
  Chirp3HD = 'Chirp3HD',
}

/**
 * Pricing information for each TTS model
 * Based on: https://cloud.google.com/text-to-speech/pricing
 */
export const TTS_MODEL_PRICING = {
  [TtsModel.Standard]: {
    price: 4, // $4 per 1M characters
    freeLimit: 4_000_000, // 0-4M characters free per month
    description: 'Basic quality, most cost-effective',
  },
  [TtsModel.WaveNet]: {
    price: 16, // $16 per 1M characters
    freeLimit: 1_000_000, // 0-1M characters free per month
    description: 'High quality, natural sounding',
  },
  [TtsModel.Neural2]: {
    price: 16, // $16 per 1M characters
    freeLimit: 1_000_000, // 0-1M characters free per month
    description: 'Premium quality with improved prosody',
  },
  [TtsModel.Studio]: {
    price: 160, // $160 per 1M characters
    freeLimit: 1_000_000, // 0-1M characters free per month
    description: 'Studio-quality voices',
  },
  [TtsModel.Chirp3HD]: {
    price: 30, // $30 per 1M characters
    freeLimit: 1_000_000, // 0-1M characters free per month
    description: 'High-definition multilingual voices',
  },
} as const;

/**
 * Map subscription tiers to recommended TTS models
 */
export const SUBSCRIPTION_MODELS: Record<SubscriptionTier, TtsModel> = {
  [SubscriptionTier.FREE]: TtsModel.Standard, // Use cheapest model with highest free limit
  [SubscriptionTier.BASIC]: TtsModel.WaveNet, // Better quality for paying users
  [SubscriptionTier.PREMIUM]: TtsModel.Neural2, // Best quality for premium users
};

/**
 * Monthly character limits per subscription tier
 */
export const SUBSCRIPTION_LIMITS = {
  [SubscriptionTier.FREE]: 10_000, // 10k characters per month
  [SubscriptionTier.BASIC]: 100_000, // 100k characters per month
  [SubscriptionTier.PREMIUM]: 1_000_000, // 1M characters per month
} as const;

/**
 * Trial period configuration
 */
export const TRIAL_CONFIG = {
  maxBlocks: 3, // Maximum 3 speech blocks
  maxCharactersPerBlock: 1000, // Maximum 1000 characters per block
  model: TtsModel.Standard, // Use Standard model for trial
} as const;
