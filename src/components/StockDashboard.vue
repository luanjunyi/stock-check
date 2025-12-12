<template>
  <div id="app-container">
    <header>
      <div class="logo">StockCheck</div>
      <div class="search-bar">
        <input 
          :value="searchInput" 
          @input="searchInput = $event.target.value.toUpperCase()" 
          @keyup.enter="updateSymbol" 
          placeholder="Enter Symbol (e.g. AAPL)" 
          type="text"
        />
        <button @click="updateSymbol">Go</button>
      </div>
    </header>

    <main>
      <!-- Top Part: Graph -->
      <section class="top-module">
        <StockChart :symbol="symbol" />
      </section>

      <!-- Bottom Part: Detailed Data -->
      <section class="bottom-module card">
        <div class="tabs-header">
          <div class="tabs">
            <button 
              v-for="tab in tabs" 
              :key="tab.id"
              :class="{ active: activeTab === tab.id }"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>
          
          <div class="view-toggles">
             <div class="toggle-group">
               <button 
                 :class="{ active: viewMode === 'Q' }" 
                 @click="viewMode = 'Q'"
               >Q</button>
               <button 
                 :class="{ active: viewMode === 'TTM' }" 
                 @click="viewMode = 'TTM'"
               >TTM</button>
             </div>
          </div>
        </div>

        <div class="tab-content">
          <div v-if="loadingFinancials" class="loading">Loading Financials...</div>
          <div v-else-if="errorFinancials" class="error">{{ errorFinancials }}</div>
          
          <MetricsTable 
            v-else-if="activeTab === 'metrics'"
            :income="financialData.income"
            :balance="financialData.balance"
            :cash="financialData.cash"
            :metrics="financialData.metrics"
            :ratios="financialData.ratios"
            :ttm-mode="viewMode === 'TTM'"
          />
          
          <FinancialTable 
            v-else 
            :data="currentData" 
            :type="activeTab" 
            :ttm-mode="viewMode === 'TTM'"
            :groups="activeTab === 'income' ? incomeStatementGroups : (activeTab === 'balance' ? balanceSheetGroups : (activeTab === 'cash' ? cashFlowGroups : null))"
          />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import StockChart from './StockChart.vue';
import FinancialTable from './FinancialTable.vue';
import MetricsTable from './MetricsTable.vue';
import { fmpService } from '../services/fmp';

const route = useRoute();
const router = useRouter();

// State derived from URL
const symbol = computed(() => route.params.symbol || 'NVDA');
const activeTab = computed({
  get: () => route.query.tab || 'income',
  set: (val) => updateQuery({ tab: val })
});
const viewMode = computed({
  get: () => route.query.mode || 'TTM',
  set: (val) => updateQuery({ mode: val })
});

const searchInput = ref(symbol.value);

const updateQuery = (newQuery) => {
  router.push({
    params: { symbol: symbol.value },
    query: { ...route.query, ...newQuery }
  });
};

const tabs = [
  { id: 'income', label: 'Income Statement' },
  { id: 'balance', label: 'Balance Sheet' },
  { id: 'cash', label: 'Cash Flow' },
  { id: 'metrics', label: 'Metrics' }
];

const financialData = ref({
  income: [],
  balance: [],
  cash: [],
  metrics: [],
  ratios: []
});

const incomeStatementGroups = [
  {
    name: 'Gross Profit',
    rows: [
      { label: 'Revenue', key: 'revenue', format: 'currency' },
      { label: 'Cost of Revenue', key: 'costOfRevenue', format: 'currency' },
      { label: 'Gross Profit', key: 'grossProfit', format: 'currency' },
      { label: 'Gross Margin', key: 'grossProfitRatio', format: 'percent' },
    ]
  },
  {
    name: 'Operating Income',
    rows: [
      { label: 'R&D Expenses', key: 'researchAndDevelopmentExpenses', format: 'currency' },
      { label: 'SG&A Expenses', key: 'sellingGeneralAndAdministrativeExpenses', format: 'currency' },
      { label: 'Operating Expenses', key: 'operatingExpenses', format: 'currency' },
      { label: 'Operating Income', key: 'operatingIncome', format: 'currency' },
      { label: 'Operating Margin', key: 'operatingIncomeRatio', format: 'percent' }
    ]
  },
  {
    name: 'Other Expenses',
    rows: [
      { label: 'Other Expenses', key: 'otherExpenses', format: 'currency' },
      { label: 'Total Other Income/Expenses', key: 'totalOtherIncomeExpensesNet', format: 'currency' }
    ]
  },
  {
    name: 'Interest Expenses',
    rows: [
      { label: 'Interest Income', key: 'interestIncome', format: 'currency' },
      { label: 'Interest Expense', key: 'interestExpense', format: 'currency' }
    ]
  },
  {
    name: 'Tax',
    rows: [
      { label: 'Income Before Tax', key: 'incomeBeforeTax', format: 'currency' },
      { label: 'Income Tax Expense', key: 'incomeTaxExpense', format: 'currency' }
    ]
  },
  {
    name: 'Net Income',
    rows: [
      { label: 'Net Income', key: 'netIncome', format: 'currency' },
      { label: 'Net Margin', key: 'netIncomeRatio', format: 'percent' },
      { label: 'EPS', key: 'eps', format: 'number' },
      { label: 'EPS Diluted', key: 'epsdiluted', format: 'number' },
      { label: 'Weighted Average Shs Out', key: 'weightedAverageShsOut', format: 'number' },
      { label: 'Weighted Average Shs Out (Dil)', key: 'weightedAverageShsOutDil', format: 'number' },
    ]
  }
];

const balanceSheetGroups = [
  {
    name: 'Current Assets',
    rows: [
      { label: 'Cash & Cash Equivalents', key: 'cashAndCashEquivalents', format: 'currency' },
      { label: 'Short Term Investments', key: 'shortTermInvestments', format: 'currency' },
      { label: 'Net Receivables', key: 'netReceivables', format: 'currency' },
      { label: 'Inventory', key: 'inventory', format: 'currency' },
      { label: 'Other Current Assets', key: 'otherCurrentAssets', format: 'currency' },
      { label: 'Total Current Assets', key: 'totalCurrentAssets', format: 'currency' },
    ]
  },
  {
    name: 'Non Current Assets',
    rows: [
      { label: 'Property Plant & Equipment', key: 'propertyPlantEquipmentNet', format: 'currency' },
      { label: 'Long Term Investments', key: 'longTermInvestments', format: 'currency' },
      { label: 'Goodwill', key: 'goodwill', format: 'currency' },
      { label: 'Intangible Assets', key: 'intangibleAssets', format: 'currency' },
      { label: 'Other Non Current Assets', key: 'otherNonCurrentAssets', format: 'currency' },
      { label: 'Total Non Current Assets', key: 'totalNonCurrentAssets', format: 'currency' },
    ]
  },
  {
    name: 'Current Liabilities',
    rows: [
      { label: 'Accounts Payable', key: 'accountPayables', format: 'currency' },
      { label: 'Short Term Debt', key: 'shortTermDebt', format: 'currency' },
      { label: 'Tax Payables', key: 'taxPayables', format: 'currency' },
      { label: 'Deferred Revenue', key: 'deferredRevenue', format: 'currency' },
      { label: 'Other Current Liabilities', key: 'otherCurrentLiabilities', format: 'currency' },
      { label: 'Total Current Liabilities', key: 'totalCurrentLiabilities', format: 'currency' },
    ]
  },
  {
    name: 'Non Current Liabilities',
    rows: [
      { label: 'Long Term Debt', key: 'longTermDebt', format: 'currency' },
      { label: 'Deferred Revenue Non Current', key: 'deferredRevenueNonCurrent', format: 'currency' },
      { label: 'Other Non Current Liabilities', key: 'otherNonCurrentLiabilities', format: 'currency' },
      { label: 'Total Non Current Liabilities', key: 'totalNonCurrentLiabilities', format: 'currency' },
    ]
  },
  {
    name: 'Equity',
    rows: [
      { label: 'Common Stock', key: 'commonStock', format: 'currency' },
      { label: 'Retained Earnings', key: 'retainedEarnings', format: 'currency' },
      { label: 'Accum. Other Comprehensive Income', key: 'accumulatedOtherComprehensiveIncomeLoss', format: 'currency' },
      { label: 'Total Stockholders Equity', key: 'totalStockholdersEquity', format: 'currency' },
      { label: 'Total Liabilities & Equity', key: 'totalLiabilitiesAndStockholdersEquity', format: 'currency' },
    ]
  }
];



const cashFlowGroups = [
  {
    name: 'Operation',
    rows: [
      { label: 'Operating Cash Flow', key: 'operatingCashFlow', format: 'currency' },
      { label: 'Net Income', key: 'netIncome', format: 'currency' },
      { label: 'Depreciation & Amortization', key: 'depreciationAndAmortization', format: 'currency' },
      { label: 'Deferred Income Tax', key: 'deferredIncomeTax', format: 'currency' },
      { label: 'Stock Based Compensation', key: 'stockBasedCompensation', format: 'currency' },
      { label: 'Accounts Receivables', key: 'accountsReceivables', format: 'currency' },
      { label: 'Inventory', key: 'inventory', format: 'currency' },
      { label: 'Accounts Payables', key: 'accountsPayables', format: 'currency' },
      { label: 'Other Working Capital', key: 'otherWorkingCapital', format: 'currency' },
      { label: 'Change In Working Capital', key: 'changeInWorkingCapital', format: 'currency' },
      { label: 'Other Non Cash Items', key: 'otherNonCashItems', format: 'currency' },
    ]
  },
  {
    name: 'Investing',
    rows: [
      { label: 'Net Cash Used For Investing', key: 'netCashUsedForInvestingActivites', format: 'currency' },
      { label: 'Capital Expenditure', key: 'capitalExpenditure', format: 'currency' },
      { label: 'Acquisitions Net', key: 'acquisitionsNet', format: 'currency' },
      { label: 'Purchases Of Investments', key: 'purchasesOfInvestments', format: 'currency' },
      { label: 'Sales/Maturities Of Investments', key: 'salesMaturitiesOfInvestments', format: 'currency' },
      { label: 'Other Investing Activities', key: 'otherInvestingActivites', format: 'currency' },
    ]
  },
  {
    name: 'Financing',
    rows: [
      { label: 'Net Cash Used/Provided By Financing', key: 'netCashUsedProvidedByFinancingActivities', format: 'currency' },
      { label: 'Debt Repayment', key: 'debtRepayment', format: 'currency' },
      { label: 'Common Stock Issued', key: 'commonStockIssued', format: 'currency' },
      { label: 'Common Stock Repurchased', key: 'commonStockRepurchased', format: 'currency' },
      { label: 'Dividends Paid', key: 'dividendsPaid', format: 'currency' },
      { label: 'Other Financing Activities', key: 'otherFinancingActivites', format: 'currency' },
    ]
  },
  {
    name: 'Free Cash Flow',
    rows: [
      { label: 'Cash from Operation', key: 'operatingCashFlow', format: 'currency' },
      { label: 'Investment in PPE', key: 'investmentsInPropertyPlantAndEquipment', format: 'currency' }, // or capitalExpenditure
      { 
        label: 'FCF excluding SBC', 
        format: 'currency',
        value: (item) => (item.freeCashFlow || 0) - (item.stockBasedCompensation || 0)
      },
      { 
        label: 'SBC / FCF', 
        format: 'percent',
        value: (item) => item.freeCashFlow ? (item.stockBasedCompensation || 0) / item.freeCashFlow : null
      }
    ]
  }
];

const loadingFinancials = ref(false);
const errorFinancials = ref(null);

const currentData = computed(() => {
  return financialData.value[activeTab.value];
});

const updateSymbol = () => {
  if (searchInput.value && searchInput.value.toUpperCase() !== symbol.value) {
    router.push({ 
      name: 'Dashboard', 
      params: { symbol: searchInput.value.toUpperCase() },
      query: route.query 
    });
  }
};

const fetchFinancials = async () => {
  loadingFinancials.value = true;
  errorFinancials.value = null;
  // Reset data
  financialData.value = { income: [], balance: [], cash: [], metrics: [], ratios: [] };
  
  if (!symbol.value) return;

  try {
    const [income, balance, cash, metrics, ratios] = await Promise.all([
      fmpService.getIncomeStatement(symbol.value),
      fmpService.getBalanceSheet(symbol.value),
      fmpService.getCashFlow(symbol.value),
      fmpService.getKeyMetrics(symbol.value),
      fmpService.getRatios(symbol.value)
    ]);

    financialData.value = {
      income,
      balance,
      cash,
      metrics,
      ratios
    };
  } catch (err) {
    errorFinancials.value = 'Failed to load financial data: ' + err.message;
  } finally {
    loadingFinancials.value = false;
  }
};

onMounted(() => {
  fetchFinancials();
});

watch(symbol, (newSymbol, oldSymbol) => {
  if (newSymbol !== oldSymbol) {
    searchInput.value = newSymbol;
    fetchFinancials();
  }
}, { immediate: true });
</script>

<style scoped>
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--accent-color);
}

.search-bar {
  display: flex;
  gap: 0.5rem;
}

.search-bar input {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  outline: none;
}

.search-bar input:focus {
  border-color: var(--accent-color);
}

.search-bar button {
  background: var(--accent-color);
  color: #fff;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.search-bar button:hover {
  opacity: 0.9;
}

.tabs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 1rem;
  padding-bottom: 0px; 
}

.tabs {
  display: flex;
  gap: 1rem;
}

.tabs button {
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 0.75rem 0;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  position: relative;
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
}

.tabs button.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-color);
}

.tabs button.active::after {
  display: none;
}

.toggle-group {
  display: flex;
  background: #2d333b;
  border-radius: 6px;
  padding: 4px;
  gap: 2px;
}

.toggle-group button {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s;
}

.toggle-group button.active {
  background: #ffffff; 
  color: #000000;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
}

.error {
  color: var(--danger-color);
}
</style>
