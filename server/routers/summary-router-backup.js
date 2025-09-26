const express = require("express");
const { R } = require("redbean-node");
const { allowDevAllOrigin } = require("../util-server");

let router = express.Router();

router.get("/summary", async (request, response) => {
    allowDevAllOrigin(response);
    
    try {
        const monitors = await R.getAll(`
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

        const monitorData = [];
        for (const monitor of monitors) {
            const latest = await R.getRow(`
                SELECT status, time, ping
                FROM heartbeat 
                WHERE monitor_id = ? 
                ORDER BY time DESC 
                LIMIT 1
            `, [monitor.id]);
            
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const heartbeats = await R.getAll(`
                SELECT status 
                FROM heartbeat 
                WHERE monitor_id = ? 
                AND time >= ?
                ORDER BY time ASC
            `, [monitor.id, yesterday.toISOString()]);
            
            let upCount = 0;
            heartbeats.forEach(hb => {
                if (hb.status === 1) upCount++;
            });
            
            const uptime = heartbeats.length > 0 ? ((upCount / heartbeats.length) * 100) : 0;
            
            monitorData.push({
                ...monitor,
                status: latest?.status || 0,
                ping: latest?.ping || null,
                lastCheck: latest?.time || null,
                uptime24h: uptime.toFixed(2),
                totalChecks: heartbeats.length
            });
        }

        const onlineCount = monitorData.filter(m => m.status === 1).length;
        const offlineCount = monitorData.filter(m => m.status === 0).length;
        const unknownCount = monitorData.filter(m => m.status === null || (m.status !== 0 && m.status !== 1)).length;
        
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
        .stats {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            justify-content: center;
        }
        .stat-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #333;
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
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Uptime Kuma - Summary</h1>
        <p>Server-side rendered monitor overview (Last 24 hours)</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${monitorData.length}</div>
            <div>Total Monitors</div>
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

    <table>
        <thead>
            <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Type</th>
                <th>URL/Target</th>
                <th>24h Uptime</th>
                <th>Ping</th>
                <th>Interval</th>
            </tr>
        </thead>
        <tbody>
            ${monitorData.map(monitor => {
                const statusClass = monitor.status === 1 ? 'status-up' : 
                                  monitor.status === 0 ? 'status-down' : 'status-unknown';
                const statusText = monitor.status === 1 ? 'UP' : 
                                 monitor.status === 0 ? 'DOWN' : 'Unknown';
                
                const uptimeClass = parseFloat(monitor.uptime24h) >= 95 ? 'uptime-good' :
                                  parseFloat(monitor.uptime24h) >= 80 ? 'uptime-warning' : 'uptime-bad';
                
                const displayUrl = monitor.url || (monitor.hostname && monitor.port ? `${monitor.hostname}:${monitor.port}` : monitor.hostname) || '-';
                
                return `
                <tr>
                    <td><strong>${monitor.name}</strong></td>
                    <td><span class="${statusClass}">${statusText}</span></td>
                    <td>${monitor.type.toUpperCase()}</td>
                    <td>
                        ${monitor.url ? 
                            `<a href="${monitor.url}" target="_blank" class="url-link">${displayUrl}</a>` : 
                            `<span class="url-link">${displayUrl}</span>`
                        }
                    </td>
                    <td><span class="${uptimeClass}">${monitor.uptime24h}%</span></td>
                    <td>${monitor.ping ? monitor.ping + 'ms' : '-'}</td>
                    <td>${monitor.interval}s</td>
                </tr>
                `;
            }).join('')}
        </tbody>
    </table>

    <div style="text-align: center; margin-top: 20px; color: #6c757d;">
        <p>Simple server-side summary • No JavaScript • No authentication required</p>
        <p><a href="/dashboard" style="color: #007bff;">← Back to Dashboard</a></p>
    </div>
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

module.exports = router;
        th {
            background: #343a40;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #dee2e6;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .status-up {
            color: #28a745;
            font-weight: bold;
        }
        .status-down {
            color: #dc3545;
            font-weight: bold;
        }
        .status-unknown {
            color: #6c757d;
            font-weight: bold;
        }
        .uptime-excellent { color: #28a745; }
        .uptime-good { color: #ffc107; }
        .uptime-poor { color: #dc3545; }
        .url-link {
            color: #007bff;
            text-decoration: none;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            display: inline-block;
        }
        .url-link:hover {
            text-decoration: underline;
        }
        .refresh-info {
            text-align: center;
            color: #6c757d;
            margin-top: 20px;
            font-size: 0.9em;
        }
        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            align-items: center;
        }
        .time-range-selector {
            display: flex;
            gap: 5px;
            align-items: center;
        }
        .range-button {
            padding: 8px 16px;
            border: 1px solid #dee2e6;
            background: white;
            color: #495057;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
            transition: all 0.2s;
        }
        .range-button:hover {
            background: #f8f9fa;
            border-color: #adb5bd;
        }
        .range-button.active {
            background: #5cdd8b;
            color: white;
            border-color: #5cdd8b;
        }
        .action-buttons {
            display: flex;
            gap: 10px;
            margin-left: auto;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-block;
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
        .time-range-selector {
            position: relative;
            display: inline-block;
            margin-bottom: 5px;
        }
        .uptime-value {
            text-align: center;
        }
        .time-range-btn {
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 0.8em;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
        }
        .time-range-btn:hover {
            background: #545b62;
        }
        .dropdown-arrow {
            font-size: 0.7em;
            transition: transform 0.2s;
        }
        .time-range-btn.open .dropdown-arrow {
            transform: rotate(180deg);
        }
        .time-range-dropdown {
            position: fixed !important;
            top: auto !important;
            right: 10px !important;
            background: white !important;
            border: 2px solid #007bff !important;
            border-radius: 8px !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3) !important;
            z-index: 99999 !important;
            width: 400px !important;
            margin-top: 4px !important;
            padding: 1rem !important;
            max-height: 400px !important;
            overflow-y: auto !important;
        }
        .custom-range-section {
            margin-bottom: 1rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #dee2e6;
        }
        .custom-range-section h4 {
            margin: 0 0 0.75rem 0;
            font-size: 0.875rem;
            color: #495057;
        }
        .date-inputs {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin-bottom: 0.75rem;
        }
        .date-input-group {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }
        .date-input-group label {
            font-size: 0.8rem;
            color: #6c757d;
            font-weight: 500;
        }
        .date-input {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 0.875rem;
        }
        .apply-custom-btn {
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            cursor: pointer;
            width: 100%;
        }
        .apply-custom-btn:hover {
            background: #0056b3;
        }
        .quick-ranges-section h4 {
            margin: 0 0 0.75rem 0;
            font-size: 0.875rem;
            color: #495057;
        }
        .quick-range-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.5rem;
        }
        .quick-range-btn {
            padding: 0.5rem 0.75rem;
            border: 1px solid #dee2e6;
            background: white;
            color: #495057;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.875rem;
            transition: all 0.2s;
        }
        .quick-range-btn:hover {
            background: #f8f9fa;
            border-color: #adb5bd;
        }
        .quick-range-btn.active {
            background: #5cdd8b;
            color: white;
            border-color: #5cdd8b;
        }
        .monitor-selector {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .search-container {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 15px;
        }
        .search-input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .select-all-btn {
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px 15px;
            cursor: pointer;
            font-size: 0.9em;
        }
        .select-all-btn:hover {
            background: #1e7e34;
        }
        .clear-all-btn {
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px 15px;
            cursor: pointer;
            font-size: 0.9em;
        }
        .clear-all-btn:hover {
            background: #c82333;
        }
        .monitor-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 10px;
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 10px;
        }
        .monitor-checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 5px;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        }
        .monitor-checkbox.hidden {
            display: none !important;
        }
        .monitor-checkbox:hover {
            background: #f8f9fa;
        }
        .monitor-checkbox input[type="checkbox"] {
            margin: 0;
        }
        .monitor-checkbox label {
            cursor: pointer;
            font-size: 0.9em;
            margin: 0;
        }
        .selected-count {
            color: #6c757d;
            font-size: 0.9em;
            margin-top: 10px;
        }
        .empty-state {
            text-align: center;
            padding: 40px;
            color: #6c757d;
        }
        .empty-state h3 {
            margin-bottom: 10px;
            color: #495057;
        }
    </style>
</head>
<body>
    <script src="/socket.io/socket.io.js"></script>
    <script>
        // Initialize socket connection immediately
        const socket = io();
        window.socket = socket;
        
        socket.on('connect', () => {
            console.log('Socket connected, time range functionality enabled');
            
            // Auto-login for summary page access
            const token = localStorage.getItem('token');
            if (token) {
                socket.emit('loginByToken', token, (res) => {
                    if (res.ok) {
                        console.log('Auto-login successful for summary page');
                    } else {
                        console.log('Auto-login failed, redirecting to login');
                        window.location.href = 'http://172.25.30.140:3000/';
                    }
                });
            } else {
                console.log('No token found, redirecting to login');
                window.location.href = 'http://172.25.30.140:3000/';
            }
        });
        
        socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });
    </script>
    
    <div class="header">
        <h1>🚀 Uptime Kuma - Summary</h1>
        <p>Lightweight monitor overview without auto-refresh</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-number" id="total-monitors">${monitors.length}</div>
            <div>Total Monitors</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="online-monitors">${monitors.filter(m => monitorStatuses[m.id]?.status === 1).length}</div>
            <div>Online</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="offline-monitors">${monitors.filter(m => monitorStatuses[m.id]?.status === 0).length}</div>
            <div>Offline</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="unknown-monitors">${monitors.filter(m => !monitorStatuses[m.id]?.status && monitorStatuses[m.id]?.status !== 0).length}</div>
            <div>Unknown</div>
        </div>
    </div>

    <div class="monitor-selector">
        <h3>📋 Select Monitors to Display</h3>
        <div class="search-container">
            <input type="text" class="search-input" placeholder="🔍 Search monitors..." id="monitor-search" oninput="filterMonitors()">
            <button class="select-all-btn" onclick="selectAllMonitors()">Select All</button>
            <button class="clear-all-btn" onclick="clearAllMonitors()">Clear All</button>
        </div>
        <div class="monitor-grid" id="monitor-grid">
            ${monitors.map(monitor => 
                '<div class="monitor-checkbox">' +
                    '<input type="checkbox" id="monitor-' + monitor.id + '" value="' + monitor.id + '" onchange="updateSelectedMonitors()">' +
                    '<label for="monitor-' + monitor.id + '">' + monitor.name + '</label>' +
                '</div>'
            ).join('')}
        </div>
        <div class="selected-count" id="selected-count">0 monitors selected</div>
    </div>

    <div class="controls">
        <div class="time-range-selector">
            <span>Time Range:</span>
            <button class="range-button active" onclick="changeTimeRange('24h')">24 Hours</button>
            <button class="range-button" onclick="changeTimeRange('7d')">7 Days</button>
            <button class="range-button" onclick="changeTimeRange('30d')">30 Days</button>
            <button class="range-button" onclick="changeTimeRange('180d')">180 Days</button>
        </div>
        <div class="action-buttons">
            <button class="btn btn-success" onclick="window.location.reload()">🔄 Refresh</button>
            <a href="/dashboard" class="btn btn-primary">📊 Full Dashboard</a>
            <a href="/status" class="btn btn-secondary">📋 Status Page</a>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Type</th>
                <th>URL/Target</th>
                <th>Uptime</th>
                <th>Ping</th>
                <th>Interval</th>
            </tr>
        </thead>
        <tbody id="monitor-table-body">
            <tr class="empty-state" id="empty-state">
                <td colspan="7">
                    <div class="empty-state">
                        <h3>📊 No Monitors Selected</h3>
                        <p>Select monitors from the list above to display their uptime data.</p>
                        <p>This reduces server load by only calculating data for selected monitors.</p>
                    </div>
                </td>
            </tr>
        </tbody>
        
        <!-- Hidden monitor data for JavaScript -->
        <script type="application/json" id="monitor-data">
            ${JSON.stringify(monitors.map(monitor => {
                const status = monitorStatuses[monitor.id];
                const uptime = uptimeData[monitor.id];
                
                let statusText = 'Unknown';
                let statusClass = 'status-unknown';
                if (status.status === 1) {
                    statusText = 'UP';
                    statusClass = 'status-up';
                } else if (status.status === 0) {
                    statusText = 'DOWN';
                    statusClass = 'status-down';
                }
                
                let uptimeClass = 'uptime-poor';
                if (uptime >= 99) uptimeClass = 'uptime-excellent';
                else if (uptime >= 95) uptimeClass = 'uptime-good';
                
                const displayUrl = monitor.url || `${monitor.hostname}${monitor.port ? ':' + monitor.port : ''}`;
                
                return {
                    id: monitor.id,
                    name: monitor.name,
                    type: monitor.type,
                    url: monitor.url,
                    displayUrl: displayUrl,
                    interval: monitor.interval,
                    status: {
                        text: statusText,
                        class: statusClass,
                        ping: status.ping
                    },
                    uptime: {
                        value: uptime,
                        class: uptimeClass
                    }
                };
            }))}
        </script>
    </table>

    <div class="refresh-info">
        <p>📊 Data cached for 30 seconds | Last updated: ${new Date().toLocaleString()}</p>
        <p>💡 This page doesn't auto-refresh. Use the refresh button for latest data.</p>
    </div>

    <script>
        function changeTimeRange(range) {
            // Update active button
            document.querySelectorAll('.range-button').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            // Update all monitor quick range selections
            const rangeMap = {
                '24h': { range: '24h', text: 'Last 24 hours' },
                '7d': { range: '7d', text: 'Last 7 days' },
                '30d': { range: '30d', text: 'Last 30 days' },
                '180d': { range: '180d', text: 'Last 6 months' }
            };
            
            const selectedRange = rangeMap[range];
            if (selectedRange) {
                // Update all visible monitor rows
                selectedMonitors.forEach(monitorId => {
                    const rangeButton = document.getElementById('selected-range-' + monitorId);
                    if (rangeButton) {
                        rangeButton.textContent = selectedRange.text;
                    }
                    
                    // Update active quick range button for each monitor
                    const dropdown = document.getElementById('time-range-dropdown-' + monitorId);
                    if (dropdown) {
                        const quickRangeBtns = dropdown.querySelectorAll('.quick-range-btn');
                        quickRangeBtns.forEach(btn => btn.classList.remove('active'));
                        
                        const targetBtn = Array.from(quickRangeBtns).find(btn => 
                            btn.textContent.toLowerCase().includes(selectedRange.text.toLowerCase().split(' ').slice(-2).join(' '))
                        );
                        if (targetBtn) {
                            targetBtn.classList.add('active');
                        }
                    }
                });
            }
            
            // Update table header based on selected range
            const uptimeHeader = document.querySelector('th:nth-child(5)');
            const rangeText = {
                '24h': '24h Uptime',
                '7d': '7d Uptime', 
                '30d': '30d Uptime',
                '180d': '180d Uptime'
            };
            if (uptimeHeader) {
                uptimeHeader.textContent = rangeText[range];
            }
        }
        
        // Time range dropdown functionality
        function toggleTimeRangeDropdown(monitorId) {
            console.log('toggleTimeRangeDropdown called for monitor:', monitorId);
            const dropdown = document.getElementById('time-range-dropdown-' + monitorId);
            console.log('Found dropdown:', dropdown);
            
            if (!dropdown) {
                console.error('Dropdown not found for monitor:', monitorId);
                return;
            }
            
            const btn = dropdown.previousElementSibling;
            console.log('Found button:', btn);
            
            // Close all other dropdowns
            document.querySelectorAll('.time-range-dropdown').forEach(menu => {
                if (menu.id !== 'time-range-dropdown-' + monitorId) {
                    menu.style.display = 'none';
                    if (menu.previousElementSibling) {
                        menu.previousElementSibling.classList.remove('open');
                    }
                }
            });
            
            // Toggle current dropdown
            if (dropdown.style.display === 'none' || dropdown.style.display === '') {
                // Remove any existing dropdowns first
                document.querySelectorAll('.temp-dropdown').forEach(el => el.remove());
                
                // Create a completely new dropdown element
                const newDropdown = document.createElement('div');
                newDropdown.className = 'temp-dropdown';
                newDropdown.innerHTML = 
                    '<div style="background: white; padding: 20px; border: 2px solid #007bff; border-radius: 8px; position: relative;">' +
                        '<button onclick="this.parentElement.parentElement.remove()" style="position: absolute; top: 5px; right: 10px; background: red; color: white; border: none; padding: 5px 10px; cursor: pointer;">✕</button>' +
                        '<h4 style="margin-top: 0;">Custom Range</h4>' +
                        '<div style="margin: 10px 0;">' +
                            '<label style="display: block; margin-bottom: 5px;">From:</label>' +
                            '<input type="datetime-local" id="from-date-temp" style="width: 100%; padding: 5px;" />' +
                        '</div>' +
                        '<div style="margin: 10px 0;">' +
                            '<label style="display: block; margin-bottom: 5px;">To:</label>' +
                            '<input type="datetime-local" id="to-date-temp" style="width: 100%; padding: 5px;" />' +
                        '</div>' +
                        '<button onclick="applyTempCustomRange(' + monitorId + ')" style="background: #007bff; color: white; padding: 8px 16px; border: none; border-radius: 4px; margin: 10px 0; cursor: pointer; width: 100%;">Apply Custom Range</button>' +
                        '<h4>Quick Ranges</h4>' +
                        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">' +
                            '<button onclick="selectTempQuickRange(' + monitorId + ', ' + "'5m'" + ', ' + "'Last 5 minutes'" + ')" style="padding: 8px; border: 1px solid #ccc; background: #f8f9fa; cursor: pointer;">Last 5 minutes</button>' +
                            '<button onclick="selectTempQuickRange(' + monitorId + ', ' + "'1h'" + ', ' + "'Last 1 hour'" + ')" style="padding: 8px; border: 1px solid #ccc; background: #f8f9fa; cursor: pointer;">Last 1 hour</button>' +
                            '<button onclick="selectTempQuickRange(' + monitorId + ', ' + "'24h'" + ', ' + "'Last 24 hours'" + ')" style="padding: 8px; border: 1px solid #ccc; background: #f8f9fa; cursor: pointer;">Last 24 hours</button>' +
                            '<button onclick="selectTempQuickRange(' + monitorId + ', ' + "'7d'" + ', ' + "'Last 7 days'" + ')" style="padding: 8px; border: 1px solid #ccc; background: #f8f9fa; cursor: pointer;">Last 7 days</button>' +
                            '<button onclick="selectTempQuickRange(' + monitorId + ', ' + "'30d'" + ', ' + "'Last 30 days'" + ')" style="padding: 8px; border: 1px solid #ccc; background: #f8f9fa; cursor: pointer;">Last 30 days</button>' +
                            '<button onclick="selectTempQuickRange(' + monitorId + ', ' + "'6m'" + ', ' + "'Last 6 months'" + ')" style="padding: 8px; border: 1px solid #ccc; background: #f8f9fa; cursor: pointer;">Last 6 months</button>' +
                        '</div>' +
                    '</div>';
                
                // Position above the button that was clicked
                const rect = btn.getBoundingClientRect();
                newDropdown.style.position = 'fixed';
                newDropdown.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
                newDropdown.style.left = Math.max(10, rect.left - 200) + 'px';
                newDropdown.style.zIndex = '999999';
                newDropdown.style.width = '400px';
                newDropdown.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
                
                document.body.appendChild(newDropdown);
                console.log('Created new dropdown element');
                
                if (btn) btn.classList.add('open');
            } else {
                dropdown.style.display = 'none';
                console.log('Hiding dropdown');
                if (btn) btn.classList.remove('open');
            }
        }
        
        function selectTempQuickRange(monitorId, range, displayText) {
            document.getElementById('selected-range-' + monitorId).textContent = displayText + ' (Loading...)';
            
            // Close dropdown
            document.querySelectorAll('.temp-dropdown').forEach(el => el.remove());
            
            // Calculate time range using exact same logic as TimeRangeSelector.vue
            const now = new Date();
            let startTime;
            
            if (range.endsWith("m")) {
                const amount = parseInt(range);
                if (range === "6m") {
                    // 6 months - same as TimeRangeSelector
                    startTime = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
                } else {
                    // minutes
                    startTime = new Date(now.getTime() - amount * 60 * 1000);
                }
            } else if (range.endsWith("h")) {
                const hours = parseInt(range);
                startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
            } else if (range.endsWith("d")) {
                const days = parseInt(range);
                startTime = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            } else {
                // Default fallback
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            }
            
            // Use existing socket.io connection to get uptime
            if (window.socket) {
                console.log('Requesting uptime for monitor', monitorId, 'from', new Date(startTime), 'to', new Date(now), 'range:', range);
                console.log('Timestamps being sent:', startTime.getTime(), now.getTime());
                
                window.socket.emit('getCustomRangeUptime', monitorId, startTime.getTime(), now.getTime(), (result) => {
                    console.log('Raw callback result:', result);
                    console.log('Result type:', typeof result);
                    console.log('Result keys:', result ? Object.keys(result) : 'null/undefined');
                    
                    // Handle authentication error
                    if (result && result.ok === false) {
                        console.error('Authentication error:', result.msg);
                        document.getElementById('selected-range-' + monitorId).textContent = displayText + ' (Auth Error)';
                        return;
                    }
                    
                    if (result && result.uptime !== undefined) {
                        // Update uptime display
                        const uptimeCell = document.querySelector('#monitor-' + monitorId);
                        if (uptimeCell) {
                            uptimeCell.innerHTML = result.uptime.toFixed(2) + '%';
                            if (result.uptime >= 95) {
                                uptimeCell.className = 'uptime-cell text-success';
                            } else if (result.uptime >= 80) {
                                uptimeCell.className = 'uptime-cell text-warning';
                            } else {
                                uptimeCell.className = 'uptime-cell text-danger';
                            }
                        }
                        
                        console.log('Updated uptime display for monitor', monitorId, 'to', result.uptime.toFixed(2) + '%');
                    }
                    
                    // Update button text (remove loading)
                    document.getElementById('selected-range-' + monitorId).textContent = displayText;
                });
            } else {
                console.error('Socket.io not available');
                document.getElementById('selected-range-' + monitorId).textContent = displayText + ' (Error)';
            }
        }
        
        function applyTempCustomRange(monitorId) {
            const fromDate = document.getElementById('from-date-temp').value;
            const toDate = document.getElementById('to-date-temp').value;
            
            if (fromDate && toDate) {
                const customText = 'Custom: ' + new Date(fromDate).toLocaleDateString() + ' - ' + new Date(toDate).toLocaleDateString();
                document.getElementById('selected-range-' + monitorId).textContent = customText + ' (Loading...)';
                
                // Close dropdown
                document.querySelectorAll('.temp-dropdown').forEach(el => el.remove());
                
                // Use existing socket.io connection for custom range
                if (window.socket) {
                    const startTime = new Date(fromDate).getTime();
                    const endTime = new Date(toDate).getTime();
                    
                    window.socket.emit('getCustomRangeUptime', monitorId, startTime, endTime, (result) => {
                        if (result && result.uptime !== undefined) {
                            // Update uptime display
                            const uptimeCell = document.querySelector('#monitor-' + monitorId);
                            if (uptimeCell) {
                                uptimeCell.innerHTML = result.uptime.toFixed(2) + '%';
                                if (result.uptime >= 95) {
                                    uptimeCell.className = 'uptime-cell text-success';
                                } else if (result.uptime >= 80) {
                                    uptimeCell.className = 'uptime-cell text-warning';
                                } else {
                                    uptimeCell.className = 'uptime-cell text-danger';
                                }
                            }
                            
                            console.log('Updated custom range uptime for monitor', monitorId, ':', result);
                        }
                        
                        // Update button text (remove loading)
                        document.getElementById('selected-range-' + monitorId).textContent = customText;
                    });
                } else {
                    console.error('Socket.io not available');
                    document.getElementById('selected-range-' + monitorId).textContent = customText + ' (Error)';
                }
            } else {
                alert('Please select both From and To dates');
            }
        }
        
        function selectQuickRange(monitorId, range, displayText) {
            // Update button text
            document.getElementById('selected-range-' + monitorId).textContent = displayText;
            
            // Update active state
            const dropdown = document.getElementById('time-range-dropdown-' + monitorId);
            dropdown.querySelectorAll('.quick-range-btn').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            // Close dropdown
            dropdown.style.display = 'none';
            dropdown.previousElementSibling.classList.remove('open');
            
            // Show feedback message
            const refreshInfo = document.querySelector('.refresh-info p:first-child');
            refreshInfo.innerHTML = '⏳ Time range changed to ' + displayText + ' for monitor ' + monitorId + '. Refresh page to load new data.';
        }
        
        function applyCustomRange(monitorId) {
            const fromDate = document.getElementById('from-date-' + monitorId).value;
            const toDate = document.getElementById('to-date-' + monitorId).value;
            
            if (!fromDate || !toDate) {
                alert('Please select both from and to dates');
                return;
            }
            
            if (new Date(fromDate) >= new Date(toDate)) {
                alert('From date must be before to date');
                return;
            }
            
            // Format dates for display
            const fromFormatted = new Date(fromDate).toLocaleDateString();
            const toFormatted = new Date(toDate).toLocaleDateString();
            const customText = fromFormatted + ' - ' + toFormatted;
            
            // Update button text
            document.getElementById('selected-range-' + monitorId).textContent = customText;
            
            // Remove active state from quick range buttons
            const dropdown = document.getElementById('time-range-dropdown-' + monitorId);
            dropdown.querySelectorAll('.quick-range-btn').forEach(btn => btn.classList.remove('active'));
            
            // Close dropdown
            dropdown.style.display = 'none';
            dropdown.previousElementSibling.classList.remove('open');
            
            // Show feedback message
            const refreshInfo = document.querySelector('.refresh-info p:first-child');
            refreshInfo.innerHTML = '⏳ Custom time range applied (' + customText + ') for monitor ' + monitorId + '. Refresh page to load new data.';
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.time-range-selector')) {
                document.querySelectorAll('.time-range-dropdown').forEach(menu => {
                    menu.style.display = 'none';
                    menu.previousElementSibling.classList.remove('open');
                });
            }
        });
        
        // Monitor selection functionality
        let monitorData = JSON.parse(document.getElementById('monitor-data').textContent);
        let selectedMonitors = new Set();
        
        function toggleMonitor(monitorId) {
            console.log('toggleMonitor called with ID:', monitorId);
            const checkbox = document.getElementById('monitor-' + monitorId);
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                console.log('Checkbox toggled, new state:', checkbox.checked);
                updateSelectedMonitors();
            } else {
                console.error('Checkbox not found for monitor ID:', monitorId);
            }
        }
        
        function filterMonitors() {
            console.log('filterMonitors called');
            const searchTerm = document.getElementById('monitor-search').value.toLowerCase();
            console.log('Search term:', searchTerm);
            const checkboxes = document.querySelectorAll('.monitor-checkbox');
            console.log('Found checkboxes:', checkboxes.length);
            
            checkboxes.forEach(checkbox => {
                const label = checkbox.querySelector('label').textContent.toLowerCase();
                console.log('Checking label:', label, 'includes search term:', label.includes(searchTerm));
                if (searchTerm === '' || label.includes(searchTerm)) {
                    checkbox.classList.remove('hidden');
                } else {
                    checkbox.classList.add('hidden');
                }
            });
        }
        
        function selectAllMonitors() {
            const checkboxes = document.querySelectorAll('.monitor-checkbox input[type="checkbox"]');
            const visibleCheckboxes = Array.from(checkboxes).filter(cb => {
                const parent = cb.closest('.monitor-checkbox');
                return parent && !parent.classList.contains('hidden');
            });
            
            visibleCheckboxes.forEach(checkbox => {
                checkbox.checked = true;
                selectedMonitors.add(parseInt(checkbox.value));
            });
            
            updateSelectedMonitors();
        }
        
        function clearAllMonitors() {
            const checkboxes = document.querySelectorAll('.monitor-checkbox input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            selectedMonitors.clear();
            
            // Clear search bar
            document.getElementById('monitor-search').value = '';
            filterMonitors();
            
            updateSelectedMonitors();
        }
        
        function updateSelectedMonitors() {
            console.log('updateSelectedMonitors called');
            // Update selected set
            selectedMonitors.clear();
            const checkedBoxes = document.querySelectorAll('.monitor-checkbox input[type="checkbox"]:checked');
            console.log('Found checked boxes:', checkedBoxes.length);
            checkedBoxes.forEach(checkbox => {
                selectedMonitors.add(parseInt(checkbox.value));
            });
            
            // Update count display
            document.getElementById('selected-count').textContent = selectedMonitors.size + ' monitors selected';
            console.log('Selected monitors count:', selectedMonitors.size);
            
            // Update table
            updateMonitorTable();
            
            // Update stats
            updateStats();
        }
        
        function updateMonitorTable() {
            const tbody = document.getElementById('monitor-table-body');
            const emptyState = document.getElementById('empty-state');
            
            if (selectedMonitors.size === 0) {
                tbody.innerHTML = '<tr class="empty-state" id="empty-state"><td colspan="7"><div class="empty-state"><h3>📊 No Monitors Selected</h3><p>Select monitors from the list above to display their uptime data.</p><p>This reduces server load by only calculating data for selected monitors.</p></div></td></tr>';
                return;
            }
            
            const selectedData = monitorData.filter(monitor => selectedMonitors.has(monitor.id));
            
            tbody.innerHTML = selectedData.map(monitor => 
                '<tr>' +
                    '<td><strong>' + monitor.name + '</strong></td>' +
                    '<td><span class="' + monitor.status.class + '">' + monitor.status.text + '</span></td>' +
                    '<td>' + monitor.type.toUpperCase() + '</td>' +
                    '<td>' +
                        (monitor.url ? 
                            '<a href="' + monitor.url + '" target="_blank" class="url-link">' + monitor.displayUrl + '</a>' : 
                            '<span class="url-link">' + monitor.displayUrl + '</span>'
                        ) +
                    '</td>' +
                    '<td id="monitor-' + monitor.id + '" class="uptime-cell text-' + monitor.uptime.class + '">' + monitor.uptime.value.toFixed(2) + '%</td>' +
                    '<td>' +
                        '<div class="uptime-container" style="position: relative;">' +
                            '<button class="time-range-btn" onclick="toggleTimeRangeDropdown(' + monitor.id + ')">' +
                                '<span id="selected-range-' + monitor.id + '">Last 1 hour</span>' +
                                '<span class="dropdown-arrow">▼</span>' +
                            '</button>' +
                            '<div class="time-range-dropdown" id="time-range-dropdown-' + monitor.id + '" style="display: none;">' +
                                '<div class="custom-range-section">' +
                                    '<h4>Custom Range</h4>' +
                                    '<div class="date-inputs">' +
                                        '<div class="date-input-group">' +
                                            '<label>From:</label>' +
                                            '<input type="datetime-local" id="from-date-' + monitor.id + '" class="date-input">' +
                                        '</div>' +
                                        '<div class="date-input-group">' +
                                            '<label>To:</label>' +
                                            '<input type="datetime-local" id="to-date-' + monitor.id + '" class="date-input">' +
                                        '</div>' +
                                    '</div>' +
                                    '<button class="apply-custom-btn" onclick="applyCustomRange(' + monitor.id + ')">Apply Custom Range</button>' +
                                '</div>' +
                                '<div class="quick-ranges-section">' +
                                    '<h4>Quick Ranges</h4>' +
                                    '<div class="quick-range-grid">' +
                                        '<button class="quick-range-btn active" onclick="selectQuickRange(' + monitor.id + ', ' + "'5m'" + ', ' + "'Last 5 minutes'" + ')">Last 5 minutes</button>' +
                                        '<button class="quick-range-btn" onclick="selectQuickRange(' + monitor.id + ', ' + "'1h'" + ', ' + "'Last 1 hour'" + ')">Last 1 hour</button>' +
                                        '<button class="quick-range-btn" onclick="selectQuickRange(' + monitor.id + ', ' + "'24h'" + ', ' + "'Last 24 hours'" + ')">Last 24 hours</button>' +
                                        '<button class="quick-range-btn" onclick="selectQuickRange(' + monitor.id + ', ' + "'7d'" + ', ' + "'Last 7 days'" + ')">Last 7 days</button>' +
                                        '<button class="quick-range-btn" onclick="selectQuickRange(' + monitor.id + ', ' + "'30d'" + ', ' + "'Last 30 days'" + ')">Last 30 days</button>' +
                                        '<button class="quick-range-btn" onclick="selectQuickRange(' + monitor.id + ', ' + "'6m'" + ', ' + "'Last 6 months'" + ')">Last 6 months</button>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="uptime-value">' +
                            '<span class="' + monitor.uptime.class + '">' + monitor.uptime.value.toFixed(2) + '%</span>' +
                        '</div>' +
                    '</td>' +
                    '<td>' + (monitor.status.ping ? monitor.status.ping + 'ms' : '-') + '</td>' +
                    '<td>' + monitor.interval + 's</td>' +
                '</tr>'
            ).join('');
        }
        
        function updateStats() {
            const selectedData = monitorData.filter(monitor => selectedMonitors.has(monitor.id));
            const online = selectedData.filter(m => m.status.text === 'UP').length;
            const offline = selectedData.filter(m => m.status.text === 'DOWN').length;
            const unknown = selectedData.filter(m => m.status.text === 'Unknown').length;
            
            document.getElementById('total-monitors').textContent = selectedData.length;
            document.getElementById('online-monitors').textContent = online;
            document.getElementById('offline-monitors').textContent = offline;
            document.getElementById('unknown-monitors').textContent = unknown;
        }
        
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                window.location.reload();
            }
            if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                window.location.href = '/dashboard';
            }
        });
    </script>
</body>
</html>
        `;

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

module.exports = router;
