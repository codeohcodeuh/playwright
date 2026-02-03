const { createBdd } = require('playwright-bdd');
const { Given, When, Then } = require('../hooks/bdd');

Given(
  'the user navigates to the application',
  async ({ page }, testInfo) => {
    const logger = testInfo?.logger;
    logger?.log(`\t\tNavigating to the application URL: ${testInfo.contextData.baseUrl}`);
    const { baseUrl } = testInfo.contextData;
    await page.goto(baseUrl);
  }
);

When(
  'the user refreshes the current page',
  async ({ page }, testInfo) => {
    const logger = testInfo?.logger;

    logger?.log(`\t\tRefreshing the current page`);

    // Playwright refresh
    await page.reload();
  }
);