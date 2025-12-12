<template>
  <div class="card chart-container">
    <div class="header-row">
      <h2>Price History ({{ symbol }})</h2>
      <div class="controls">
        <button 
          v-for="p in periods" 
          :key="p" 
          :class="{ active: selectedPeriod === p }"
          @click="selectPeriod(p)"
        >
          {{ p }}
        </button>
      </div>
    </div>
    
    <div v-if="loading" class="loading">Loading Chart...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="chart-wrapper">
      <Line :data="chartData" :options="chartOptions" />
    </div>

    <div class="slider-container" v-if="!loading && !error && selectedPeriod !== '1D'"> <!-- No slider for 1D for now -->
      <div class="slider-track"></div>
      <div 
        class="slider-range"
        :style="{ left: sliderLeft + '%', width: sliderWidth + '%' }"
      ></div>
      <input 
        type="range" 
        min="0" 
        :max="totalPoints" 
        v-model.number="rangeStart" 
        @input="onSliderInput('start')"
        class="slider-input start"
      />
      <input 
        type="range" 
        min="0" 
        :max="totalPoints" 
        v-model.number="rangeEnd" 
        @input="onSliderInput('end')"
        class="slider-input end"
      />
      
      <!-- Markers -->
      <div class="slider-markers">
        <span 
          v-for="(marker, idx) in sliderMarkers" 
          :key="idx" 
          class="marker-label"
          :style="{ left: marker.left + '%' }"
        >
          {{ marker.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController, // Import BarController
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'vue-chartjs';
import { fmpService } from '../services/fmp';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController, // Register BarController
  Title,
  Tooltip,
  Legend,
  Filler
);

const props = defineProps({
  symbol: {
    type: String,
    required: true
  }
});

const periods = ['1D', '1W', '1M', '3M', '6M', '1Y', '3Y', '5Y', 'Max'];
const selectedPeriod = ref('1Y');

const loading = ref(true);
const error = ref(null);

// Data Storage
const fullHistoricalData = ref([]); // Daily data (oldest to newest)
const intradayData = ref([]);       // 1D data (oldest to newest)

// Slider State (indices)
const rangeStart = ref(0);
const rangeEnd = ref(100);
const totalPoints = ref(100);

const chartData = computed(() => {
  let data = [];
  
  if (selectedPeriod.value === '1D') {
    data = intradayData.value;
  } else {
    // Slice full history based on slider range
    // Ensure range is valid
    const start = Math.min(rangeStart.value, rangeEnd.value);
    const end = Math.max(rangeStart.value, rangeEnd.value);
    data = fullHistoricalData.value.slice(start, end + 1);
  }

  return {
    labels: data.map(d => d.date.substring(0, 16)), // Date or DateTime
    datasets: [
      {
        type: 'line',
        label: props.symbol,
        yAxisID: 'y',
        backgroundColor: (ctx) => {
          const canvas = ctx.chart.ctx;
          const gradient = canvas.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(88, 166, 255, 0.5)');
          gradient.addColorStop(1, 'rgba(88, 166, 255, 0)');
          return gradient;
        },
        borderColor: '#58a6ff',
        pointRadius: 0,
        pointHoverRadius: 4,
        data: data.map(d => selectedPeriod.value === '1D' ? d.close : d.adjClose),
        fill: true,
        tension: 0.1,
        order: 1
      },
      {
        type: 'bar',
        label: 'Volume',
        yAxisID: 'y1',
        backgroundColor: 'rgba(48, 54, 61, 0.8)', // Darker bar color
        data: data.map(d => d.volume),
        barPercentage: 0.5,
        order: 2
      }
    ]
  };
});

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: '#161b22',
      titleColor: '#c9d1d9',
      bodyColor: '#c9d1d9',
      borderColor: '#30363d',
      borderWidth: 1
    }
  },
  scales: {
    x: {
      display: true,
      grid: {
        display: false,
        drawBorder: false
      },
      ticks: {
        color: '#8b949e',
        maxTicksLimit: 8,
        maxRotation: 0,
        autoSkip: true,
        callback: function(val, index) {
          // 'this' is the axis instance. 'val' is the index for Category scale.
          // access label via: this.getLabelForValue(val)
          const label = this.getLabelForValue(val);
          if (!label) return '';

          const date = new Date(label);
          const period = selectedPeriod.value;

          if (period === '1D') {
            // HH:MM
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
          
          if (['1W', '1M', '3M'].includes(period)) {
             // MMM D
             return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
          }

          if (['6M', '1Y', 'YTD'].includes(period)) {
             // MMM YYYY
             return date.toLocaleDateString([], { month: 'short', year: '2-digit' });
          }

          // > 1Y
          return date.getFullYear();
        }
      }
    },
    y: {
      type: 'linear',
      display: true,
      position: 'left',
      grid: { color: '#30363d' },
      ticks: { color: '#8b949e' }
    },
    y1: {
      type: 'linear',
      display: true,
      position: 'right',
      grid: {
        drawOnChartArea: false, // only want the grid lines for one axis to show up
      },
      ticks: {
        color: '#484f58', // Dimmer implementation for secondary axis
        callback: function(value) {
            if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
            if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
            if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
            return value;
        }
      },
      // Optional: Suggest max to push bars down? Use min: 0 default.
      beginAtZero: true
    }
  }
}));

// CSS-based Slider visual properties
const sliderLeft = computed(() => {
  if (totalPoints.value === 0) return 0;
  return (Math.min(rangeStart.value, rangeEnd.value) / totalPoints.value) * 100;
});

const sliderWidth = computed(() => {
  if (totalPoints.value === 0) return 100;
  const start = Math.min(rangeStart.value, rangeEnd.value);
  const end = Math.max(rangeStart.value, rangeEnd.value);
  return ((end - start) / totalPoints.value) * 100;
});

const sliderMarkers = computed(() => {
  if (fullHistoricalData.value.length === 0) return [];
  
  const markers = [];
  const count = 6; // Number of markers
  const step = Math.floor(totalPoints.value / (count - 1));
  
  for (let i = 0; i < count; i++) {
    const idx = Math.min(i * step, totalPoints.value - 1);
    const item = fullHistoricalData.value[idx];
    if (item && item.date) {
      const date = new Date(item.date);
      markers.push({
        left: (idx / totalPoints.value) * 100,
        label: date.getFullYear()
      });
    }
  }
  return markers;
});


const onSliderInput = (handle) => {
  // Logic to prevent crossing can go here if strictly needed, 
  // but Math.min/max in slice handles it nicely.
  // We might want to switch period to 'Custom' if user drags?
  // User didn't strictly ask for 'Custom' button, but implicit behavior.
  // For now, let's keep the period active or just visual.
};

const selectPeriod = async (period) => {
  selectedPeriod.value = period;
  
  if (period === '1D') {
    await fetchIntraday();
    return; // Slider disabled for 1D
  }

  // Set slider range based on period logic
  const len = fullHistoricalData.value.length;
  if (len === 0) return;

  totalPoints.value = len;
  rangeEnd.value = len - 1;

  const now = new Date();
  let pastDate = new Date();

  switch (period) {
    case '1W': pastDate.setDate(now.getDate() - 7); break;
    case '1M': pastDate.setMonth(now.getMonth() - 1); break;
    case '3M': pastDate.setMonth(now.getMonth() - 3); break;
    case '6M': pastDate.setMonth(now.getMonth() - 6); break;
    case '1Y': pastDate.setFullYear(now.getFullYear() - 1); break;
    case '3Y': pastDate.setFullYear(now.getFullYear() - 3); break;
    case '5Y': pastDate.setFullYear(now.getFullYear() - 5); break;
    case 'Max': pastDate = new Date(0); break; // Very old date
  }

  // Find index closest to pastDate
  // Data is Oldest -> Newest.
  // We want to find the first index where data.date >= pastDate
  const cutoff = pastDate.toISOString().split('T')[0];
  const idx = fullHistoricalData.value.findIndex(d => d.date >= cutoff);
  
  rangeStart.value = idx >= 0 ? idx : 0;
};

const fetchHistory = async () => {
  loading.value = true;
  error.value = null;
  try {
    const data = await fmpService.getHistoricalPrice(props.symbol);
    if (data.historical) {
      // API returns Newest -> Oldest. Reverse it.
      fullHistoricalData.value = [...data.historical].reverse();
      totalPoints.value = fullHistoricalData.value.length;
      
      // Initial set to 1Y
      selectPeriod('1Y');
    } else {
      error.value = 'No historical data found';
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const fetchIntraday = async () => {
  loading.value = true;
  try {
    const data = await fmpService.getIntraday(props.symbol);
    // data is array of { date: "YYYY-MM-DD HH:mm:ss", close: ... }
    // Usually Newest -> Oldest
    if (Array.isArray(data)) {
      intradayData.value = [...data].reverse();
    } else {
      intradayData.value = [];
    }
  } catch (err) {
    console.error(err);
    // Fallback? or just show empty
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchHistory();
});

watch(() => props.symbol, () => {
  fetchHistory();
});
</script>

<style scoped>
.chart-container {
  height: 550px; /* Increased height for controls */
  display: flex;
  flex-direction: column;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.controls {
  display: flex;
  gap: 4px;
  background: #2d333b;
  padding: 4px;
  border-radius: 6px;
}

.controls button {
  background: transparent;
  border: none;
  color: #8b949e;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.2s;
}

.controls button:hover {
  color: #c9d1d9;
}

.controls button.active {
  background: #58a6ff;
  color: #ffffff;
}

.chart-wrapper {
  flex: 1;
  position: relative;
  min-height: 0; 
}

/* Slider Styles */
.slider-container {
  position: relative;
  height: 40px;
  margin-top: 10px;
  width: 100%;
}

.slider-track {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 4px;
  background: #30363d;
  border-radius: 2px;
  transform: translateY(-50%);
}

.slider-range {
  position: absolute;
  top: 50%;
  height: 4px;
  background: #58a6ff;
  transform: translateY(-50%);
  pointer-events: none; /* Let clicks pass through */
}

.slider-input {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 100%;
  pointer-events: none; /* Allow trying to click through */
  appearance: none;
  background: transparent;
  margin: 0;
  outline: none;
}

/* Enable pointer events for the thumb/handle only */
.slider-input::-webkit-slider-thumb {
  pointer-events: auto;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #58a6ff;
  cursor: pointer;
  position: relative;
  z-index: 10;
}

.slider-input::-moz-range-thumb {
  pointer-events: auto;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #58a6ff;
  cursor: pointer;
  position: relative;
  z-index: 10;
}

.slider-markers {
  position: absolute;
  top: 28px; /* Lowered further below the track */
  width: 100%;
  height: 20px;
  pointer-events: none;
}

.marker-label {
  position: absolute;
  transform: translateX(-50%);
  font-size: 10px;
  color: #8b949e;
}
</style>
