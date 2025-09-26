-- SQL script to add monitors directly to Uptime Kuma database
-- Usage: sqlite3 /path/to/kuma.db < add_monitor.sql

-- Example monitors - modify as needed

-- HTTP Monitor
INSERT INTO monitor (
    name, active, user_id, interval, url, type, weight,
    hostname, port, created_date, maxretries, timeout, method,
    accepted_statuscodes_json
) VALUES (
    'Example Website',           -- name
    1,                          -- active (1=true, 0=false)
    1,                          -- user_id
    60,                         -- interval (seconds)
    'https://example.com',      -- url
    'http',                     -- type
    2000,                       -- weight
    'example.com',              -- hostname
    443,                        -- port
    datetime('now'),            -- created_date
    0,                          -- maxretries
    48,                         -- timeout
    'GET',                      -- method
    '["200-299"]'               -- accepted_statuscodes_json
);

-- Port Monitor
INSERT INTO monitor (
    name, active, user_id, interval, type, weight,
    hostname, port, created_date, maxretries, timeout
) VALUES (
    'SSH Server',               -- name
    1,                          -- active
    1,                          -- user_id
    120,                        -- interval (seconds)
    'port',                     -- type
    2000,                       -- weight
    '192.168.1.1',              -- hostname
    22,                         -- port
    datetime('now'),            -- created_date
    0,                          -- maxretries
    48                          -- timeout
);

-- Ping Monitor
INSERT INTO monitor (
    name, active, user_id, interval, type, weight,
    hostname, created_date, maxretries, timeout
) VALUES (
    'Router Ping',              -- name
    1,                          -- active
    1,                          -- user_id
    60,                         -- interval (seconds)
    'ping',                     -- type
    2000,                       -- weight
    '192.168.1.1',              -- hostname
    datetime('now'),            -- created_date
    0,                          -- maxretries
    48                          -- timeout
);

-- DNS Monitor
INSERT INTO monitor (
    name, active, user_id, interval, type, weight,
    hostname, created_date, maxretries, timeout,
    dns_resolve_type, dns_resolve_server
) VALUES (
    'DNS Check',                -- name
    1,                          -- active
    1,                          -- user_id
    300,                        -- interval (seconds)
    'dns',                      -- type
    2000,                       -- weight
    'google.com',               -- hostname
    datetime('now'),            -- created_date
    0,                          -- maxretries
    48,                         -- timeout
    'A',                        -- dns_resolve_type
    '8.8.8.8'                   -- dns_resolve_server
);

-- Show added monitors
SELECT 'Added Monitors:' as result;
SELECT id, name, type, url, hostname, port, interval, active 
FROM monitor 
WHERE created_date >= datetime('now', '-1 minute')
ORDER BY id;
