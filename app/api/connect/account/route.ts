import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, STRIPE_CONNECT_COUNTRY } from '@/lib/stripeClient';
import {
  authenticateServerRequest,
  createAdminSupabase,
  requestAppUrl,
} from '@/lib/serverAuth';

export const runtime = 'nodejs';

type AccountAction = 'onboard' | 'manage';

function safeReturnPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  if (value === '/events/create' || value.startsWith('/events/create?')) return value;
  if (/^\/events\/[0-9a-f-]{36}\/manage\/settings(?:\?.*)?$/i.test(value)) return value;
  if (value === '/promoter/dashboard' || value === '/manager/dashboard') return value;
  return fallback;
}

function displayName(account: Stripe.Account): string | null {
  if (account.business_profile?.name) return account.business_profile.name;
  if (account.company?.name) return account.company.name;
  const individual = [account.individual?.first_name, account.individual?.last_name]
    .filter(Boolean)
    .join(' ');
  return individual || null;
}

function connectSetupRequirement(error: unknown): { message: string; actionUrl: string } | null {
  if (!(error instanceof Error)) return null;
  if (error.message.includes('complete your platform profile to use Connect')) {
    return {
      message: 'Completa el perfil de la plataforma en Stripe para crear cuentas conectadas en modo producción.',
      actionUrl: 'https://dashboard.stripe.com/connect/accounts/overview',
    };
  }
  if (error.message.includes("only create new accounts if you've signed up for Connect")) {
    return {
      message: 'Primero activa Stripe Connect en la cuenta de plataforma y vuelve a intentarlo.',
      actionUrl: 'https://dashboard.stripe.com/connect',
    };
  }
  return null;
}

async function saveAccount(userId: string, account: Stripe.Account) {
  const admin = createAdminSupabase();
  const onboardingComplete = Boolean(
    account.details_submitted && account.charges_enabled && account.payouts_enabled,
  );
  const { data, error } = await admin
    .from('organizer_payment_accounts')
    .upsert({
      user_id: userId,
      provider: 'stripe',
      stripe_account_id: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      onboarding_complete: onboardingComplete,
      account_display_name: displayName(account),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function retrieveAccount(accountId: string): Promise<Stripe.Account | null> {
  const account = await stripe.accounts.retrieve(accountId);
  if ('deleted' in account && account.deleted) return null;
  return account as Stripe.Account;
}

async function connectedAccountForUser(userId: string) {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from('organizer_payment_accounts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function publicAccount(account: {
  account_display_name: string | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_complete: boolean;
  updated_at: string;
} | null) {
  if (!account) return null;
  return {
    account_display_name: account.account_display_name,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    details_submitted: account.details_submitted,
    onboarding_complete: account.onboarding_complete,
    updated_at: account.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateServerRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (!['promoter', 'manager', 'admin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Tu cuenta no puede conectar pagos.' }, { status: 403 });
    }

    const stored = await connectedAccountForUser(auth.userId);
    if (!stored) return NextResponse.json({ account: null });

    if (request.nextUrl.searchParams.get('sync') !== 'true') {
      return NextResponse.json({ account: publicAccount(stored) });
    }

    const remote = await retrieveAccount(stored.stripe_account_id);
    if (!remote) return NextResponse.json({ account: null });
    const synced = await saveAccount(auth.userId, remote);
    return NextResponse.json({ account: publicAccount(synced) });
  } catch (error) {
    console.error('[connect/account:get]', error);
    return NextResponse.json({ error: 'No se pudo consultar la cuenta de pagos.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateServerRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (!['promoter', 'manager', 'admin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Tu cuenta no puede conectar pagos.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as { action?: AccountAction; returnPath?: string };
    const action: AccountAction = body.action === 'manage' ? 'manage' : 'onboard';
    let stored = await connectedAccountForUser(auth.userId);
    let account = stored ? await retrieveAccount(stored.stripe_account_id) : null;

    if (!account) {
      account = await stripe.accounts.create({
        type: 'express',
        country: STRIPE_CONNECT_COUNTRY,
        email: auth.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          product_description: 'Inscripciones para eventos de deportes de combate',
        },
        metadata: {
          strikersmatch_profile_id: auth.userId,
          strikersmatch_role: auth.role,
        },
      });
      stored = await saveAccount(auth.userId, account);
    } else {
      stored = await saveAccount(auth.userId, account);
    }

    if (action === 'manage' && stored.onboarding_complete) {
      const loginLink = await stripe.accounts.createLoginLink(account.id);
      return NextResponse.json({ url: loginLink.url });
    }

    const appUrl = requestAppUrl(request);
    const dashboardPath = auth.role === 'manager'
      ? '/manager/dashboard'
      : auth.role === 'admin' ? '/admin' : '/promoter/dashboard';
    const returnPath = safeReturnPath(body.returnPath, dashboardPath);
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${appUrl}${returnPath}${returnPath.includes('?') ? '&' : '?'}stripe=refresh`,
      return_url: `${appUrl}${returnPath}${returnPath.includes('?') ? '&' : '?'}stripe=return`,
      type: 'account_onboarding',
      collection_options: { fields: 'eventually_due' },
    });
    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error('[connect/account:post]', error);
    const setupRequirement = connectSetupRequirement(error);
    if (setupRequirement) {
      return NextResponse.json({
        error: setupRequirement.message,
        action_url: setupRequirement.actionUrl,
      }, { status: 409 });
    }
    return NextResponse.json({ error: 'No se pudo iniciar la configuración de Stripe.' }, { status: 500 });
  }
}
