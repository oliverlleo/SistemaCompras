import DashboardManager from './dashboard-manager.js';

document.addEventListener('DOMContentLoaded', () => {
    // Instantiate the dashboard manager
    const dashboardManager = new DashboardManager();

    // Make it globally available for existing onclick handlers
    window.dashboardManager = dashboardManager;

    // Initialize the dashboard
    dashboardManager.init();
});