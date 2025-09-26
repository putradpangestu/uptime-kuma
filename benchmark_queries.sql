-- Benchmark: Original JULIANDAY query vs Optimized query
-- Test with a 30-day range to get meaningful data

.timer ON

-- Original JULIANDAY-based query (simulated)
SELECT 'JULIANDAY Query Start' as test;

SELECT
    SUM(
        CASE
            WHEN (JULIANDAY(`time`) - JULIANDAY('2025-08-15 00:00:00')) * 86400 < duration
            THEN (JULIANDAY(`time`) - JULIANDAY('2025-08-15 00:00:00')) * 86400
            ELSE duration
        END
    ) AS total_duration,
    SUM(
        CASE
            WHEN (status = 1 OR status = 3)
            THEN
                CASE
                    WHEN (JULIANDAY(`time`) - JULIANDAY('2025-08-15 00:00:00')) * 86400 < duration
                        THEN (JULIANDAY(`time`) - JULIANDAY('2025-08-15 00:00:00')) * 86400
                    ELSE duration
                END
            END
    ) AS uptime_duration
FROM heartbeat
WHERE time >= '2025-08-15 00:00:00' AND time <= '2025-09-14 23:59:59'
AND monitor_id = 1;

SELECT 'JULIANDAY Query End' as test;

-- Optimized query (current implementation)
SELECT 'Optimized Query Start' as test;

SELECT
    SUM(
        CASE
            WHEN duration > 2592000 THEN 2592000  -- 30 days in seconds
            ELSE duration
        END
    ) AS total_duration,
    SUM(
        CASE
            WHEN (status = 1 OR status = 3) THEN
                CASE
                    WHEN duration > 2592000 THEN 2592000
                    ELSE duration
                END
            ELSE 0
        END
    ) AS uptime_duration
FROM heartbeat
WHERE time >= '2025-08-15 00:00:00' AND time <= '2025-09-14 23:59:59' AND monitor_id = 1;

SELECT 'Optimized Query End' as test;
