package dev.formetric.body;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "body_evaluations")
class BodyEvaluation {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "current_version_number", nullable = false)
    private int currentVersionNumber;

    @Column(nullable = false)
    private boolean archived;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    @OneToMany(mappedBy = "evaluation", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("versionNumber DESC")
    private List<BodyEvaluationVersion> versions = new ArrayList<>();

    protected BodyEvaluation() {
    }

    private BodyEvaluation(UUID userId, Instant now) {
        this.id = UUID.randomUUID();
        this.userId = userId;
        this.currentVersionNumber = 1;
        this.archived = false;
        this.createdAt = now;
        this.updatedAt = now;
    }

    static BodyEvaluation create(UUID userId, Instant now) {
        return new BodyEvaluation(userId, now);
    }

    void addInitialVersion(BodyEvaluationVersion evaluationVersion) {
        if (!versions.isEmpty() || evaluationVersion.versionNumber() != 1) {
            throw new BodyConflictException("A primeira versão da avaliação deve ser a versão 1.");
        }
        versions.add(evaluationVersion);
    }

    void addVersion(BodyEvaluationVersion evaluationVersion, int expectedCurrentVersionNumber, Instant now) {
        if (archived) {
            throw new BodyConflictException("Restaure a avaliação antes de criar uma nova versão.");
        }
        if (currentVersionNumber != expectedCurrentVersionNumber) {
            throw new BodyConflictException(
                    "A avaliação foi alterada por outra operação. Atualize os dados e tente novamente.");
        }
        int nextVersionNumber = currentVersionNumber + 1;
        if (evaluationVersion.versionNumber() != nextVersionNumber) {
            throw new BodyConflictException("A nova versão não segue a sequência esperada.");
        }
        versions.add(evaluationVersion);
        currentVersionNumber = nextVersionNumber;
        updatedAt = now;
    }

    void setArchived(boolean archived, long expectedIdentityVersion, Instant now) {
        if (version != expectedIdentityVersion) {
            throw new BodyConflictException(
                    "A avaliação foi alterada por outra operação. Atualize os dados e tente novamente.");
        }
        if (this.archived == archived) {
            return;
        }
        this.archived = archived;
        this.updatedAt = now;
    }

    UUID id() { return id; }
    UUID userId() { return userId; }
    int currentVersionNumber() { return currentVersionNumber; }
    boolean archived() { return archived; }
    Instant createdAt() { return createdAt; }
    Instant updatedAt() { return updatedAt; }
    long identityVersion() { return version; }
    List<BodyEvaluationVersion> versions() { return List.copyOf(versions); }
}
