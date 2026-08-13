package dev.formetric.diary;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "water_logs")
class WaterLog {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "daily_log_id", nullable = false)
    private DailyLog dailyLog;
    @Column(name = "logged_at", nullable = false) private Instant loggedAt;
    @Column(name = "volume_ml", nullable = false, precision = 12, scale = 3) private BigDecimal volumeMl;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    protected WaterLog() {}
    private WaterLog(DailyLog dailyLog, Instant loggedAt, BigDecimal volumeMl, Instant now) {
        this.id = UUID.randomUUID(); this.dailyLog = dailyLog; this.loggedAt = loggedAt;
        this.volumeMl = volumeMl; this.createdAt = now; this.updatedAt = now;
    }
    static WaterLog create(DailyLog dailyLog, Instant loggedAt, BigDecimal volumeMl, Instant now) {
        if (loggedAt == null) throw new DiaryValidationException("loggedAt", "O horário é obrigatório.");
        if (volumeMl == null || volumeMl.signum() <= 0) throw new DiaryValidationException("volumeMl", "O volume deve ser maior que zero.");
        return new WaterLog(dailyLog, loggedAt, volumeMl, now);
    }
    void update(Instant loggedAt, BigDecimal volumeMl, Instant now) {
        dailyLog.requireOpen();
        if (loggedAt == null) throw new DiaryValidationException("loggedAt", "O horário é obrigatório.");
        if (volumeMl == null || volumeMl.signum() <= 0) throw new DiaryValidationException("volumeMl", "O volume deve ser maior que zero.");
        this.loggedAt = loggedAt; this.volumeMl = volumeMl; this.updatedAt = now; dailyLog.touch(now);
    }
    UUID id() { return id; } Instant loggedAt() { return loggedAt; } BigDecimal volumeMl() { return volumeMl; }
}
