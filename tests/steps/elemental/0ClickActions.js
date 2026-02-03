const { createBdd } = require('playwright-bdd');
const { Given, When, Then } = require('../hooks/bdd');

//When the user clicks on the webElement element-name on the page-name page
When(
  'the user clicks on the webElement {word} on the {word} page',
  async ({ page }, testInfo, elementName, pageName) => {
    const logger = testInfo?.logger;

    const locatorKey = `${elementName}.${pageName}`;
    const locatorValue = testInfo.contextData.locators[locatorKey];

    if (!locatorValue) {
      throw new Error(
        `Locator not found for key '${locatorKey}'. Check contextData.locators`
      );
    }

    logger?.log(`\t\tLocator ${locatorKey}`);
    logger?.log(`\t\tLocator value: ${locatorValue}`);
    logger?.log(`\t\tPerforming click action on the locator`);

    await page.locator(locatorValue).click();
  }
);

//When the user right clicks the webElement element-name on the page-name page
When(
  'the user double clicks the webElement {word} on the {word} page',
  async ({ page }, testInfo, elementName, pageName) => {
    const logger = testInfo?.logger;

    const locatorKey = `${elementName}.${pageName}`;
    const locatorValue = testInfo.contextData.locators[locatorKey];

    if (!locatorValue) {
      throw new Error(
        `Locator not found for key '${locatorKey}'. Check contextData.locators`
      );
    }

    logger?.log(`\t\tLocator ${locatorKey}`);
    logger?.log(`\t\tLocator value: ${locatorValue}`);
    logger?.log(`\t\tPerforming double click action on the locator`);

    await page.locator(locatorValue).dblclick();
  }
);

//When the user right clicks the webElement element-name on the page-name page
When(
  'the user right clicks the webElement {word} on the {word} page',
  async ({ page }, testInfo, elementName, pageName) => {
    const logger = testInfo?.logger;

    const locatorKey = `${elementName}.${pageName}`;
    const locatorValue = testInfo.contextData.locators[locatorKey];

    if (!locatorValue) {
      throw new Error(
        `Locator not found for key '${locatorKey}'. Check contextData.locators`
      );
    }

    logger?.log(`\t\tLocator ${locatorKey}`);
    logger?.log(`\t\tLocator value: ${locatorValue}`);
    logger?.log(`\t\tPerforming right click action on the locator`);

    await page.locator(locatorValue).click({ button: 'right' });
  }
);