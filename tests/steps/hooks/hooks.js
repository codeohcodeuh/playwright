const { createBdd } = require('playwright-bdd');
const { Before } = createBdd();

const { parseTags } = require('../../support/tagparser');
const { loadBaseUrl } = require('../../support/loaders/urlLoader');
const { loadLocators } = require('../../support/loaders/locatorLoader');
const { loadTestData } = require('../../support/loaders/dataLoader');
// const { buildLocatorEngine } = require('../../support/locatorEngine'); Not in use, as we want to give more control to the user
const { startScenarioLog } = require('../../support/logger');
const { createFeatureLogger } = require('../../support/featureLogger');

Before(async ({ page }, testInfo) => {


  // Create feature log file
  const logger = createFeatureLogger(testInfo);
  testInfo.logger = logger;
  logger.log(`FEATURE: ${testInfo.titlePath[0]}`);
  logger.log(`SCENARIO: ${testInfo.title}`);
  logger.log(`START TIME: ${new Date().toISOString()}`);

  // Parse tags
  const tags = testInfo.annotations
    .filter(a => a.type === 'tag')
    .map(a => a.description);

  const ctx = parseTags(tags);
  logger.log(`ENV: ${ctx.env}`);
  logger.log(`APP: ${ctx.app}`);
  logger.log(`DATA KEYS: ${ctx.dataKeys?.join(', ') || 'NONE'}`);

  // Load runtime config
  ctx.baseUrl = await loadBaseUrl(ctx.app, ctx.env);

//   const locators = await loadLocators(ctx.app);
//   ctx.ui = buildLocatorEngine(page, locators);

  ctx.locators = await loadLocators(ctx.app);

  ctx.data = await loadTestData(ctx.app, ctx.dataKeys);

  logger.log(`BASE URL: ${ctx.baseUrl}`);
  logger.log(`LOCATORS LOADED: ${Object.keys(ctx.locators).length}`);

  testInfo.contextData = ctx;
});
