package com.assbi.repository;

import com.assbi.model.CrossingEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface CrossingEventRepository extends JpaRepository<CrossingEvent, Long> {

    // Count by direction + type in time range
    @Query("""
        SELECT e.objectType, e.direction, COUNT(e)
        FROM CrossingEvent e
        WHERE e.timestamp BETWEEN :from AND :to
        GROUP BY e.objectType, e.direction
        ORDER BY e.objectType, e.direction
        """)
    List<Object[]> countByTypeAndDirectionBetween(
            @Param("from") Instant from,
            @Param("to") Instant to);

    // Hourly breakdown for a date range
    @Query(value = """
        SELECT DATE_TRUNC('hour', timestamp) AS hour,
               object_type, direction, COUNT(*) AS total
        FROM crossing_events
        WHERE timestamp BETWEEN :from AND :to
        GROUP BY hour, object_type, direction
        ORDER BY hour
        """, nativeQuery = true)
    List<Object[]> hourlyBreakdown(
            @Param("from") Instant from,
            @Param("to") Instant to);


}
