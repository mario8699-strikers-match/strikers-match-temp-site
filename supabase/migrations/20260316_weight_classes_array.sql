-- Add multi-weight-class support to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS weight_classes_needed TEXT[] DEFAULT '{}';

-- Migrate existing single value into the new array
UPDATE public.events
  SET weight_classes_needed = ARRAY[weight_class_needed]
  WHERE weight_class_needed IS NOT NULL
    AND weight_class_needed <> '';
