#!/usr/bin/env node

/**
 * Script to add monitors to Uptime Kuma database using sqlite3 CLI
 * Usage: node add_monitor.js --name "Monitor Name" --url "https://example.com" --type http --interval 60
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        name: null,
        url: null,
        type: 'http',
        interval: 60,
        hostname: null,
        port: null,
        active: true,
        user_id: 1,
        weight: 2000,
        maxretries: 0,
        timeout: 48,
        method: 'GET'
    };

    for (let i = 0; i < args.length; i += 2) {
        const key = args[i].replace('--', '');
        const value = args[i + 1];
        
        if (key in config) {
            // Convert boolean and number types
            if (key === 'active') {
                config[key] = value.toLowerCase() === 'true';
            } else if (['interval', 'port', 'user_id', 'weight', 'maxretries', 'timeout'].includes(key)) {
                config[key] = parseInt(value);
            } else {
                config[key] = value;
            }
        }
    }

    return config;
}

// Extract hostname and port from URL
function parseUrl(url, type) {
    if (!url) return { hostname: null, port: null };
    
    try {
        const urlObj = new URL(url);
        return {
            hostname: urlObj.hostname,
            port: urlObj.port ? parseInt(urlObj.port) : (urlObj.protocol === 'https:' ? 443 : 80)
        };
    } catch (e) {
        if (type === 'ping' || type === 'port') {
            // For ping/port monitors, URL might just be hostname:port
            const parts = url.split(':');
            return {
                hostname: parts[0],
                port: parts[1] ? parseInt(parts[1]) : null
            };
        }
        return { hostname: url, port: null };
    }
}

// Add monitor to database using sqlite3 CLI
function addMonitor(config) {
    const dbPath = path.join(__dirname, 'data/v1/kuma.db');
    
    // Parse URL for hostname/port if not provided
    if (!config.hostname && config.url) {
        const parsed = parseUrl(config.url, config.type);
        config.hostname = parsed.hostname;
        if (!config.port) config.port = parsed.port;
    }

    // Create temporary SQL file
    const tempSqlFile = path.join(__dirname, 'temp_monitor.sql');
    
    const sql = `
INSERT INTO monitor (
    name, active, user_id, interval, url, type, weight, 
    hostname, port, created_date, maxretries, timeout, method,
    accepted_statuscodes_json
) VALUES (
    '${config.name.replace(/'/g, "''")}',
    ${config.active ? 1 : 0},
    ${config.user_id},
    ${config.interval},
    ${config.url ? `'${config.url.replace(/'/g, "''")}'` : 'NULL'},
    '${config.type}',
    ${config.weight},
    ${config.hostname ? `'${config.hostname.replace(/'/g, "''")}'` : 'NULL'},
    ${config.port || 'NULL'},
    datetime('now'),
    ${config.maxretries},
    ${config.timeout},
    '${config.method}',
    '["200-299"]'
);

SELECT 'Monitor added successfully!' as result;
SELECT id, name, type, url, hostname, port, interval, active 
FROM monitor 
WHERE created_date >= datetime('now', '-1 minute')
ORDER BY id DESC
LIMIT 1;
`;

    try {
        // Write SQL to temp file
        fs.writeFileSync(tempSqlFile, sql);
        
        // Execute SQL using sqlite3 CLI
        const result = execSync(`sqlite3 "${dbPath}" < "${tempSqlFile}"`, { 
            encoding: 'utf8',
            stdio: 'pipe'
        });
        
        console.log(`✅ Monitor added successfully!`);
        console.log(`   Name: ${config.name}`);
        console.log(`   Type: ${config.type}`);
        console.log(`   URL: ${config.url || 'N/A'}`);
        console.log(`   Interval: ${config.interval}s`);
        console.log(`   Hostname: ${config.hostname || 'N/A'}`);
        console.log(`   Port: ${config.port || 'N/A'}`);
        
        // Clean up temp file
        fs.unlinkSync(tempSqlFile);
        
    } catch (error) {
        console.error('❌ Error adding monitor:', error.message);
        
        // Clean up temp file on error
        if (fs.existsSync(tempSqlFile)) {
            fs.unlinkSync(tempSqlFile);
        }
        
        process.exit(1);
    }
}

// Validate required fields
function validateConfig(config) {
    if (!config.name) {
        console.error('❌ Error: --name is required');
        showUsage();
        process.exit(1);
    }

    if (['http', 'https', 'keyword', 'json-query'].includes(config.type) && !config.url) {
        console.error(`❌ Error: --url is required for ${config.type} monitors`);
        process.exit(1);
    }

    if (config.type === 'port' && (!config.hostname || !config.port)) {
        console.error('❌ Error: --hostname and --port are required for port monitors');
        process.exit(1);
    }
}

// Show usage information
function showUsage() {
    console.log(`
Usage: node add_monitor.js [options]

Required:
  --name          Monitor name (string)

Optional:
  --url           Monitor URL (string)
  --type          Monitor type (default: http)
                  Options: http, https, port, ping, keyword, json-query, dns, push
  --interval      Check interval in seconds (default: 60)
  --hostname      Hostname (auto-extracted from URL if not provided)
  --port          Port number (auto-extracted from URL if not provided)
  --active        Active status (default: true)
  --user_id       User ID (default: 1)
  --timeout       Timeout in seconds (default: 48)
  --method        HTTP method (default: GET)

Examples:
  # Add HTTP monitor
  node add_monitor.js --name "Google" --url "https://google.com" --interval 30

  # Add port monitor
  node add_monitor.js --name "SSH Server" --type port --hostname "192.168.1.1" --port 22

  # Add ping monitor
  node add_monitor.js --name "Router" --type ping --hostname "192.168.1.1" --interval 120
    `);
}

// Main execution
function main() {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        showUsage();
        return;
    }

    const config = parseArgs();
    validateConfig(config);
    addMonitor(config);
}

main();
