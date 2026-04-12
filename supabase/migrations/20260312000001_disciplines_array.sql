ALTER TABLE public.fighters ADD COLUMN IF NOT EXISTS disciplines TEXT[] DEFAULT '{}';
UPDATE public.fighters SET disciplines = ARRAY[discipline] WHERE discipline IS NOT NULL AND discipline != '';
ALTER TABLE public.fighters DROP COLUMN IF EXISTS discipline;
