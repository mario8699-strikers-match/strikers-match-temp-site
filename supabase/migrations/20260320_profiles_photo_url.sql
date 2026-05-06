-- Vendor profile picture support.
-- Vendors upload a photo on /vendor/profile, stored in DO Spaces, URL
-- persisted on profiles.photo_url. Displayed on /professionals.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photo_url text;
