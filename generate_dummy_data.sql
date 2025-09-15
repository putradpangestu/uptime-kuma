-- Create a test monitor first
INSERT INTO monitor (id, name, type, url, hostname, port, active, interval) 
VALUES (1, 'Test Monitor', 'http', 'https://example.com', 'example.com', 443, 1, 60);

-- Generate dummy heartbeat data for the last 7 months
-- This creates realistic uptime data with occasional downtime

WITH RECURSIVE date_series AS (
  -- Start from 7 months ago
  SELECT datetime('now', '-7 months') as time_point, 0 as counter
  UNION ALL
  SELECT 
    datetime(time_point, '+5 minutes') as time_point,
    counter + 1
  FROM date_series 
  WHERE counter < (7 * 30 * 24 * 12) -- 7 months * 30 days * 24 hours * 12 (5-min intervals)
)
INSERT INTO heartbeat (monitor_id, status, time, ping, duration, important, msg)
SELECT 
  1 as monitor_id,
  CASE 
    -- 95% uptime: occasional downtime
    WHEN (ABS(RANDOM()) % 100) < 95 THEN 1  -- UP
    ELSE 0  -- DOWN
  END as status,
  time_point as time,
  CASE 
    WHEN (ABS(RANDOM()) % 100) < 95 THEN (50 + ABS(RANDOM()) % 200)  -- 50-250ms ping when UP
    ELSE NULL  -- No ping when DOWN
  END as ping,
  300 as duration,  -- 5 minutes = 300 seconds
  CASE 
    WHEN (ABS(RANDOM()) % 100) < 5 THEN 1  -- 5% marked as important
    ELSE 0
  END as important,
  CASE 
    WHEN (ABS(RANDOM()) % 100) < 95 THEN 'OK'
    ELSE 'Connection timeout'
  END as msg
FROM date_series
WHERE counter < (7 * 30 * 24 * 12);
