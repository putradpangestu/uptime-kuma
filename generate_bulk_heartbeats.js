#!/usr/bin/env node

/**
 * Script to generate 7 months of dummy heartbeat data for all monitors
 * Usage: node generate_bulk_heartbeats.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function generateBulkHeartbeats() {
    const dbPath = path.join(__dirname, 'data/v1/kuma.db');
    
    console.log('🔍 Getting monitor list...');
    
    // Get all monitor IDs
    const monitorResult = execSync(`sqlite3 "${dbPath}" "SELECT id FROM monitor ORDER BY id;"`, { 
        encoding: 'utf8',
        stdio: 'pipe'
    });
    
    const monitorIds = monitorResult.trim().split('\n').filter(id => id).map(id => parseInt(id));
    console.log(`📊 Found ${monitorIds.length} monitors to process`);
    
    // Process monitors in batches to avoid memory issues
    const batchSize = 10;
    const totalBatches = Math.ceil(monitorIds.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * batchSize;
        const endIdx = Math.min(startIdx + batchSize, monitorIds.length);
        const batchMonitors = monitorIds.slice(startIdx, endIdx);
        
        console.log(`🚀 Processing batch ${batchIndex + 1}/${totalBatches} (monitors ${startIdx + 1}-${endIdx})`);
        
        const tempSqlFile = path.join(__dirname, `temp_heartbeats_batch_${batchIndex}.sql`);
        
        let sql = `-- Batch ${batchIndex + 1}: Generating heartbeats for monitors ${batchMonitors.join(', ')}\n`;
        
        for (const monitorId of batchMonitors) {
            sql += generateHeartbeatsForMonitor(monitorId);
        }
        
        try {
            // Write SQL to temp file
            fs.writeFileSync(tempSqlFile, sql);
            
            // Execute SQL using sqlite3 CLI with timeout and retry logic
            const startTime = Date.now();
            let retries = 3;
            let success = false;
            
            while (retries > 0 && !success) {
                try {
                    execSync(`sqlite3 "${dbPath}" ".timeout 30000" < "${tempSqlFile}"`, { 
                        encoding: 'utf8',
                        stdio: 'pipe',
                        timeout: 120000 // 2 minute timeout
                    });
                    success = true;
                } catch (error) {
                    retries--;
                    if (error.message.includes('database is locked') && retries > 0) {
                        console.log(`⏳ Database locked, waiting 5s before retry (${retries} attempts left)...`);
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    } else {
                        throw error;
                    }
                }
            }
            
            const duration = Date.now() - startTime;
            console.log(`✅ Batch ${batchIndex + 1} completed in ${Math.round(duration/1000)}s`);
            
            // Clean up temp file
            fs.unlinkSync(tempSqlFile);
            
            // Add delay between batches to prevent locking
            if (batchIndex < totalBatches - 1) {
                console.log('⏳ Waiting 2s before next batch...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
        } catch (error) {
            console.error(`❌ Error processing batch ${batchIndex + 1}:`, error.message);
            
            // Clean up temp file on error
            if (fs.existsSync(tempSqlFile)) {
                fs.unlinkSync(tempSqlFile);
            }
            
            process.exit(1);
        }
    }
    
    // Final statistics
    console.log('\n📈 Generating final statistics...');
    const finalStats = execSync(`sqlite3 "${dbPath}" "SELECT COUNT(*) as total_heartbeats FROM heartbeat; SELECT COUNT(DISTINCT monitor_id) as monitors_with_data FROM heartbeat;"`, { 
        encoding: 'utf8',
        stdio: 'pipe'
    });
    
    console.log('🎉 Bulk heartbeat generation completed!');
    console.log('📊 Final statistics:');
    console.log(finalStats);
}

function generateHeartbeatsForMonitor(monitorId) {
    // Generate different uptime patterns for variety
    const patterns = [
        { uptime: 98, description: 'Excellent' },
        { uptime: 95, description: 'Good' },
        { uptime: 92, description: 'Average' },
        { uptime: 88, description: 'Poor' }
    ];
    
    const pattern = patterns[monitorId % patterns.length];
    
    return `
-- Monitor ${monitorId}: ${pattern.description} uptime pattern (${pattern.uptime}%)
WITH RECURSIVE date_series_${monitorId} AS (
  SELECT datetime('now', '-7 months') as time_point, 0 as counter
  UNION ALL
  SELECT 
    datetime(time_point, '+1 minute') as time_point,
    counter + 1
  FROM date_series_${monitorId}
  WHERE counter < (7 * 30 * 24 * 60) -- 7 months * 30 days * 24 hours * 60 minutes
)
INSERT INTO heartbeat (monitor_id, status, time, ping, duration, important, msg)
SELECT 
  ${monitorId} as monitor_id,
  CASE 
    WHEN (ABS(RANDOM()) % 100) < ${pattern.uptime} THEN 1  -- UP
    ELSE 0  -- DOWN
  END as status,
  time_point as time,
  CASE 
    WHEN (ABS(RANDOM()) % 100) < ${pattern.uptime} THEN (30 + ABS(RANDOM()) % 300)  -- 30-330ms ping when UP
    ELSE NULL  -- No ping when DOWN
  END as ping,
  60 as duration,  -- 1 minute = 60 seconds
  CASE 
    WHEN (ABS(RANDOM()) % 100) < 2 THEN 1  -- 2% marked as important
    ELSE 0
  END as important,
  CASE 
    WHEN (ABS(RANDOM()) % 100) < ${pattern.uptime} THEN 'OK'
    ELSE 'Connection timeout'
  END as msg
FROM date_series_${monitorId}
WHERE counter < (7 * 30 * 24 * 60)
AND time_point < datetime('now', '-1 hour'); -- Don't overlap with current time

`;
}

// Main execution
async function main() {
    console.log('🎯 Bulk Heartbeat Generator');
    console.log('Generating 7 months of dummy heartbeat data for all monitors...\n');

    const startTime = Date.now();
    await generateBulkHeartbeats();
    const totalTime = Date.now() - startTime;

    console.log(`\n⏱️  Total execution time: ${Math.round(totalTime / 1000)}s`);
    console.log('🚀 Ready to test custom time range performance!');
}

main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
});
