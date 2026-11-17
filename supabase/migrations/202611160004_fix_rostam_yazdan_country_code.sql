-- Rostam Yazdan's registered profile had a current-country name but no ISO
-- country code, so country filters could not include him under Iran.
UPDATE public.profiles AS profile
SET country = 'Iran',
    country_code = 'IR'
FROM public.fighters AS fighter
WHERE fighter.profile_id = profile.id
  AND fighter.id = 'c385251b-81aa-463b-93d5-6aaad47a8aa2'
  AND (
    profile.country_code IS DISTINCT FROM 'IR'
    OR profile.country IS DISTINCT FROM 'Iran'
  );
