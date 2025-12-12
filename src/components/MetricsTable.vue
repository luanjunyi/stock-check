<template>
  <div class="metrics-table-wrapper">
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th class="sticky-col">Metrics</th>
            <th class="trend-header">Trend</th>
            <th v-for="period in periods" :key="period">
              {{ period }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groups" :key="group.name">
            <tr class="group-header" @click="toggleGroup(group.name)">
              <td class="sticky-col" :style="{ zIndex: 30 }">
                <span :class="['arrow', { down: !collapsed[group.name] }]">▶</span>
                {{ group.name }}
              </td>
              <!-- colspan + 1 for Trend column -->
              <td :colspan="periods.length + 1"></td>
            </tr>
            <template v-if="!collapsed[group.name]">
              <tr v-for="row in group.rows" :key="row.label">
                <td class="sticky-col row-label">
                  {{ row.label }}
                </td>
                <td 
                  class="trend-cell" 
                  :class="{ selected: row.label === selectedMetricKey }"
                  @click="onTrendClick(row)"
                >
                  <svg width="60" height="20" viewBox="0 0 60 20">
                    <path 
                      :d="getSparklinePath(row.values)" 
                      :stroke="getSparklineColor(row.values)"
                      fill="none"
                      stroke-width="1.5"
                    />
                  </svg>
                </td>
                <td v-for="(val, idx) in row.values" :key="idx">
                  {{ formatValue(val, row.format) }}
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  income: { type: Array, default: () => [] },
  balance: { type: Array, default: () => [] },
  cash: { type: Array, default: () => [] },
  metrics: { type: Array, default: () => [] },
  ratios: { type: Array, default: () => [] },
  ttmMode: { type: Boolean, default: false },
  selectedMetricKey: { type: String, default: null }
});

const emit = defineEmits(['select-metric']);

const collapsed = ref({});

const toggleGroup = (name) => {
  collapsed.value[name] = !collapsed.value[name];
};

// Helper: safe division
const div = (a, b) => (b ? a / b : null);

// Helpers for TTM
const getHistoricalWindow = (data, index, count = 4) => {
  if (index + count > data.length) return null; // Not enough data
  return data.slice(index, index + count);
};

const sum = (window, type, key) => {
  if (!window) return null;
  return window.reduce((acc, curr) => acc + (curr[type]?.[key] || 0), 0);
};

const avg = (window, type, key) => {
  if (!window) return null;
  const s = sum(window, type, key);
  return s !== null ? s / window.length : null;
};

// Merge data by date (latest first). 
const mergedData = computed(() => {
  const map = new Map();
  
  const process = (arr, type) => {
    arr.forEach(item => {
      const key = `${item.date}`; 
      if (!map.has(key)) map.set(key, { date: item.date, fillingDate: item.fillingDate, period: `${item.calendarYear} ${item.period}` });
      const obj = map.get(key);
      if (!obj.fillingDate && item.fillingDate) obj.fillingDate = item.fillingDate; // Ensure we capture it
      obj[type] = item;
    });
  };

  process(props.income, 'income');
  process(props.balance, 'balance');
  process(props.cash, 'cash');
  process(props.metrics, 'metrics');
  process(props.ratios, 'ratios');

  return Array.from(map.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
});

const periods = computed(() => mergedData.value.map(d => {
  const dateStr = d.fillingDate || d.date;
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  let year = date.getFullYear();
  const month = date.getMonth();
  let quarter = Math.floor(month / 3) + 1;
  
  // Previous quarter logic
  if (quarter === 1) {
    quarter = 4;
    year--;
  } else {
    quarter--;
  }
  
  return `${year} Q${quarter}`;
}));

// Row definitions
// We need to pass index to getValues to support TTM lookbacks
const groups = computed(() => {
  const data = mergedData.value;
  const isTTM = props.ttmMode;
  
  const getValues = (fn) => data.map((d, i) => {
    try {
      return fn(d, i, data);
    } catch (e) {
      return null;
    }
  });

  // TTM Helpers local to this scope to use 'data' if needed, but getValues passes 'd, i, data'
  const ttmSum = (i, arr, type, key) => sum(getHistoricalWindow(arr, i, 4), type, key);
  
  return [
    {
      name: 'Margins',
      rows: [
        { 
          label: 'Gross Margin', 
          format: 'percent', 
          values: getValues((d, i, arr) => {
            if (isTTM) {
              const gp = ttmSum(i, arr, 'income', 'grossProfit');
              const rev = ttmSum(i, arr, 'income', 'revenue');
              return div(gp, rev);
            }
            return d.ratios?.grossProfitMargin || div(d.income?.grossProfit, d.income?.revenue);
          }) 
        },
        { 
          label: 'SGA Margin', 
          format: 'percent', 
          values: getValues((d, i, arr) => {
            if (isTTM) {
              const sga = ttmSum(i, arr, 'income', 'sellingGeneralAndAdministrativeExpenses');
              const rev = ttmSum(i, arr, 'income', 'revenue');
              return div(sga, rev);
            }
            return div(d.income?.sellingGeneralAndAdministrativeExpenses, d.income?.revenue);
          })
        }, 
        { 
          label: 'Operating Margin', 
          format: 'percent', 
          values: getValues((d, i, arr) => {
             if (isTTM) {
               const op = ttmSum(i, arr, 'income', 'operatingIncome');
               const rev = ttmSum(i, arr, 'income', 'revenue');
               return div(op, rev);
             }
             return d.ratios?.operatingProfitMargin;
          }) 
        },
        { 
          label: 'EBITDA Margin', 
          format: 'percent', 
          values: getValues((d, i, arr) => {
            if (isTTM) {
               const ebitda = ttmSum(i, arr, 'income', 'ebitda');
               const rev = ttmSum(i, arr, 'income', 'revenue');
               return div(ebitda, rev);
            }
            return div(d.income?.ebitda, d.income?.revenue);
          }) 
        },
        { 
          label: 'Net Margin', 
          format: 'percent', 
          values: getValues((d, i, arr) => {
            if (isTTM) {
               const ni = ttmSum(i, arr, 'income', 'netIncome');
               const rev = ttmSum(i, arr, 'income', 'revenue');
               return div(ni, rev);
            }
            return d.ratios?.netProfitMargin;
          }) 
        },
        { 
          label: 'Free Cash Flow Margin', 
          format: 'percent', 
          values: getValues((d, i, arr) => {
            if (isTTM) {
               const fcf = ttmSum(i, arr, 'cash', 'freeCashFlow');
               const rev = ttmSum(i, arr, 'income', 'revenue');
               return div(fcf, rev);
            }
            return div(d.cash?.freeCashFlow, d.income?.revenue);
          }) 
        },
        { 
           label: 'Operating Cash Flow Margin', 
           format: 'percent', 
           values: getValues((d, i, arr) => {
             if (isTTM) {
                const ocf = ttmSum(i, arr, 'cash', 'operatingCashFlow');
                const rev = ttmSum(i, arr, 'income', 'revenue');
                return div(ocf, rev);
             }
             return d.ratios?.operatingCashFlowSalesRatio;
           }) 
        },
      ]
    },
    {
      name: 'Valuation Metrics',
      rows: [
        { label: 'Market Cap', format: 'currency', values: getValues(d => d.metrics?.marketCap) }, // Snapshot
        { label: 'Enterprise Value', format: 'currency', values: getValues(d => d.metrics?.enterpriseValue) },
        { 
          label: 'Price to Sales', 
          format: 'number', 
          values: getValues((d, i, arr) => {
            if (isTTM) {
               const rev = ttmSum(i, arr, 'income', 'revenue');
               return div(d.metrics?.marketCap, rev);
            }
            return d.metrics?.priceToSalesRatio ?? d.ratios?.priceToSalesRatio;
          }) 
        }, 
        { 
          label: 'Price to Gross', 
          format: 'number', 
          values: getValues((d, i, arr) => {
            if (isTTM) {
               const gp = ttmSum(i, arr, 'income', 'grossProfit');
               return div(d.metrics?.marketCap, gp);
            }
            return div(d.metrics?.marketCap, d.income?.grossProfit);
          }) 
        },
        { 
          label: 'Price to Operating Cash Flow', 
          format: 'number', 
          values: getValues((d, i, arr) => {
            if (isTTM) {
               const ocf = ttmSum(i, arr, 'cash', 'operatingCashFlow');
               return div(d.metrics?.marketCap, ocf);
            }
            return d.ratios?.priceToOperatingCashFlowsRatio;
          }) 
        },
        { 
          label: 'Price to Operating Income', 
          format: 'number', 
          values: getValues((d, i, arr) => {
            if (isTTM) {
               const op = ttmSum(i, arr, 'income', 'operatingIncome');
               return div(d.metrics?.marketCap, op);
            }
            return div(d.metrics?.marketCap, d.income?.operatingIncome);
          }) 
        },
        { 
          label: 'Price to Earnings', 
          format: 'number', 
          values: getValues((d, i, arr) => {
            if (isTTM) {
               const ni = ttmSum(i, arr, 'income', 'netIncome');
               return div(d.metrics?.marketCap, ni);
            }
            return d.metrics?.peRatio;
          }) 
        },
        { 
          label: 'Price to Free Cash Flow', 
          format: 'number', 
          values: getValues((d, i, arr) => {
            if (isTTM) {
               const fcf = ttmSum(i, arr, 'cash', 'freeCashFlow');
               return div(d.metrics?.marketCap, fcf);
            }
            return d.metrics?.pfcfRatio;
          }) 
        },
      ]
    }, 
    {
      name: 'Management',
      rows: [
        { label: 'Return On Assets', format: 'percent', values: getValues((d,i,arr) => isTTM ? div(ttmSum(i,arr,'income','netIncome'), d.balance?.totalAssets) : d.ratios?.returnOnAssets) }, // Approx for TTM: NetIncome(TTM) / Last Assets
        { label: 'Return On Capital Employed', format: 'percent', values: getValues(d => d.ratios?.returnOnCapitalEmployed) }, // Skipping complex calc for now unless critical
        { label: 'Return On Equity', format: 'percent', values: getValues((d,i,arr) => isTTM ? div(ttmSum(i,arr,'income','netIncome'), d.balance?.totalStockholdersEquity) : d.ratios?.returnOnEquity) },
        { label: 'Return On Invested Capital', format: 'percent', values: getValues(d => d.metrics?.roic) },
      ]
    },
    {
      name: 'Stock Based Compensation',
      rows: [
        { label: 'SBC as a % of FCF', format: 'percent', values: getValues((d,i,arr) => isTTM ? div(ttmSum(i,arr,'cash','stockBasedCompensation'), ttmSum(i,arr,'cash','freeCashFlow')) : div(d.cash?.stockBasedCompensation, d.cash?.freeCashFlow)) },
        { label: 'SBC as a % of OCF', format: 'percent', values: getValues((d,i,arr) => isTTM ? div(ttmSum(i,arr,'cash','stockBasedCompensation'), ttmSum(i,arr,'cash','operatingCashFlow')) : div(d.cash?.stockBasedCompensation, d.cash?.operatingCashFlow)) },
        { label: 'SBC as a % of Revenue', format: 'percent', values: getValues((d,i,arr) => isTTM ? div(ttmSum(i,arr,'cash','stockBasedCompensation'), ttmSum(i,arr,'income','revenue')) : d.metrics?.stockBasedCompensationToRevenue) },
        { label: 'FCF Excl. SBC Yield', format: 'percent', values: getValues((d,i,arr) => isTTM ? div(ttmSum(i,arr,'cash','freeCashFlow') - ttmSum(i,arr,'cash','stockBasedCompensation'), d.metrics?.marketCap) : div(d.cash?.freeCashFlow - d.cash?.stockBasedCompensation, d.metrics?.marketCap)) }, 
      ]
    },
    {
      name: 'Per Share',
      rows: [
        { label: 'Free Cash Flow Per Share', format: 'number', values: getValues((d,i,arr) => isTTM ? ttmSum(i,arr,'metrics','freeCashFlowPerShare') : d.metrics?.freeCashFlowPerShare) }, // Summing per share is okay if share count stable, else FCF(TTM)/Shares
        { label: 'Operating Cash Flow Per Share', format: 'number', values: getValues((d,i,arr) => isTTM ? ttmSum(i,arr,'metrics','operatingCashFlowPerShare') : d.metrics?.operatingCashFlowPerShare) },
        { label: 'Revenue Per Share', format: 'number', values: getValues((d,i,arr) => isTTM ? ttmSum(i,arr,'metrics','revenuePerShare') : d.metrics?.revenuePerShare) },
      ]
    },
    {
        name: 'Financial Health',
        rows: [
            { label: 'Debt to EBITDA Ratio', format: 'number', values: getValues((d,i,arr) => isTTM ? div(d.balance?.totalDebt, ttmSum(i,arr,'income','ebitda')) : div(d.balance?.totalDebt, d.income?.ebitda)) },
            { label: 'Interest Coverage Ratio', format: 'number', values: getValues(d => d.metrics?.interestCoverage ?? d.ratios?.interestCoverage) },
            { label: 'Net Debt', format: 'currency', values: getValues(d => d.balance?.netDebt) },
            { label: 'Total Debt', format: 'currency', values: getValues(d => d.balance?.totalDebt) },
        ]
    }
  ];
});

const formatValue = (val, format) => {
  if (val === null || val === undefined || isNaN(val)) return '--';
  
  if (format === 'percent') {
    return (val * 100).toFixed(2) + '%';
  }
  if (format === 'currency') {
    if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(2) + ' B';
    if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(2) + ' M';
    if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(2) + ' K';
    return val.toFixed(2);
  }
  if (format === 'number') {
    return val.toFixed(2);
  }
  return val;
};

// Initialize collapsed state
watch(groups, (newGroups) => {
  newGroups.forEach(g => {
    if (!(g.name in collapsed.value)) {
      collapsed.value[g.name] = false;
    }
  });
}, { immediate: true });

// Sparkline & Interaction
const getSparklineData = (values) => {
  // values are Newest -> Oldest (matching table columns)
  // Chart needs Oldest -> Newest
  return values
    .map(v => (typeof v === 'number' ? v : null))
    .filter(v => v !== null)
    .reverse();
};

const getSparklinePath = (rowValues) => {
  const values = getSparklineData(rowValues);
  if (values.length < 2) return '';
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  const width = 60;
  const height = 20;
  const margin = 2;
  
  if (range === 0) return `M 0,${height/2} L ${width},${height/2}`;
  
  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * width;
    const normalized = (val - min) / range;
    const y = height - margin - (normalized * (height - 2*margin));
    return `${x},${y}`;
  });
  
  return `M ${points.join(' L ')}`;
};

const getSparklineColor = (rowValues) => {
  const values = getSparklineData(rowValues);
  if (values.length < 2) return '#8b949e';
  const start = values[0]; // oldest
  const end = values[values.length - 1]; // newest
  return end >= start ? '#2ea043' : '#da3633';
};

const onTrendClick = (row) => {
  // Construct full history for chart
  // periods is Newest -> Oldest
  // row.values is Newest -> Oldest
  const history = periods.value.map((p, i) => ({
    period: p,
    value: row.values[i]
  })).filter(d => typeof d.value === 'number').reverse(); // Oldest -> Newest

  emit('select-metric', {
    key: row.label, // Metrics use Label as unique ID typically
    name: row.label,
    data: history,
    format: row.format
  });
};


</script>

<style scoped>
.metrics-table-wrapper {
  overflow-x: auto;
  max-width: 100%;
}
.table-container {
  display: inline-block;
  min-width: 100%;
}
table {
  border-collapse: collapse;
  width: 100%;
}
th, td {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border-color);
  text-align: right;
  white-space: nowrap;
  font-family: monospace;
  font-size: 0.9rem;
}
.sticky-col {
  position: sticky;
  left: 0;
  background: var(--card-bg);
  z-index: 10;
  text-align: left;
  border-right: 1px solid var(--border-color);
  min-width: 250px;
}
th.sticky-col {
  z-index: 20;
}
.group-header {
  background-color: #21262d;
  cursor: pointer;
  font-weight: 600;
  color: var(--text-primary);
}
.group-header:hover {
  background-color: #30363d;
}
.arrow {
  display: inline-block;
  font-size: 0.7rem;
  margin-right: 0.5rem;
  transition: transform 0.2s;
}
.arrow.down {
  transform: rotate(90deg);
}
.row-label {
  padding-left: 2rem;
  color: var(--text-secondary);
  display: block; /* Remove flex gap if we removed icons */
}

/* Trend Column Styles (Shared concept with FinancialTable) */
.trend-header {
  position: sticky;
  left: 250px; /* Width of metric label col */
  z-index: 20; /* Same as sticky headers */
  background: var(--card-bg);
  text-align: center;
  min-width: 80px;
  border-right: 1px solid var(--border-color); /* Separator */
}

.trend-cell {
  position: sticky;
  left: 250px;
  z-index: 10;
  background: var(--card-bg);
  text-align: center;
  padding: 0 10px;
  cursor: pointer;
  border-right: 1px solid var(--border-color);
  border-top: 2px solid transparent; /* Maintain height balance */
  border-bottom: 2px solid transparent; 
  /* We use box-shadow or internal border for selection to avoid layout shift? 
     Or just standard border logic if box-sizing border-box. */
}

.trend-cell:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.trend-cell.selected {
  /* Highlight */
  box-shadow: inset 0 0 0 2px var(--accent-color);
  background-color: rgba(88, 166, 255, 0.1);
}
</style>
