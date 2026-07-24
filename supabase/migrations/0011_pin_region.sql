-- Passport regions: pins remember their first-level admin area
-- (state/province/region) from reverse geocoding, so the profile passport can
-- tally regions alongside countries and cities.
alter table public.pins add column if not exists region text;
