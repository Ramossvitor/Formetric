ALTER TABLE nutrient_targets
    DROP CONSTRAINT ck_nutrient_targets_nutrient,
    DROP CONSTRAINT ck_nutrient_targets_unit;

ALTER TABLE nutrient_targets
    ADD CONSTRAINT ck_nutrient_targets_nutrient CHECK (
        nutrient IN ('CALORIES', 'PROTEIN', 'CARBOHYDRATE', 'FAT', 'FIBER', 'WATER')
    ),
    ADD CONSTRAINT ck_nutrient_targets_unit CHECK (
        unit IN ('KCAL', 'G', 'ML')
    ),
    ADD CONSTRAINT ck_nutrient_targets_canonical_unit CHECK (
        (nutrient = 'CALORIES' AND unit = 'KCAL')
        OR (nutrient = 'WATER' AND unit = 'ML')
        OR (nutrient IN ('PROTEIN', 'CARBOHYDRATE', 'FAT', 'FIBER') AND unit = 'G')
    );

COMMENT ON CONSTRAINT ck_nutrient_targets_canonical_unit ON nutrient_targets IS
    'Keeps each versioned nutrition metric in its canonical calculation unit.';

-- Existing periods intentionally remain without a CALORIES target. Their nominal
-- calorie_target is preserved, but no historical tolerance is invented.
