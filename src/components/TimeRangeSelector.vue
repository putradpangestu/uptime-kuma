<template>
    <div class="time-range-selector">
        <div class="dropdown">
            <button 
                class="btn btn-outline-secondary btn-sm dropdown-toggle" 
                type="button" 
                data-bs-toggle="dropdown" 
                aria-expanded="false"
            >
                {{ selectedRangeLabel }}
            </button>
            <ul class="dropdown-menu">
                <li>
                    <div class="px-2 py-1" @click.stop>
                        <!-- Custom Range Section -->
                        <div class="mb-3">
                            <h6 class="custom-range-header mb-2">Custom Range</h6>
                            
                            <!-- Date inputs with better styling -->
                            <div class="date-inputs">
                                <div class="mb-2">
                                    <label class="form-label-sm mb-1">From:</label>
                                    <div class="date-input-wrapper">
                                        <input 
                                            v-model="customFrom" 
                                            type="datetime-local" 
                                            class="form-control form-control-sm date-input"
                                            :max="getCurrentDateTime()"
                                            placeholder="Select date and time"
                                            @change="updateCustomRange"
                                            @focus="onDateInputFocus"
                                        >
                                    </div>
                                </div>
                                <div class="mb-2">
                                    <label class="form-label-sm mb-1">To:</label>
                                    <div class="date-input-wrapper">
                                        <input 
                                            v-model="customTo" 
                                            type="datetime-local" 
                                            class="form-control form-control-sm date-input"
                                            :min="customFrom"
                                            :max="getCurrentDateTime()"
                                            placeholder="Select date and time"
                                            @change="updateCustomRange"
                                            @focus="onDateInputFocus"
                                        >
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Enhanced range info -->
                            <div v-if="customRangeInfo" class="range-info">
                                <div class="d-flex align-items-center">
                                    <small class="text-muted duration-text">{{ customRangeInfo }}</small>
                                </div>
                            </div>
                            
                            <!-- Validation error message -->
                            <div v-if="showValidationError" class="validation-error mt-1 mb-2">
                                <small class="text-danger"><i class="fas fa-exclamation-circle me-1"></i>Date and time cannot be in the future</small>
                            </div>
                            
                            <!-- Apply button for custom range -->
                            <div v-if="customFrom && customTo" class="mt-1">
                                <button 
                                    type="button" 
                                    class="btn btn-sm w-100 apply-btn"
                                    @click="applyCustomRange"
                                    style="background-color: #5cdd8b; border-color: #5cdd8b; color: white;"
                                >
                                    <i class="fas fa-check me-1"></i><span class="apply-text">Apply Custom Range</span>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Quick Ranges Section -->
                        <div>
                            <h6 class="quick-ranges-header mb-2">Quick Ranges</h6>
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
            showValidationError: false,
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
    },
    methods: {
        selectRange(value, label) {
            this.selectedRange = value;
            this.selectedRangeLabel = label;
            // Clear any validation errors when selecting a quick range
            this.showValidationError = false;
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
                const now = new Date();
                
                // Clear validation error when user makes changes
                this.showValidationError = false;
                
                if (from >= to) {
                    // Auto-adjust if from is after to
                    this.customTo = this.formatDateTimeLocal(new Date(from.getTime() + 60 * 60 * 1000)); // Add 1 hour
                }
                
                // Check if dates are in the future
                if (from > now || to > now) {
                    // Just show the validation message but don't prevent editing
                    this.showValidationError = true;
                }
            }
        },

        applyCustomRange() {
            if (this.customFrom && this.customTo) {
                const from = new Date(this.customFrom);
                const to = new Date(this.customTo);
                const now = new Date();
                
                // Validate that dates are not in the future
                if (from > now || to > now) {
                    // Show error message
                    this.showValidationError = true;
                    return;
                }
                
                // Clear any validation errors
                this.showValidationError = false;
                
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
        
        getCurrentDateTime() {
            return this.formatDateTimeLocal(new Date());
        },

        setQuickCustomRange(preset) {
            const now = new Date();
            let from, to;
            
            // Clear any validation errors
            this.showValidationError = false;
            
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
            // Clear any validation errors
            this.showValidationError = false;
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
    min-width: 280px;
    padding: 0.75rem 0.5rem;
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border-radius: 8px;
}

.form-control-sm {
    font-size: 0.75rem;
}

.form-label-sm {
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--bs-gray-600);
    margin-bottom: 0.2rem;
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
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--bs-gray-600);
    margin-bottom: 0.5rem;
    padding-bottom: 0.25rem;
    display: inline-block;
    border-bottom: 1px solid #5cdd8b; /* Thinner line for minimalist look */
    text-transform: uppercase;
    letter-spacing: 0.03rem;
}

.quick-ranges-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
    margin-bottom: 0.25rem;
}

.quick-range-btn {
    background: var(--bs-body-bg);
    border: 1px solid var(--bs-gray-200);
    color: var(--bs-gray-600);
    font-size: 0.7rem;
    padding: 0.25rem 0.375rem;
    text-align: center;
    transition: all 0.2s ease;
    border-radius: 6px;
    outline: none;
    position: relative;
    overflow: hidden;
    box-shadow: none;
}

.quick-range-btn::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(92, 221, 139, 0.05);
    transform: translateX(-100%);
    transition: transform 0.25s ease;
}

.quick-range-btn:hover::after {
    transform: translateX(0);
}

.quick-range-btn:hover {
    background: #f8fdfb; /* very light green */
    border-color: #5cdd8b;
    color: #198754; /* bootstrap success color */
    box-shadow: none;
    transform: none;
}

.quick-range-btn.active {
    background: #5cdd8b; /* primary heartbeat color */
    border-color: #5cdd8b;
    color: white;
    box-shadow: none;
}

.quick-range-btn.active:hover {
    background: #4bc77a; /* slightly darker primary for hover */
    border-color: #4bc77a;
    color: white;
    box-shadow: none;
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

.date-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.date-input {
    font-size: 0.75rem;
    transition: all 0.2s ease;
    border: 1px solid var(--bs-gray-300);
    background: var(--bs-body-bg);
    border-radius: 4px;
    padding: 0.25rem 0.4rem;
    box-shadow: none;
    width: 100%;
    font-family: var(--bs-font-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif);
    color: var(--bs-gray-700);
    letter-spacing: normal;
    text-align: left;
    font-weight: 400;
    height: auto;
}

.date-input::-webkit-calendar-picker-indicator {
    padding: 0;
    margin: 0;
    width: 16px;
    height: 16px;
    opacity: 0.7;
    cursor: pointer;
    filter: invert(60%) sepia(89%) saturate(387%) hue-rotate(93deg) brightness(95%) contrast(85%);
}

.date-input::-webkit-datetime-edit {
    padding: 0;
    text-align: left;
}

/* Fix date input symmetry */
.date-input::-webkit-datetime-edit-fields-wrapper {
    display: inline-flex;
    align-items: center;
    width: 100%;
    gap: 0;
}

.date-input::-webkit-datetime-edit-text {
    padding: 0;
    color: var(--bs-gray-600);
}

.date-input::-webkit-datetime-edit-day-field,
.date-input::-webkit-datetime-edit-month-field,
.date-input::-webkit-datetime-edit-year-field,
.date-input::-webkit-datetime-edit-hour-field,
.date-input::-webkit-datetime-edit-minute-field {
    padding: 0;
    min-width: 1em;
    display: inline-block;
    font-weight: normal;
    font-size: 0.75rem;
}

.date-input:focus {
    border-color: #5cdd8b;
    box-shadow: 0 0 0 1px rgba(92, 221, 139, 0.2);
    background: var(--bs-body-bg);
    outline: none;
}

.range-info {
    background: rgba(92, 221, 139, 0.03);
    border-radius: 4px;
    padding: 0.35rem 0.5rem;
    margin: 0.5rem 0;
    border: none;
}

.validation-error {
    background-color: rgba(220, 53, 69, 0.05);
    border-radius: 4px;
    padding: 0.35rem 0.5rem;
    text-align: center;
    font-size: 0.75rem;
}

.format-hint {
    display: block;
    font-size: 0.65rem;
    color: var(--bs-gray-500);
    margin-top: -0.1rem;
    margin-bottom: 0.2rem;
}

.duration-text {
    font-size: 0.75rem;
    font-weight: 400;
}

.apply-btn {
    border-radius: 6px;
    font-weight: 500;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
    height: 32px;
}

.apply-btn::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(-100%);
    transition: transform 0.25s ease;
}

.apply-btn:hover::after {
    transform: translateX(0);
}

.apply-text {
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.01rem;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
}

.apply-btn:hover {
    transform: none;
    background-color: #4bc77a; /* slightly darker primary for hover */
    border-color: #4bc77a;
    color: #fff;
    box-shadow: none;
}

.quick-ranges-grid .quick-range-btn {
    border-radius: 6px;
    font-weight: 400;
}

/* Remove this rule as it's overriding our main hover styles */
</style>
