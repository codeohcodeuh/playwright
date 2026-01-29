const { createBdd } = require('playwright-bdd');
const { Given } = require('../hooks/bdd');

Given(
  'the user navigates to the application',
  async ({ page }, testInfo) => {
    const { baseUrl } = testInfo.contextData;
    await page.goto(baseUrl);
  }
);
