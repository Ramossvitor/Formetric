CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE nutrition_goal_periods (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
    valid_from DATE NOT NULL,
    valid_to DATE,
    calorie_target NUMERIC(12, 3),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_nutrition_goal_periods_interval CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ck_nutrition_goal_periods_calories CHECK (calorie_target IS NULL OR calorie_target > 0),
    CONSTRAINT ex_nutrition_goal_periods_no_overlap EXCLUDE USING gist (
        user_id WITH =,
        daterange(valid_from, valid_to, '[)') WITH &&
    )
);

CREATE INDEX ix_nutrition_goal_periods_user_date
    ON nutrition_goal_periods (user_id, valid_from);

CREATE TABLE nutrient_targets (
    id UUID PRIMARY KEY,
    goal_period_id UUID NOT NULL REFERENCES nutrition_goal_periods (id) ON DELETE CASCADE,
    nutrient VARCHAR(24) NOT NULL,
    unit VARCHAR(8) NOT NULL,
    CONSTRAINT uq_nutrient_targets_period_nutrient UNIQUE (goal_period_id, nutrient),
    CONSTRAINT ck_nutrient_targets_nutrient CHECK (
        nutrient IN ('PROTEIN', 'CARBOHYDRATE', 'FAT', 'FIBER', 'WATER')
    ),
    CONSTRAINT ck_nutrient_targets_unit CHECK (unit IN ('G', 'ML'))
);

CREATE TABLE goal_bands (
    id UUID PRIMARY KEY,
    nutrient_target_id UUID NOT NULL REFERENCES nutrient_targets (id) ON DELETE CASCADE,
    band_order INTEGER NOT NULL,
    min_value NUMERIC(12, 3),
    max_value NUMERIC(12, 3),
    min_inclusive BOOLEAN NOT NULL,
    max_inclusive BOOLEAN NOT NULL,
    label VARCHAR(40) NOT NULL,
    tone VARCHAR(16) NOT NULL,
    CONSTRAINT uq_goal_bands_target_order UNIQUE (nutrient_target_id, band_order),
    CONSTRAINT ck_goal_bands_order CHECK (band_order >= 0),
    CONSTRAINT ck_goal_bands_min CHECK (min_value IS NULL OR min_value >= 0),
    CONSTRAINT ck_goal_bands_max CHECK (max_value IS NULL OR max_value >= 0),
    CONSTRAINT ck_goal_bands_range CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value),
    CONSTRAINT ck_goal_bands_label CHECK (char_length(btrim(label)) BETWEEN 1 AND 40),
    CONSTRAINT ck_goal_bands_tone CHECK (tone IN ('POSITIVE', 'NEUTRAL', 'WARNING'))
);

CREATE INDEX ix_nutrient_targets_period ON nutrient_targets (goal_period_id);
CREATE INDEX ix_goal_bands_target ON goal_bands (nutrient_target_id, band_order);

CREATE TABLE tdee_periods (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
    valid_from DATE NOT NULL,
    valid_to DATE,
    kcal_per_day NUMERIC(12, 3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_tdee_periods_interval CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ck_tdee_periods_value CHECK (kcal_per_day > 0),
    CONSTRAINT ex_tdee_periods_no_overlap EXCLUDE USING gist (
        user_id WITH =,
        daterange(valid_from, valid_to, '[)') WITH &&
    )
);

CREATE INDEX ix_tdee_periods_user_date ON tdee_periods (user_id, valid_from);
