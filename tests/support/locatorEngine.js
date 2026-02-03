// Not in use, as we want to give more control to the user

function buildLocatorEngine(page, locators) {
    return {
      click: async (key) => {
        await page.locator(locators[key]).click();
      },
  
      fill: async (key, value) => {
        await page.locator(locators[key]).fill(value);
      },
  
      type: async (key, value) => {
        await page.locator(locators[key]).type(value);
      },
  
      waitFor: async (key) => {
        await page.locator(locators[key]).waitFor();
      },
  
      get: (key) => {
        return page.locator(locators[key]);
      }
    };
  }
  
  module.exports = { buildLocatorEngine };
  