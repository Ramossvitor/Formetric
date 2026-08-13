CREATE TABLE body_evaluations (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_accounts (id) ON DELETE CASCADE,
    current_version_number INTEGER NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_body_evaluations_current_version CHECK (current_version_number > 0)
);

CREATE INDEX ix_body_evaluations_user_archived
    ON body_evaluations (user_id, archived, updated_at DESC, id);

CREATE TABLE body_evaluation_versions (
    id UUID PRIMARY KEY,
    evaluation_id UUID NOT NULL REFERENCES body_evaluations (id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    assessment_date DATE NOT NULL,
    title VARCHAR(160) NOT NULL,
    source VARCHAR(24) NOT NULL,
    assessor_name VARCHAR(160),
    notes VARCHAR(2000),
    weight_kg NUMERIC(7, 3),
    height_cm NUMERIC(7, 3),
    age_years INTEGER,
    formula_sex VARCHAR(16),
    composition_protocol VARCHAR(48) NOT NULL,
    protocol_revision INTEGER,
    reported_method_type VARCHAR(24) NOT NULL,
    reported_method_label VARCHAR(160),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_body_evaluation_versions_number UNIQUE (evaluation_id, version_number),
    CONSTRAINT uq_body_evaluation_versions_id_evaluation UNIQUE (id, evaluation_id),
    CONSTRAINT ck_body_evaluation_versions_number CHECK (version_number > 0),
    CONSTRAINT ck_body_evaluation_versions_title CHECK (
        char_length(btrim(title)) BETWEEN 1 AND 160
    ),
    CONSTRAINT ck_body_evaluation_versions_source CHECK (
        source IN ('SELF', 'PROFESSIONAL', 'IMPORT_CONFIRMED')
    ),
    CONSTRAINT ck_body_evaluation_versions_assessor CHECK (
        assessor_name IS NULL OR char_length(btrim(assessor_name)) BETWEEN 1 AND 160
    ),
    CONSTRAINT ck_body_evaluation_versions_notes CHECK (
        notes IS NULL OR char_length(notes) <= 2000
    ),
    CONSTRAINT ck_body_evaluation_versions_weight CHECK (
        weight_kg IS NULL OR weight_kg > 0 AND weight_kg <= 1000
    ),
    CONSTRAINT ck_body_evaluation_versions_height CHECK (
        height_cm IS NULL OR height_cm >= 30 AND height_cm <= 300
    ),
    CONSTRAINT ck_body_evaluation_versions_age CHECK (
        age_years IS NULL OR age_years BETWEEN 0 AND 130
    ),
    CONSTRAINT ck_body_evaluation_versions_formula_sex CHECK (
        formula_sex IS NULL OR formula_sex IN ('MALE', 'FEMALE')
    ),
    CONSTRAINT ck_body_evaluation_versions_protocol CHECK (
        composition_protocol IN ('NONE', 'JACKSON_POLLOCK_7_SIRI_1961')
    ),
    CONSTRAINT ck_body_evaluation_versions_protocol_revision CHECK (
        (composition_protocol = 'NONE' AND protocol_revision IS NULL)
        OR (composition_protocol = 'JACKSON_POLLOCK_7_SIRI_1961' AND protocol_revision = 1)
    ),
    CONSTRAINT ck_body_evaluation_versions_reported_method CHECK (
        reported_method_type IN ('UNSPECIFIED', 'SKINFOLD', 'BIOIMPEDANCE', 'DXA', 'OTHER')
    ),
    CONSTRAINT ck_body_evaluation_versions_reported_label CHECK (
        (reported_method_type <> 'OTHER'
            AND (reported_method_label IS NULL OR char_length(btrim(reported_method_label)) BETWEEN 1 AND 160))
        OR (reported_method_type = 'OTHER'
            AND reported_method_label IS NOT NULL
            AND char_length(btrim(reported_method_label)) BETWEEN 1 AND 160)
    )
);

CREATE INDEX ix_body_evaluation_versions_evaluation
    ON body_evaluation_versions (evaluation_id, version_number DESC);
CREATE INDEX ix_body_evaluation_versions_assessment_date
    ON body_evaluation_versions (assessment_date DESC, evaluation_id);

ALTER TABLE body_evaluations
    ADD CONSTRAINT fk_body_evaluations_current_version
    FOREIGN KEY (id, current_version_number)
    REFERENCES body_evaluation_versions (evaluation_id, version_number)
    DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE body_circumferences (
    id UUID PRIMARY KEY,
    evaluation_version_id UUID NOT NULL REFERENCES body_evaluation_versions (id) ON DELETE CASCADE,
    site VARCHAR(24) NOT NULL,
    value_cm NUMERIC(8, 3) NOT NULL,
    CONSTRAINT uq_body_circumferences_site UNIQUE (evaluation_version_id, site),
    CONSTRAINT ck_body_circumferences_site CHECK (site IN (
        'NECK', 'SHOULDERS', 'CHEST', 'ABDOMEN', 'WAIST', 'HIP',
        'LEFT_ARM', 'RIGHT_ARM', 'LEFT_THIGH', 'RIGHT_THIGH', 'LEFT_CALF', 'RIGHT_CALF'
    )),
    CONSTRAINT ck_body_circumferences_value CHECK (value_cm > 0 AND value_cm <= 1000)
);

CREATE INDEX ix_body_circumferences_version
    ON body_circumferences (evaluation_version_id, site);

CREATE TABLE body_skinfolds (
    id UUID PRIMARY KEY,
    evaluation_version_id UUID NOT NULL REFERENCES body_evaluation_versions (id) ON DELETE CASCADE,
    site VARCHAR(24) NOT NULL,
    side VARCHAR(16) NOT NULL,
    value_mm NUMERIC(8, 3) NOT NULL,
    CONSTRAINT uq_body_skinfolds_site UNIQUE (evaluation_version_id, site),
    CONSTRAINT ck_body_skinfolds_site CHECK (site IN (
        'CHEST', 'MIDAXILLARY', 'TRICEPS', 'SUBSCAPULAR', 'ABDOMEN', 'SUPRAILIAC', 'THIGH'
    )),
    CONSTRAINT ck_body_skinfolds_side CHECK (side IN ('RIGHT', 'LEFT', 'UNSPECIFIED')),
    CONSTRAINT ck_body_skinfolds_value CHECK (value_mm > 0 AND value_mm <= 200)
);

CREATE INDEX ix_body_skinfolds_version
    ON body_skinfolds (evaluation_version_id, site);

CREATE TABLE body_composition_results (
    id UUID PRIMARY KEY,
    evaluation_version_id UUID NOT NULL REFERENCES body_evaluation_versions (id) ON DELETE CASCADE,
    metric VARCHAR(48) NOT NULL,
    value NUMERIC(18, 8) NOT NULL,
    provenance VARCHAR(40) NOT NULL,
    method_code VARCHAR(80) NOT NULL,
    method_revision INTEGER NOT NULL,
    reported_label VARCHAR(160),
    basis_result_id UUID,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_body_results_id_version UNIQUE (id, evaluation_version_id),
    CONSTRAINT uq_body_results_metric_provenance UNIQUE (
        evaluation_version_id, metric, provenance
    ),
    CONSTRAINT ck_body_results_metric CHECK (metric IN (
        'BMI', 'WAIST_HIP_RATIO', 'CIRCUMFERENCE_SUM_CM', 'SKINFOLD_SUM_MM',
        'BODY_DENSITY_G_PER_ML', 'BODY_FAT_PERCENT', 'FAT_MASS_KG',
        'FAT_FREE_MASS_PERCENT', 'FAT_FREE_MASS_KG', 'LEAN_BODY_MASS_KG',
        'LEAN_SOFT_TISSUE_MASS_KG', 'SKELETAL_MUSCLE_MASS_KG', 'UNSPECIFIED_LEAN_MASS_KG'
    )),
    CONSTRAINT ck_body_results_provenance CHECK (provenance IN (
        'REPORTED', 'SYSTEM_CALCULATED', 'SYSTEM_DERIVED_FROM_REPORTED'
    )),
    CONSTRAINT ck_body_results_method CHECK (
        char_length(btrim(method_code)) BETWEEN 1 AND 80 AND method_revision > 0
    ),
    CONSTRAINT ck_body_results_reported_label CHECK (
        reported_label IS NULL OR char_length(btrim(reported_label)) BETWEEN 1 AND 160
    ),
    CONSTRAINT ck_body_results_basis CHECK (
        (provenance = 'SYSTEM_DERIVED_FROM_REPORTED' AND basis_result_id IS NOT NULL)
        OR (provenance <> 'SYSTEM_DERIVED_FROM_REPORTED' AND basis_result_id IS NULL)
    ),
    CONSTRAINT fk_body_results_basis_same_version
        FOREIGN KEY (basis_result_id, evaluation_version_id)
        REFERENCES body_composition_results (id, evaluation_version_id)
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX ix_body_results_version
    ON body_composition_results (evaluation_version_id, metric, provenance);

COMMENT ON TABLE body_evaluation_versions IS
    'Append-only snapshots. Corrections create a complete new version and never rewrite history.';
COMMENT ON TABLE body_composition_results IS
    'Reported, calculated and reported-derived results coexist with explicit provenance and method revision.';
