package dev.formetric.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "user_profiles")
class UserProfile {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(nullable = false, length = 35)
    private String locale;

    @Column(name = "time_zone", nullable = false, length = 63)
    private String timeZone;

    @Enumerated(EnumType.STRING)
    @Column(name = "unit_system", nullable = false, length = 16)
    private UnitSystem unitSystem;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "formula_sex", length = 16)
    private FormulaSex formulaSex;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserProfile() {
    }

    private UserProfile(UUID userId, String displayName, String locale, String timeZone, UnitSystem unitSystem, Instant now) {
        this.userId = userId;
        this.displayName = displayName;
        this.locale = locale;
        this.timeZone = timeZone;
        this.unitSystem = unitSystem;
        this.createdAt = now;
        this.updatedAt = now;
    }

    static UserProfile defaults(UUID userId, String displayName, Instant now) {
        return new UserProfile(userId, displayName, "pt-BR", "America/Sao_Paulo", UnitSystem.METRIC, now);
    }

    void update(
            String displayName,
            String locale,
            String timeZone,
            UnitSystem unitSystem,
            LocalDate birthDate,
            FormulaSex formulaSex,
            Instant now) {
        this.displayName = displayName;
        this.locale = locale;
        this.timeZone = timeZone;
        this.unitSystem = unitSystem;
        this.birthDate = birthDate;
        this.formulaSex = formulaSex;
        this.updatedAt = now;
    }

    UUID userId() {
        return userId;
    }

    String displayName() {
        return displayName;
    }

    String locale() {
        return locale;
    }

    String timeZone() {
        return timeZone;
    }

    UnitSystem unitSystem() {
        return unitSystem;
    }

    LocalDate birthDate() {
        return birthDate;
    }

    FormulaSex formulaSex() {
        return formulaSex;
    }
}
