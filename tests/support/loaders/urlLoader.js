const cache = new Map();

async function loadBaseUrl(app, env) {
  const key = `${app}-${env}`;

  if (!cache.has(key)) {
    const res = await fetch(
      `http://localhost:3002/service/url/${app}/${env}`
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch URL for ${app}/${env}`);
    }

    cache.set(key, await res.text());
  }

  return cache.get(key);
}

module.exports = { loadBaseUrl };
