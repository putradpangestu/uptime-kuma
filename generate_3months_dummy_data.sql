-- Generate dummy heartbeat data for monitor_id 1 starting from 3 months ago
-- This creates realistic uptime data with occasional downtime

WITH RECURSIVE date_series AS (
  -- Start from 3 months ago
  SELECT datetime('now', '-3 months') as time_point, 0 as counter
  UNION ALL
  SELECT 
    datetime(time_point, '+5 minutes') as time_point,
    counter + 1
  FROM date_series 
  WHERE counter < (3 * 30 * 24 * 12) -- 3 months * 30 days * 24 hours * 12 (5-min intervals)
)
INSERT INTO heartbeat (monitor_id, status, time, ping, duration, important, msg)
SELECT 
  1 as monitor_id,
  CASE 
    -- 96% uptime: occasional downtime
    WHEN (ABS(RANDOM()) % 100) < 96 THEN 1  -- UP
    ELSE 0  -- DOWN
  END as status,
  time_point as time,
  CASE 
    WHEN (ABS(RANDOM()) % 100) < 96 THEN (45 + ABS(RANDOM()) % 180)  -- 45-225ms ping when UP
    ELSE NULL  -- No ping when DOWN
  END as ping,
  300 as duration,  -- 5 minutes = 300 seconds
  CASE 
    WHEN (ABS(RANDOM()) % 100) < 3 THEN 1  -- 3% marked as important
    ELSE 0
  END as important,
  CASE 
    WHEN (ABS(RANDOM()) % 100) < 96 THEN 'OK'
    ELSE 'Connection timeout'
  END as msg
FROM date_series
WHERE counter < (3 * 30 * 24 * 12);
