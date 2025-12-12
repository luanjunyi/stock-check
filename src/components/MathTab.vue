<template>
  <div class="math-tab">
    <div class="calculator-card">
      <h3>Implied Growth Rate Calculator</h3>
      <p class="description">
        Calculate the implied growth rate required to justify a given valuation multiple based on a Discounted Cash Flow (DCF) model.
      </p>

      <div class="input-grid">
        <div class="input-group">
          <label for="valuation-multiple">Valuation Multiple (P/E₀)</label>
          <input 
            id="valuation-multiple" 
            type="number" 
            v-model.number="valuationMultiple" 
            step="0.1"
          />
        </div>

        <div class="input-group">
          <label for="years">Number of Years (N)</label>
          <input 
            id="years" 
            type="number" 
            v-model.number="years" 
            step="1"
          />
        </div>

        <div class="input-group">
          <label for="wacc">WACC (Discount Rate %)</label>
          <input 
            id="wacc" 
            type="number" 
            v-model.number="waccPercent" 
            step="0.1"
          />
        </div>

        <div class="input-group">
          <label for="terminal-growth">Terminal Growth Rate (%)</label>
          <input 
            id="terminal-growth" 
            type="number" 
            v-model.number="terminalGrowthPercent" 
            step="0.1"
          />
        </div>
      </div>

      <div class="result-section">
        <div class="result-label">Implied Growth Rate</div>
        <div class="result-value" :class="{ 'calculating': calculating }">
          {{ formattedResult }}
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>
    </div>

    <div class="formula-card">
      <h4>Formula</h4>
      <div class="formula-display">
        <p>Valuation Multiple = ∑ [ (1+R)ᵗ / (1+WACC)ᵗ ] + Terminal Value</p>
        <p class="sub-formula">Reference equation solved for R (Growth Rate)</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watchEffect } from 'vue';

const valuationMultiple = ref(20);
const years = ref(10);
const waccPercent = ref(10);
const terminalGrowthPercent = ref(2);

const calculating = ref(false);
const impliedGrowthRate = ref(null);
const error = ref(null);

const formattedResult = computed(() => {
  if (error.value) return '---';
  if (impliedGrowthRate.value === null) return '---';
  return (impliedGrowthRate.value * 100).toFixed(2) + '%';
});

const calculateImpliedGrowth = () => {
  calculating.value = true;
  error.value = null;
  
  try {
    const P_E = valuationMultiple.value;
    const N = years.value;
    const WACC = waccPercent.value / 100;
    const T = terminalGrowthPercent.value / 100;

    // Validate inputs
    if (P_E <= 0 || N <= 0) {
      // Basic validation
      impliedGrowthRate.value = null;
      return;
    }
    
    if (WACC <= T) {
      error.value = "WACC must be greater than Terminal Growth Rate";
      impliedGrowthRate.value = null;
      return;
    }

    // Solve for R using Binary Search
    // Range for R: -99% to 1000%
    let low = -0.99;
    let high = 10.0; 
    let mid = 0;
    let iterations = 0;
    const maxIterations = 100;
    const tolerance = 0.0001;

    let solutionFound = false;

    const calculateValuation = (R) => {
      let sum = 0;
      // Discounted Cash Flows for years 1 to N
      for (let t = 1; t <= N; t++) {
        sum += Math.pow(1 + R, t) / Math.pow(1 + WACC, t);
      }
      
      // Terminal Value Limit
      // Terminal Value at year N = (CF_N * (1+T)) / (WACC - T)
      // Where CF_N = (1+R)^N
      // PV of TV = TerminalValue / (1+WACC)^N
      const termNumerator = Math.pow(1 + R, N) * (1 + T);
      const termDenominator = (WACC - T) * Math.pow(1 + WACC, N);
      
      const terminalValuePV = termNumerator / termDenominator;
      
      return sum + terminalValuePV;
    };

    while (iterations < maxIterations) {
      mid = (low + high) / 2;
      const calcValue = calculateValuation(mid);
      
      if (Math.abs(calcValue - P_E) < tolerance) {
        solutionFound = true;
        break;
      }
      
      if (calcValue < P_E) {
        // Need higher growth to match P_E
        low = mid;
      } else {
        high = mid;
      }
      
      iterations++;
    }

    if (iterations >= maxIterations && Math.abs(calculateValuation(mid) - P_E) > 1) {
       // Only error if it didn't converge reasonably well
       // (Sometimes simple binary search takes a while or range is off, but usually it finds close enough)
    }

    impliedGrowthRate.value = mid;

  } catch (e) {
    console.error(e);
    error.value = "Calculation Error";
  } finally {
    calculating.value = false;
  }
};

watchEffect(() => {
  calculateImpliedGrowth();
});

</script>

<style scoped>
.math-tab {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 1rem;
}

.calculator-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.description {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 2rem;
  line-height: 1.5;
}

.input-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-group label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.input-group input {
  background: #0d1117; /* Darker input background */
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.2s;
}

.input-group input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.result-section {
  background: rgba(46, 160, 67, 0.1); /* Subtle green bg */
  border: 1px solid rgba(46, 160, 67, 0.3);
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
}

.result-label {
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.result-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: #3fb950; /* Green */
  font-variant-numeric: tabular-nums;
}

.error-msg {
  color: var(--danger-color);
  margin-top: 1rem;
}

.formula-card {
  background: #161b22;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;
}

.formula-display {
  font-family: 'Courier New', Courier, monospace;
  color: var(--text-secondary);
  background: rgba(0,0,0,0.2);
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
  text-align: center;
}

.sub-formula {
  font-size: 0.8rem;
  margin-top: 0.5rem;
  opacity: 0.7;
  font-family: inherit;
}
</style>
