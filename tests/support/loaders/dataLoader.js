const cache = new Map();

async function loadTestData(app, dataKeys = []) {
  const results = {};

  for (const key of dataKeys) {
    if (!cache.has(key)) {
      const res = await fetch(
        `http://localhost:3002/data/${key}`
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch data for ${key}`);
      }

      cache.set(key, await res.json());
    }

    results[key] = cache.get(key);
  }

  return results;
}

module.exports = { loadTestData };
