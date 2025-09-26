#!/usr/bin/env node

/**
 * Script to remove all existing monitors and keep only 50
 * Usage: node cleanup_monitors.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function cleanupMonitors() {
    const dbPath = path.join(__dirname, 'data/v1/kuma.db');
    const tempSqlFile = path.join(__dirname, 'temp_cleanup.sql');
    
    let sql = `
-- First, get current monitor count
SELECT 'Current monitors before cleanup:' as info;
SELECT COUNT(*) as total_monitors FROM monitor;

-- Delete all heartbeat data first (foreign key constraint)
DELETE FROM heartbeat;

-- Delete all monitors
DELETE FROM monitor;

-- Reset auto-increment counter
DELETE FROM sqlite_sequence WHERE name='monitor';

-- Verify cleanup
SELECT 'Monitors after cleanup:' as info;
SELECT COUNT(*) as total_monitors FROM monitor;
SELECT 'Successfully cleaned up all monitors and heartbeat data!' as result;
`;

    try {
        console.log('🧹 Cleaning up existing monitors...');
        
        // Write SQL to temp file
        fs.writeFileSync(tempSqlFile, sql);
        
        // Execute SQL using sqlite3 CLI
        const result = execSync(`sqlite3 "${dbPath}" < "${tempSqlFile}"`, { 
            encoding: 'utf8',
            stdio: 'pipe'
        });
        
        console.log('✅ Successfully removed all existing monitors and heartbeat data!');
        console.log('📊 Database is now clean and ready for new monitors');
        
        // Clean up temp file
        fs.unlinkSync(tempSqlFile);
        
        // Now create 50 new monitors
        console.log('\n🚀 Creating 50 new monitors...');
        execSync('node create_200_monitors.js', { stdio: 'inherit' });
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error.message);
        
        // Clean up temp file on error
        if (fs.existsSync(tempSqlFile)) {
            fs.unlinkSync(tempSqlFile);
        }
        
        process.exit(1);
    }
}

// Main execution
console.log('🎯 Monitor Cleanup & Recreation');
console.log('Removing all existing monitors and creating 50 new ones...\n');

cleanupMonitors();
