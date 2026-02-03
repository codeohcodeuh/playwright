const cache = new Map();
const config = require('../../config');

/**
 * Loads locators for an application.
 */
async function loadLocators(app) {
  if (!app) {
    throw new Error('App name is required to load locators');
  }

  if (!cache.has(app)) {
    console.log(`Fetching locators for ${app}`);
    const res = await fetch(
      `${config.expeditestUrl}/api/exports/locators/${app}`
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch locators for ${app}`);
    }

    const json = await res.json();
    cache.set(app, json.locators);
  }

  return cache.get(app);
}

module.exports = { loadLocators };
