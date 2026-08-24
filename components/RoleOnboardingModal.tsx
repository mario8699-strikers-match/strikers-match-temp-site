'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authService } from '@/services/authService';
import { VENDOR_ROLES, type Profile, type UserRole } from '@/types';

const ONBOARDING_VERSION = 'v1';
const ONBOARDING_ACTIVE_KEY = 'sm_onboarding_active';
const ONBOARDING_SHOWN_SESSION_KEY = 'sm_onboarding_shown_session';

interface TranslatedStep {
  title: string;
  body: string;
  href?: string;
  action?: string;
}

const ROLE_CONTENT_KEYS: Partial<Record<UserRole, string>> = {
  fighter: 'fighter',
  spectator: 'spectator',
  promoter: 'promoter',
  manager: 'manager',
  sponsor: 'sponsor',
  admin: 'admin',
};

function onboardingKey(profile: Profile) {
  return `sm_onboarding_${ONBOARDING_VERSION}_${profile.id}_${profile.role}`;
}

function getContentKey(profile: Profile) {
  if (VENDOR_ROLES.includes(profile.role)) return 'vendor';
  return ROLE_CONTENT_KEYS[profile.role] ?? 'default';
}

function safeSetActive(value: boolean) {
  try {
    if (value) sessionStorage.setItem(ONBOARDING_ACTIVE_KEY, '1');
    else sessionStorage.removeItem(ONBOARDING_ACTIVE_KEY);
  } catch {
    // ignore private mode restrictions
  }
  window.dispatchEvent(new Event('sm:onboarding-state'));
}

export function RoleOnboardingModal() {
  const { t } = useTranslation('onboarding');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;
    authService.getSession().then(({ data }) => {
      if (cancelled) return;
      const nextProfile = data?.profile ?? null;
      if (!nextProfile) return;

      try {
        if (localStorage.getItem(onboardingKey(nextProfile)) === 'dismissed') return;
      } catch {
        // continue; onboarding should still work without persistence
      }

      setProfile(nextProfile);
      setOpen(true);
      safeSetActive(true);
      try {
        sessionStorage.setItem(ONBOARDING_SHOWN_SESSION_KEY, '1');
      } catch {
        // ignore private mode restrictions
      }
    });

    return () => {
      cancelled = true;
      safeSetActive(false);
    };
  }, []);

  const contentKey = useMemo(() => profile ? getContentKey(profile) : 'default', [profile]);
  const steps = useMemo(() => {
    const translated = t(`roles.${contentKey}.steps`, { returnObjects: true });
    return Array.isArray(translated) ? translated as TranslatedStep[] : [];
  }, [contentKey, t]);
  const primaryHref = t(`roles.${contentKey}.primaryHref`);

  const dismiss = () => {
    if (profile) {
      try {
        localStorage.setItem(onboardingKey(profile), 'dismissed');
      } catch {
        // ignore private mode restrictions
      }
    }
    setOpen(false);
    safeSetActive(false);
  };

  if (!open || !profile) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-onboarding-title"
      onClick={dismiss}
    >
      <div
        className="max-h-[95vh] w-full overflow-y-auto bg-white sm:max-w-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-[#0A0A0A] px-5 py-5 text-white sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#C0001E]">{t(`roles.${contentKey}.eyebrow`)}</p>
              <h2
                id="role-onboarding-title"
                className="font-display mt-1 font-black uppercase leading-none"
                style={{ fontSize: 'clamp(1.75rem,5vw,2.35rem)', letterSpacing: '-0.01em' }}
              >
                {t(`roles.${contentKey}.title`)}
              </h2>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="min-h-10 border border-[#3A3A3A] px-3 py-2 text-xs font-bold uppercase tracking-widest text-[#D4D4D4] hover:border-[#5A5A5A] hover:text-white"
            >
              {t('actions.close')}
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#B8B8B8]">{t(`roles.${contentKey}.intro`)}</p>
        </div>

        <ol className="space-y-4 p-5 sm:p-6">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3 border-b border-zinc-100 pb-4 last:border-b-0 last:pb-0">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center bg-[#C0001E] font-display text-xs font-black text-white">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-zinc-900 sm:text-base">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600">{step.body}</p>
                {step.href && step.action && (
                  <a
                    href={step.href}
                    onClick={dismiss}
                    className="mt-2 inline-block text-xs font-bold uppercase tracking-widest text-[#C0001E] hover:text-[#900016]"
                  >
                    {step.action}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 px-4 py-3 text-center text-xs font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-900"
          >
            {t('actions.doNotShowAgain')}
          </button>
          <a
            href={primaryHref}
            onClick={dismiss}
            className="min-h-11 bg-[#0A0A0A] px-5 py-3 text-center text-xs font-bold uppercase tracking-widest text-white hover:bg-[#C0001E]"
          >
            {t(`roles.${contentKey}.primaryLabel`)}
          </a>
        </div>
      </div>
    </div>
  );
}
