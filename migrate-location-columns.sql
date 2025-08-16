
-- Add location columns to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS host_country TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS host_region TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS host_city TEXT;
