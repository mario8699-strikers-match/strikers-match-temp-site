// User roles
export type UserRole =
  | 'fighter'
  | 'spectator'
  | 'promoter'
  | 'manager'
  | 'sponsor'
  | 'admin'
  | 'ring_card_girl'
  | 'photographer'
  | 'videographer'
  | 'broadcast_personality'
  | 'catering_vendor'
  | 'venue_rental'
  | 'judge'
  | 'ring_rental'
  | 'ring_announcer'
  | 'cutman'
  | 'merchandise_vendor'
  | 'ringside_doctor'
  | 'ringside_emt';

// Vendor/service-provider roles.
export const VENDOR_ROLES: UserRole[] = [
  'ring_card_girl', 'photographer', 'videographer', 'broadcast_personality',
  'catering_vendor', 'venue_rental', 'judge', 'ring_rental',
  'ring_announcer', 'cutman', 'merchandise_vendor',
  'ringside_doctor', 'ringside_emt',
];

// Legacy access role list kept for compatibility.
// Current promoter/manager event tools use role-based access.
export const MONETIZED_ROLES: UserRole[] = ['promoter', 'manager'];

// Legacy free-request role list kept for compatibility.
export const FREE_REQUEST_ROLES: UserRole[] = ['promoter', 'manager'];

export type PromoterFederationStatus = 'federated' | 'independent';

// Restricted operational actions.
export type PaidAction =
  | 'send_fight_request'
  | 'emergency_replacement'
  | 'live_streaming';

// Which roles can perform which operational actions.
export const ROLE_ALLOWED_ACTIONS: Record<string, PaidAction[]> = {
  promoter: ['send_fight_request', 'emergency_replacement', 'live_streaming'],
  manager: ['send_fight_request', 'emergency_replacement', 'live_streaming'],
  sponsor: [],
};

// Profile stored in the "profiles" table
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  city: string | null;
  state: string | null;
  country: string;
  phone: string | null;
  date_of_birth: string | null;
  bio: string | null;
  instagram: string | null;
  photo_url: string | null;
  promoter_federation_status: PromoterFederationStatus;
  is_available: boolean;
  additional_roles: UserRole[];
  is_banned?: boolean;
  reliability_score?: number;
  total_matches?: number;
  cancellations?: number;
  no_shows?: number;
  created_at: string;
  updated_at: string;
}

// Fighter-specific profile
export interface Fighter {
  id: string;
  profile_id: string;
  nickname: string | null;
  bio: string | null;
  weight_class: string | null;
  disciplines: string[];
  exact_weight: number | null;
  height_cm: number | null;
  reach_cm: number | null;
  gym_name: string | null;
  state: string | null;
  record_wins: number;
  record_losses: number;
  record_draws: number;
  is_available: boolean;
  short_notice_ready: boolean;
  experience_level: 'amateur' | 'pro';
  available_from: string | null;
  available_to: string | null;
  medical_clearance_date: string | null;
  photo_url: string | null;
  has_manager: boolean;
  manager_name: string | null;
  manager_email: string | null;
  manager_phone: string | null;
  has_promoter: boolean;
  promoter_name: string | null;
  promoter_email: string | null;
  promoter_phone: string | null;
  has_sponsor: boolean;
  sponsor_name: string | null;
  sponsor_email: string | null;
  sponsor_phone: string | null;
  verified?: boolean;
  is_hidden?: boolean;
  created_at: string;
}

// Fighter joined with profile (for admin views)
export interface FighterWithProfile extends Fighter {
  profiles: {
    full_name: string;
    email: string;
    city: string | null;
    date_of_birth?: string | null;
    phone: string | null;
    is_banned?: boolean;
    reliability_score?: number;
    total_matches?: number;
    cancellations?: number;
    no_shows?: number;
  };
}

export interface FighterFollow {
  id: string;
  spectator_profile_id: string;
  fighter_id: string;
  created_at: string;
}

export interface FighterFollowWithFighter extends FighterFollow {
  fighters: FighterWithProfile;
}

// Event
export interface Event {
  id: string;
  promoter_id: string;
  event_name: string;
  event_date: string | null;
  city: string | null;
  venue: string | null;
  weight_class_needed: string | null;
  weight_classes_needed: string[];
  disciplines_needed: string[];
  purse_amount: number | null;
  signup_fee: number | null;
  notes: string | null;
  event_time: string | null;
  flyer_url: string | null;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  created_at: string;
}

// Event form data
export interface EventFormData {
  event_name: string;
  event_date: string;
  event_time: string;
  city: string;
  venue: string;
  weight_class_needed: string;
  weight_classes_needed: string[];
  disciplines_needed: string[];
  purse_amount: string;
  purse_enabled: boolean;
  signup_fee: string;
  notes: string;
  status: Event['status'];
}

// Fighter application to an event
export interface EventApplication {
  id: string;
  event_id: string;
  fighter_id: string;
  message: string | null;
  fighter_discipline: string | null;
  fighter_weight_class: string | null;
  jiu_jitsu_belt: string | null;
  confirm_weight: boolean;
  confirm_availability: boolean;
  corner_name: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn';
  created_at: string;
}

// Match request
export interface MatchRequest {
  id: string;
  event_id: string;
  fighter_id: string | null;
  manual_fighter_id: string | null;
  sender_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  message: string | null;
  created_at: string;
}

// Manager-Fighter roster link
export interface ManagerFighter {
  id: string;
  manager_id: string;
  fighter_id: string;
  created_at: string;
}

// Manual fighter (added by manager/promoter, not registered on platform)
// manager_id semantically means "creator_id" (manager, promoter, or admin).
export interface ManualFighter {
  id: string;
  manager_id: string;
  full_name: string;
  nickname: string | null;
  weight_class: string | null;
  discipline: string | null;
  record_wins: number;
  record_losses: number;
  record_draws: number;
  phone: string | null;
  email: string | null;
  city: string | null;
  gym_name: string | null;
  experience_level: 'amateur' | 'pro';
  notes: string | null;
  // Display columns (added for public visibility)
  photo_url: string | null;
  bio: string | null;
  height_cm: number | null;
  reach_cm: number | null;
  state: string | null;
  is_available: boolean;
  created_at: string;
}

// Manual fighter joined with creator's profile (for admin/public views)
export interface ManualFighterWithCreator extends ManualFighter {
  profiles: {
    full_name: string;
    email: string;
    role: UserRole;
  } | null;
}

// Sponsorship offer
export interface SponsorshipOffer {
  id: string;
  sponsor_id: string;
  fighter_id: string;
  amount: number | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  message: string | null;
  created_at: string;
}

// Auth session
export interface AuthSession {
  user: {
    id: string;
    email: string;
  };
  profile: Profile | null;
}

// Service response wrapper
export interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
}

// Registration form
export interface RegisterFormData {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  city: string;
  phone: string;
  date_of_birth: string;
  gym_name: string;
  bio?: string;
  instagram?: string;
}

export type BusinessListingCategory =
  | 'gyms_academies'
  | 'recovery_wellness'
  | 'event_services'
  | 'gear_apparel'
  | 'nutrition_supplements'
  | 'local_business'
  | 'other';

export type BusinessListingStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'rejected'
  | 'expired';

export interface BusinessListing {
  id: string;
  owner_profile_id: string | null;
  title: string;
  category: BusinessListingCategory;
  description: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  instagram: string | null;
  image_url: string | null;
  image_storage_path: string | null;
  status: BusinessListingStatus;
  is_featured: boolean;
  starts_at: string | null;
  ends_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

// Login form
export interface LoginFormData {
  email: string;
  password: string;
}

// Legacy account-access shape
export interface PromoterSubscription {
  id: string;
  profile_id: string;
  plan_type: 'free' | 'basic' | 'pro' | 'per_request';
  requests_used: number;
  max_requests: number;
  is_active: boolean;
  trial_used: boolean;
  free_request_used: boolean;
  expires_at: string | null;
  created_at: string;
}

// Fighter search filters
export interface FighterSearchFilters {
  weight_class?: string;
  city?: string;
  short_notice_ready?: boolean;
  is_available?: boolean;
  manager_id?: string;
  page?: number;
  limit?: number;
}

// Fighter search result
export interface FighterSearchResult {
  fighters: FighterWithProfile[];
  count: number;
}

// Matchmaking result
export interface MatchResult {
  fighter: FighterWithProfile;
  match_score: number;
  match_reasons: string[];
}

// Emergency match result
export interface EmergencyMatchResult {
  fighter: FighterWithProfile;
  emergency_score: number;
}

// Event registration (external payment tracking)
export type RegistrationApprovalStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';
export type RegistrationEligibilityStatus = 'pending' | 'review_required' | 'eligible' | 'ineligible';

export interface EventRegistration {
  id: string;
  event_id: string;
  fighter_id: string;
  application_id: string | null;
  approval_status: RegistrationApprovalStatus;
  payment_status: 'pending' | 'submitted' | 'confirmed';
  eligibility_status: RegistrationEligibilityStatus;
  eligibility_reasons: string[];
  eligibility_evaluated_at: string | null;
  eligibility_rule_version: number;
  registered_discipline: string | null;
  registered_weight_class: string | null;
  weigh_in_weight: number | null;
  weigh_in_verified_at: string | null;
  belt_level: string | null;
  experience_level: 'amateur' | 'pro' | null;
  record_wins: number | null;
  record_losses: number | null;
  record_draws: number | null;
  date_of_birth: string | null;
  age_at_event: number | null;
  age_class: string | null;
  gender_division: string | null;
  team_name: string | null;
  ruleset: string | null;
  bout_format: string | null;
  availability_confirmed: boolean;
  weight_confirmed: boolean;
  medical_clearance_date: string | null;
  medical_verified_at: string | null;
  minor_consent_verified_at: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Registration with joined fighter + profile
export interface RegistrationWithFighter extends EventRegistration {
  fighters: {
    id: string;
    profiles: { full_name: string; city: string | null; date_of_birth?: string | null };
    weight_class: string | null;
    disciplines: string[];
    photo_url: string | null;
  };
}

export interface EventMat {
  id: string;
  event_id: string;
  name: string;
  mat_number: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type EventStaffRole = 'manager' | 'operator' | 'producer';

export interface EventStaff {
  id: string;
  event_id: string;
  profile_id: string;
  staff_role: EventStaffRole;
  is_active: boolean;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
    role: UserRole;
  } | null;
}

export interface EventMatchmakingSettings {
  event_id: string;
  weight_tolerance_kg: number;
  age_tolerance_years: number;
  experience_tolerance_fights: number;
  allow_same_team: boolean;
  recent_opponent_lookback_days: number;
  max_bouts_per_fighter: number;
  minimum_rest_minutes: number;
  rules_version: number;
  registration_closes_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventDivision {
  id: string;
  event_id: string;
  name: string;
  discipline: string;
  ruleset: string;
  bout_format: string | null;
  weight_class: string | null;
  minimum_weight_kg: number | null;
  maximum_weight_kg: number | null;
  age_class: string | null;
  minimum_age: number | null;
  maximum_age: number | null;
  gender_division: string | null;
  belt_level: string | null;
  experience_level: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type BoutStatus =
  | 'approved'
  | 'confirmed'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Bout {
  id: string;
  event_id: string;
  match_id: string | null;
  division_id: string | null;
  fighter_a_registration_id: string;
  fighter_b_registration_id: string;
  fighter_a_id: string;
  fighter_b_id: string;
  fighter_a_snapshot: { id: string; name: string; team?: string | null };
  fighter_b_snapshot: { id: string; name: string; team?: string | null };
  fighter_a?: {
    id: string;
    photo_url: string | null;
    exact_weight: number | null;
    weight_class: string | null;
    record_wins: number | null;
    record_losses: number | null;
    record_draws: number | null;
    gym_name: string | null;
    profiles: { full_name: string | null; city: string | null } | null;
  } | null;
  fighter_b?: {
    id: string;
    photo_url: string | null;
    exact_weight: number | null;
    weight_class: string | null;
    record_wins: number | null;
    record_losses: number | null;
    record_draws: number | null;
    gym_name: string | null;
    profiles: { full_name: string | null; city: string | null } | null;
  } | null;
  discipline: string | null;
  ruleset: string | null;
  bout_format: string | null;
  weight_class: string | null;
  age_class: string | null;
  belt_level: string | null;
  experience_level: string | null;
  mat_id: string | null;
  bout_number: number | null;
  mat_order: number | null;
  scheduled_time: string | null;
  status: BoutStatus;
  winner_id: string | null;
  result: string | null;
  method: string | null;
  elapsed_seconds: number | null;
  notes: string | null;
  cancellation_reason: string | null;
  replacement_notes: string | null;
  approved_by: string | null;
  approved_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Operational action access result.
export interface SubscriptionCheck {
  allowed: boolean;
  reason: string;
  requestsUsed: number;
  action?: PaidAction;
}

// Parental consent for minor fighters
export interface ParentalConsent {
  id: string;
  fighter_profile_id: string;
  parent_full_name: string;
  parent_email: string;
  parent_phone: string;
  relationship: 'Padre' | 'Madre' | 'Tutor Legal';
  signature_data: string;
  waiver_text_hash: string;
  consented_at: string;
  created_at: string;
}
