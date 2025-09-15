<template>
    <div class="time-range-selector">
        <div class="dropdown">
            <button 
                class="btn btn-outline-secondary btn-sm dropdown-toggle" 
                type="button" 
                data-bs-toggle="dropdown" 
                aria-expanded="false"
            >
                <font-awesome-icon icon="clock" />
                {{ selectedRangeLabel }}
            </button>
            <ul class="dropdown-menu">
                <li>
                    <div class="px-1 py-1" @click.stop>
                        <!-- Custom Range Section -->
                        <div class="mb-2">
                            <h6 class="custom-range-header mb-1">Custom Range</h6>
                            
                            <!-- Date inputs with better styling -->
                            <div class="date-inputs">
                                <div class="mb-2">
                                    <label class="form-label-sm mb-1">From:</label>
                                    <input 
                                        v-model="customFrom" 
                                        type="datetime-local" 
                                        class="form-control form-control-sm date-input"
                                        :max="customTo"
                                        @change="updateCustomRange"
                                        @focus="onDateInputFocus"
                                    >
                                </div>
                                <div class="mb-2">
                                    <label class="form-label-sm mb-1">To:</label>
                                    <input 
                                        v-model="customTo" 
                                        type="datetime-local" 
                                        class="form-control form-control-sm date-input"
                                        :min="customFrom"
                                        @change="updateCustomRange"
                                        @focus="onDateInputFocus"
                                    >
                                </div>
                            </div>
                            
                            <!-- Enhanced range info -->
                            <div v-if="customRangeInfo" class="range-info">
                                <div class="d-flex align-items-center">
                                    <i class="fas fa-clock text-muted me-1"></i>
                                    <small class="text-muted duration-text">{{ customRangeInfo }}</small>
                                </div>
                            </div>
                            
                            <!-- Apply button for custom range -->
                            <div v-if="customFrom && customTo" class="mt-1">
                                <button 
                                    type="button" 
                                    class="btn btn-success btn-sm w-100 apply-btn"
                                    @click="applyCustomRange"
                                >
                                    <i class="fas fa-check me-1"></i>Apply Custom Range
                                </button>
                            </div>
                        </div>
                        
                        <!-- Quick Ranges Section -->
                        <div>
                            <h6 class="quick-ranges-header mb-3">Quick Ranges</h6>
                            <div class="quick-ranges-grid">
                                <button 
                                    v-for="range in quickRanges" 
                                    :key="range.value"
                                    type="button" 
                                    class="btn btn-sm quick-range-btn"
                                    :class="{ 'active': selectedRange === range.value }"
                                    @click="selectRange(range.value, range.label)"
                                >
                                    {{ range.label }}
                                </button>
                            </div>
                        </div>
                    </div>
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
export default {
    name: "TimeRangeSelector",
    emits: ["range-changed"],
    data() {
        return {
            selectedRange: "5m",
            selectedRangeLabel: "Last 5 minutes",
            customFrom: "",
            customTo: "",
            quickRanges: [
                { value: "5m", label: "Last 5 minutes" },
                { value: "1h", label: "Last 1 hour" },
                { value: "24h", label: "Last 24 hours" },
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "180d", label: "Last 6 months" }
            ]
        };
    },
    computed: {
        customRangeInfo() {
            if (!this.customFrom || !this.customTo) return null;
            
            const from = new Date(this.customFrom);
            const to = new Date(this.customTo);
            const diffMs = to - from;
            
            if (diffMs <= 0) return "Invalid range";
            
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            if (diffDays > 0) {
                return `Duration: ${diffDays}d ${diffHours}h ${diffMinutes}m`;
            } else if (diffHours > 0) {
                return `Duration: ${diffHours}h ${diffMinutes}m`;
            } else {
                return `Duration: ${diffMinutes}m`;
            }
        }
    },
    mounted() {
        this.initializeCustomDates();
        this.emitRangeChange();
    },
    methods: {
        selectRange(value, label) {
            this.selectedRange = value;
            this.selectedRangeLabel = label;
            
            // Clear custom range inputs when selecting quick ranges
            this.customFrom = "";
            this.customTo = "";
            
            this.emitRangeChange();
            
            // Close dropdown after selecting quick range
            const dropdown = document.querySelector('.dropdown-toggle');
            if (dropdown) {
                dropdown.click();
            }
        },
        
        updateCustomRange() {
            if (this.customFrom && this.customTo) {
                const from = new Date(this.customFrom);
                const to = new Date(this.customTo);
                
                if (from >= to) {
                    // Auto-adjust if from is after to
                    this.customTo = this.formatDateTimeLocal(new Date(from.getTime() + 60 * 60 * 1000)); // Add 1 hour
                }
            }
        },

        applyCustomRange() {
            if (this.customFrom && this.customTo) {
                const from = new Date(this.customFrom);
                const to = new Date(this.customTo);
                
                this.selectedRange = "custom";
                this.selectedRangeLabel = this.formatCustomRangeLabel(from, to);
                this.emitRangeChange();
                
                // Close dropdown after applying
                const dropdown = document.querySelector('.dropdown-toggle');
                if (dropdown) {
                    dropdown.click();
                }
            }
        },

        setQuickCustomRange(preset) {
            const now = new Date();
            let from, to;
            
            switch (preset) {
                case 'today':
                    from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0);
                    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
                    break;
                case 'yesterday':
                    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    from = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0);
                    to = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59);
                    break;
                case 'thisWeek':
                    const startOfWeek = new Date(now);
                    startOfWeek.setDate(now.getDate() - now.getDay());
                    startOfWeek.setHours(0, 0, 0, 0);
                    from = startOfWeek;
                    to = now;
                    break;
            }
            
            this.customFrom = this.formatDateTimeLocal(from);
            this.customTo = this.formatDateTimeLocal(to);
            this.updateCustomRange();
        },

        onDateInputFocus() {
            // Add visual feedback when user focuses on date inputs
        },

        setCustomPreset(preset) {
            const now = new Date();
            let from, to;
            
            switch (preset) {
                case 'yesterday':
                    from = new Date(now);
                    from.setDate(now.getDate() - 1);
                    from.setHours(0, 0, 0, 0);
                    to = new Date(from);
                    to.setHours(23, 59, 59, 999);
                    break;
                    
                case 'thisWeek':
                    from = new Date(now);
                    from.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
                    from.setHours(0, 0, 0, 0);
                    to = new Date(now);
                    break;
                    
                case 'lastWeek':
                    from = new Date(now);
                    from.setDate(now.getDate() - now.getDay() - 7); // Start of last week
                    from.setHours(0, 0, 0, 0);
                    to = new Date(from);
                    to.setDate(from.getDate() + 6); // End of last week
                    to.setHours(23, 59, 59, 999);
                    break;
            }
            
            this.customFrom = this.formatDateTimeLocal(from);
            this.customTo = this.formatDateTimeLocal(to);
            this.updateCustomRange();
        },
        
        initializeCustomDates() {
            // Keep custom range fields empty on first load
            this.customTo = "";
            this.customFrom = "";
        },
        
        formatDateTimeLocal(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        },

        formatCustomRangeLabel(from, to) {
            const formatDate = (date, includeYear = false) => {
                const day = String(date.getDate()).padStart(2, '0');
                const month = date.toLocaleDateString('en-US', { month: 'short' });
                const year = includeYear ? ` ${date.getFullYear()}` : '';
                const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                
                // If same day, show only time for 'to' date
                if (from.toDateString() === to.toDateString()) {
                    if (date === from) {
                        return `${day} ${month}${year}, ${time}`;
                    } else {
                        return time;
                    }
                }
                
                return `${day} ${month}${year}, ${time}`;
            };
            
            // Check if years are different
            const differentYears = from.getFullYear() !== to.getFullYear();
            
            return `${formatDate(from, differentYears)} - ${formatDate(to, differentYears)}`;
        },
        
        emitRangeChange() {
            let from, to;
            const now = new Date();
            
            if (this.selectedRange === "custom") {
                from = new Date(this.customFrom);
                to = new Date(this.customTo);
            } else {
                to = now;
                const value = this.selectedRange;
                
                if (value.endsWith("m")) {
                    const amount = parseInt(value);
                    if (value === "6m") {
                        // 6 months
                        from = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
                    } else {
                        // minutes
                        from = new Date(now.getTime() - amount * 60 * 1000);
                    }
                } else if (value.endsWith("h")) {
                    const hours = parseInt(value);
                    from = new Date(now.getTime() - hours * 60 * 60 * 1000);
                } else if (value.endsWith("d")) {
                    const days = parseInt(value);
                    from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
                }
            }
            
            this.$emit("range-changed", {
                range: this.selectedRange,
                from: from,
                to: to
            });
        },
        
        calculateFromTime(range, now) {
            const multipliers = {
                m: 60 * 1000,           // minutes
                h: 60 * 60 * 1000,      // hours  
                d: 24 * 60 * 60 * 1000  // days
            };
            
            const match = range.match(/^(\d+)([mhd])$/);
            if (!match) return new Date(now.getTime() - 24 * 60 * 60 * 1000); // default 24h
            
            const [, amount, unit] = match;
            const milliseconds = parseInt(amount) * multipliers[unit];
            
            return new Date(now.getTime() - milliseconds);
        }
    }
};
</script>

<style scoped>
.time-range-selector {
    display: inline-block;
}

.dropdown-item.active {
    background-color: var(--bs-primary);
    color: white;
}

.dropdown-menu {
    min-width: 320px;
    padding: 0.375rem;
}

.form-control-sm {
    font-size: 0.75rem;
}

.form-label-sm {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--bs-gray-600);
}

.btn-group .btn-sm {
    font-size: 0.7rem;
    padding: 0.25rem 0.5rem;
}

.dropdown-item {
    font-size: 0.875rem;
}

.custom-range-header,
.quick-ranges-header {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--bs-gray-700);
    margin-bottom: 0.5rem;
    padding-bottom: 0.25rem;
    display: inline-block;
    border-bottom: 2px solid var(--bs-success);
}

.quick-ranges-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
}

.quick-range-btn {
    background: var(--bs-body-bg);
    border: 1px solid var(--bs-gray-300);
    color: var(--bs-gray-600);
    font-size: 0.7rem;
    padding: 0.25rem 0.375rem;
    text-align: center;
    transition: all 0.15s ease-in-out;
    outline: 1px solid var(--bs-gray-300);
    outline-offset: -1px;
}

.quick-range-btn:hover {
    background: var(--bs-gray-200);
    border-color: var(--bs-gray-400);
}

.quick-range-btn.active {
    background: var(--bs-success);
    border-color: var(--bs-success);
    color: white;
    outline: 1px solid var(--bs-success);
}

.quick-range-btn.active:hover {
    background: var(--bs-success);
    border-color: var(--bs-success);
    color: white;
    outline: 1px solid var(--bs-success);
}

.preset-buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.preset-btn {
    flex: 1;
    min-width: 70px;
    font-size: 0.7rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    transition: all 0.2s ease;
}

.preset-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.input-label {
    background: var(--bs-light);
    border-color: var(--bs-border-color);
    font-size: 0.75rem;
    font-weight: 500;
    min-width: 70px;
}

.date-input {
    font-size: 0.75rem;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    border: 1px solid var(--bs-gray-300);
    background: var(--bs-body-bg);
    outline: 1px solid var(--bs-gray-300);
    outline-offset: -1px;
    padding: 0.25rem 0.5rem;
}

.date-input::-webkit-calendar-picker-indicator {
    padding: 0;
    margin: 0;
    width: 16px;
    height: 16px;
}

.date-input::-webkit-datetime-edit {
    padding: 0;
}

.date-input:focus {
    border-color: var(--bs-success);
    box-shadow: 0 0 0 0.2rem rgba(25, 135, 84, 0.25);
    background: var(--bs-body-bg);
    outline: 1px solid var(--bs-success);
}

.range-info {
    background: var(--bs-light);
    border-radius: 0.375rem;
    padding: 0.5rem;
    margin-top: 0.5rem;
}

.duration-text {
    font-size: 0.75rem;
    font-weight: 400;
}

.apply-btn {
    border-radius: 0.375rem;
    font-weight: 500;
    transition: all 0.2s ease;
}

.apply-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(25, 135, 84, 0.3);
}

.quick-ranges-grid .quick-range-btn {
    border-radius: 0.375rem;
    font-weight: 500;
}

.quick-ranges-grid .quick-range-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
</style>
