package com.assbi.repository;

import com.assbi.model.DailySummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailySummaryRepository extends JpaRepository<DailySummary, Long> {

    List<DailySummary> findBySummaryDateBetweenOrderBySummaryDateAsc(
            LocalDate from, LocalDate to);

    Optional<DailySummary> findBySummaryDateAndCameraSourceAndObjectType(
            LocalDate date, String cameraSource, String objectType);

    @Query("""
        SELECT s.summaryDate, s.objectType,
               SUM(s.countIn), SUM(s.countOut)
        FROM DailySummary s
        WHERE s.summaryDate BETWEEN :from AND :to
        GROUP BY s.summaryDate, s.objectType
        ORDER BY s.summaryDate
        """)
    List<Object[]> aggregatedByDateAndType(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);
}
