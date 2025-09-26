-- Advanced optimization tests
.timer ON

-- Test 1: Current query
SELECT 'Current Query' as test;
SELECT
    SUM(CASE WHEN duration > 2592000 THEN 2592000 ELSE duration END) AS total_duration,
    SUM(CASE WHEN (status = 1 OR status = 3) THEN CASE WHEN duration > 2592000 THEN 2592000 ELSE duration END ELSE 0 END) AS uptime_duration
FROM heartbeat
WHERE time >= '2025-08-15 00:00:00' AND time <= '2025-09-14 23:59:59' AND monitor_id = 1;

-- Test 2: Pre-filter with subquery (reduce CASE evaluations)
SELECT 'Subquery Filter' as test;
SELECT
    SUM(CASE WHEN duration > 2592000 THEN 2592000 ELSE duration END) AS total_duration,
    SUM(CASE WHEN status IN (1,3) THEN CASE WHEN duration > 2592000 THEN 2592000 ELSE duration END ELSE 0 END) AS uptime_duration
FROM heartbeat
WHERE time >= '2025-08-15 00:00:00' AND time <= '2025-09-14 23:59:59' AND monitor_id = 1;

-- Test 3: Use MIN() instead of CASE (potentially faster)
SELECT 'MIN Function' as test;
SELECT
    SUM(MIN(duration, 2592000)) AS total_duration,
    SUM(CASE WHEN status IN (1,3) THEN MIN(duration, 2592000) ELSE 0 END) AS uptime_duration
FROM heartbeat
WHERE time >= '2025-08-15 00:00:00' AND time <= '2025-09-14 23:59:59' AND monitor_id = 1;

-- Test 4: Separate queries (might be faster due to simpler execution plan)
SELECT 'Separate Queries - Total' as test;
SELECT SUM(MIN(duration, 2592000)) AS total_duration
FROM heartbeat
WHERE time >= '2025-08-15 00:00:00' AND time <= '2025-09-14 23:59:59' AND monitor_id = 1;

SELECT 'Separate Queries - Uptime' as test;
SELECT SUM(MIN(duration, 2592000)) AS uptime_duration
FROM heartbeat
WHERE time >= '2025-08-15 00:00:00' AND time <= '2025-09-14 23:59:59' AND monitor_id = 1 AND status IN (1,3);

-- Test 5: Count-based approach (if duration is always 300)
SELECT 'Count-based' as test;
SELECT
    COUNT(*) * 300 AS total_duration,
    COUNT(CASE WHEN status IN (1,3) THEN 1 END) * 300 AS uptime_duration
FROM heartbeat
WHERE time >= '2025-08-15 00:00:00' AND time <= '2025-09-14 23:59:59' AND monitor_id = 1;
