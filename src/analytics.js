import { analytics } from './firebase';
import { logEvent } from 'firebase/analytics';

/**
 * Log custom analytics events
 * @param {string} eventName - Name of the event
 * @param {object} eventParams - Optional parameters for the event
 */
export const trackEvent = (eventName, eventParams = {}) => {
    if (analytics) {
        logEvent(analytics, eventName, eventParams);
    }
};

/**
 * Track page views
 * @param {string} pageName - Name of the page
 * @param {string} pageTitle - Title of the page
 */
export const trackPageView = (pageName, pageTitle) => {
    if (analytics) {
        logEvent(analytics, 'page_view', {
            page_name: pageName,
            page_title: pageTitle
        });
    }
};

/**
 * Track stock symbol searches
 * @param {string} symbol - Stock symbol searched
 */
export const trackStockSearch = (symbol) => {
    if (analytics) {
        logEvent(analytics, 'stock_search', {
            symbol: symbol
        });
    }
};

/**
 * Track metric selections
 * @param {string} metricName - Name of the metric selected
 */
export const trackMetricSelection = (metricName) => {
    if (analytics) {
        logEvent(analytics, 'metric_selected', {
            metric_name: metricName
        });
    }
};
