/**
 * Stripe Server Client + Price Configuration
 *
 * Used by API routes only (server-side).
 * Prices are in MXN centavos (Stripe expects the smallest currency unit).
 */

import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
});

export type PlanKey = 'basic' | 'pro' | 'per_request';

export interface PlanConfig {
  name: string;
  amount: number;          // MXN centavos (e.g. 19900 = $199 MXN)
  currency: string;
  mode: 'subscription' | 'payment';
  interval?: 'month';      // only for subscriptions
  maxRequests: number;      // max_requests value set in DB after purchase
  planType: string;         // value stored in promoter_subscriptions.plan_type
}

export const PLAN_CONFIG: Record<PlanKey, PlanConfig> = {
  basic: {
    name: 'Basic',
    amount: 19900,           // $199 MXN
    currency: 'mxn',
    mode: 'subscription',
    interval: 'month',
    maxRequests: 10,
    planType: 'basic',
  },
  pro: {
    name: 'Pro',
    amount: 39900,           // $399 MXN
    currency: 'mxn',
    mode: 'subscription',
    interval: 'month',
    maxRequests: 999999,     // unlimited
    planType: 'pro',
  },
  per_request: {
    name: 'Pay-as-you-go',
    amount: 4900,            // $49 MXN
    currency: 'mxn',
    mode: 'payment',
    maxRequests: 1,          // adds 1 credit per purchase
    planType: 'per_request',
  },
};
