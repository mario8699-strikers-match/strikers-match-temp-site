'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Pagination } from '@/components/Pagination';
import { supabase } from '@/lib/supabaseClient';
import { authService } from '@/services/authService';
import { BUSINESS_LISTING_CATEGORIES, directoryService } from '@/services/directoryService';
import { VENDOR_ROLES } from '@/types';
import type { BusinessListing, BusinessListingCategory, Profile, UserRole } from '@/types';

const PAGE_SIZE = 12;

type CategoryFilter = BusinessListingCategory | 'all' | 'profiles';
type DirectoryEntry =
  | { kind: 'profile'; profile: Profile }
  | { kind: 'listing'; listing: BusinessListing };

const CATEGORY_PROFILE_ROLES: Record<BusinessListingCategory, UserRole[]> = {
  gyms_academies: ['gyms_academies'],
  recovery_wellness: ['recovery_wellness'],
  event_services: [
    'ring_card_girl',
    'photographer',
    'videographer',
    'broadcast_personality',
    'catering_vendor',
    'venue_rental',
    'judge',
    'ring_rental',
    'ring_announcer',
    'cutman',
    'merchandise_vendor',
    'ringside_doctor',
    'ringside_emt',
  ],
  gear_apparel: ['gear_apparel'],
  nutrition_supplements: ['nutrition_supplements'],
  local_business: ['local_business'],
  other: ['other_service'],
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '—';
}

function hasServiceRole(profile: Profile | null): boolean {
  if (!profile) return false;
  return (
    VENDOR_ROLES.includes(profile.role) ||
    (profile.additional_roles ?? []).some((role) => VENDOR_ROLES.includes(role))
  );
}

function mergeProfiles(primary: Profile[], secondary: Profile[]): Profile[] {
  const byId = new Map<string, Profile>();
  [...primary, ...secondary].forEach((profile) => byId.set(profile.id, profile));
  return Array.from(byId.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

interface DirectoryPageClientProps {
  initialListings: BusinessListing[];
  initialProfiles: Profile[];
}

export function DirectoryPageClient({ initialListings, initialProfiles }: DirectoryPageClientProps) {
  const { t } = useTranslation('gallery');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<BusinessListing[]>(initialListings);
  const [serviceProfiles, setServiceProfiles] = useState<Profile[]>(initialProfiles);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [serviceRoleSaving, setServiceRoleSaving] = useState(false);
  const [serviceRoleError, setServiceRoleError] = useState<string | null>(null);
  const [serviceRoleSuccess, setServiceRoleSuccess] = useState(false);
  const [selectedServiceRoles, setSelectedServiceRoles] = useState<UserRole[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    category: 'gyms_academies' as BusinessListingCategory,
    description: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    website_url: '',
    instagram: '',
  });

  useEffect(() => {
    let active = true;

    async function load() {
      const [
        { data: session },
        { data },
        primaryProfiles,
        additionalProfiles,
      ] = await Promise.all([
        authService.getSession(),
        directoryService.getPublished(),
        supabase
          .from('profiles')
          .select('*')
          .in('role', VENDOR_ROLES)
          .eq('is_banned', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('*')
          .overlaps('additional_roles', VENDOR_ROLES)
          .eq('is_banned', false)
          .order('created_at', { ascending: false }),
      ]);
      if (!active) return;
      const currentProfile = session?.profile ?? null;
      setProfile(currentProfile);
      setListings(data ?? []);
      setServiceProfiles(mergeProfiles(
        (primaryProfiles.data as Profile[] | null) ?? [],
        (additionalProfiles.data as Profile[] | null) ?? []
      ));
      setSelectedServiceRoles(
        ((currentProfile?.additional_roles ?? []).filter((role) => VENDOR_ROLES.includes(role)) as UserRole[])
      );
      setLoading(false);
    }

    void load();
    return () => { active = false; };
  }, []);

  const directoryEntries = useMemo<DirectoryEntry[]>(() => {
    const profileEntries = serviceProfiles.map((serviceProfile) => ({
      kind: 'profile' as const,
      profile: serviceProfile,
    }));
    const listingEntries = listings.map((listing) => ({
      kind: 'listing' as const,
      listing,
    }));

    if (category === 'profiles') return profileEntries;
    if (category === 'all') return [...profileEntries, ...listingEntries];

    const matchingRoles = CATEGORY_PROFILE_ROLES[category];
    const matchingProfiles = profileEntries.filter(({ profile: serviceProfile }) => {
      const roles = [serviceProfile.role, ...(serviceProfile.additional_roles ?? [])];
      return roles.some((role) => matchingRoles.includes(role));
    });
    const matchingListings = listingEntries.filter((entry) => entry.listing.category === category);

    return [...matchingProfiles, ...matchingListings];
  }, [category, listings, serviceProfiles]);

  const totalPages = Math.ceil(directoryEntries.length / PAGE_SIZE);
  const pageEntries = useMemo(
    () => directoryEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [directoryEntries, page]
  );

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleServiceRole = (role: UserRole) => {
    if (profile?.role === role) return;
    setSelectedServiceRoles((prev) =>
      prev.includes(role) ? prev.filter((item) => item !== role) : [...prev, role]
    );
    setServiceRoleSuccess(false);
    setServiceRoleError(null);
  };

  const saveServiceProfileSelection = async () => {
    if (!profile) return;
    if (!hasServiceRole({ ...profile, additional_roles: selectedServiceRoles })) {
      setServiceRoleError(t('gallery.profileSelector.errors.roleRequired'));
      return;
    }

    setServiceRoleSaving(true);
    setServiceRoleError(null);
    setServiceRoleSuccess(false);

    const retainedRoles = (profile.additional_roles ?? []).filter((role) => !VENDOR_ROLES.includes(role));
    const nextAdditionalRoles = Array.from(new Set([
      ...retainedRoles,
      ...selectedServiceRoles.filter((role) => role !== profile.role),
    ]));

    const { error } = await authService.updateProfile(profile.id, {
      additional_roles: nextAdditionalRoles,
      is_available: true,
    });

    setServiceRoleSaving(false);

    if (error) {
      setServiceRoleError(error);
      return;
    }

    const updatedProfile: Profile = {
      ...profile,
      additional_roles: nextAdditionalRoles,
      is_available: true,
    };
    setProfile(updatedProfile);
    setServiceRoleSuccess(true);
    setServiceProfiles((current) => mergeProfiles([updatedProfile], current));
  };

  const resetForm = () => {
    setForm({
      title: '',
      category: 'gyms_academies',
      description: '',
      city: '',
      state: '',
      phone: '',
      email: '',
      website_url: '',
      instagram: '',
    });
    setImageFile(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    if (!form.title.trim()) {
      setSubmitError(t('gallery.form.errors.titleRequired'));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    const { error } = await directoryService.submit(
      {
        owner_profile_id: profile.id,
        title: form.title,
        category: form.category,
        description: form.description,
        city: form.city,
        state: form.state,
        phone: form.phone,
        email: form.email,
        website_url: form.website_url,
        instagram: form.instagram,
      },
      imageFile
    );

    setSubmitting(false);

    if (error) {
      setSubmitError(error);
      return;
    }

    resetForm();
    setSubmitSuccess(true);
    setFormOpen(false);
  };

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar activePage="gallery" />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: '#C0001E' }}>Strikers Match</p>
            <h1 className="font-display font-black uppercase leading-none" style={{ fontSize: 'clamp(2.5rem,6vw,4.5rem)', letterSpacing: '-0.02em', color: '#0A0A0A' }}>
              {t('gallery.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm" style={{ color: '#5A5A5A' }}>{t('gallery.subtitle')}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {profile ? (
              <button
                type="button"
                onClick={() => setFormOpen((value) => !value)}
                className="min-h-11 bg-[#C0001E] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#9A0018]"
              >
                {formOpen ? t('gallery.form.close') : t('gallery.form.open')}
              </button>
            ) : (
              <>
                <Link
                  href={`/login?next=${encodeURIComponent('/directorio')}`}
                  className="min-h-11 border border-zinc-300 px-5 py-3 text-center text-xs font-bold uppercase tracking-widest text-zinc-800 transition-colors hover:bg-zinc-50"
                >
                  {t('gallery.form.signIn')}
                </Link>
                <Link
                  href={`/register?account=professional&next=${encodeURIComponent('/directorio')}`}
                  className="min-h-11 bg-[#C0001E] px-5 py-3 text-center text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#9A0018]"
                >
                  {t('gallery.form.createAccount')}
                </Link>
              </>
            )}
          </div>
        </div>

        {submitSuccess && (
          <div className="mb-6 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {t('gallery.form.success')}
          </div>
        )}

        {profile && (
          <section className="mb-8 border border-zinc-200 bg-zinc-50 p-5 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-[#C0001E]">
                  {t('gallery.profileSelector.eyebrow')}
                </p>
                <h2 className="font-display text-2xl font-black uppercase leading-none text-zinc-950">
                  {t('gallery.profileSelector.title')}
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-zinc-600">
                  {t('gallery.profileSelector.body')}
                </p>
              </div>
              {hasServiceRole(profile) && (
                <Link
                  href="/vendor/profile"
                  className="min-h-10 shrink-0 border border-zinc-300 bg-white px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-zinc-800 transition-colors hover:border-zinc-900"
                >
                  {t('gallery.profileSelector.editProfile')}
                </Link>
              )}
            </div>

            {serviceRoleError && (
              <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {serviceRoleError}
              </div>
            )}
            {serviceRoleSuccess && (
              <div className="mb-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {t('gallery.profileSelector.success')}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {VENDOR_ROLES.map((role) => {
                const checked = profile.role === role || selectedServiceRoles.includes(role);
                const disabled = profile.role === role;
                return (
                  <label
                    key={role}
                    className={`flex min-h-11 items-center gap-3 border px-3 py-2 text-sm ${
                      checked ? 'border-zinc-900 bg-white text-zinc-950' : 'border-zinc-200 bg-white text-zinc-600'
                    } ${disabled ? 'opacity-80' : 'cursor-pointer hover:border-zinc-500'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleServiceRole(role)}
                      className="h-4 w-4"
                    />
                    <span className="font-semibold">
                      {t(`gallery.serviceRoles.${role}`)}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-500">
                {hasServiceRole(profile)
                  ? t('gallery.profileSelector.activeHint')
                  : t('gallery.profileSelector.inactiveHint')}
              </p>
              <button
                type="button"
                onClick={saveServiceProfileSelection}
                disabled={serviceRoleSaving}
                className="min-h-11 bg-zinc-900 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#C0001E] disabled:opacity-50"
              >
                {serviceRoleSaving ? t('gallery.profileSelector.saving') : t('gallery.profileSelector.save')}
              </button>
            </div>
          </section>
        )}

        {formOpen && profile && (
          <form onSubmit={handleSubmit} className="mb-10 border border-zinc-200 bg-white p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-black uppercase text-zinc-950">{t('gallery.form.title')}</h2>
              <p className="mt-1 text-sm text-zinc-500">{t('gallery.form.subtitle')}</p>
            </div>

            {submitError && (
              <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DirectoryInput
                label={t('gallery.form.fields.title')}
                value={form.title}
                onChange={(value) => updateForm('title', value)}
                required
              />
              <label>
                <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-zinc-600">{t('gallery.form.fields.category')}</span>
                <select
                  value={form.category}
                  onChange={(event) => updateForm('category', event.target.value)}
                  className="min-h-11 w-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                >
                  {BUSINESS_LISTING_CATEGORIES.map((option) => (
                    <option key={option} value={option}>
                      {t(`gallery.categories.${option}`)}
                    </option>
                  ))}
                </select>
              </label>
              <DirectoryInput label={t('gallery.form.fields.city')} value={form.city} onChange={(value) => updateForm('city', value)} />
              <DirectoryInput label={t('gallery.form.fields.state')} value={form.state} onChange={(value) => updateForm('state', value)} />
              <DirectoryInput label={t('gallery.form.fields.phone')} value={form.phone} onChange={(value) => updateForm('phone', value)} />
              <DirectoryInput label={t('gallery.form.fields.email')} value={form.email} onChange={(value) => updateForm('email', value)} type="email" />
              <DirectoryInput label={t('gallery.form.fields.website')} value={form.website_url} onChange={(value) => updateForm('website_url', value)} />
              <DirectoryInput label={t('gallery.form.fields.instagram')} value={form.instagram} onChange={(value) => updateForm('instagram', value)} />
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-zinc-600">{t('gallery.form.fields.image')}</span>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-zinc-500 file:mr-3 file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-widest file:text-white"
                />
              </label>
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-zinc-600">{t('gallery.form.fields.description')}</span>
                <textarea
                  value={form.description}
                  onChange={(event) => updateForm('description', event.target.value)}
                  rows={4}
                  className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => { setFormOpen(false); setSubmitError(null); }}
                className="min-h-11 border border-zinc-300 px-5 py-3 text-xs font-bold uppercase tracking-widest text-zinc-700"
              >
                {t('gallery.form.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-11 bg-zinc-900 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
              >
                {submitting ? t('gallery.form.submitting') : t('gallery.form.submit')}
              </button>
            </div>
          </form>
        )}

        <div className="mb-8 flex flex-wrap gap-2">
          {(['all', 'profiles', ...BUSINESS_LISTING_CATEGORIES] as CategoryFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setCategory(option);
                setPage(1);
              }}
              className={`min-h-10 border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                category === option
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500'
              }`}
            >
              {option === 'all' ? t('gallery.categories.all') : t(`gallery.categories.${option}`)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-24 text-center text-zinc-400 text-sm">{t('gallery.loading')}</div>
        ) : directoryEntries.length === 0 ? (
          <div className="py-24 text-center border border-dashed border-zinc-200">
            <p className="text-zinc-900 font-medium">{t('gallery.empty')}</p>
            <p className="mt-1 text-sm text-zinc-500">{t('gallery.emptySubtitle')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {pageEntries.map((entry) => (
                entry.kind === 'profile' ? (
                  <article key={`profile-${entry.profile.id}`} className="flex h-full flex-col border border-zinc-200 bg-white p-5">
                    <Link href={`/professionals/${entry.profile.id}`} className="group flex items-start gap-4">
                      {entry.profile.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={entry.profile.photo_url} alt={entry.profile.full_name} className="h-16 w-16 shrink-0 object-cover" />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-zinc-900 text-sm font-bold text-white">
                          {initials(entry.profile.full_name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#C0001E]">
                          {t('gallery.categories.profiles')}
                        </p>
                        <h2 className="font-display text-2xl font-black uppercase leading-none text-zinc-950 transition-colors group-hover:text-[#C0001E]">
                          {entry.profile.full_name}
                        </h2>
                        {(entry.profile.city || entry.profile.state) && (
                          <p className="mt-2 text-sm text-zinc-500">
                            {[entry.profile.city, entry.profile.state].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                    </Link>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {[entry.profile.role, ...(entry.profile.additional_roles ?? [])]
                        .filter((role, index, roles) => VENDOR_ROLES.includes(role) && roles.indexOf(role) === index)
                        .map((role) => (
                          <span key={role} className="border border-zinc-200 px-2 py-1 text-xs font-bold uppercase tracking-widest text-zinc-600">
                            {t(`gallery.serviceRoles.${role}`)}
                          </span>
                        ))}
                    </div>
                    {entry.profile.bio && (
                      <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-zinc-700">{entry.profile.bio}</p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-2 pt-5">
                      {entry.profile.instagram && (
                        <a href={`https://instagram.com/${entry.profile.instagram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="border border-zinc-300 px-3 py-2 text-xs font-bold uppercase tracking-widest text-zinc-700">
                          {t('gallery.contact.instagram')}
                        </a>
                      )}
                      <Link href={`/professionals/${entry.profile.id}`} className="bg-zinc-900 px-3 py-2 text-xs font-bold uppercase tracking-widest text-white">
                        {t('gallery.contact.viewProfile')}
                      </Link>
                    </div>
                  </article>
                ) : (
                  <article key={`listing-${entry.listing.id}`} className="flex h-full flex-col overflow-hidden border border-zinc-200 bg-white">
                    {entry.listing.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.listing.image_url} alt={entry.listing.title} className="h-48 w-full object-cover" />
                    ) : (
                      <div className="flex h-48 w-full items-center justify-center bg-zinc-100 px-6 text-center">
                        <span className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">{t(`gallery.categories.${entry.listing.category}`)}</span>
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#C0001E]">{t(`gallery.categories.${entry.listing.category}`)}</p>
                          <h2 className="font-display text-2xl font-black uppercase leading-none text-zinc-950">{entry.listing.title}</h2>
                        </div>
                        {entry.listing.is_featured && (
                          <span className="shrink-0 bg-zinc-900 px-2 py-1 text-xs font-bold uppercase tracking-widest text-white">
                            {t('gallery.featured')}
                          </span>
                        )}
                      </div>
                      {(entry.listing.city || entry.listing.state) && (
                        <p className="mb-3 text-sm text-zinc-500">
                          {[entry.listing.city, entry.listing.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {entry.listing.description && (
                        <p className="mb-5 line-clamp-4 text-sm leading-relaxed text-zinc-700">{entry.listing.description}</p>
                      )}
                      <div className="mt-auto flex flex-wrap gap-2 pt-4">
                        {entry.listing.phone && <a href={`tel:${entry.listing.phone}`} className="border border-zinc-300 px-3 py-2 text-xs font-bold uppercase tracking-widest text-zinc-700">{t('gallery.contact.phone')}</a>}
                        {entry.listing.email && <a href={`mailto:${entry.listing.email}`} className="border border-zinc-300 px-3 py-2 text-xs font-bold uppercase tracking-widest text-zinc-700">{t('gallery.contact.email')}</a>}
                        {entry.listing.website_url && <a href={entry.listing.website_url} target="_blank" rel="noopener noreferrer" className="border border-zinc-300 px-3 py-2 text-xs font-bold uppercase tracking-widest text-zinc-700">{t('gallery.contact.website')}</a>}
                        {entry.listing.instagram && <a href={`https://instagram.com/${entry.listing.instagram}`} target="_blank" rel="noopener noreferrer" className="border border-zinc-300 px-3 py-2 text-xs font-bold uppercase tracking-widest text-zinc-700">{t('gallery.contact.instagram')}</a>}
                      </div>
                    </div>
                  </article>
                )
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

function DirectoryInput({
  label,
  value,
  onChange,
  required = false,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-zinc-600">
        {label}{required ? ' *' : ''}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="min-h-11 w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900"
      />
    </label>
  );
}
