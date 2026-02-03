const cache = new Map();
const config = require('../../config');

async function loadBaseUrl(app, env) {
  const cacheKey = `${app}:${env}`;

  if (!cache.has(cacheKey)) {
    if (config.useMockData) {
      cache.set(cacheKey, 'https://qa-portal5.int.aerialink.net/login');
    } else {
      const res = await fetch(
        `${config.expeditestUrl}/base-url/${app}/${env}`
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch base URL for ${app} (${env})`);
      }

      const data = await res.json();
      const baseUrl = data.baseUrl ?? data.url ?? data;

      if (typeof baseUrl !== 'string' || baseUrl.length === 0) {
        throw new Error(`Invalid base URL response for ${app} (${env})`);
      }

      cache.set(cacheKey, baseUrl);
    }
  }

  return cache.get(cacheKey);
}

module.exports = { loadBaseUrl };
