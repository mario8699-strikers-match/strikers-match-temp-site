import { isValidSocialMediaIdentifier } from '@/lib/socialMedia';
import type { Fighter, Profile } from '@/types';

export const FIGHTER_REGISTRATION_PROFILE_FIELDS = [
  'photo',
  'fullName',
  'country',
  'nationality',
  'instagram',
  'discipline',
  'weight',
  'team',
] as const;

export type FighterRegistrationProfileField =
  (typeof FIGHTER_REGISTRATION_PROFILE_FIELDS)[number];

function hasFirstAndLastName(value?: string | null) {
  return (value?.trim().split(/\s+/u).filter(Boolean).length ?? 0) >= 2;
}

export function getMissingFighterRegistrationProfileFields(
  fighter: Pick<
    Fighter,
    'photo_url' | 'nationalities' | 'disciplines' | 'weight_class' | 'gym_name'
  >,
  profile: Pick<Profile, 'full_name' | 'country' | 'country_code' | 'instagram'>,
): FighterRegistrationProfileField[] {
  const missing: FighterRegistrationProfileField[] = [];

  if (!fighter.photo_url?.trim()) missing.push('photo');
  if (!hasFirstAndLastName(profile.full_name)) missing.push('fullName');
  if (!profile.country_code?.trim() && !profile.country?.trim()) missing.push('country');
  if (!fighter.nationalities?.some((code) => code?.trim())) missing.push('nationality');
  if (!profile.instagram?.trim() || !isValidSocialMediaIdentifier('instagram', profile.instagram)) {
    missing.push('instagram');
  }
  if (!fighter.disciplines?.some((discipline) => discipline?.trim())) missing.push('discipline');
  if (!fighter.weight_class?.trim()) missing.push('weight');
  if (!fighter.gym_name?.trim()) missing.push('team');

  return missing;
}
