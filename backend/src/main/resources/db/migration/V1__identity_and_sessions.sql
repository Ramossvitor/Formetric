CREATE TABLE user_accounts (
    id UUID PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_user_accounts_email UNIQUE (email),
    CONSTRAINT ck_user_accounts_email_normalized CHECK (email = lower(btrim(email))),
    CONSTRAINT ck_user_accounts_role CHECK (role IN ('OWNER', 'USER')),
    CONSTRAINT ck_user_accounts_status CHECK (status IN ('ACTIVE', 'DISABLED'))
);

CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES user_accounts (id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    locale VARCHAR(35) NOT NULL DEFAULT 'pt-BR',
    time_zone VARCHAR(63) NOT NULL DEFAULT 'America/Sao_Paulo',
    unit_system VARCHAR(16) NOT NULL DEFAULT 'METRIC',
    birth_date DATE,
    formula_sex VARCHAR(16),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_user_profiles_display_name CHECK (char_length(display_name) BETWEEN 2 AND 100),
    CONSTRAINT ck_user_profiles_unit_system CHECK (unit_system IN ('METRIC', 'IMPERIAL')),
    CONSTRAINT ck_user_profiles_formula_sex CHECK (formula_sex IS NULL OR formula_sex IN ('MALE', 'FEMALE'))
);

CREATE TABLE user_invites (
    id UUID PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    role VARCHAR(16) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES user_accounts (id),
    accepted_by UUID REFERENCES user_accounts (id),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_user_invites_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_user_invites_email_normalized CHECK (email = lower(btrim(email))),
    CONSTRAINT ck_user_invites_role CHECK (role IN ('OWNER', 'USER')),
    CONSTRAINT ck_user_invites_acceptance CHECK (
        (accepted_at IS NULL AND accepted_by IS NULL)
        OR (accepted_at IS NOT NULL AND accepted_by IS NOT NULL)
    )
);

CREATE INDEX ix_user_invites_email ON user_invites (email);
CREATE INDEX ix_user_invites_open ON user_invites (expires_at) WHERE accepted_at IS NULL;

CREATE TABLE SPRING_SESSION (
    PRIMARY_ID CHAR(36) NOT NULL,
    SESSION_ID CHAR(36) NOT NULL,
    CREATION_TIME BIGINT NOT NULL,
    LAST_ACCESS_TIME BIGINT NOT NULL,
    MAX_INACTIVE_INTERVAL INTEGER NOT NULL,
    EXPIRY_TIME BIGINT NOT NULL,
    PRINCIPAL_NAME VARCHAR(320),
    CONSTRAINT SPRING_SESSION_PK PRIMARY KEY (PRIMARY_ID)
);

CREATE UNIQUE INDEX SPRING_SESSION_IX1 ON SPRING_SESSION (SESSION_ID);
CREATE INDEX SPRING_SESSION_IX2 ON SPRING_SESSION (EXPIRY_TIME);
CREATE INDEX SPRING_SESSION_IX3 ON SPRING_SESSION (PRINCIPAL_NAME);

CREATE TABLE SPRING_SESSION_ATTRIBUTES (
    SESSION_PRIMARY_ID CHAR(36) NOT NULL,
    ATTRIBUTE_NAME VARCHAR(200) NOT NULL,
    ATTRIBUTE_BYTES BYTEA NOT NULL,
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_PK PRIMARY KEY (SESSION_PRIMARY_ID, ATTRIBUTE_NAME),
    CONSTRAINT SPRING_SESSION_ATTRIBUTES_FK FOREIGN KEY (SESSION_PRIMARY_ID)
        REFERENCES SPRING_SESSION (PRIMARY_ID) ON DELETE CASCADE
);
