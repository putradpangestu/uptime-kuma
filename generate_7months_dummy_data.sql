-- Generate dummy heartbeat data for monitor_id 1 extending back to 7 months ago
-- This fills the gap between existing data and 7 months back

WITH RECURSIVE date_series AS (
  -- Start from 7 months ago and go up to 3 months ago (to fill the gap)
  SELECT datetime('now', '-7 months') as time_point, 0 as counter
  UNION ALL
  SELECT 
    datetime(time_point, '+5 minutes') as time_point,
    counter + 1
  FROM date_series 
  WHERE counter < (4 * 30 * 24 * 12) -- 4 months * 30 days * 24 hours * 12 (5-min intervals)
)
INSERT INTO heartbeat (monitor_id, status, time, ping, duration, important, msg)
SELECT 
  1 as monitor_id,
  CASE 
    -- 94% uptime: slightly more downtime in older data
    WHEN (ABS(RANDOM()) % 100) < 94 THEN 1  -- UP
    ELSE 0  -- DOWN
  END as status,
  time_point as time,
  CASE 
    WHEN (ABS(RANDOM()) % 100) < 94 THEN (60 + ABS(RANDOM()) % 200)  -- 60-260ms ping when UP
    ELSE NULL  -- No ping when DOWN
  END as ping,
  300 as duration,  -- 5 minutes = 300 seconds
  CASE 
    WHEN (ABS(RANDOM()) % 100) < 4 THEN 1  -- 4% marked as important
    ELSE 0
  END as important,
  CASE 
    WHEN (ABS(RANDOM()) % 100) < 94 THEN 'OK'
    ELSE 'Connection timeout'
  END as msg
FROM date_series
WHERE counter < (4 * 30 * 24 * 12)
AND time_point < datetime('now', '-3 months'); -- Don't overlap with existing data
