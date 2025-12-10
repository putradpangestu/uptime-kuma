# Custom Features Documentation

This document describes the custom features ported from v1.23.17a to v2.0.2.

## Table of Contents

1. [Custom Time Range Selector](#custom-time-range-selector)
2. [Mark as Maintenance](#mark-as-maintenance)
3. [Uptime Calculation Method](#uptime-calculation-method)

---

## Custom Time Range Selector

### Overview

The Time Range Selector allows users to view uptime statistics for custom time periods beyond the default 24-hour and 30-day views.

### Available Ranges

| Range | Description |
|-------|-------------|
| Last 5 minutes | Quick check for recent issues |
| Last 1 hour | Short-term monitoring |
| Last 24 hours | Default daily view |
| Last 7 days | Weekly overview |
| Last 30 days | Default monthly view |
| Last 6 months | Long-term trends |
| Custom Range | User-defined date/time range |

### Usage

1. Navigate to a monitor's **Details** page
2. Click the time range dropdown (shows "Last 5 minutes" by default)
3. Select a quick range or set a custom date range
4. The uptime percentage will update to reflect the selected period

### Technical Implementation

**Frontend:**
- Component: `src/components/TimeRangeSelector.vue`
- Integration: `src/pages/Details.vue`

**Backend:**
- Socket handler: `getCustomRangeUptime` in `server/server.js`

**API:**
```javascript
socket.emit("getCustomRangeUptime", monitorId, fromDate, toDate, (response) => {
    // response.ok: boolean
    // response.uptime: number (0-1)
});
```

---

## Mark as Maintenance

### Overview

This feature allows users to retroactively mark downtime periods as maintenance, which updates the uptime statistics to exclude those periods from downtime calculations.

### Usage

1. Navigate to a monitor's **Details** page
2. Scroll to the **Event** table showing heartbeat history
3. Find a DOWN event (red status)
4. Click the wrench icon (🔧) in the **Actions** column
5. Confirm the action in the dialog

### Behavior

When marking a heartbeat as maintenance:

1. **Finds the downtime period** - Identifies all consecutive DOWN heartbeats around the selected time
2. **Updates status** - Changes status from `0` (DOWN) to `3` (MAINTENANCE)
3. **Recalculates statistics** - Updates `stat_minutely`, `stat_hourly`, and `stat_daily` tables
4. **Updates UI** - Refreshes the heartbeat list and uptime percentages

### Technical Implementation

**Frontend:**
- Method: `markHeartbeatAsMaintenance()` in `src/pages/Details.vue`
- Confirmation dialog with maintenance icon

**Backend:**
- Socket handler: `markHeartbeatAsMaintenance` in `server/server.js`

**API:**
```javascript
socket.emit("markHeartbeatAsMaintenance", monitorId, heartbeatTime, (response) => {
    // response.ok: boolean
    // response.msg: string
    // response.affectedCount: number (heartbeats updated)
});
```

---

## Uptime Calculation Method

### v2.0.2 Count-Based Calculation

Uptime Kuma v2 uses a **count-based** calculation method:

```
Uptime = (UP_count + MAINTENANCE_count) / Total_count
```

### Status Values

| Status | Value | Counts As |
|--------|-------|-----------|
| UP | 1 | UP |
| DOWN | 0 | DOWN |
| PENDING | 2 | DOWN |
| MAINTENANCE | 3 | UP |

### Example Calculation

```
Heartbeats in range: 23
- Status 1 (UP): 12
- Status 3 (MAINTENANCE): 1
- Status 0 (DOWN): 10

Uptime = (12 + 1) / 23 = 13/23 = 56.52%
```

### Comparison with v1 (Duration-Based)

| Aspect | v1 (Duration) | v2 (Count) |
|--------|---------------|------------|
| **Formula** | `uptime_seconds / total_seconds` | `up_count / total_count` |
| **Unit** | Time (seconds) | Number of checks |
| **Storage** | `duration` column | `stat_*` tables |
| **Weight** | Proportional to time | Equal per check |

### When Results Differ

Results are **identical** when heartbeat intervals are consistent.

Results **differ** when intervals vary:

```
Example: Variable intervals
| Time     | Status | Duration |
|----------|--------|----------|
| 08:00:00 | UP     | 300s     |
| 08:05:00 | DOWN   | 60s      |
| 08:06:00 | UP     | 60s      |

v1 (duration): 360/420 = 85.7%
v2 (count):    2/3 = 66.7%
```

### Interval Change Scenario

If a monitor's interval changes mid-period (e.g., 1min → 5min):

- The period with **more frequent checks** will have **more weight** in the calculation
- This is expected behavior and consistent with industry-standard monitoring tools

### Recommendations

| Use Case | Recommendation |
|----------|----------------|
| General monitoring | Count-based (v2) is fine |
| SLA reporting | Consider tracking actual downtime duration separately |
| Comparing monitors | Use same interval for accurate comparison |

---

## Language Keys

The following translation keys were added to `src/lang/en.json`:

```json
{
    "Time Range": "Time Range",
    "Custom Range": "Custom Range",
    "Apply Custom Range": "Apply Custom Range",
    "Quick Ranges": "Quick Ranges",
    "Last 5 minutes": "Last 5 minutes",
    "Last 1 hour": "Last 1 hour",
    "Last 24 hours": "Last 24 hours",
    "Last 7 days": "Last 7 days",
    "Last 30 days": "Last 30 days",
    "Last 6 months": "Last 6 months",
    "Mark as Maintenance": "Mark as Maintenance",
    "Are you sure you want to mark this downtime period as maintenance?": "Are you sure you want to mark this downtime period as maintenance?",
    "This will update the uptime statistics.": "This will update the uptime statistics.",
    "Downtime period marked as maintenance": "Downtime period marked as maintenance",
    "Actions": "Actions",
    "From": "From",
    "To": "To",
    "Duration": "Duration",
    "Invalid range": "Invalid range",
    "Date and time cannot be in the future": "Date and time cannot be in the future"
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/TimeRangeSelector.vue` | New component |
| `src/pages/Details.vue` | Added TimeRangeSelector, Actions column, maintenance dialog |
| `server/server.js` | Added `getCustomRangeUptime` and `markHeartbeatAsMaintenance` handlers |
| `src/lang/en.json` | Added translation keys |

---

## References

- [Uptime Kuma v2 Architecture](https://github.com/louislam/uptime-kuma/pull/4067)
- [UptimeCalculator Class](https://github.com/louislam/uptime-kuma/blob/2.0.X/server/uptime-calculator.js)
