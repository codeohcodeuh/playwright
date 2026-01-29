const cache = new Map();

async function loadLocators(app) {
  if (!cache.has(app)) {
    const res = await fetch(
      `http://localhost:3002/api/exports/locators/${app}`
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
