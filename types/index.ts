// User roles
export type UserRole =
  | 'fighter'
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
  | 'merchandise_vendor';

// Vendor roles (free users that can create profile + be contacted)
export const VENDOR_ROLES: UserRole[] = [
  'ring_card_girl', 'photographer', 'videographer', 'broadcast_personality',
  'catering_vendor', 'venue_rental', 'judge', 'ring_rental',
  'ring_announcer', 'cutman', 'merchandise_vendor',
];

// Roles subject to monetization checks
export const MONETIZED_ROLES: UserRole[] = ['promoter', 'manager', 'sponsor'];

// Roles that get 1 free request (sponsors do NOT)
export const FREE_REQUEST_ROLES: UserRole[] = ['promoter', 'manager'];

// Paid actions requiring subscription/payment
export type PaidAction =
  | 'send_fight_request'
  | 'emergency_replacement'
  | 'bulk_actions'
  | 'contact_users';

// Which roles can perform which paid actions
export const ROLE_ALLOWED_ACTIONS: Record<string, PaidAction[]> = {
  promoter: ['send_fight_request', 'emergency_replacement', 'bulk_actions', 'contact_users'],
  manager: ['send_fight_request', 'emergency_replacement', 'bulk_actions', 'contact_users'],
  sponsor: ['contact_users'],
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
    phone: string | null;
    is_banned?: boolean;
  };
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
}

// Gallery photo
export interface GalleryPhoto {
  id: string;
  admin_id: string;
  storage_path: string;
  caption: string | null;
  event_name: string | null;
  created_at: string;
  url?: string;
}

// Login form
export interface LoginFormData {
  email: string;
  password: string;
}

// Promoter subscription / monetization
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
export interface EventRegistration {
  id: string;
  event_id: string;
  fighter_id: string;
  payment_status: 'pending' | 'submitted' | 'confirmed';
  submitted_at: string | null;
  confirmed_at: string | null;
  created_at: string;
}

// Registration with joined fighter + profile
export interface RegistrationWithFighter extends EventRegistration {
  fighters: {
    id: string;
    profiles: { full_name: string; city: string | null };
    weight_class: string | null;
    disciplines: string[];
    photo_url: string | null;
  };
}

// Subscription check result
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
