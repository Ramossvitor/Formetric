package dev.formetric.body;

import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface BodyEvaluationRepository extends JpaRepository<BodyEvaluation, UUID> {

    @Query(
            value = """
                    select evaluation from BodyEvaluation evaluation
                    join BodyEvaluationVersion currentVersion
                      on currentVersion.evaluation = evaluation
                     and currentVersion.versionNumber = evaluation.currentVersionNumber
                    where evaluation.userId = :userId
                      and currentVersion.assessmentDate between :from and :to
                      and (:includeAll = true or evaluation.archived = :archived)
                    order by currentVersion.assessmentDate desc, evaluation.updatedAt desc, evaluation.id
                    """,
            countQuery = """
                    select count(evaluation) from BodyEvaluation evaluation
                    join BodyEvaluationVersion currentVersion
                      on currentVersion.evaluation = evaluation
                     and currentVersion.versionNumber = evaluation.currentVersionNumber
                    where evaluation.userId = :userId
                      and currentVersion.assessmentDate between :from and :to
                      and (:includeAll = true or evaluation.archived = :archived)
                    """)
    Page<BodyEvaluation> findPage(
            @Param("userId") UUID userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("includeAll") boolean includeAll,
            @Param("archived") boolean archived,
            Pageable pageable);

    Optional<BodyEvaluation> findByIdAndUserId(UUID id, UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select evaluation from BodyEvaluation evaluation where evaluation.id = :id and evaluation.userId = :userId")
    Optional<BodyEvaluation> findOwnedByIdForUpdate(@Param("id") UUID id, @Param("userId") UUID userId);
}

interface BodyEvaluationVersionRepository extends JpaRepository<BodyEvaluationVersion, UUID> {

    @Query("""
            select version from BodyEvaluationVersion version
            join fetch version.evaluation evaluation
            where evaluation.id in :evaluationIds
              and version.versionNumber = evaluation.currentVersionNumber
            order by version.assessmentDate desc, evaluation.id
            """)
    List<BodyEvaluationVersion> findCurrentByEvaluationIds(
            @Param("evaluationIds") Collection<UUID> evaluationIds);

    @Query("""
            select version from BodyEvaluationVersion version
            join fetch version.evaluation evaluation
            where evaluation.id = :evaluationId and evaluation.userId = :userId
            order by version.versionNumber desc
            """)
    List<BodyEvaluationVersion> findAllOwnedVersions(
            @Param("evaluationId") UUID evaluationId,
            @Param("userId") UUID userId);

    @Query("""
            select version from BodyEvaluationVersion version
            join fetch version.evaluation evaluation
            where version.id = :versionId and evaluation.userId = :userId
            """)
    Optional<BodyEvaluationVersion> findOwnedVersion(
            @Param("versionId") UUID versionId,
            @Param("userId") UUID userId);

    @Query("""
            select version from BodyEvaluationVersion version
            join fetch version.evaluation evaluation
            where evaluation.userId = :userId
              and evaluation.archived = false
              and version.versionNumber = evaluation.currentVersionNumber
              and version.assessmentDate between :from and :to
            order by version.assessmentDate asc, evaluation.id
            """)
    List<BodyEvaluationVersion> findActiveCurrentInRange(
            @Param("userId") UUID userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);
}
