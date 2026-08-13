CREATE TABLE daily_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_daily_logs_user_date UNIQUE (user_id, log_date),
    CONSTRAINT ck_daily_logs_status CHECK (status IN ('OPEN', 'CLOSED')),
    CONSTRAINT ck_daily_logs_closed_state CHECK (
        (status = 'OPEN' AND closed_at IS NULL)
        OR (status = 'CLOSED' AND closed_at IS NOT NULL)
    )
);

CREATE INDEX ix_daily_logs_user_date ON daily_logs (user_id, log_date DESC);

CREATE TABLE daily_log_state_events (
    id UUID PRIMARY KEY,
    daily_log_id UUID NOT NULL REFERENCES daily_logs (id) ON DELETE CASCADE,
    event_type VARCHAR(16) NOT NULL,
    event_order INTEGER NOT NULL,
    fasting_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    actor_user_id UUID NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
    occurred_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_daily_log_state_events_type CHECK (event_type IN ('CREATED', 'CLOSED', 'REOPENED')),
    CONSTRAINT uq_daily_log_state_events_order UNIQUE (daily_log_id, event_order),
    CONSTRAINT ck_daily_log_state_events_order CHECK (event_order >= 0),
    CONSTRAINT ck_daily_log_state_events_fasting CHECK (
        fasting_confirmed = FALSE OR event_type = 'CLOSED'
    )
);

CREATE INDEX ix_daily_log_state_events_log_time
    ON daily_log_state_events (daily_log_id, event_order);

CREATE TABLE meals (
    id UUID PRIMARY KEY,
    daily_log_id UUID NOT NULL REFERENCES daily_logs (id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    position INTEGER NOT NULL,
    meal_time TIME,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_meals_name CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
    CONSTRAINT ck_meals_position CHECK (position >= 0)
);

CREATE INDEX ix_meals_log_position ON meals (daily_log_id, position, created_at);

CREATE TABLE meal_items (
    id UUID PRIMARY KEY,
    meal_id UUID NOT NULL REFERENCES meals (id) ON DELETE CASCADE,
    catalog_item_type VARCHAR(16) NOT NULL,
    catalog_item_version_id UUID NOT NULL,
    serving_option_id UUID,
    position INTEGER NOT NULL,
    quantity NUMERIC(14, 3) NOT NULL,
    quantity_unit VARCHAR(24) NOT NULL,
    equivalent_basis_quantity NUMERIC(14, 3) NOT NULL,
    basis_quantity NUMERIC(14, 3) NOT NULL,
    base_unit VARCHAR(24) NOT NULL,
    conversion_factor NUMERIC(18, 8) NOT NULL,
    snapshot_name VARCHAR(160) NOT NULL,
    snapshot_kcal NUMERIC(14, 3) NOT NULL,
    snapshot_protein_g NUMERIC(14, 3) NOT NULL,
    snapshot_carbohydrate_g NUMERIC(14, 3) NOT NULL,
    snapshot_fat_g NUMERIC(14, 3) NOT NULL,
    snapshot_fiber_g NUMERIC(14, 3) NOT NULL,
    snapshot_sodium_mg NUMERIC(14, 3),
    data_quality VARCHAR(24) NOT NULL,
    uncertainty_kcal NUMERIC(14, 3),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_meal_items_position CHECK (position >= 0),
    CONSTRAINT ck_meal_items_catalog_type CHECK (catalog_item_type IN ('FOOD', 'RECIPE')),
    CONSTRAINT ck_meal_items_quantity CHECK (quantity > 0),
    CONSTRAINT ck_meal_items_equivalent_basis_quantity CHECK (equivalent_basis_quantity > 0),
    CONSTRAINT ck_meal_items_basis_quantity CHECK (basis_quantity > 0),
    CONSTRAINT ck_meal_items_conversion CHECK (conversion_factor > 0),
    CONSTRAINT ck_meal_items_snapshot_name CHECK (char_length(btrim(snapshot_name)) BETWEEN 1 AND 160),
    CONSTRAINT ck_meal_items_nutrients CHECK (
        snapshot_kcal >= 0
        AND snapshot_protein_g >= 0
        AND snapshot_carbohydrate_g >= 0
        AND snapshot_fat_g >= 0
        AND snapshot_fiber_g >= 0
        AND (snapshot_sodium_mg IS NULL OR snapshot_sodium_mg >= 0)
    ),
    CONSTRAINT ck_meal_items_quality CHECK (data_quality IN ('EXACT', 'ESTIMATED', 'HIGHLY_ESTIMATED')),
    CONSTRAINT ck_meal_items_uncertainty CHECK (uncertainty_kcal IS NULL OR uncertainty_kcal >= 0)
);

CREATE INDEX ix_meal_items_meal_position ON meal_items (meal_id, position, created_at);
CREATE INDEX ix_meal_items_catalog_version ON meal_items (catalog_item_version_id);

CREATE TABLE water_logs (
    id UUID PRIMARY KEY,
    daily_log_id UUID NOT NULL REFERENCES daily_logs (id) ON DELETE CASCADE,
    logged_at TIMESTAMPTZ NOT NULL,
    volume_ml NUMERIC(12, 3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_water_logs_volume CHECK (volume_ml > 0)
);

CREATE INDEX ix_water_logs_log_time ON water_logs (daily_log_id, logged_at);

CREATE TABLE diary_idempotency_keys (
    user_id UUID NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    operation VARCHAR(32) NOT NULL,
    log_date DATE NOT NULL,
    payload_fingerprint VARCHAR(64) NOT NULL,
    resource_id UUID,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, request_id),
    CONSTRAINT ck_diary_idempotency_operation CHECK (operation IN (
        'ADD_MEAL', 'ADD_ITEM', 'ADD_WATER', 'COPY_MEAL', 'COPY_DAY'
    )),
    CONSTRAINT ck_diary_idempotency_fingerprint CHECK (
        payload_fingerprint ~ '^[0-9a-f]{64}$'
    )
);

CREATE INDEX ix_diary_idempotency_created_at ON diary_idempotency_keys (created_at);
