-- Verify calculation correctness: Original vs MIN() approach
-- Test with a small time window where duration trimming matters

.timer ON

-- Test case: 1-hour window (3600 seconds) where some durations exceed the window
SELECT 'Original JULIANDAY Logic (simulated)' as test;
SELECT
    SUM(
        CASE
            WHEN (JULIANDAY(`time`) - JULIANDAY('2025-09-14 12:00:00')) * 86400 < duration
            THEN (JULIANDAY(`time`) - JULIANDAY('2025-09-14 12:00:00')) * 86400
            ELSE duration
        END
    ) AS total_duration,
    SUM(
        CASE
            WHEN (status = 1 OR status = 3)
            THEN
                CASE
                    WHEN (JULIANDAY(`time`) - JULIANDAY('2025-09-14 12:00:00')) * 86400 < duration
                        THEN (JULIANDAY(`time`) - JULIANDAY('2025-09-14 12:00:00')) * 86400
                    ELSE duration
                END
            END
    ) AS uptime_duration
FROM heartbeat
WHERE time >= '2025-09-14 12:00:00' AND time <= '2025-09-14 13:00:00'
AND monitor_id = 1;

SELECT 'Current MIN() Logic' as test;
SELECT
    SUM(MIN(duration, 3600)) AS total_duration,
    SUM(CASE WHEN status IN (1,3) THEN MIN(duration, 3600) ELSE 0 END) AS uptime_duration
FROM heartbeat
WHERE time >= '2025-09-14 12:00:00' AND time <= '2025-09-14 13:00:00' AND monitor_id = 1;

-- Show actual data to understand the difference
SELECT 'Sample Data' as test;
SELECT time, status, duration, 
       (JULIANDAY(time) - JULIANDAY('2025-09-14 12:00:00')) * 86400 as seconds_from_start,
       MIN(duration, 3600) as capped_duration
FROM heartbeat
WHERE time >= '2025-09-14 12:00:00' AND time <= '2025-09-14 13:00:00' AND monitor_id = 1
ORDER BY time
LIMIT 5;
