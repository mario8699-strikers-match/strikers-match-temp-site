'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function PasswordInput({ className = '', ...props }: PasswordInputProps) {
  const { t } = useTranslation('auth');
  const [visible, setVisible] = useState(false);
  const label = visible
    ? t('auth.passwordVisibility.hide')
    : t('auth.passwordVisibility.show');

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${className} !pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#C0001E]"
      >
        <EyeIcon hidden={visible} />
      </button>
    </div>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.7" />
      {hidden && <path d="m4 4 16 16" />}
    </svg>
  );
}
