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
}
