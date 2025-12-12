<template>
  <div class="financial-table-wrapper">
    <table v-if="displayData && displayData.length">
      <thead>
        <tr>
          <th>Year-Period</th>
          <th v-for="(item, index) in displayData" :key="index">
            {{ formatDateHeader(item) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-if="groups">
          <template v-for="group in groups" :key="group.name">
            <tr class="group-header">
              <td :colspan="displayData.length + 1">{{ group.name }}</td>
            </tr>
            <tr v-for="row in group.rows" :key="row.label">
              <td class="row-label">{{ row.label }}</td>
              <td v-for="(item, index) in displayData" :key="index">
                {{ formatValue(getValue(item, row), row.format) }}
              </td>
            </tr>
          </template>
        </template>
        <template v-else>
          <tr v-for="key in keys" :key="key">
            <td>{{ formatKey(key) }}</td>
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
  }
});

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
</script>

<style scoped>
.financial-table-wrapper {
  overflow-x: auto;
}
.no-data {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
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
  z-index: 25; /* Above row labels */
  background-color: var(--card-bg);
}

.row-label {
  padding-left: 1.5rem;
  color: var(--text-secondary);
  
  /* Make sticky */
  position: sticky;
  left: 0;
  z-index: 20; /* Above normal cells */
  background-color: var(--card-bg);
  border-right: 1px solid var(--border-color);
}
</style>
