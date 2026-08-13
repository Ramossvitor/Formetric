CREATE TABLE workouts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    modality VARCHAR(24) NOT NULL,
    custom_modality VARCHAR(80),
    title VARCHAR(120) NOT NULL,
    start_time TIME,
    duration_minutes INTEGER NOT NULL,
    estimated_kcal NUMERIC(12, 3),
    notes VARCHAR(2000),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_workouts_modality CHECK (modality IN (
        'STRENGTH', 'RUNNING', 'WALKING', 'SOCCER', 'BEACH_TENNIS', 'CYCLING', 'OTHER'
    )),
    CONSTRAINT ck_workouts_custom_modality CHECK (
        (modality = 'OTHER' AND custom_modality IS NOT NULL
            AND char_length(btrim(custom_modality)) BETWEEN 1 AND 80)
        OR (modality <> 'OTHER' AND custom_modality IS NULL)
    ),
    CONSTRAINT ck_workouts_title CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
    CONSTRAINT ck_workouts_duration CHECK (duration_minutes BETWEEN 1 AND 1440),
    CONSTRAINT ck_workouts_estimated_kcal CHECK (
        estimated_kcal IS NULL OR estimated_kcal BETWEEN 0 AND 100000
    ),
    CONSTRAINT ck_workouts_notes CHECK (notes IS NULL OR char_length(notes) <= 2000)
);

CREATE INDEX ix_workouts_user_date
    ON workouts (user_id, activity_date DESC, start_time, id);

CREATE TABLE workout_muscle_groups (
    workout_id UUID NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    muscle_group VARCHAR(50) NOT NULL,
    PRIMARY KEY (workout_id, position),
    CONSTRAINT uq_workout_muscle_group UNIQUE (workout_id, muscle_group),
    CONSTRAINT ck_workout_muscle_group_position CHECK (position >= 0),
    CONSTRAINT ck_workout_muscle_group_name CHECK (
        char_length(btrim(muscle_group)) BETWEEN 1 AND 50
    )
);

CREATE TABLE workout_idempotency_keys (
    user_id UUID NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    payload_fingerprint VARCHAR(64) NOT NULL,
    resource_id UUID REFERENCES workouts (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, request_id),
    CONSTRAINT ck_workout_idempotency_fingerprint CHECK (
        payload_fingerprint ~ '^[0-9a-f]{64}$'
    )
);

CREATE INDEX ix_workout_idempotency_created_at
    ON workout_idempotency_keys (created_at);

CREATE TABLE weight_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
    measurement_date DATE NOT NULL,
    weight_kg NUMERIC(7, 3) NOT NULL,
    measured_at TIME NOT NULL,
    measurement_condition VARCHAR(120),
    notes VARCHAR(2000),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_weight_logs_user_date UNIQUE (user_id, measurement_date),
    CONSTRAINT ck_weight_logs_weight CHECK (weight_kg > 0 AND weight_kg <= 1000),
    CONSTRAINT ck_weight_logs_condition CHECK (
        measurement_condition IS NULL OR char_length(btrim(measurement_condition)) BETWEEN 1 AND 120
    ),
    CONSTRAINT ck_weight_logs_notes CHECK (notes IS NULL OR char_length(notes) <= 2000)
);

CREATE INDEX ix_weight_logs_user_date
    ON weight_logs (user_id, measurement_date DESC);
