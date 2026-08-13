package dev.formetric.diary;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "daily_logs")
class DailyLog {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "log_date", nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DailyLogStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Version
    @Column(nullable = false)
    private long version;

    @OneToMany(mappedBy = "dailyLog", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC, createdAt ASC")
    private List<Meal> meals = new ArrayList<>();

    @OneToMany(mappedBy = "dailyLog", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("loggedAt ASC")
    private List<WaterLog> waterLogs = new ArrayList<>();

    @OneToMany(mappedBy = "dailyLog", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<DailyLogStateEvent> stateEvents = new ArrayList<>();

    protected DailyLog() {
    }

    private DailyLog(UUID id, UUID userId, LocalDate date, Instant now) {
        this.id = id;
        this.userId = userId;
        this.date = date;
        this.status = DailyLogStatus.OPEN;
        this.createdAt = now;
        this.updatedAt = now;
        this.stateEvents.add(DailyLogStateEvent.created(this, userId, now));
    }

    static DailyLog create(UUID userId, LocalDate date, Instant now) {
        return new DailyLog(UUID.randomUUID(), userId, date, now);
    }

    void requireOpen() {
        if (status == DailyLogStatus.CLOSED) {
            throw new DiaryConflictException("O diário está fechado. Reabra o dia antes de alterá-lo.");
        }
    }

    Meal addMeal(String name, int position, LocalTime mealTime, Instant now) {
        requireOpen();
        Meal meal = Meal.create(this, name, position, mealTime, now);
        meals.add(meal);
        touch(now);
        return meal;
    }

    Meal copyMeal(Meal source, Instant now) {
        requireOpen();
        Meal copy = source.copyTo(this, nextMealPosition(), now);
        meals.add(copy);
        touch(now);
        return copy;
    }

    WaterLog addWater(Instant loggedAt, BigDecimal volumeMl, Instant now) {
        requireOpen();
        WaterLog water = WaterLog.create(this, loggedAt, volumeMl, now);
        waterLogs.add(water);
        touch(now);
        return water;
    }

    void close(boolean fastingConfirmed, Instant now) {
        requireOpen();
        boolean hasFood = meals.stream().anyMatch(meal -> !meal.items().isEmpty());
        if (hasFood && fastingConfirmed) {
            throw new DiaryValidationException(
                    "fastingConfirmed", "Um dia com alimentos registrados não pode ser confirmado como jejum.");
        }
        boolean hasTrackedData = !waterLogs.isEmpty() || hasFood;
        if (!hasTrackedData && !fastingConfirmed) {
            throw new DiaryValidationException(
                    "fastingConfirmed", "Confirme explicitamente o jejum para fechar um dia sem alimentos.");
        }
        status = DailyLogStatus.CLOSED;
        closedAt = now;
        touch(now);
        stateEvents.add(DailyLogStateEvent.closed(this, userId, stateEvents.size(), fastingConfirmed, now));
    }

    void reopen(Instant now) {
        if (status == DailyLogStatus.OPEN) {
            throw new DiaryConflictException("O diário já está aberto.");
        }
        status = DailyLogStatus.OPEN;
        closedAt = null;
        touch(now);
        stateEvents.add(DailyLogStateEvent.reopened(this, userId, stateEvents.size(), now));
    }

    void removeMeal(Meal meal, Instant now) {
        requireOpen();
        meals.remove(meal);
        touch(now);
    }

    void removeWater(WaterLog water, Instant now) {
        requireOpen();
        waterLogs.remove(water);
        touch(now);
    }

    void reorderMeals(List<UUID> mealIds, Instant now) {
        requireOpen();
        if (mealIds.size() != meals.size()
                || !mealIds.containsAll(meals.stream().map(Meal::id).toList())) {
            throw new DiaryValidationException("mealIds", "Informe todas as refeições do dia, sem repetições.");
        }
        if (mealIds.stream().distinct().count() != mealIds.size()) {
            throw new DiaryValidationException("mealIds", "As refeições não podem se repetir.");
        }
        for (int position = 0; position < mealIds.size(); position++) {
            mealById(mealIds.get(position)).reposition(position, now);
        }
        meals.sort(Comparator.comparingInt(Meal::position));
        touch(now);
    }

    Meal mealById(UUID mealId) {
        return meals.stream()
                .filter(meal -> meal.id().equals(mealId))
                .findFirst()
                .orElseThrow(() -> new DiaryNotFoundException("Refeição não encontrada neste diário."));
    }

    WaterLog waterById(UUID waterId) {
        return waterLogs.stream()
                .filter(water -> water.id().equals(waterId))
                .findFirst()
                .orElseThrow(() -> new DiaryNotFoundException("Registro de água não encontrado neste diário."));
    }

    int nextMealPosition() {
        return meals.stream().mapToInt(Meal::position).max().orElse(-1) + 1;
    }

    void touch(Instant now) {
        updatedAt = now;
    }

    UUID id() { return id; }
    UUID userId() { return userId; }
    LocalDate date() { return date; }
    DailyLogStatus status() { return status; }
    Instant createdAt() { return createdAt; }
    Instant updatedAt() { return updatedAt; }
    Instant closedAt() { return closedAt; }
    List<Meal> meals() { return List.copyOf(meals); }
    List<WaterLog> waterLogs() { return List.copyOf(waterLogs); }
    List<DailyLogStateEvent> stateEvents() { return List.copyOf(stateEvents); }
}

@Entity
@Table(name = "daily_log_state_events")
class DailyLogStateEvent {
    enum EventType { CREATED, CLOSED, REOPENED }

    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "daily_log_id", nullable = false)
    private DailyLog dailyLog;
    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 16)
    private EventType eventType;
    @Column(name = "event_order", nullable = false)
    private int position;
    @Column(name = "fasting_confirmed", nullable = false)
    private boolean fastingConfirmed;
    @Column(name = "actor_user_id", nullable = false)
    private UUID actorUserId;
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected DailyLogStateEvent() {}
    private DailyLogStateEvent(
            UUID id, DailyLog dailyLog, EventType eventType, int position,
            boolean fastingConfirmed, UUID actorUserId, Instant at) {
        this.id = id;
        this.dailyLog = dailyLog;
        this.eventType = eventType;
        this.position = position;
        this.fastingConfirmed = fastingConfirmed;
        this.actorUserId = actorUserId;
        this.occurredAt = at;
    }
    static DailyLogStateEvent created(DailyLog log, UUID actor, Instant at) {
        return new DailyLogStateEvent(UUID.randomUUID(), log, EventType.CREATED, 0, false, actor, at);
    }
    static DailyLogStateEvent closed(DailyLog log, UUID actor, int position, boolean fasting, Instant at) {
        return new DailyLogStateEvent(UUID.randomUUID(), log, EventType.CLOSED, position, fasting, actor, at);
    }
    static DailyLogStateEvent reopened(DailyLog log, UUID actor, int position, Instant at) {
        return new DailyLogStateEvent(UUID.randomUUID(), log, EventType.REOPENED, position, false, actor, at);
    }
    EventType eventType() { return eventType; }
    boolean fastingConfirmed() { return fastingConfirmed; }
    UUID actorUserId() { return actorUserId; }
    Instant occurredAt() { return occurredAt; }
}
