-- =============================================
-- Fighter & Profile Search Indexes
-- Optimizes high-performance search queries
-- =============================================

-- 1) Weight class filtering
-- Speeds up WHERE weight_class = 'X' queries used in search and matchmaking
CREATE INDEX IF NOT EXISTS idx_fighters_weight_class
  ON public.fighters(weight_class);

-- 2) City filtering (on profiles, since city lives there)
-- Speeds up ILIKE '%city%' joins used in fighter search
CREATE INDEX IF NOT EXISTS idx_profiles_city
  ON public.profiles(city);

-- 3) Availability filtering
-- Speeds up WHERE is_available = true used in every search/matchmaking query
CREATE INDEX IF NOT EXISTS idx_fighters_available
  ON public.fighters(is_available);

-- 4) Short notice readiness
-- Speeds up short_notice_ready filtering in emergency matchmaking
CREATE INDEX IF NOT EXISTS idx_fighters_short_notice
  ON public.fighters(short_notice_ready);

-- 5) Composite index for the main search query
-- Covers the most common multi-filter search: weight + availability + short notice
CREATE INDEX IF NOT EXISTS idx_fighters_search
  ON public.fighters(weight_class, is_available, short_notice_ready);

-- 6) Availability date range
-- Speeds up date-based availability checks in matchmaking
CREATE INDEX IF NOT EXISTS idx_fighters_available_dates
  ON public.fighters(available_from, available_to);

-- 7) Profile ID lookup (foreign key optimization)
-- Speeds up joins between fighters and profiles
CREATE INDEX IF NOT EXISTS idx_fighters_profile_id
  ON public.fighters(profile_id);

-- 8) Match requests by event (for realtime and emergency queries)
CREATE INDEX IF NOT EXISTS idx_match_requests_event
  ON public.match_requests(event_id, status);

-- 9) Match requests by fighter
CREATE INDEX IF NOT EXISTS idx_match_requests_fighter
  ON public.match_requests(fighter_id, status);
