const BASE_URL = 'https://financialmodelingprep.com/api/v3';
const API_KEY = import.meta.env.VITE_FMP_API_KEY;

if (!API_KEY) {
  console.warn('FMP API Key is missing! Please set VITE_FMP_API_KEY.');
}

async function fetchFMP(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.append('apikey', API_KEY);
  for (const key in params) {
    url.searchParams.append(key, params[key]);
  }

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`FMP API Error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Fetch FMP Error:', error);
    throw error;
  }
}

export const fmpService = {
  getHistoricalPrice: (symbol) => fetchFMP(`/historical-price-full/${symbol}`),
  getIncomeStatement: (symbol) => fetchFMP(`/income-statement/${symbol}`, { period: 'quarter', limit: 40 }),
  getBalanceSheet: (symbol) => fetchFMP(`/balance-sheet-statement/${symbol}`, { period: 'quarter', limit: 40 }),
  getCashFlow: (symbol) => fetchFMP(`/cash-flow-statement/${symbol}`, { period: 'quarter', limit: 40 }),
  getKeyMetrics: (symbol) => fetchFMP(`/key-metrics/${symbol}`, { period: 'quarter', limit: 40 }),
  getRatios: (symbol) => fetchFMP(`/ratios/${symbol}`, { period: 'quarter', limit: 40 }),
  getIntraday: (symbol) => fetchFMP(`/historical-chart/5min/${symbol}`),
};
