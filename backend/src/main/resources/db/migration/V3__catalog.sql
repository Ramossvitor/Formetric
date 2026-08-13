CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION formetric_normalize(input TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
    SELECT lower(public.unaccent('public.unaccent', input));
$$;

CREATE TABLE food_items (
    id UUID PRIMARY KEY,
    owner_user_id UUID REFERENCES user_accounts (id) ON DELETE CASCADE,
    origin VARCHAR(16) NOT NULL,
    external_source VARCHAR(80),
    external_id VARCHAR(160),
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_food_items_origin CHECK (origin IN ('USER', 'SYSTEM', 'EXTERNAL')),
    CONSTRAINT ck_food_items_ownership CHECK (
        (origin = 'SYSTEM' AND owner_user_id IS NULL)
        OR (origin IN ('USER', 'EXTERNAL') AND owner_user_id IS NOT NULL)
    ),
    CONSTRAINT ck_food_items_external_identity CHECK (
        (external_source IS NULL AND external_id IS NULL)
        OR (external_source IS NOT NULL AND external_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX uq_food_items_external_identity
    ON food_items (owner_user_id, external_source, external_id)
    NULLS NOT DISTINCT
    WHERE external_source IS NOT NULL;
CREATE INDEX ix_food_items_owner ON food_items (owner_user_id, archived);

CREATE TABLE food_versions (
    id UUID PRIMARY KEY,
    food_id UUID NOT NULL REFERENCES food_items (id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name VARCHAR(160) NOT NULL,
    brand VARCHAR(120),
    notes VARCHAR(1000),
    reference_quantity NUMERIC(14, 3) NOT NULL,
    reference_unit VARCHAR(16) NOT NULL,
    calories_kcal NUMERIC(14, 3) NOT NULL,
    protein_g NUMERIC(14, 3) NOT NULL,
    carbohydrate_g NUMERIC(14, 3) NOT NULL,
    fat_g NUMERIC(14, 3) NOT NULL,
    fiber_g NUMERIC(14, 3) NOT NULL,
    sodium_mg NUMERIC(14, 3),
    nutrition_quality VARCHAR(24) NOT NULL,
    kcal_uncertainty NUMERIC(14, 3),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_food_versions_number UNIQUE (food_id, version_number),
    CONSTRAINT uq_food_versions_id_food UNIQUE (id, food_id),
    CONSTRAINT ck_food_versions_number CHECK (version_number > 0),
    CONSTRAINT ck_food_versions_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
    CONSTRAINT ck_food_versions_reference_quantity CHECK (reference_quantity > 0),
    CONSTRAINT ck_food_versions_reference_unit CHECK (
        reference_unit IN ('G', 'ML', 'UNIT', 'TABLESPOON', 'SLICE', 'PORTION')
    ),
    CONSTRAINT ck_food_versions_nutrients CHECK (
        calories_kcal >= 0 AND protein_g >= 0 AND carbohydrate_g >= 0
        AND fat_g >= 0 AND fiber_g >= 0
        AND (sodium_mg IS NULL OR sodium_mg >= 0)
        AND (kcal_uncertainty IS NULL OR kcal_uncertainty >= 0)
    ),
    CONSTRAINT ck_food_versions_quality CHECK (
        nutrition_quality IN ('EXACT', 'ESTIMATED', 'HIGHLY_ESTIMATED')
    )
);

CREATE INDEX ix_food_versions_food ON food_versions (food_id, version_number DESC);
CREATE INDEX ix_food_versions_name_trgm
    ON food_versions USING gin (formetric_normalize(name) gin_trgm_ops);
CREATE INDEX ix_food_versions_brand_trgm
    ON food_versions USING gin (formetric_normalize(coalesce(brand, '')) gin_trgm_ops);

CREATE TABLE food_serving_options (
    id UUID PRIMARY KEY,
    food_version_id UUID NOT NULL REFERENCES food_versions (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    label VARCHAR(80) NOT NULL,
    unit VARCHAR(16) NOT NULL,
    quantity NUMERIC(14, 3) NOT NULL,
    reference_quantity_equivalent NUMERIC(14, 3) NOT NULL,
    CONSTRAINT uq_food_servings_position UNIQUE (food_version_id, position),
    CONSTRAINT uq_food_servings_id_version UNIQUE (id, food_version_id),
    CONSTRAINT ck_food_servings_position CHECK (position >= 0),
    CONSTRAINT ck_food_servings_label CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
    CONSTRAINT ck_food_servings_unit CHECK (
        unit IN ('G', 'ML', 'UNIT', 'TABLESPOON', 'SLICE', 'PORTION')
    ),
    CONSTRAINT ck_food_servings_quantities CHECK (
        quantity > 0 AND reference_quantity_equivalent > 0
    )
);

CREATE INDEX ix_food_servings_version ON food_serving_options (food_version_id, position);

CREATE TABLE food_favorites (
    user_id UUID NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
    food_id UUID NOT NULL REFERENCES food_items (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, food_id)
);

CREATE TABLE recipes (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX ix_recipes_owner ON recipes (owner_user_id, archived);

CREATE TABLE recipe_favorites (
    user_id UUID NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, recipe_id)
);

CREATE TABLE recipe_versions (
    id UUID PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name VARCHAR(160) NOT NULL,
    notes VARCHAR(1000),
    yield_quantity NUMERIC(14, 3) NOT NULL,
    yield_unit VARCHAR(16) NOT NULL,
    serving_quantity NUMERIC(14, 3),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_recipe_versions_number UNIQUE (recipe_id, version_number),
    CONSTRAINT uq_recipe_versions_id_recipe UNIQUE (id, recipe_id),
    CONSTRAINT ck_recipe_versions_number CHECK (version_number > 0),
    CONSTRAINT ck_recipe_versions_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
    CONSTRAINT ck_recipe_versions_yield CHECK (yield_quantity > 0),
    CONSTRAINT ck_recipe_versions_yield_unit CHECK (yield_unit IN ('G', 'ML', 'PORTION')),
    CONSTRAINT ck_recipe_versions_serving CHECK (serving_quantity IS NULL OR serving_quantity > 0)
);

CREATE INDEX ix_recipe_versions_recipe ON recipe_versions (recipe_id, version_number DESC);
CREATE INDEX ix_recipe_versions_name_trgm
    ON recipe_versions USING gin (formetric_normalize(name) gin_trgm_ops);

CREATE TABLE recipe_ingredients (
    id UUID PRIMARY KEY,
    recipe_version_id UUID NOT NULL REFERENCES recipe_versions (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    food_version_id UUID NOT NULL,
    quantity NUMERIC(14, 3) NOT NULL,
    unit VARCHAR(16) NOT NULL,
    serving_option_id UUID,
    reference_quantity_equivalent NUMERIC(14, 3) NOT NULL,
    CONSTRAINT uq_recipe_ingredients_position UNIQUE (recipe_version_id, position),
    CONSTRAINT fk_recipe_ingredients_food_version FOREIGN KEY (food_version_id)
        REFERENCES food_versions (id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT fk_recipe_ingredients_serving_version FOREIGN KEY (serving_option_id, food_version_id)
        REFERENCES food_serving_options (id, food_version_id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT ck_recipe_ingredients_position CHECK (position >= 0),
    CONSTRAINT ck_recipe_ingredients_quantity CHECK (
        quantity > 0 AND reference_quantity_equivalent > 0
    ),
    CONSTRAINT ck_recipe_ingredients_unit CHECK (
        unit IN ('G', 'ML', 'UNIT', 'TABLESPOON', 'SLICE', 'PORTION')
    )
);

CREATE INDEX ix_recipe_ingredients_version ON recipe_ingredients (recipe_version_id, position);
CREATE INDEX ix_recipe_ingredients_food_version ON recipe_ingredients (food_version_id);

COMMENT ON TABLE food_versions IS
    'Append-only nutritional snapshots. Application code never updates a row.';
COMMENT ON TABLE recipe_versions IS
    'Append-only preparation snapshots. MVP ingredients reference food versions only, preventing recipe cycles.';
