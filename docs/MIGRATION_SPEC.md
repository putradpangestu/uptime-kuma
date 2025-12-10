# Migration Spec Kit

This document provides instructions for porting custom features to new Uptime Kuma versions.

## Overview

| Feature | Files Modified | Complexity |
|---------|---------------|------------|
| Custom Time Range Selector | 4 files | Medium |
| Mark as Maintenance | 3 files | Medium |
| Docker Build | 1 file | Low |

---

## Files to Migrate

### 1. `src/components/TimeRangeSelector.vue` (NEW FILE)

**Action:** Copy entire file to new version.

**Dependencies:** None (standalone component)

**Verification:**
```bash
# Check file exists
ls -la src/components/TimeRangeSelector.vue
```

---

### 2. `src/pages/Details.vue`

**Action:** Merge changes into new version's Details.vue

**Changes to port:**

#### A. Import Statement (around line 479)
```javascript
import TimeRangeSelector from "../components/TimeRangeSelector.vue";
```

#### B. Component Registration (around line 502)
```javascript
components: {
    // ... existing components
    TimeRangeSelector,
},
```

#### C. Data Properties (around line 535)
```javascript
data() {
    return {
        // ... existing properties
        timeRange: { range: "24h", from: null, to: null },
        customRangeUptime: null,
        loadingCustomUptime: false,
        selectedBeat: null,
    };
},
```

#### D. Computed Property (around line 644)
```javascript
timeRangeUptime() {
    if (this.loadingCustomUptime) {
        return null;
    }
    if (this.customRangeUptime !== null) {
        return this.customRangeUptime;
    }
    if (this.timeRange.range === "24h") {
        return this.$root.uptimeList[this.monitor.id]?.["24"];
    }
    if (this.timeRange.range === "30d") {
        return this.$root.uptimeList[this.monitor.id]?.["720"];
    }
    return null;
},
```

#### E. Template - TimeRangeSelector Component (in stats section)
```vue
<TimeRangeSelector @range-changed="onTimeRangeChanged" />
```

#### F. Template - Actions Column in Event Table
```vue
<th>{{ $t("Actions") }}</th>
<!-- In tbody -->
<td>
    <button 
        v-if="beat.status === 0"
        class="btn btn-outline-warning btn-sm"
        @click="markHeartbeatAsMaintenance(beat)"
        :title="$t('Mark as Maintenance')"
    >
        <font-awesome-icon icon="wrench" />
    </button>
</td>
```

#### G. Template - Confirmation Dialog (before closing template tag)
```vue
<Confirm 
    ref="confirmMarkHeartbeatMaintenance" 
    :yes-text="$t('Yes')" 
    :no-text="$t('No')"
    @yes="confirmMarkHeartbeatAsMaintenance"
>
    <template #body>
        <div class="text-center">
            <font-awesome-icon icon="wrench" class="mb-3 maintenance-icon" size="3x" />
            <p>{{ $t("Are you sure you want to mark this downtime period as maintenance?") }}</p>
            <p class="text-muted small">{{ $t("This will update the uptime statistics.") }}</p>
        </div>
    </template>
</Confirm>
```

#### H. Methods (in methods section)
```javascript
onTimeRangeChanged(timeRange) {
    this.timeRange = timeRange;
    if (timeRange.range !== "24h" && timeRange.range !== "30d") {
        this.requestCustomRangeUptime(timeRange);
    } else {
        this.customRangeUptime = null;
        this.loadingCustomUptime = false;
    }
},

requestCustomRangeUptime(timeRange) {
    this.loadingCustomUptime = true;
    this.customRangeUptime = null;
    this.$root.getSocket().emit("getCustomRangeUptime", this.monitor.id, timeRange.from, timeRange.to, (res) => {
        this.loadingCustomUptime = false;
        if (res.ok) {
            this.customRangeUptime = res.uptime;
        } else {
            this.customRangeUptime = null;
        }
    });
},

markHeartbeatAsMaintenance(beat) {
    this.selectedBeat = beat;
    this.$refs.confirmMarkHeartbeatMaintenance.show();
},

confirmMarkHeartbeatAsMaintenance() {
    const beat = this.selectedBeat;
    if (!beat) return;
    const plainBeat = JSON.parse(JSON.stringify(beat));
    const timestamp = String(plainBeat.time);
    const monitorId = Number(this.monitor.id);
    this.$root.getSocket().emit("markHeartbeatAsMaintenance", monitorId, timestamp, (res) => {
        if (res && res.ok) {
            toast.success(this.$t("Downtime period marked as maintenance"));
        } else {
            toast.error(res?.msg || this.$t("Failed to mark as maintenance"));
        }
    });
},
```

---

### 3. `server/server.js`

**Action:** Add socket handlers to new version

**Changes to port:**

#### A. Import Statement (around line 135)
Add `sendImportantHeartbeatList` to imports from `./client`:
```javascript
const { sendNotificationList, sendHeartbeatList, sendImportantHeartbeatList, sendInfo } = require("./client");
```

#### B. Socket Handler - markHeartbeatAsMaintenance
Add after `clearHeartbeats` handler (around line 1560):

```javascript
// Mark heartbeat as maintenance
socket.on("markHeartbeatAsMaintenance", async (monitorID, heartbeatTime, callback) => {
    try {
        checkLogin(socket);

        log.info("manage", `Marking heartbeat as maintenance for monitor ${monitorID} at ${heartbeatTime}`);

        // Find the downtime period boundaries
        const clickedBeat = await R.findOne("heartbeat", " monitor_id = ? AND time = ? ", [monitorID, heartbeatTime]);

        if (!clickedBeat) {
            callback({ ok: false, msg: "Heartbeat not found" });
            return;
        }

        if (clickedBeat.status !== 0) {
            callback({ ok: false, msg: "Only DOWN heartbeats can be marked as maintenance" });
            return;
        }

        // Find all consecutive DOWN heartbeats in this downtime period
        const allHeartbeats = await R.find("heartbeat", " monitor_id = ? ORDER BY time ASC ", [monitorID]);

        let startIndex = -1;
        let endIndex = -1;
        let clickedIndex = -1;

        for (let i = 0; i < allHeartbeats.length; i++) {
            if (allHeartbeats[i].time === heartbeatTime) {
                clickedIndex = i;
                break;
            }
        }

        if (clickedIndex === -1) {
            callback({ ok: false, msg: "Heartbeat not found in list" });
            return;
        }

        // Find start of downtime period
        startIndex = clickedIndex;
        for (let i = clickedIndex - 1; i >= 0; i--) {
            if (allHeartbeats[i].status === 0) {
                startIndex = i;
            } else {
                break;
            }
        }

        // Find end of downtime period
        endIndex = clickedIndex;
        for (let i = clickedIndex + 1; i < allHeartbeats.length; i++) {
            if (allHeartbeats[i].status === 0) {
                endIndex = i;
            } else {
                break;
            }
        }

        // Update all heartbeats in the downtime period to maintenance status
        const startTime = allHeartbeats[startIndex].time;
        const endTime = allHeartbeats[endIndex].time;

        await R.exec(
            "UPDATE heartbeat SET status = 3 WHERE monitor_id = ? AND time >= ? AND time <= ? AND status = 0",
            [monitorID, startTime, endTime]
        );

        const affectedCount = endIndex - startIndex + 1;
        log.info("manage", `Marked ${affectedCount} heartbeats as maintenance for monitor ${monitorID}`);

        // Clear the cached UptimeCalculator for this monitor
        UptimeCalculator.clearCache(monitorID);

        // Delete existing stat records for this monitor
        await R.exec("DELETE FROM stat_minutely WHERE monitor_id = ?", [monitorID]);
        await R.exec("DELETE FROM stat_hourly WHERE monitor_id = ?", [monitorID]);
        await R.exec("DELETE FROM stat_daily WHERE monitor_id = ?", [monitorID]);

        // Rebuild stats from heartbeat data
        const uptimeCalculator = await UptimeCalculator.getUptimeCalculator(monitorID);
        const heartbeats = await R.find("heartbeat", " monitor_id = ? ORDER BY time ASC ", [monitorID]);

        for (const hb of heartbeats) {
            await uptimeCalculator.update(hb.status, hb.ping);
        }

        // Send updated heartbeat list to all clients
        await sendImportantHeartbeatList(socket, monitorID, true, true);

        // Emit uptime update
        let uptime24 = await uptimeCalculator.getDataArray(24);
        let uptime30d = await uptimeCalculator.getDataArray(720);

        io.to(monitorID).emit("uptime", monitorID, 24, uptime24);
        io.to(monitorID).emit("uptime", monitorID, 720, uptime30d);

        callback({
            ok: true,
            msg: `Marked ${affectedCount} heartbeats as maintenance`,
            affectedCount: affectedCount
        });

    } catch (e) {
        log.error("manage", `Error marking heartbeat as maintenance: ${e.message}`);
        callback({
            ok: false,
            msg: e.message,
        });
    }
});
```

#### C. Socket Handler - getCustomRangeUptime
Add after `markHeartbeatAsMaintenance` handler:

```javascript
// Get custom range uptime calculation
socket.on("getCustomRangeUptime", async (monitorID, fromTime, toTime, callback) => {
    try {
        checkLogin(socket);

        const calcStartTime = Date.now();
        log.info("server", `getCustomRangeUptime called: monitor=${monitorID}, from=${fromTime}, to=${toTime}`);

        // Convert client timestamps to UTC (database uses UTC)
        const startTimeUTC = new Date(fromTime).toISOString().slice(0, 19).replace("T", " ");
        const endTimeUTC = new Date(toTime).toISOString().slice(0, 19).replace("T", " ");

        log.info("server", `Converted to UTC: from=${startTimeUTC}, to=${endTimeUTC}`);

        const queryStartTime = Date.now();

        // In v2.0.2, uptime is calculated by counting heartbeats, not by duration
        // Status 1 = UP, Status 3 = MAINTENANCE (counts as UP)
        // Status 0 = DOWN, Status 2 = PENDING (counts as DOWN)
        let result = await R.getRow(`
            SELECT
                COUNT(*) AS total_count,
                SUM(CASE WHEN status = 1 OR status = 3 THEN 1 ELSE 0 END) AS up_count,
                SUM(CASE WHEN status = 0 OR status = 2 THEN 1 ELSE 0 END) AS down_count
            FROM heartbeat
            WHERE time >= ? AND time <= ? AND monitor_id = ?
        `, [ startTimeUTC, endTimeUTC, monitorID ]);

        log.info("server", `Query result: total=${result?.total_count}, up=${result?.up_count}, down=${result?.down_count}`);

        const queryDuration = Date.now() - queryStartTime;

        let totalCount = result ? (result.total_count || 0) : 0;
        let upCount = result ? (result.up_count || 0) : 0;
        let uptime = 0;

        if (totalCount > 0) {
            uptime = upCount / totalCount;
        }

        const totalDurationMs = Date.now() - calcStartTime;

        log.info("server", `Custom range uptime calculated: ${(uptime * 100).toFixed(2)}% (${upCount}/${totalCount}) | Query: ${queryDuration}ms | Total: ${totalDurationMs}ms | Monitor: ${monitorID}`);

        callback({
            ok: true,
            uptime: uptime
        });

    } catch (e) {
        log.error("server", `Error calculating custom range uptime: ${e.message}`);
        callback({
            ok: false,
            msg: e.message,
        });
    }
});
```

---

### 4. `src/lang/en.json`

**Action:** Add translation keys to new version

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

### 5. `Dockerfile.custom` (NEW FILE)

**Action:** Copy entire file to new version.

**Note:** May need to update base image version if Node.js version changes.

---

## Migration Checklist

```
[ ] 1. Copy TimeRangeSelector.vue to src/components/
[ ] 2. Merge Details.vue changes
    [ ] Import statement
    [ ] Component registration
    [ ] Data properties
    [ ] Computed property (timeRangeUptime)
    [ ] Template - TimeRangeSelector
    [ ] Template - Actions column
    [ ] Template - Confirmation dialog
    [ ] Methods (4 methods)
[ ] 3. Merge server.js changes
    [ ] Import sendImportantHeartbeatList
    [ ] markHeartbeatAsMaintenance handler
    [ ] getCustomRangeUptime handler
[ ] 4. Add translation keys to en.json
[ ] 5. Copy Dockerfile.custom
[ ] 6. Copy docs/CUSTOM_FEATURES.md
[ ] 7. Test all features
    [ ] Custom time range selector works
    [ ] Mark as maintenance updates stats
    [ ] Docker build succeeds
```

---

## Version Compatibility Notes

### v2.0.2 Specific

- Uses count-based uptime calculation (not duration-based)
- Statistics stored in `stat_minutely`, `stat_hourly`, `stat_daily` tables
- `UptimeCalculator` class manages statistics
- Must clear cache and rebuild stats when modifying heartbeat status

### Breaking Changes to Watch

1. **UptimeCalculator API changes** - Check if `clearCache()` and `getUptimeCalculator()` methods exist
2. **Database schema changes** - Verify `heartbeat` and `stat_*` table structures
3. **Socket.io API changes** - Verify `sendImportantHeartbeatList` function signature
4. **Vue component structure** - Details.vue may be restructured

---

## Quick Diff Commands

```bash
# Compare with upstream
git diff upstream-2.0.2 2.0.2a --stat

# Show specific file changes
git diff upstream-2.0.2 2.0.2a -- server/server.js
git diff upstream-2.0.2 2.0.2a -- src/pages/Details.vue
git diff upstream-2.0.2 2.0.2a -- src/lang/en.json

# Export patches
git format-patch upstream-2.0.2..2.0.2a -o patches/
```

---

## Contact

Repository: https://github.com/putradpangestu/uptime-kuma
Branch: 2.0.2a
