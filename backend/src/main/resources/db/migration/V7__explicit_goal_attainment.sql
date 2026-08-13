ALTER TABLE goal_bands
    ADD COLUMN counts_as_attained BOOLEAN;

-- Existing goal periods were created by the original two-band UI, where the
-- POSITIVE band represented the user's intended target. This is a one-time
-- compatibility migration; new periods must declare attainment explicitly.
UPDATE goal_bands
SET counts_as_attained = tone = 'POSITIVE';

ALTER TABLE goal_bands
    ALTER COLUMN counts_as_attained SET NOT NULL;

COMMENT ON COLUMN goal_bands.counts_as_attained IS
    'Business rule used by analytics; intentionally independent from the visual tone.';
