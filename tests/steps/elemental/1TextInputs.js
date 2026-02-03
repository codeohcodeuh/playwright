const { createBdd } = require('playwright-bdd');
const { Given, When, Then } = require('../hooks/bdd');

// When the user enters a value valueName on the webElement INP-Email on the Login.default page
When(
  'the user enters a value {string} on the webElement {word} on the {word} page',
  async ({ page }, testInfo, valueName, elementName, pageName) => {
    const logger = testInfo?.logger;

    const locatorKey = `${elementName}.${pageName}`;
    const locatorValue = testInfo.contextData.locators[locatorKey];

    if (!locatorValue) {
      throw new Error(
        `Locator not found for key '${locatorKey}'. Check contextData.locators`
      );
    } 

    logger?.log(`\t\tLocator \t :${locatorKey}`);
    logger?.log(`\t\tLocator value: ${locatorValue}`);
    logger?.log(`\t\tEntering value: ${valueName}`);

    const locator = page.locator(locatorValue);

    await locator.fill('');
    await locator.type(valueName);
  }
);