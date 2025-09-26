const express = require("express");
const { R } = require("redbean-node");
const { allowDevAllOrigin } = require("../util-server");

let router = express.Router();

// Helper function to calculate time range like TimeRangeSelector.vue
function calculateTimeRange(range) {
    const now = new Date();
    let from;
    
    if (range.endsWith("m")) {
        // minutes
        const amount = parseInt(range);
        from = new Date(now.getTime() - amount * 60 * 1000);
    } else if (range.endsWith("h")) {
        const hours = parseInt(range);
        from = new Date(now.getTime() - hours * 60 * 60 * 1000);
    } else if (range.endsWith("d")) {
        const days = parseInt(range);
        from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    } else {
        // Default to 24h
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    return { from, to: now };
}

// Helper function to calculate uptime for a time range using same logic as dashboard
async function calculateUptime(monitorId, fromTime, toTime) {
    // Convert timestamps to UTC format for database query
    const startTimeUTC = fromTime.toISOString().slice(0, 19).replace('T', ' ');
    const endTimeUTC = toTime.toISOString().slice(0, 19).replace('T', ' ');
    
    // Calculate time window in seconds
    const timeWindowSeconds = (toTime - fromTime) / 1000;
    
    // Use exact same query logic as dashboard getCustomRangeUptime
    let result = await R.getRow(`
        SELECT
            SUM(
                CASE
                    WHEN duration > ? THEN ?
                    ELSE duration
                END
            ) AS total_duration,
            SUM(
                CASE
                    WHEN status IN (1,3) THEN
                        CASE
                            WHEN duration > ? THEN ?
                            ELSE duration
                        END
                    ELSE 0
                END
            ) AS uptime_duration
        FROM heartbeat
        WHERE time >= ? AND time <= ? AND monitor_id = ?
    `, [
        timeWindowSeconds, timeWindowSeconds,
        timeWindowSeconds, timeWindowSeconds,
        startTimeUTC, endTimeUTC, monitorId
    ]);

    let totalDuration = result.total_duration || 0;
    let uptimeDuration = result.uptime_duration || 0;
    let uptime = 0;

    if (totalDuration > 0) {
        uptime = uptimeDuration / totalDuration;
        if (uptime < 0) {
            uptime = 0;
        }
    }

    return uptime * 100; // Convert to percentage
}

router.get("/summary", async (request, response) => {
    allowDevAllOrigin(response);
    
    try {
        // Get query parameters
        const timeRange = request.query.range || '24h';
        const selectedMonitors = request.query.monitors ? 
            (Array.isArray(request.query.monitors) ? request.query.monitors : request.query.monitors.split(',')) : [];
        const statusFilter = request.query.status || '';
        const typeFilter = request.query.type || '';
        
        // Get all monitors for selection
        const allMonitors = await R.getAll(`
            SELECT 
                m.id,
                m.name,
                m.type,
                m.url,
                m.hostname,
                m.port,
                m.active,
                m.interval
            FROM monitor m
            WHERE m.active = 1
            ORDER BY m.name
        `);

        // Process selected monitors and apply filters
        const monitorData = [];
        if (selectedMonitors.length > 0) {
            for (const monitor of allMonitors) {
                // Only process if monitor is selected
                if (!selectedMonitors.includes(monitor.id.toString())) {
                    continue;
                }
                
                const latest = await R.getRow(`
                    SELECT status, time, ping
                    FROM heartbeat 
                    WHERE monitor_id = ? 
                    ORDER BY time DESC 
                    LIMIT 1
                `, [monitor.id]);
                
                // Apply status filter
                const currentStatus = latest?.status || 0;
                if (statusFilter) {
                    if (statusFilter === 'up' && currentStatus !== 1) continue;
                    if (statusFilter === 'down' && currentStatus !== 0) continue;
                    if (statusFilter === 'unknown' && (currentStatus === 0 || currentStatus === 1)) continue;
                }
                
                // Apply type filter
                if (typeFilter && monitor.type !== typeFilter) {
                    continue;
                }
                
                // Calculate uptime for the selected time range
                const timeCalc = calculateTimeRange(timeRange);
                const uptime = await calculateUptime(monitor.id, timeCalc.from, timeCalc.to);
                
                monitorData.push({
                    ...monitor,
                    status: currentStatus,
                    ping: latest?.ping || null,
                    lastCheck: latest?.time || null,
                    uptime: uptime.toFixed(2),
                    totalChecks: 0
                });
            }
        }

        const onlineCount = monitorData.filter(m => m.status === 1).length;
        const offlineCount = monitorData.filter(m => m.status === 0).length;
        const unknownCount = monitorData.filter(m => m.status === null || (m.status !== 0 && m.status !== 1)).length;
        
        // Get unique monitor types for filter dropdown
        const monitorTypes = [...new Set(allMonitors.map(m => m.type))];
        
        // Format time range display
        const rangeLabels = {
            '5m': 'Last 5 minutes',
            '1h': 'Last 1 hour', 
            '24h': 'Last 24 hours',
            '7d': 'Last 7 days',
            '30d': 'Last 30 days',
            '180d': 'Last 180 days'
        };
        const timeRangeDisplay = rangeLabels[timeRange] || 'Last 24 hours';

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Uptime Kuma - Summary</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 20px;
            background: #f8f9fa;
        }
        .header {
            background: #5cdd8b;
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
        }
        .controls {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .control-row {
            display: flex;
            gap: 15px;
            margin-bottom: 15px;
            align-items: center;
            flex-wrap: wrap;
        }
        .control-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        .control-group label {
            font-weight: 600;
            color: #495057;
            font-size: 0.9em;
        }
        .form-control {
            padding: 8px 12px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
            text-decoration: none;
            display: inline-block;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #007bff;
            color: white;
        }
        .btn-primary:hover {
            background: #0056b3;
        }
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        .btn-secondary:hover {
            background: #545b62;
        }
        .btn-success {
            background: #28a745;
            color: white;
        }
        .btn-success:hover {
            background: #1e7e34;
        }
        .time-range-buttons {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }
        .range-btn {
            padding: 6px 12px;
            border: 1px solid #dee2e6;
            background: white;
            color: #495057;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85em;
            text-decoration: none;
            transition: all 0.2s;
        }
        .range-btn:hover {
            background: #f8f9fa;
            border-color: #adb5bd;
        }
        .range-btn.active {
            background: #5cdd8b;
            color: white;
            border-color: #5cdd8b;
        }
        .monitor-selector {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
        }
        .monitor-search {
            margin-bottom: 10px;
        }
        .monitor-search input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .monitor-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 12px;
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 15px;
            background: white;
        }
        .monitor-checkbox {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
            border: 1px solid transparent;
        }
        .monitor-checkbox:hover {
            background: #f8f9fa;
            border-color: #dee2e6;
        }
        .monitor-checkbox input[type="checkbox"] {
            margin: 0;
            transform: scale(1.1);
        }
        .monitor-checkbox label {
            cursor: pointer;
            font-size: 0.9em;
            margin: 0;
            flex: 1;
            line-height: 1.4;
        }
        .monitor-actions {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }
        .monitor-actions button {
            padding: 4px 8px;
            font-size: 0.8em;
        }
        .per-monitor-range {
            display: flex;
            gap: 5px;
            align-items: center;
        }
        .range-selector {
            padding: 2px 6px;
            border: 1px solid #dee2e6;
            border-radius: 3px;
            font-size: 0.75em;
            background: white;
        }
        .custom-range-inputs {
            display: flex;
            gap: 5px;
            align-items: center;
        }
        .custom-range-inputs input {
            padding: 2px 4px;
            border: 1px solid #ced4da;
            border-radius: 3px;
            font-size: 0.7em;
            width: 120px;
        }
        .custom-range-inputs button {
            padding: 2px 6px;
            font-size: 0.7em;
        }
        .stats {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .stat-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
            min-width: 120px;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #333;
        }
        .current-range {
            background: #e3f2fd;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            text-align: center;
            color: #1976d2;
            font-weight: 500;
        }
        table {
            width: 100%;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-collapse: collapse;
            overflow: hidden;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
        }
        .status-up { color: #28a745; font-weight: bold; }
        .status-down { color: #dc3545; font-weight: bold; }
        .status-unknown { color: #6c757d; font-weight: bold; }
        .uptime-good { color: #28a745; }
        .uptime-warning { color: #ffc107; }
        .uptime-bad { color: #dc3545; }
        .url-link { color: #007bff; text-decoration: none; }
        .url-link:hover { text-decoration: underline; }
        .no-results {
            text-align: center;
            padding: 40px;
            color: #6c757d;
        }
        @media (max-width: 768px) {
            .control-row {
                flex-direction: column;
                align-items: stretch;
            }
            .time-range-buttons {
                justify-content: center;
            }
            .custom-range {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Uptime Kuma - Summary</h1>
        <p>Advanced monitor overview with search, filters, and custom time ranges</p>
    </div>

    <div class="controls">
        <form method="GET" action="/summary" id="mainForm">
            <div class="control-row">
                <div class="control-group">
                    <label>📋 Select Monitors</label>
                    <div class="monitor-selector">
                        <div class="monitor-search">
                            <input type="text" id="monitorSearch" placeholder="🔍 Search monitors..." onkeyup="filterMonitors()">
                        </div>
                        <div class="monitor-grid" id="monitorGrid">
                            ${allMonitors.map(monitor => `
                                <div class="monitor-checkbox" data-name="${monitor.name.toLowerCase()}">
                                    <input type="checkbox" id="monitor_${monitor.id}" name="monitors" value="${monitor.id}" 
                                           ${selectedMonitors.includes(monitor.id.toString()) ? 'checked' : ''}>
                                    <label for="monitor_${monitor.id}">${monitor.name} (${monitor.type.toUpperCase()})</label>
                                </div>
                            `).join('')}
                        </div>
                        <div class="monitor-actions">
                            <button type="button" class="btn btn-secondary" onclick="selectAllMonitors()">Select All</button>
                            <button type="button" class="btn btn-secondary" onclick="clearAllMonitors()">Clear All</button>
                            <span id="selectedCount">${selectedMonitors.length} selected</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="control-row">
                <div class="control-group">
                    <label for="status">📊 Status Filter</label>
                    <select id="status" name="status" class="form-control">
                        <option value="">All Statuses</option>
                        <option value="up" ${statusFilter === 'up' ? 'selected' : ''}>🟢 Up</option>
                        <option value="down" ${statusFilter === 'down' ? 'selected' : ''}>🔴 Down</option>
                        <option value="unknown" ${statusFilter === 'unknown' ? 'selected' : ''}>⚪ Unknown</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <label for="type">🏷️ Type Filter</label>
                    <select id="type" name="type" class="form-control">
                        <option value="">All Types</option>
                        ${monitorTypes.map(type => 
                            `<option value="${type}" ${typeFilter === type ? 'selected' : ''}>${type.toUpperCase()}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="control-group">
                    <label>⏱️ Global Time Range</label>
                    <div class="time-range-buttons">
                        <a href="javascript:void(0)" onclick="setGlobalRange('5m')" 
                           class="range-btn ${timeRange === '5m' ? 'active' : ''}">5m</a>
                        <a href="javascript:void(0)" onclick="setGlobalRange('1h')" 
                           class="range-btn ${timeRange === '1h' ? 'active' : ''}">1h</a>
                        <a href="javascript:void(0)" onclick="setGlobalRange('24h')" 
                           class="range-btn ${timeRange === '24h' ? 'active' : ''}">24h</a>
                        <a href="javascript:void(0)" onclick="setGlobalRange('7d')" 
                           class="range-btn ${timeRange === '7d' ? 'active' : ''}">7d</a>
                        <a href="javascript:void(0)" onclick="setGlobalRange('30d')" 
                           class="range-btn ${timeRange === '30d' ? 'active' : ''}">30d</a>
                        <a href="javascript:void(0)" onclick="setGlobalRange('180d')" 
                           class="range-btn ${timeRange === '180d' ? 'active' : ''}">180d</a>
                    </div>
                    <input type="hidden" name="range" id="rangeInput" value="${timeRange}">
                </div>
                
                <div class="control-group">
                    <label>&nbsp;</label>
                    <button type="submit" class="btn btn-primary">Update View</button>
                </div>
            </div>
        </form>
        
        <div class="current-range">
            📊 Current Range: ${timeRangeDisplay} | Showing ${monitorData.length} monitors
        </div>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${monitorData.length}</div>
            <div>Filtered</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${onlineCount}</div>
            <div>Online</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${offlineCount}</div>
            <div>Offline</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${unknownCount}</div>
            <div>Unknown</div>
        </div>
    </div>

    ${monitorData.length === 0 ? `
        <div class="no-results">
            <h3>🔍 No monitors found</h3>
            <p>Try adjusting your search or filter criteria.</p>
            <a href="/summary" class="btn btn-primary">Clear All Filters</a>
        </div>
    ` : `
        <table class="monitor-table">
            <thead>
                <tr>
                    <th>Monitor</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Ping</th>
                    <th>Time Range & Uptime</th>
                    <th>Last Check</th>
                </tr>
            </thead>
            <tbody>
                ${monitorData.map(monitor => `
                    <tr>
                        <td class="monitor-name">
                            <strong>${monitor.name}</strong>
                            ${monitor.url ? `<br><small>${monitor.url}</small>` : ''}
                            ${monitor.hostname ? `<br><small>${monitor.hostname}${monitor.port ? ':' + monitor.port : ''}</small>` : ''}
                        </td>
                        <td><span class="badge">${monitor.type.toUpperCase()}</span></td>
                        <td>
                            ${monitor.status === 1 ? 
                                '<span class="status-badge status-up">🟢 UP</span>' : 
                                monitor.status === 0 ? 
                                '<span class="status-badge status-down">🔴 DOWN</span>' : 
                                '<span class="status-badge status-unknown">⚪ UNKNOWN</span>'
                            }
                        </td>
                        <td>${monitor.ping ? monitor.ping + 'ms' : 'N/A'}</td>
                        <td>
                            <div class="per-monitor-range">
                                <select class="range-selector" onchange="updateMonitorRange(${monitor.id}, this.value)">
                                    <option value="5m" ${timeRange === '5m' ? 'selected' : ''}>5m</option>
                                    <option value="1h" ${timeRange === '1h' ? 'selected' : ''}>1h</option>
                                    <option value="24h" ${timeRange === '24h' ? 'selected' : ''}>24h</option>
                                    <option value="7d" ${timeRange === '7d' ? 'selected' : ''}>7d</option>
                                    <option value="30d" ${timeRange === '30d' ? 'selected' : ''}>30d</option>
                                    <option value="180d" ${timeRange === '180d' ? 'selected' : ''}>180d</option>
                                    <option value="custom">Custom</option>
                                </select>
                                <span class="uptime-badge ${monitor.uptime >= 95 ? 'uptime-good' : monitor.uptime >= 80 ? 'uptime-warning' : 'uptime-bad'}" id="uptime_${monitor.id}">
                                    ${monitor.uptime}%
                                </span>
                            </div>
                            <div class="custom-range-inputs" id="custom_${monitor.id}" style="display: none; margin-top: 5px;">
                                <div style="display: flex; gap: 5px; align-items: center; margin-bottom: 3px;">
                                    <label style="font-size: 0.7em; min-width: 30px;">From:</label>
                                    <input type="date" id="from_date_${monitor.id}" style="width: 110px; font-size: 0.7em;">
                                    <input type="time" id="from_time_${monitor.id}" style="width: 80px; font-size: 0.7em;" step="1">
                                </div>
                                <div style="display: flex; gap: 5px; align-items: center; margin-bottom: 3px;">
                                    <label style="font-size: 0.7em; min-width: 30px;">To:</label>
                                    <input type="date" id="to_date_${monitor.id}" style="width: 110px; font-size: 0.7em;">
                                    <input type="time" id="to_time_${monitor.id}" style="width: 80px; font-size: 0.7em;" step="1">
                                </div>
                                <button type="button" class="btn btn-primary" onclick="applyCustomRange(${monitor.id})" style="font-size: 0.7em; padding: 2px 6px;">Apply</button>
                            </div>
                        </td>
                        <td>${monitor.lastCheck ? new Date(monitor.lastCheck).toLocaleString() : 'Never'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `}

    <div style="text-align: center; margin-top: 20px; color: #6c757d;">
        <p>Advanced summary with search, filters & custom time ranges • Updated: ${new Date().toLocaleString()}</p>
        <p>
            <a href="/dashboard" style="color: #007bff; margin-right: 15px;">← Back to Dashboard</a>
            <a href="/summary" style="color: #007bff;">🔄 Clear All Filters</a>
        </p>
    </div>

    <script>
        function filterMonitors() {
            const searchTerm = document.getElementById('monitorSearch').value.toLowerCase();
            const checkboxes = document.querySelectorAll('.monitor-checkbox');
            
            checkboxes.forEach(checkbox => {
                const name = checkbox.getAttribute('data-name');
                if (name.includes(searchTerm)) {
                    checkbox.style.display = 'flex';
                } else {
                    checkbox.style.display = 'none';
                }
            });
        }

        function selectAllMonitors() {
            const visibleCheckboxes = document.querySelectorAll('.monitor-checkbox:not([style*="display: none"]) input[name="monitors"]');
            visibleCheckboxes.forEach(cb => cb.checked = true);
            updateSelectedCount();
        }

        function clearAllMonitors() {
            const checkboxes = document.querySelectorAll('input[name="monitors"]');
            checkboxes.forEach(cb => cb.checked = false);
            updateSelectedCount();
        }

        function updateSelectedCount() {
            const selected = document.querySelectorAll('input[name="monitors"]:checked').length;
            document.getElementById('selectedCount').textContent = selected + ' selected';
        }

        function setGlobalRange(range) {
            document.getElementById('rangeInput').value = range;
            document.getElementById('mainForm').submit();
        }

        function updateMonitorRange(monitorId, range) {
            const customDiv = document.getElementById('custom_' + monitorId);
            if (range === 'custom') {
                customDiv.style.display = 'block';
            } else {
                customDiv.style.display = 'none';
                // Update uptime for this monitor with new range
                fetchMonitorUptime(monitorId, range);
            }
        }

        function applyCustomRange(monitorId) {
            const fromDate = document.getElementById('from_date_' + monitorId).value;
            const fromTime = document.getElementById('from_time_' + monitorId).value;
            const toDate = document.getElementById('to_date_' + monitorId).value;
            const toTime = document.getElementById('to_time_' + monitorId).value;
            
            if (fromDate && toDate) {
                const fromDateTime = fromDate + 'T' + (fromTime || '00:00:00');
                const toDateTime = toDate + 'T' + (toTime || '23:59:59');
                fetchCustomMonitorUptime(monitorId, fromDateTime, toDateTime);
            }
        }

        async function fetchMonitorUptime(monitorId, range) {
            try {
                const response = await fetch('/api/monitor-uptime?id=' + monitorId + '&range=' + range);
                const data = await response.json();
                const uptimeElement = document.getElementById('uptime_' + monitorId);
                uptimeElement.textContent = data.uptime.toFixed(2) + '%';
                uptimeElement.className = 'uptime-badge ' + (data.uptime >= 95 ? 'uptime-good' : data.uptime >= 80 ? 'uptime-warning' : 'uptime-bad');
            } catch (error) {
                console.error('Failed to fetch uptime:', error);
            }
        }

        async function fetchCustomMonitorUptime(monitorId, from, to) {
            try {
                const response = await fetch('/api/monitor-uptime?id=' + monitorId + '&from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
                const data = await response.json();
                const uptimeElement = document.getElementById('uptime_' + monitorId);
                uptimeElement.textContent = data.uptime.toFixed(2) + '%';
                uptimeElement.className = 'uptime-badge ' + (data.uptime >= 95 ? 'uptime-good' : data.uptime >= 80 ? 'uptime-warning' : 'uptime-bad');
            } catch (error) {
                console.error('Failed to fetch custom uptime:', error);
            }
        }

        // Update selected count on page load and checkbox changes
        document.addEventListener('DOMContentLoaded', function() {
            updateSelectedCount();
            document.querySelectorAll('input[name="monitors"]').forEach(cb => {
                cb.addEventListener('change', updateSelectedCount);
            });
        });
    </script>
</body>
</html>`;

        response.setHeader('Content-Type', 'text/html');
        response.send(html);

    } catch (error) {
        console.error('Summary page error:', error);
        response.status(500).send(`
            <html>
                <body style="font-family: sans-serif; padding: 20px;">
                    <h1>Error</h1>
                    <p>Failed to load summary: ${error.message}</p>
                    <a href="/dashboard">← Back to Dashboard</a>
                </body>
            </html>
        `);
    }
});

// API endpoint for individual monitor uptime calculation
router.get("/api/monitor-uptime", async (request, response) => {
    allowDevAllOrigin(response);
    
    try {
        const monitorId = request.query.id;
        const range = request.query.range;
        const customFrom = request.query.from;
        const customTo = request.query.to;
        
        if (!monitorId) {
            return response.status(400).json({ error: "Monitor ID required" });
        }
        
        let fromTime, toTime;
        if (customFrom && customTo) {
            fromTime = new Date(customFrom);
            toTime = new Date(customTo);
        } else if (range) {
            const timeCalc = calculateTimeRange(range);
            fromTime = timeCalc.from;
            toTime = timeCalc.to;
        } else {
            return response.status(400).json({ error: "Time range or custom dates required" });
        }
        
        const uptime = await calculateUptime(monitorId, fromTime, toTime);
        
        response.json({ uptime: uptime });
        
    } catch (error) {
        console.error('Monitor uptime API error:', error);
        response.status(500).json({ error: error.message });
    }
});

module.exports = router;
