<template>
  <div class="financial-table-wrapper">
    <table v-if="displayData && displayData.length">
      <thead>
        <tr>
          <th>Year-Period</th>
          <th class="trend-header">Trend</th>
          <th v-for="(item, index) in displayData" :key="index">
            {{ formatDateHeader(item) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-if="groups">
          <template v-for="group in groups" :key="group.name">
            <tr class="group-header">
              <td :colspan="displayData.length + 2">{{ group.name }}</td>
            </tr>
            <tr v-for="row in group.rows" :key="row.label">
              <td class="row-label">{{ row.label }}</td>
              <td 
                class="trend-cell" 
                :class="{ selected: (row.key || row.label) === selectedMetricKey }"
                @click="onTrendClick(row)"
              >
                <svg width="60" height="20" viewBox="0 0 60 20">
                  <path 
                    :d="getSparklinePath(displayData, row)" 
                    :stroke="getSparklineColor(displayData, row)"
                    fill="none"
                    stroke-width="1.5"
                  />
                </svg>
              </td>
              <td v-for="(item, index) in displayData" :key="index">
                {{ formatValue(getValue(item, row), row.format) }}
              </td>
            </tr>
          </template>
        </template>
        <template v-else>
          <tr v-for="key in keys" :key="key">
            <td>{{ formatKey(key) }}</td>
            <td 
              class="trend-cell" 
              :class="{ selected: key === selectedMetricKey }"
              @click="onTrendClick({ key })"
            >
               <svg width="60" height="20" viewBox="0 0 60 20">
                  <path 
                    :d="getSparklinePath(displayData, { key })" 
                    :stroke="getSparklineColor(displayData, { key })"
                    fill="none"
                    stroke-width="1.5"
                  />
               </svg>
            </td>
            <td v-for="(item, index) in displayData" :key="index">
              {{ formatValue(item[key]) }}
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <div v-else class="no-data">No data available</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  type: {
    type: String, // 'income', 'balance', 'cash', 'metrics'
    required: true
  },
  ttmMode: {
    type: Boolean,
    default: false
  },
  groups: {
    type: Array,
    default: null
  },
  selectedMetricKey: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['select-metric']);

// Define which keys to show for each type to avoid showing raw API noise.
const excludedKeys = ['date', 'symbol', 'period', 'calendarYear', 'cik', 'fillingDate', 'acceptedDate', 'link', 'finalLink'];

// Helper to aggregate quarters
const getTTMValue = (list, index, key, type = 'sum') => {
  if (index + 4 > list.length) return null;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < 4; i++) {
    const val = list[index + i][key];
    if (typeof val !== 'number') return null; // Can't sum non-numbers
    sum += val;
    count++;
  }
  
  if (type === 'avg') {
    return sum / count;
  }
  return sum;
};

const processedData = computed(() => {
  if (!props.data || props.data.length === 0) return [];
  
  // If not TTM mode or if Balance Sheet (snapshot), return original
  // Note: Balance Sheet is point-in-time, summing doesn't make sense usually.
  if (!props.ttmMode || props.type === 'balance' || props.type === 'metrics') {
    return props.data;
  }

  // For Income and Cash Flow, we calculate TTM
  // We map the original list, but for each item, we try to calculate TTM values for numeric fields
  return props.data.map((item, index) => {
    // Basic cloning or new object structure
    const newItem = { ...item };
    
    // We want to update numeric keys with TTM sums
    // But we need to be careful only to sum the "summable" fields.
    // Most fields in income/cash flow are flows, so summing 4 quarters is correct for TTM.
    // EPS is also summed.
    
    Object.keys(item).forEach(key => {
      if (excludedKeys.includes(key)) return;
      
      const val = item[key];
      if (typeof val === 'number') { 
        // Heuristic for aggregation type
        let aggrType = 'sum';
        const lowerKey = key.toLowerCase();
        
        // Shares, Ratios, Margins should be averaged, not summed
        if (
          lowerKey.includes('share') || 
          lowerKey.includes('shs') || 
          lowerKey.includes('ratio') || 
          lowerKey.includes('margin')
        ) {
          aggrType = 'avg';
        }

        const ttm = getTTMValue(props.data, index, key, aggrType);
        if (ttm !== null) {
          newItem[key] = ttm;
        } else {
          // If we can't calculate TTM (end of list), maybe return null or keeps q? 
          // Usually we just can't show TTM for the oldest data points.
          newItem[key] = null; 
        }
      }
    });

    return newItem;
  });
});

const keys = computed(() => {
  if (!props.data || props.data.length === 0) return [];
  return Object.keys(props.data[0]).filter(k => !excludedKeys.includes(k));
});

const displayData = computed(() => {
  return processedData.value;
});

const formatKey = (key) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

const formatValue = (val, format) => {
  if (val === null || val === undefined) return '--';
  
  if (format === 'percent') {
    return (val * 100).toFixed(2) + '%';
  }
  
  if (typeof val === 'number') {
    if (Math.abs(val) >= 1e9) {
      return (val / 1e9).toFixed(2) + ' B';
    }
    if (Math.abs(val) >= 1e6) {
      return (val / 1e6).toFixed(2) + ' M';
    }
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return val;
};


const getValue = (item, row) => {
  if (row.value && typeof row.value === 'function') {
    return row.value(item);
  }
  return item[row.key];
};

const formatDateHeader = (item) => {
  if (!item) return '';
  const dateStr = item.fillingDate || item.date;
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  let year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  let quarter = Math.floor(month / 3) + 1;
  
  // Logic: Use filing date to get quarter, then show previous quarter.
  if (quarter === 1) {
    quarter = 4;
    year--;
  } else {
    quarter--;
  }
  
  return `${year} Q${quarter}`;
};

// Sparkline Logic
const getSparklineData = (dataList, row) => {
  // Extract values for the row
  const values = dataList.map(item => getValue(item, row));
  
  // Data list is typically Newest -> Oldest (e.g. 2024, 2023...)
  // We want trend Oldest -> Newest for the chart
  // Filter out non-numbers first? Or treat as 0? Usually just filter valid numbers
  const validValues = values.filter(v => typeof v === 'number').reverse();
  return validValues;
};

const getSparklinePath = (dataList, row) => {
  const values = getSparklineData(dataList, row);
  if (values.length < 2) return '';
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  // Dimensions 60x20
  const width = 60;
  const height = 20;
  const margin = 2; // top/bottom margin
  
  // If flat line
  if (range === 0) {
    return `M 0,${height/2} L ${width},${height/2}`;
  }
  
  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * width;
    // Invert Y because SVG 0 is top
    // Normalize val between 0 and 1
    const normalized = (val - min) / range; 
    const y = height - margin - (normalized * (height - 2*margin)); 
    return `${x},${y}`;
  });
  
  return `M ${points.join(' L ')}`;
};

const getSparklineColor = (dataList, row) => {
  const values = getSparklineData(dataList, row);
  if (values.length < 2) return '#8b949e'; // grey
  
  const start = values[0];
  const end = values[values.length - 1];
  
  return end >= start ? '#2ea043' : '#da3633'; // Green or Red
};

const onTrendClick = (row) => {
  // We need to gather the full historical data for this row to pass to the chart
  // The chart expects: [{ date/period: '...', value: 123 }, ...] (Oldest -> Newest)
  
  // displayData is Newest -> Oldest
  const history = displayData.value.map(item => ({
    date: item.date, // keep original date for sorting/key
    period: formatDateHeader(item), // formatted label
    value: getValue(item, row)
  })).filter(d => typeof d.value === 'number').reverse();

  emit('select-metric', {
    key: row.key || row.label, // unique id
    name: row.label || formatKey(row.key),
    data: history,
    format: row.format
  });
};


</script>

<style scoped>
.financial-table-wrapper {
  overflow-x: auto;
}
.no-data {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
  background: var(--card-bg); /* Ensure plain text has bg if sticky interferes */
}

.group-header {
  background-color: var(--card-bg);
  font-weight: 600;
  color: var(--text-primary);
  text-align: left;
}

.group-header td {
  padding-top: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border-color);
  
  /* Make sticky */
  position: sticky;
  left: 0;
  z-index: 30; /* Above row labels and trend */
  background-color: var(--card-bg);
}

.row-label {
  padding-left: 1.5rem;
  color: var(--text-secondary);
  
  /* Make sticky */
  position: sticky;
  left: 0;
  z-index: 25; /* Above trend column */
  background-color: var(--card-bg);
  border-right: 1px solid var(--border-color);
}

.trend-header {
  position: sticky;
  left: 180px; /* Estimate width of first col? No, row-label width varies */
  /* Actually, to stick the 2nd column, we need to know the width of the 1st. */
  /* This is hard without fixed widths. But maybe we don't sticky the Trend column? */
  /* User didn't explicitly ask for Trend to be sticky, but it's part of the "header" usually. */
  /* Let's Try keep it simple first: Not sticky, or give fixed width to row-label? */
  /* Given the screenshot, the "Trend" is part of the "metadata" of the row. */
  /* Let's try to make row-label AND trend sticky if possible? */
  /* For now, let's just make it a normal column. If user complains we fix it. */
  text-align: center;
  width: 80px; /* min width */
}

.trend-cell {
  text-align: center;
  padding: 0 10px;
  cursor: pointer;
  border: 2px solid transparent; /* Reserve space */
  border-radius: 4px;
  transition: border-color 0.2s;
}

.trend-cell:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.trend-cell.selected {
  border-color: var(--accent-color);
  background-color: rgba(88, 166, 255, 0.1);
}
</style>
