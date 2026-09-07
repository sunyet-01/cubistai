/**
 * Authoritative pricing catalog.
 *
 * The checkout API uses this as the SOURCE OF TRUTH for price/credits/duration.
 * Any price, credits, or plan info sent by the client is IGNORED — only the
 * product_id is honored, and everything else is looked up here.
 *
 * To change pricing, edit this file and redeploy. Admin UI cannot alter prices.
 *
 * NOTE: kept in sync with the pricing page UI (src/blocks/pricing.tsx):
 *   Free   $0      — 10 credits/day
 *   Starter $7.90  — 1,100 credits/mo
 *   Plus    $14.90 — 2,000 credits/mo
 *   Pro     $27.90 — 4,000 credits/mo
 * Yearly = 12 months of credits at ~20% off.
 */

import { PaymentInterval, PaymentType } from '@/core/payment/types';

export type PricingPlanInfo = {
  name: string;
  interval: PaymentInterval;
  intervalCount: number;
};

export type PricingProduct = {
  productId: string;
  productName: string;
  planName: string;
  description: string;
  type: PaymentType;
  priceInCents: number;
  currency: string;
  credits: number;
  creditsValidDays?: number;
  plan?: PricingPlanInfo;
};

/**
 * Keys MUST match what the pricing UI sends as product_id.
 */
export const pricingCatalog: Record<string, PricingProduct> = {
  starter_monthly: {
    productId: 'starter_monthly',
    productName: 'Starter',
    planName: 'Starter',
    description: 'Starter Monthly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 790,
    currency: 'usd',
    credits: 1100,
    plan: { name: 'Starter', interval: PaymentInterval.MONTH, intervalCount: 1 },
  },
  plus_monthly: {
    productId: 'plus_monthly',
    productName: 'Plus',
    planName: 'Plus',
    description: 'Plus Monthly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 1490,
    currency: 'usd',
    credits: 2000,
    plan: { name: 'Plus', interval: PaymentInterval.MONTH, intervalCount: 1 },
  },
  pro_monthly: {
    productId: 'pro_monthly',
    productName: 'Pro',
    planName: 'Pro',
    description: 'Pro Monthly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 2790,
    currency: 'usd',
    credits: 4000,
    plan: { name: 'Pro', interval: PaymentInterval.MONTH, intervalCount: 1 },
  },
  starter_yearly: {
    productId: 'starter_yearly',
    productName: 'Starter',
    planName: 'Starter',
    description: 'Starter Yearly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 7500,
    currency: 'usd',
    credits: 13200,
    plan: { name: 'Starter', interval: PaymentInterval.YEAR, intervalCount: 1 },
  },
  plus_yearly: {
    productId: 'plus_yearly',
    productName: 'Plus',
    planName: 'Plus',
    description: 'Plus Yearly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 13900,
    currency: 'usd',
    credits: 24000,
    plan: { name: 'Plus', interval: PaymentInterval.YEAR, intervalCount: 1 },
  },
  pro_yearly: {
    productId: 'pro_yearly',
    productName: 'Pro',
    planName: 'Pro',
    description: 'Pro Yearly',
    type: PaymentType.SUBSCRIPTION,
    priceInCents: 25900,
    currency: 'usd',
    credits: 48000,
    plan: { name: 'Pro', interval: PaymentInterval.YEAR, intervalCount: 1 },
  },
};

export function getPricingProduct(productId: string): PricingProduct | null {
  if (!productId) return null;
  return pricingCatalog[productId] ?? null;
}

export function listPricingProducts(): PricingProduct[] {
  return Object.values(pricingCatalog);
}
