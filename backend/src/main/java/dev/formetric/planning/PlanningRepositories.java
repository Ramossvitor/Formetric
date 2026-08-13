package dev.formetric.planning;

import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface NutritionGoalPeriodRepository extends JpaRepository<NutritionGoalPeriod, UUID> {

    List<NutritionGoalPeriod> findAllByUserIdOrderByValidFromAsc(UUID userId);

    @Query("""
            select period from NutritionGoalPeriod period
            where period.userId = :userId
              and period.validFrom <= :date
              and (period.validTo is null or period.validTo > :date)
            """)
    Optional<NutritionGoalPeriod> findEffective(
            @Param("userId") UUID userId,
            @Param("date") LocalDate date);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select period from NutritionGoalPeriod period
            where period.userId = :userId
              and period.validTo is null
              and period.validFrom < :nextValidFrom
            """)
    Optional<NutritionGoalPeriod> findOpenPrecedingForUpdate(
            @Param("userId") UUID userId,
            @Param("nextValidFrom") LocalDate nextValidFrom);

    @Query("""
            select distinct period from NutritionGoalPeriod period
            left join fetch period.nutrientTargets
            where period.userId = :userId
              and period.validFrom <= :to
              and (period.validTo is null or period.validTo > :from)
            order by period.validFrom
            """)
    List<NutritionGoalPeriod> findOverlappingWithTargets(
            @Param("userId") UUID userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);
}

interface NutrientTargetRepository extends JpaRepository<NutrientTarget, UUID> {

    @Query("""
            select distinct target from NutrientTarget target
            left join fetch target.bands
            where target.goalPeriod in :periods
            """)
    List<NutrientTarget> fetchBandsForPeriods(
            @Param("periods") List<NutritionGoalPeriod> periods);
}

interface TdeePeriodRepository extends JpaRepository<TdeePeriod, UUID> {

    List<TdeePeriod> findAllByUserIdOrderByValidFromAsc(UUID userId);

    @Query("""
            select period from TdeePeriod period
            where period.userId = :userId
              and period.validFrom <= :date
              and (period.validTo is null or period.validTo > :date)
            """)
    Optional<TdeePeriod> findEffective(
            @Param("userId") UUID userId,
            @Param("date") LocalDate date);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select period from TdeePeriod period
            where period.userId = :userId
              and period.validTo is null
              and period.validFrom < :nextValidFrom
            """)
    Optional<TdeePeriod> findOpenPrecedingForUpdate(
            @Param("userId") UUID userId,
            @Param("nextValidFrom") LocalDate nextValidFrom);

    @Query("""
            select period from TdeePeriod period
            where period.userId = :userId
              and period.validFrom <= :to
              and (period.validTo is null or period.validTo > :from)
            order by period.validFrom
            """)
    List<TdeePeriod> findOverlapping(
            @Param("userId") UUID userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);
}
