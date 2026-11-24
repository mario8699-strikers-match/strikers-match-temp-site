'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { RecordValue } from '@/components/CombatRecord';
import { GenderDivisionCheckboxes } from '@/components/GenderDivisionCheckboxes';
import { authService } from '@/services/authService';
import { fighterService } from '@/services/fighterService';
import { requestService } from '@/services/requestService';
import { eventService } from '@/services/eventService';
import { isMinor, hasValidConsent } from '@/services/consentService';
import { supabase } from '@/lib/supabaseClient';
import {
  SOCIAL_MEDIA_PLATFORMS,
  getSocialMediaDisplayValue,
  getSocialMediaHref,
  isValidSocialMediaIdentifier,
  normalizeSocialMediaIdentifier,
} from '@/lib/socialMedia';
import { DISCIPLINE_OPTIONS } from '@/lib/disciplines';
import { countryFlagEmoji, getCountryName, getCountryOptions } from '@/lib/countries';
import { compactFighterBio, FIGHTER_BIO_MAX_LENGTH } from '@/lib/fighterProfile';
import type { SocialMediaHandles, SocialMediaPlatform } from '@/lib/socialMedia';
import type { Profile, Fighter, MatchRequest, EventApplication } from '@/types';

const WEIGHT_CLASSES = [
  'minimosca','mosca','supermosca','gallo','supergallo','pluma','superpluma',
  'ligero','superligero','welter','superwelter','medio','supermedio','semipesado','crucero','pesado',
];
const WEIGHT_LABELS: Record<string, string> = {
  minimosca:'Minimosca',mosca:'Mosca',supermosca:'Supermosca',gallo:'Gallo',supergallo:'Supergallo',
  pluma:'Pluma',superpluma:'Superpluma',ligero:'Ligero',superligero:'Superligero',welter:'Welter',
  superwelter:'Superwelter',medio:'Medio',supermedio:'Supermedio',semipesado:'Semipesado',crucero:'Crucero',pesado:'Pesado',
};
const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-red-50 text-red-700',
  cancelled: 'bg-zinc-100 text-zinc-500',
};

function countryCodeFromProfile(profile: Profile) {
  if (profile.country_code) return profile.country_code;
  const legacyCountry = profile.country?.trim();
  if (!legacyCountry) return '';
  return getCountryOptions('en').find(
    (option) => option.label.localeCompare(legacyCountry, 'en', { sensitivity: 'base' }) === 0,
  )?.code ?? '';
}

type RequestWithDetails = MatchRequest & {
  events?: { event_name: string; event_date: string | null; city: string | null };
  profiles?: { full_name: string };
};

export default function FighterProfilePage() {
  const { t, i18n } = useTranslation('fighters');
  const countryOptions = useMemo(
    () => getCountryOptions(i18n.resolvedLanguage || i18n.language),
    [i18n.resolvedLanguage, i18n.language],
  );
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [fighter, setFighter] = useState<Fighter | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Account profile fields. Email is intentionally never included in updates.
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [currentCountryCode, setCurrentCountryCode] = useState('');
  const [nationality, setNationality] = useState('');

  // Fighter profile fields
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [weightClass, setWeightClass] = useState('');
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [gymName, setGymName] = useState('');
  const [exactWeight, setExactWeight] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [reachCm, setReachCm] = useState('');
  const [wins, setWins] = useState('0');
  const [losses, setLosses] = useState('0');
  const [draws, setDraws] = useState('0');
  const [genderDivision, setGenderDivision] = useState('');
  const [koWins, setKoWins] = useState('0');
  const [tkoWins, setTkoWins] = useState('0');
  const [koLosses, setKoLosses] = useState('0');
  const [tkoLosses, setTkoLosses] = useState('0');
  const [skillRating, setSkillRating] = useState('');
  const [preferredRulesets, setPreferredRulesets] = useState('');
  const [requestedWeight, setRequestedWeight] = useState('');
  const [acceptableWeightMin, setAcceptableWeightMin] = useState('');
  const [acceptableWeightMax, setAcceptableWeightMax] = useState('');
  const [specialRestrictions, setSpecialRestrictions] = useState('');
  const [lastFightAt, setLastFightAt] = useState('');
  const [lastKoLossAt, setLastKoLossAt] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [availableToTravelInternationally, setAvailableToTravelInternationally] = useState(false);
  const [shortNotice, setShortNotice] = useState(false);
  const [experienceLevel, setExperienceLevel] = useState<'amateur' | 'pro'>('amateur');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  const [socialMedia, setSocialMedia] = useState<Record<SocialMediaPlatform, string>>({
    instagram: '',
    tiktok: '',
    facebook: '',
    youtube: '',
    x_handle: '',
  });

  // Representation
  const [hasManager, setHasManager] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [hasPromoter, setHasPromoter] = useState(false);
  const [promoterName, setPromoterName] = useState('');
  const [promoterEmail, setPromoterEmail] = useState('');
  const [promoterPhone, setPromoterPhone] = useState('');
  const [hasSponsor, setHasSponsor] = useState(false);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorEmail, setSponsorEmail] = useState('');
  const [sponsorPhone, setSponsorPhone] = useState('');

  // Photo
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Inbox (Realtime)
  const [requests, setRequests] = useState<RequestWithDetails[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // My event applications
  type AppWithEvent = EventApplication & { events: { event_name: string; event_date: string | null; city: string | null; promoter_id: string } };
  const [myApplications, setMyApplications] = useState<AppWithEvent[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const syncFormFromProfile = (p: Profile) => {
    setFullName(p.full_name ?? '');
    setPhone(p.phone ?? '');
    setDateOfBirth(p.date_of_birth ?? '');
    setCity(p.city ?? '');
    setState(p.state ?? '');
    setCurrentCountryCode(countryCodeFromProfile(p));
  };

  const syncFormFromFighter = (f: Fighter) => {
    setNationality(f.nationalities?.[0] ?? '');
    setNickname(f.nickname ?? '');
    setBio(f.bio ?? '');
    setWeightClass(f.weight_class ?? '');
    setDisciplines(f.disciplines ?? []);
    setGymName(f.gym_name ?? '');
    setExactWeight(f.exact_weight != null ? String(f.exact_weight) : '');
    setHeightCm(f.height_cm != null ? String(f.height_cm) : '');
    setReachCm(f.reach_cm != null ? String(f.reach_cm) : '');
    setWins(String(f.record_wins));
    setLosses(String(f.record_losses));
    setDraws(String(f.record_draws));
    setGenderDivision(f.gender_division ?? '');
    setKoWins(String(f.ko_wins ?? 0));
    setTkoWins(String(f.tko_wins ?? 0));
    setKoLosses(String(f.ko_losses ?? 0));
    setTkoLosses(String(f.tko_losses ?? 0));
    setSkillRating(f.skill_rating != null ? String(f.skill_rating) : '');
    setPreferredRulesets((f.preferred_rulesets ?? []).join(', '));
    setRequestedWeight(f.requested_weight_kg != null ? String(f.requested_weight_kg) : '');
    setAcceptableWeightMin(f.acceptable_weight_min_kg != null ? String(f.acceptable_weight_min_kg) : '');
    setAcceptableWeightMax(f.acceptable_weight_max_kg != null ? String(f.acceptable_weight_max_kg) : '');
    setSpecialRestrictions((f.special_restrictions ?? []).join(', '));
    setLastFightAt(f.last_fight_at ?? '');
    setLastKoLossAt(f.last_ko_loss_at ?? '');
    setIsAvailable(f.is_available);
    setAvailableToTravelInternationally(f.available_to_travel_internationally ?? false);
    setShortNotice(f.short_notice_ready);
    setExperienceLevel(f.experience_level ?? 'amateur');
    setAvailableFrom(f.available_from ?? '');
    setAvailableTo(f.available_to ?? '');
    setHasManager(f.has_manager ?? false);
    setManagerName(f.manager_name ?? '');
    setManagerEmail(f.manager_email ?? '');
    setManagerPhone(f.manager_phone ?? '');
    setHasPromoter(f.has_promoter ?? false);
    setPromoterName(f.promoter_name ?? '');
    setPromoterEmail(f.promoter_email ?? '');
    setPromoterPhone(f.promoter_phone ?? '');
    setHasSponsor(f.has_sponsor ?? false);
    setSponsorName(f.sponsor_name ?? '');
    setSponsorEmail(f.sponsor_email ?? '');
    setSponsorPhone(f.sponsor_phone ?? '');
  };

  useEffect(() => {
    authService.getSession().then(async ({ data }) => {
      const p = data?.profile ?? null;
      setProfile(p);
      if (!p) { window.location.href = '/login'; return; }
      if (p.role !== 'fighter') { window.location.href = '/'; return; }
      syncFormFromProfile(p);

      setSocialMedia((current) => ({ ...current, instagram: p.instagram ?? '' }));
      authService.getSocialMediaHandles(p.id).then(({ data: handles }) => {
        if (!handles) return;
        setSocialMedia({
          instagram: handles.instagram ?? '',
          tiktok: handles.tiktok ?? '',
          facebook: handles.facebook ?? '',
          youtube: handles.youtube ?? '',
          x_handle: handles.x_handle ?? '',
        });
        setProfile((current) => current ? { ...current, ...handles } : current);
      });

      // Minor consent gate
      if (isMinor(p.date_of_birth)) {
        const consented = await hasValidConsent(p.id);
        if (!consented) { window.location.href = '/consent'; return; }
      }

      fighterService.getByProfileId(p.id).then(({ data: f }) => {
        setFighter(f ?? null);
        if (f) {
          syncFormFromFighter(f);

          // Load initial inbox
          setRequestsLoading(true);
          requestService.getByFighter(f.id).then(({ data: reqs }) => {
            setRequests((reqs as RequestWithDetails[]) ?? []);
            setRequestsLoading(false);
          });

          // Load my event applications
          setAppsLoading(true);
          eventService.getMyApplications(f.id).then(({ data: apps }) => {
            setMyApplications((apps ?? []) as AppWithEvent[]);
            setAppsLoading(false);
          });

          // Realtime subscription
          const channel = supabase
            .channel(`requests:fighter:${f.id}`)
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'match_requests', filter: `fighter_id=eq.${f.id}` },
              (payload) => {
                setRequests((prev) => [payload.new as RequestWithDetails, ...prev]);
              }
            )
            .on(
              'postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'match_requests', filter: `fighter_id=eq.${f.id}` },
              (payload) => {
                setRequests((prev) =>
                  prev.map((r) => r.id === payload.new.id ? { ...r, ...payload.new } : r)
                );
              }
            )
            .subscribe();

          return () => { supabase.removeChannel(channel); };
        }
      });
    });
  }, []);

  const startEditing = () => {
    if (profile) syncFormFromProfile(profile);
    if (fighter) syncFormFromFighter(fighter);
    setError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    if (profile) syncFormFromProfile(profile);
    if (fighter) syncFormFromFighter(fighter);
    setPhotoFile(null);
    setPhotoPreview(null);
    setError(null);
    setEditing(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!profile) return;
    setError(null);

    const normalizedFullName = fullName.trim();
    if (!normalizedFullName) {
      setError('El nombre completo es obligatorio.');
      return;
    }

    const minimumWeight = acceptableWeightMin ? Number(acceptableWeightMin) : null;
    const maximumWeight = acceptableWeightMax ? Number(acceptableWeightMax) : null;
    if (minimumWeight != null && maximumWeight != null && minimumWeight > maximumWeight) {
      setError(t('fighters.accountProfile.errors.weightRange'));
      return;
    }

    const invalidPlatform = SOCIAL_MEDIA_PLATFORMS.find(
      ({ key }) => !isValidSocialMediaIdentifier(key, socialMedia[key])
    );
    if (invalidPlatform) {
      setError(t('fighters.accountProfile.errors.socialMedia', { platform: invalidPlatform.label }));
      return;
    }

    const socialUpdates: SocialMediaHandles = {
      instagram: normalizeSocialMediaIdentifier(socialMedia.instagram),
      tiktok: normalizeSocialMediaIdentifier(socialMedia.tiktok),
      facebook: normalizeSocialMediaIdentifier(socialMedia.facebook),
      youtube: normalizeSocialMediaIdentifier(socialMedia.youtube),
      x_handle: normalizeSocialMediaIdentifier(socialMedia.x_handle),
    };

    setSaving(true);

    let photoUrl: string | undefined;
    if (photoFile) {
      const { data: url, error: upErr } = await fighterService.uploadPhoto(photoFile);
      if (upErr) { setError(t('fighters.accountProfile.errors.photoUpload')); setSaving(false); return; }
      photoUrl = url ?? undefined;
    }

    const payload = {
      nickname: nickname.trim() || null,
      bio: bio.trim().slice(0, FIGHTER_BIO_MAX_LENGTH) || null,
      weight_class: weightClass || null,
      disciplines: disciplines,
      nationalities: nationality ? [nationality] : [],
      gym_name: gymName.trim() || null,
      exact_weight: exactWeight ? parseFloat(exactWeight) : null,
      height_cm: heightCm ? parseFloat(heightCm) : null,
      reach_cm: reachCm ? parseFloat(reachCm) : null,
      record_wins: parseInt(wins) || 0,
      record_losses: parseInt(losses) || 0,
      record_draws: parseInt(draws) || 0,
      gender_division: genderDivision || null,
      ko_wins: parseInt(koWins) || 0,
      tko_wins: parseInt(tkoWins) || 0,
      ko_losses: parseInt(koLosses) || 0,
      tko_losses: parseInt(tkoLosses) || 0,
      skill_rating: skillRating ? parseFloat(skillRating) : null,
      preferred_rulesets: preferredRulesets.split(',').map((value) => value.trim()).filter(Boolean),
      requested_weight_kg: requestedWeight ? parseFloat(requestedWeight) : null,
      acceptable_weight_min_kg: minimumWeight,
      acceptable_weight_max_kg: maximumWeight,
      special_restrictions: specialRestrictions.split(',').map((value) => value.trim()).filter(Boolean),
      last_fight_at: lastFightAt || null,
      last_ko_loss_at: lastKoLossAt || null,
      is_available: isAvailable,
      short_notice_ready: shortNotice,
      experience_level: experienceLevel,
      available_from: availableFrom || null,
      available_to: availableTo || null,
      has_manager: hasManager,
      manager_name: hasManager ? managerName || null : null,
      manager_email: hasManager ? managerEmail || null : null,
      manager_phone: hasManager ? managerPhone || null : null,
      has_promoter: hasPromoter,
      promoter_name: hasPromoter ? promoterName || null : null,
      promoter_email: hasPromoter ? promoterEmail || null : null,
      promoter_phone: hasPromoter ? promoterPhone || null : null,
      has_sponsor: hasSponsor,
      sponsor_name: hasSponsor ? sponsorName || null : null,
      sponsor_email: hasSponsor ? sponsorEmail || null : null,
      sponsor_phone: hasSponsor ? sponsorPhone || null : null,
      ...(photoUrl !== undefined ? { photo_url: photoUrl } : {}),
    };

    const result = fighter
      ? await fighterService.update(fighter.id, payload)
      : await fighterService.create(profile.id, payload);

    if (result.error) {
      setSaving(false);
      setError(t('fighters.accountProfile.errors.save'));
      return;
    }

    const savedFighter = result.data
      ? {
          ...result.data,
          available_to_travel_internationally: availableToTravelInternationally,
        }
      : null;
    if (savedFighter) {
      const travelResult = await fighterService.updateTravelPreference(
        savedFighter.id,
        availableToTravelInternationally,
      );
      if (travelResult.error) {
        setSaving(false);
        setError(t('fighters.accountProfile.travelSaveError'));
        return;
      }
    }

    const profileUpdates = {
      full_name: normalizedFullName,
      phone: phone.trim() || null,
      date_of_birth: dateOfBirth || null,
      city: city.trim() || null,
      state: state.trim() || null,
      country_code: currentCountryCode || null,
      country: getCountryName(currentCountryCode, 'en') || null,
      ...socialUpdates,
    };
    const profileResult = await authService.updateProfile(profile.id, profileUpdates);
    setSaving(false);
    setFighter(savedFighter);
    if (profileResult.error) {
      setError(t('fighters.accountProfile.errors.personalDataSave'));
      return;
    }

    setProfile((current) => current ? { ...current, ...profileUpdates } : current);
    setSocialMedia({
      instagram: socialUpdates.instagram ?? '',
      tiktok: socialUpdates.tiktok ?? '',
      facebook: socialUpdates.facebook ?? '',
      youtube: socialUpdates.youtube ?? '',
      x_handle: socialUpdates.x_handle ?? '',
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setEditing(false);
  };

  const handleRequestStatus = async (requestId: string, status: 'accepted' | 'declined') => {
    setUpdatingId(requestId);
    await requestService.updateStatus(requestId, status);
    setRequests((prev) =>
      prev.map((r) => r.id === requestId ? { ...r, status } as RequestWithDetails : r)
    );
    setUpdatingId(null);
  };

  const handleWithdrawApplication = async (applicationId: string) => {
    setWithdrawingId(applicationId);
    await eventService.withdrawApplication(applicationId);
    setMyApplications((prev) =>
      prev.map((a) => a.id === applicationId ? { ...a, status: 'withdrawn' as const } : a)
    );
    setWithdrawingId(null);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const { error: err } = await authService.deleteAccount();
    if (err) {
      setError(err);
      setDeleting(false);
      setShowDeleteConfirm(false);
    } else {
      window.location.href = '/';
    }
  };

  if (!profile || fighter === undefined) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-sm" style={{ color:'#9A9A9A' }}>...</p></div>;
  }

  const isSetup = !fighter;
  const displayPhoto = photoPreview ?? fighter?.photo_url ?? null;
  const visibleSocialMedia = SOCIAL_MEDIA_PLATFORMS.flatMap((platform) => {
    const value = socialMedia[platform.key];
    const href = value ? getSocialMediaHref(platform.key, value) : null;
    return href ? [{ ...platform, value, href }] : [];
  });
  const nationalityLabel = nationality
    ? `${countryFlagEmoji(nationality)} ${getCountryName(nationality, i18n.resolvedLanguage)}`
    : '—';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar activePage={null} />
      <main className="flex-1 max-w-2xl mx-auto px-4 sm:px-6 py-10 w-full">

        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#C0001E' }}>{t('fighters.accountProfile.title')}</p>
        </div>
        <div className="flex items-start gap-6 mb-8">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 bg-zinc-100 overflow-hidden cursor-pointer" onClick={() => photoInputRef.current?.click()} title={t('fighters.accountProfile.changePhoto')}>
              {displayPhoto ? (
                <Image src={displayPhoto} alt={t('fighters.accountProfile.profilePhoto')} width={80} height={80} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                  </svg>
                </div>
              )}
            </div>
            <button onClick={() => photoInputRef.current?.click()} className="absolute -bottom-1 -right-1 w-6 h-6 bg-zinc-900 text-white flex items-center justify-center">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#C0001E' }}>{t('fighters.accountProfile.title')}</p>
                <h1 className="text-3xl font-black uppercase" style={{ letterSpacing:'-1px' }}>{profile!.full_name}</h1>
                {fighter?.nickname && <p className="text-base font-semibold" style={{ color:'#C0001E' }}>&ldquo;{fighter.nickname}&rdquo;</p>}
                <p className="text-sm mt-1" style={{ color:'#5A5A5A' }}>{profile!.city ?? t('fighters.accountProfile.noCity')}</p>
              </div>
              {fighter?.verified && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-emerald-50 text-emerald-700 flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  {t('fighters.accountProfile.verified')}
                </span>
              )}
            </div>
            {photoFile && <p className="text-xs mt-2 text-amber-600">{t('fighters.accountProfile.photoSelected')}</p>}
          </div>
        </div>

        {isSetup && !editing && (
          <div className="border-l-4 border-[#C0001E] bg-zinc-50 px-4 py-4 mb-6">
            <p className="text-sm font-semibold text-zinc-900">{t('fighters.accountProfile.completeProfile')}</p>
            <p className="text-xs text-zinc-500 mt-1">{t('fighters.accountProfile.completeProfileHelp')}</p>
            <button onClick={startEditing} className="mt-3 px-4 py-2 text-xs font-bold tracking-widest uppercase text-white" style={{ background:'#C0001E' }}>{t('fighters.accountProfile.configureProfile')}</button>
          </div>
        )}

        {error && <div className="mb-6 border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

        {/* ── View Mode ── */}
        {!editing && fighter && (
          <div className="space-y-6">
            <div className="border border-zinc-100 p-6">
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color:'#9A9A9A' }}>{t('fighters.accountProfile.personalInformation')}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { label:t('fighters.accountProfile.fullName'), value: profile.full_name },
                  { label:t('fighters.accountProfile.fields.phone'), value: profile.phone ?? '—' },
                  { label:t('fighters.accountProfile.dateOfBirth'), value: profile.date_of_birth ?? '—' },
                  { label:t('fighters.accountProfile.city'), value: profile.city ?? '—' },
                  { label:t('fighters.accountProfile.state'), value: profile.state ?? '—' },
                  {
                    label:t('fighters.accountProfile.fields.country'),
                    value: profile.country_code
                      ? `${countryFlagEmoji(profile.country_code)} ${getCountryName(profile.country_code, i18n.resolvedLanguage || i18n.language)}`
                      : profile.country || '—',
                  },
                  { label:t('fighters.accountProfile.nationality'), value: nationalityLabel },
                  { label:t('fighters.accountProfile.accountEmail'), value: profile.email },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#9A9A9A' }}>{label}</p>
                    <p className="text-sm font-semibold text-zinc-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Record */}
            <div className="grid grid-cols-3 gap-4 border border-zinc-100 p-6 text-center">
              {[
                { label:t('fighters.accountProfile.wins'), value:fighter.record_wins, part:'wins' as const },
                { label:t('fighters.accountProfile.losses'), value:fighter.record_losses, part:'losses' as const },
                { label:t('fighters.accountProfile.draws'), value:fighter.record_draws, part:'draws' as const },
              ].map(({label,value,part}) => (
                <div key={label}>
                  <p className="text-3xl font-black" style={{ fontFamily:'var(--font-barlow-condensed)', letterSpacing:'-1px' }}><RecordValue part={part} value={value} /></p>
                  <p className="text-xs font-bold tracking-widest uppercase mt-1" style={{ color:'#5A5A5A' }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Disciplines pills */}
            {fighter.disciplines && fighter.disciplines.length > 0 && (
              <div className="border border-zinc-100 p-6 mb-4">
                <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color:'#9A9A9A' }}>{t('fighters.accountProfile.disciplines')}</p>
                <div className="flex flex-wrap gap-2">
                  {fighter.disciplines.map(d => (
                    <span key={d} className="text-xs font-bold px-3 py-1.5 uppercase tracking-wide bg-[#0A0A0A] text-white">{d}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4 border border-zinc-100 p-6">
              {[
                { label:t('fighters.accountProfile.fields.division'), value: fighter.weight_class ? (WEIGHT_LABELS[fighter.weight_class] ?? fighter.weight_class) : '—' },
                { label:t('fighters.accountProfile.gym'), value: fighter.gym_name ?? '—' },
                { label:t('fighters.accountProfile.exactWeight'), value: fighter.exact_weight ? `${fighter.exact_weight} kg` : '—' },
                { label:t('fighters.accountProfile.fields.skillLevel'), value: fighter.skill_rating ? `${fighter.skill_rating}/10` : '—' },
                { label:t('fighters.accountProfile.koTkoFor'), value: `${fighter.ko_wins + fighter.tko_wins}` },
                { label:t('fighters.accountProfile.koTkoAgainst'), value: `${fighter.ko_losses + fighter.tko_losses}` },
                { label:t('fighters.accountProfile.rulesets'), value: fighter.preferred_rulesets.length ? fighter.preferred_rulesets.join(', ') : '—' },
                { label:t('fighters.accountProfile.requestedWeight'), value: fighter.requested_weight_kg ? `${fighter.requested_weight_kg} kg` : '—' },
                { label:t('fighters.accountProfile.acceptableRange'), value: fighter.acceptable_weight_min_kg != null || fighter.acceptable_weight_max_kg != null ? `${fighter.acceptable_weight_min_kg ?? '—'}–${fighter.acceptable_weight_max_kg ?? '—'} kg` : '—' },
                { label:t('fighters.accountProfile.fields.lastFight'), value: fighter.last_fight_at ?? '—' },
                { label:t('fighters.accountProfile.height'), value: fighter.height_cm ? `${fighter.height_cm} cm` : '—' },
                { label:t('fighters.accountProfile.reach'), value: fighter.reach_cm ? `${fighter.reach_cm} cm` : '—' },
              ].map(({label,value}) => (
                <div key={label}>
                  <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#9A9A9A' }}>{label}</p>
                  <p className="text-sm font-semibold text-zinc-900">{value}</p>
                </div>
              ))}
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#9A9A9A' }}>{t('fighters.accountProfile.level')}</p>
                <span className={`text-xs font-bold px-2 py-1 uppercase tracking-widest ${fighter.experience_level === 'pro' ? 'bg-[#C0001E] text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                  {fighter.experience_level === 'pro' ? 'Pro' : 'Amateur'}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#9A9A9A' }}>{t('fighters.accountProfile.availability')}</p>
                <span className={`text-xs font-semibold px-2 py-1 ${fighter.is_available ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                  {fighter.is_available ? t('fighters.accountProfile.available') : t('fighters.accountProfile.unavailable')}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#9A9A9A' }}>{t('fighters.accountProfile.internationalTravel')}</p>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 ${fighter.available_to_travel_internationally ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                  {fighter.available_to_travel_internationally && <span aria-hidden="true">✓</span>}
                  {fighter.available_to_travel_internationally
                    ? t('fighters.accountProfile.willingToTravel')
                    : t('fighters.accountProfile.notWillingToTravel')}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#9A9A9A' }}>{t('fighters.accountProfile.shortNotice')}</p>
                <span className={`text-xs font-semibold px-2 py-1 ${fighter.short_notice_ready ? 'bg-amber-50 text-amber-700' : 'bg-zinc-100 text-zinc-500'}`}>
                  {fighter.short_notice_ready ? t('fighters.accountProfile.ready') : t('fighters.accountProfile.no')}
                </span>
              </div>
              {fighter.available_from && (
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#9A9A9A' }}>{t('fighters.accountProfile.availableFrom')}</p>
                  <p className="text-sm text-zinc-900">{fighter.available_from}</p>
                </div>
              )}
              {fighter.available_to && (
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#9A9A9A' }}>{t('fighters.accountProfile.availableTo')}</p>
                  <p className="text-sm text-zinc-900">{fighter.available_to}</p>
                </div>
              )}
              {fighter.special_restrictions.length > 0 && (
                <div className="col-span-2 border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-bold tracking-widest uppercase text-amber-800">{t('fighters.accountProfile.privateRestrictions')}</p>
                  <p className="mt-1 text-sm text-amber-950">{fighter.special_restrictions.join(' · ')}</p>
                </div>
              )}
            </div>

            {/* Bio */}
            {fighter.bio && (
              <div className="border-l-4 border-[#C0001E] bg-zinc-50 p-6">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#C0001E]">{t('fighters.profile.highlights')}</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">{compactFighterBio(fighter.bio)}</p>
              </div>
            )}

            {visibleSocialMedia.length > 0 && (
              <div className="border border-zinc-100 p-6">
                <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color:'#9A9A9A' }}>{t('fighters.accountProfile.socialMedia')}</p>
                <div className="flex flex-wrap gap-2">
                  {visibleSocialMedia.map(({ key, label, value, href }) => (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 border border-zinc-200 px-3 py-2 text-sm text-zinc-700 transition-colors hover:border-[#C0001E] hover:text-[#C0001E]"
                    >
                      <span className="font-bold">{label}</span>
                      <span>{getSocialMediaDisplayValue(value)}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={startEditing} className="px-4 py-2 text-sm font-semibold border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors">{t('fighters.accountProfile.editProfile')}</button>
            </div>
          </div>
        )}

        {/* ── Edit / Setup Form ── */}
        {editing && (
          <div className="space-y-5">
            <div className="border border-zinc-200 p-4 sm:p-5">
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.personalInformation')}</p>
              <p className="mt-1 text-xs text-zinc-500">{t('fighters.accountProfile.emailLockedHelp')}</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">{t('fighters.accountProfile.fullName')}</span>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required maxLength={120}
                    className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">{t('fighters.accountProfile.fields.phone')}</span>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+52 000 000 0000" maxLength={30}
                    className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">{t('fighters.accountProfile.dateOfBirth')}</span>
                  <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                    className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">{t('fighters.accountProfile.city')}</span>
                  <input type="text" value={city} onChange={e => setCity(e.target.value)} maxLength={100}
                    className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">{t('fighters.accountProfile.state')}</span>
                  <input type="text" value={state} onChange={e => setState(e.target.value)} maxLength={100}
                    className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">{t('fighters.accountProfile.fields.country')}</span>
                  <select
                    value={currentCountryCode}
                    onChange={(event) => setCurrentCountryCode(event.target.value)}
                    className="w-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  >
                    <option value="">{t('fighters.accountProfile.selectCountry')}</option>
                    {countryOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {countryFlagEmoji(option.code)} {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">{t('fighters.accountProfile.nationalityFlag')}</span>
                  <select
                    value={nationality}
                    onChange={(event) => setNationality(event.target.value)}
                    className="w-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  >
                    <option value="">{t('fighters.accountProfile.selectCountry')}</option>
                    {countryOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {countryFlagEmoji(option.code)} {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">{t('fighters.accountProfile.accountEmail')}</span>
                  <input type="email" value={profile.email} readOnly aria-readonly="true"
                    className="w-full cursor-not-allowed border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500" />
                </label>
              </div>
            </div>

            {/* Nickname */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.nickname')}</label>
              <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} placeholder={t('fighters.accountProfile.nicknamePlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>

            {/* Weight class */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.divisionWeight')}</label>
              <select value={weightClass} onChange={e => setWeightClass(e.target.value)}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white">
                <option value="">— {t('fighters.accountProfile.selectDivision')} —</option>
                {WEIGHT_CLASSES.map(wc => <option key={wc} value={wc}>{WEIGHT_LABELS[wc]}</option>)}
              </select>
            </div>

            {/* Disciplines — multi-select checkboxes */}
            <div className="col-span-2">
              <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.disciplines')}</label>
              <div className="flex flex-wrap gap-2">
                {DISCIPLINE_OPTIONS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDisciplines(prev =>
                      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                    )}
                    className={`px-3 py-1.5 text-xs font-bold tracking-wide uppercase border transition-colors ${
                      disciplines.includes(d)
                        ? 'bg-[#C0001E] text-white border-[#C0001E]'
                        : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Gym */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.gym')}</label>
              <input type="text" value={gymName} onChange={e => setGymName(e.target.value)} placeholder={t('fighters.accountProfile.gymPlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
            </div>

            {/* Physical stats */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.physicalStats')}</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label:t('fighters.accountProfile.weightKg'), val:exactWeight, set:setExactWeight, step:'0.1' },
                  { label:t('fighters.accountProfile.heightCm'), val:heightCm, set:setHeightCm, step:'1' },
                  { label:t('fighters.accountProfile.reachCm'), val:reachCm, set:setReachCm, step:'1' },
                ].map(({ label, val, set: setter, step }) => (
                  <div key={label}>
                    <p className="text-xs text-zinc-400 mb-1">{label}</p>
                    <input type="number" min="0" step={step} value={val} onChange={e => setter(e.target.value)}
                      className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm text-center focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                  </div>
                ))}
              </div>
            </div>

            {/* Record */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.recordLabel')}</label>
              <div className="grid grid-cols-3 gap-3">
                {[{label:t('fighters.accountProfile.wins'),val:wins,set:setWins},{label:t('fighters.accountProfile.losses'),val:losses,set:setLosses},{label:t('fighters.accountProfile.draws'),val:draws,set:setDraws}].map(({ label, val, set: setter }) => (
                  <div key={label}>
                    <p className="text-xs text-zinc-400 mb-1">{label}</p>
                    <input type="number" min="0" value={val} onChange={e => setter(e.target.value)}
                      className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm text-center focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.divisionAndLevel')}</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <GenderDivisionCheckboxes value={genderDivision} onChange={setGenderDivision} />
                <input type="number" min="1" max="10" step="0.1" value={skillRating} onChange={e => setSkillRating(e.target.value)} placeholder={t('fighters.accountProfile.skillPlaceholder')} className="w-full border border-zinc-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.knockoutRecord')}</label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[{label:t('fighters.accountProfile.koFor'),val:koWins,set:setKoWins},{label:t('fighters.accountProfile.tkoFor'),val:tkoWins,set:setTkoWins},{label:t('fighters.accountProfile.koAgainst'),val:koLosses,set:setKoLosses},{label:t('fighters.accountProfile.tkoAgainst'),val:tkoLosses,set:setTkoLosses}].map(({ label, val, set: setter }) => <label key={label}><span className="mb-1 block text-xs text-zinc-400">{label}</span><input type="number" min="0" value={val} onChange={e => setter(e.target.value)} className="w-full border border-zinc-300 px-3 py-2 text-center text-sm" /></label>)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.rulesAndPreferences')}</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input value={preferredRulesets} onChange={e => setPreferredRulesets(e.target.value)} placeholder={t('fighters.accountProfile.rulesetsPlaceholder')} className="w-full border border-zinc-300 px-3 py-2 text-sm sm:col-span-2" />
                <input type="number" min="0" step="0.1" value={requestedWeight} onChange={e => setRequestedWeight(e.target.value)} placeholder={t('fighters.accountProfile.requestedWeightPlaceholder')} className="w-full border border-zinc-300 px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" min="0" step="0.1" value={acceptableWeightMin} onChange={e => setAcceptableWeightMin(e.target.value)} placeholder={t('fighters.accountProfile.minimumKg')} className="w-full border border-zinc-300 px-3 py-2 text-sm" />
                  <input type="number" min="0" step="0.1" value={acceptableWeightMax} onChange={e => setAcceptableWeightMax(e.target.value)} placeholder={t('fighters.accountProfile.maximumKg')} className="w-full border border-zinc-300 px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.recentHistoryRestrictions')}</label>
              <div className="grid grid-cols-2 gap-3">
                <label><span className="mb-1 block text-xs text-zinc-400">{t('fighters.accountProfile.fields.lastFight')}</span><input type="date" value={lastFightAt} onChange={e => setLastFightAt(e.target.value)} className="w-full border border-zinc-300 px-3 py-2 text-sm" /></label>
                <label><span className="mb-1 block text-xs text-zinc-400">{t('fighters.accountProfile.fields.lastKoLoss')}</span><input type="date" value={lastKoLossAt} onChange={e => setLastKoLossAt(e.target.value)} className="w-full border border-zinc-300 px-3 py-2 text-sm" /></label>
              </div>
              <textarea value={specialRestrictions} onChange={e => setSpecialRestrictions(e.target.value)} rows={2} placeholder={t('fighters.accountProfile.restrictionsPlaceholder')} className="mt-3 w-full border border-zinc-300 px-3 py-2 text-sm" />
            </div>

            {/* Availability window */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.availabilityWindow')}</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-400 mb-1">{t('fighters.accountProfile.from')}</p>
                  <input type="date" value={availableFrom} onChange={e => setAvailableFrom(e.target.value)}
                    className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 mb-1">{t('fighters.accountProfile.to')}</p>
                  <input type="date" value={availableTo} onChange={e => setAvailableTo(e.target.value)}
                    className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                </div>
              </div>
            </div>

            {/* Availability toggle */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.availability')}</label>
              <div className="flex gap-3">
                {[{label:t('fighters.accountProfile.available'),value:true},{label:t('fighters.accountProfile.unavailable'),value:false}].map(({label,value}) => (
                  <button key={String(value)} type="button" onClick={() => setIsAvailable(value)}
                    className={`flex-1 py-2 text-sm font-semibold border transition-colors ${isAvailable===value ? 'border-[#C0001E] text-white bg-[#C0001E]' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* International travel toggle */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.internationalTravel')}</label>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700">
                <input
                  type="checkbox"
                  checked={availableToTravelInternationally}
                  onChange={(event) => setAvailableToTravelInternationally(event.target.checked)}
                  className="h-5 w-5 accent-[#C0001E]"
                />
                <span>{t('fighters.accountProfile.willingToTravel')}</span>
              </label>
            </div>

            {/* Short notice toggle */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.shortNotice')}</label>
              <div className="flex gap-3">
                {[{label:t('fighters.accountProfile.ready'),value:true},{label:t('fighters.accountProfile.no'),value:false}].map(({label,value}) => (
                  <button key={String(value)} type="button" onClick={() => setShortNotice(value)}
                    className={`flex-1 py-2 text-sm font-semibold border transition-colors ${shortNotice===value ? 'border-[#C0001E] text-white bg-[#C0001E]' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Experience level */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-2" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.level')}</label>
              <div className="flex gap-3">
                {([{label:'Amateur',value:'amateur'},{label:'Pro',value:'pro'}] as const).map(({label,value}) => (
                  <button key={value} type="button" onClick={() => setExperienceLevel(value)}
                    className={`flex-1 py-2 text-sm font-bold uppercase tracking-widest border transition-colors ${experienceLevel===value ? 'border-[#C0001E] text-white bg-[#C0001E]' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Short public bio / accomplishments */}
            <div>
              <div className="mb-1 flex items-end justify-between gap-3">
                <label className="block text-xs font-bold tracking-widest uppercase" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.bioLabel')}</label>
                <span className="text-[11px] tabular-nums text-zinc-400">{bio.length}/{FIGHTER_BIO_MAX_LENGTH}</span>
              </div>
              <p className="mb-2 text-xs leading-relaxed text-zinc-500">{t('fighters.accountProfile.bioHelp')}</p>
              <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={FIGHTER_BIO_MAX_LENGTH} rows={4} placeholder={t('fighters.accountProfile.bioPlaceholder')}
                className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none" />
            </div>

            {/* Social media */}
            <div className="border border-zinc-200 p-4">
              <label className="block text-xs font-bold tracking-widest uppercase" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.socialMedia')}</label>
              <p className="mt-1 text-xs text-zinc-500">{t('fighters.accountProfile.socialMediaHelp')}</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SOCIAL_MEDIA_PLATFORMS.map(({ key, label, placeholder }) => (
                  <label key={key}>
                    <span className="mb-1 block text-xs text-zinc-400">{label}</span>
                    <input
                      type="text"
                      value={socialMedia[key]}
                      onChange={(event) => setSocialMedia((current) => ({ ...current, [key]: event.target.value }))}
                      placeholder={placeholder}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={255}
                      className="w-full border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Representation */}
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase mb-3" style={{ color:'#5A5A5A' }}>{t('fighters.accountProfile.currentRepresentation')}</label>
              <div className="space-y-4">
                {/* Manager */}
                <div className="border border-zinc-200 p-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasManager} onChange={e => setHasManager(e.target.checked)}
                      className="w-4 h-4 border-zinc-300 text-[#C0001E] focus:ring-[#C0001E]" />
                    <span className="text-sm font-semibold text-zinc-900">{t('fighters.accountProfile.hasManager')}</span>
                  </label>
                  {hasManager && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">{t('fighters.accountProfile.name')}</p>
                        <input type="text" value={managerName} onChange={e => setManagerName(e.target.value)} placeholder={t('fighters.accountProfile.fullName')}
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">{t('fighters.accountProfile.email')}</p>
                        <input type="email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} placeholder="correo@ejemplo.com"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">{t('fighters.accountProfile.fields.phone')}</p>
                        <input type="tel" value={managerPhone} onChange={e => setManagerPhone(e.target.value)} placeholder="+52 000 000 0000"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Promoter */}
                <div className="border border-zinc-200 p-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasPromoter} onChange={e => setHasPromoter(e.target.checked)}
                      className="w-4 h-4 border-zinc-300 text-[#C0001E] focus:ring-[#C0001E]" />
                    <span className="text-sm font-semibold text-zinc-900">{t('fighters.accountProfile.hasPromoter')}</span>
                  </label>
                  {hasPromoter && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">{t('fighters.accountProfile.name')}</p>
                        <input type="text" value={promoterName} onChange={e => setPromoterName(e.target.value)} placeholder={t('fighters.accountProfile.fullName')}
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">{t('fighters.accountProfile.email')}</p>
                        <input type="email" value={promoterEmail} onChange={e => setPromoterEmail(e.target.value)} placeholder="correo@ejemplo.com"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">{t('fighters.accountProfile.fields.phone')}</p>
                        <input type="tel" value={promoterPhone} onChange={e => setPromoterPhone(e.target.value)} placeholder="+52 000 000 0000"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Sponsor */}
                <div className="border border-zinc-200 p-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasSponsor} onChange={e => setHasSponsor(e.target.checked)}
                      className="w-4 h-4 border-zinc-300 text-[#C0001E] focus:ring-[#C0001E]" />
                    <span className="text-sm font-semibold text-zinc-900">{t('fighters.accountProfile.hasSponsor')}</span>
                  </label>
                  {hasSponsor && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">{t('fighters.accountProfile.name')}</p>
                        <input type="text" value={sponsorName} onChange={e => setSponsorName(e.target.value)} placeholder={t('fighters.accountProfile.fullName')}
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">{t('fighters.accountProfile.email')}</p>
                        <input type="email" value={sponsorEmail} onChange={e => setSponsorEmail(e.target.value)} placeholder="correo@ejemplo.com"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">{t('fighters.accountProfile.fields.phone')}</p>
                        <input type="tel" value={sponsorPhone} onChange={e => setSponsorPhone(e.target.value)} placeholder="+52 000 000 0000"
                          className="w-full border border-zinc-300 px-3 py-2 text-zinc-900 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              {fighter && (
                <button onClick={cancelEditing} className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors">{t('fighters.accountProfile.cancel')}</button>
              )}
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-bold tracking-wide uppercase text-white disabled:opacity-50 transition-colors"
                style={{ background: saving ? '#9A9A9A' : '#C0001E' }}>
                {saving ? t('fighters.accountProfile.saving') : isSetup ? t('fighters.accountProfile.createProfile') : t('fighters.accountProfile.saveChanges')}
              </button>
            </div>
          </div>
        )}

        {/* ── Inbox: Fight Requests (Realtime) ── */}
        {fighter && (
          <div className="mt-10">
            <div className="border-t border-zinc-100 pt-8">
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color:'#C0001E' }}>{t('fighters.accountProfile.fightRequests')}</p>
              {requestsLoading ? (
                <p className="text-sm text-zinc-400">{t('fighters.accountProfile.loading')}</p>
              ) : requests.length === 0 ? (
                <div className="border border-dashed border-zinc-200 py-8 text-center">
                  <p className="text-sm text-zinc-400">{t('fighters.accountProfile.noFightRequests')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {requests.map((req) => {
                    const s = { label: t(`fighters.accountProfile.requestStatus.${req.status}`, { defaultValue: req.status }), cls: STATUS_CLASSES[req.status] ?? 'bg-zinc-100 text-zinc-500' };
                    return (
                      <div key={req.id} className="border border-zinc-200 p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900">{req.events?.event_name ?? t('fighters.accountProfile.unknownEvent')}</p>
                            <p className="text-xs mt-0.5" style={{ color:'#5A5A5A' }}>
                              {t('fighters.accountProfile.promoter')}: {req.profiles?.full_name ?? '—'}
                              {req.events?.event_date ? ` · ${req.events.event_date}` : ''}
                              {req.events?.city ? ` · ${req.events.city}` : ''}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 flex-shrink-0 ${s.cls}`}>{s.label}</span>
                        </div>
                        {req.message && <p className="text-xs text-zinc-600 bg-zinc-50 px-3 py-2 mb-3">&ldquo;{req.message}&rdquo;</p>}
                        {req.status === 'pending' && (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => handleRequestStatus(req.id,'declined')} disabled={updatingId===req.id}
                              className="px-3 py-1.5 text-xs font-semibold border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors">
                              {t('fighters.accountProfile.decline')}
                            </button>
                            <button onClick={() => handleRequestStatus(req.id,'accepted')} disabled={updatingId===req.id}
                              className="px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 transition-colors" style={{ background:'#C0001E' }}>
                              {updatingId===req.id ? '...' : t('fighters.accountProfile.accept')}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Mis Aplicaciones a Eventos ── */}
        {fighter && (
          <div className="mt-10">
            <div className="border-t border-zinc-100 pt-8">
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color:'#C0001E' }}>{t('fighters.accountProfile.myEventApplications')}</p>
              {appsLoading ? (
                <p className="text-sm text-zinc-400">{t('fighters.accountProfile.loading')}</p>
              ) : myApplications.length === 0 ? (
                <div className="border border-dashed border-zinc-200 py-8 text-center">
                  <p className="text-sm text-zinc-400">{t('fighters.accountProfile.noApplications')}</p>
                  <Link href="/events" className="mt-3 inline-block text-xs font-bold tracking-widest uppercase text-white px-4 py-2 transition-colors" style={{ background:'#C0001E' }}>
                    {t('fighters.accountProfile.viewEvents')}
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {myApplications.map((app) => {
                    const appStatuses: Record<string, { label: string; cls: string }> = {
                      pending:   { label: t('fighters.accountProfile.applicationStatus.pending'), cls: 'bg-amber-50 text-amber-700' },
                      accepted:  { label: t('fighters.accountProfile.applicationStatus.accepted'), cls: 'bg-emerald-50 text-emerald-700' },
                      declined:  { label: t('fighters.accountProfile.applicationStatus.declined'), cls: 'bg-red-50 text-red-700' },
                      withdrawn: { label: t('fighters.accountProfile.applicationStatus.withdrawn'), cls: 'bg-zinc-100 text-zinc-500' },
                    };
                    const s = appStatuses[app.status] ?? { label: app.status, cls: 'bg-zinc-100 text-zinc-500' };
                    return (
                      <div key={app.id} className="border border-zinc-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900">{app.events?.event_name ?? '—'}</p>
                            <p className="text-xs mt-0.5" style={{ color:'#5A5A5A' }}>
                              {app.events?.event_date ?? '—'}{app.events?.city ? ` · ${app.events.city}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className={`text-xs font-bold px-2 py-1 ${s.cls}`}>{s.label}</span>
                            {app.status === 'pending' && (
                              <button
                                onClick={() => handleWithdrawApplication(app.id)}
                                disabled={withdrawingId === app.id}
                                className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50 transition-colors">
                                {withdrawingId === app.id ? '...' : t('fighters.accountProfile.withdraw')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Delete Account ── */}
        <div className="mt-12 border-t border-zinc-100 pt-8">
          <p className="text-xs font-bold tracking-widest uppercase mb-2 text-red-600">{t('fighters.accountProfile.dangerZone')}</p>
          <p className="text-sm text-zinc-500 mb-4">{t('fighters.accountProfile.deleteWarning')}</p>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 text-sm font-semibold border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
          >
            {t('fighters.accountProfile.deleteAccount')}
          </button>
        </div>

        {/* Delete Confirm Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white max-w-sm w-full p-6 shadow-lg">
              <h3 className="text-lg font-black uppercase mb-2">{t('fighters.accountProfile.deleteAccount')}</h3>
              <p className="text-sm text-zinc-600 mb-6">
                {t('fighters.accountProfile.deleteConfirmation')}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  {t('fighters.accountProfile.cancel')}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wide text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? t('fighters.accountProfile.deleting') : t('fighters.accountProfile.yesDelete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
