const cache = new Map();
const config = require('../../config');

/**
 * Mock locator data (used while /data/:key API is under construction)
 */
const mockData = {
    "AeriaLink.MCH.Niche.00001": {
      "D1": "V1",
      "D2": "V2",
      "D3": "V3",
      "D4": "V4",
      "D5": "V5",
      "D6": "V6",
      "D7": "V7",
      "D8": "V8",
      "D9": "V9",
      "D10": "V10",
      "D11": "V11",
      "D12": "V12",
      "D13": "V13",
      "D14": "V14",
      "D15": "V15",
      "D16": "V16",
      "D17": "V17",
      "D18": "V18",
      "D19": "V19",
      "D20": "V20",
      "D21": "V21",
      "D22": "V22",
      "D23": "V23",
      "D24": "V24",
      "D25": "V25",
      "D26": "V26",
      "D27": "V27",
      "D28": "V28",
      "D29": "V29",
      "D30": "V30"
    }
  };

/**
 * Loads test data by keys.
 * Uses mock data when backend API is unavailable.
 */
async function loadTestData(app, dataKeys = []) {
  const results = {};

  for (const key of dataKeys) {
    if (!cache.has(key)) {
      // 🔹 MOCK MODE (temporary)
      if (config.useMockData) {
        cache.set(key, mockData);
      } else {
        const res = await fetch(`${config.expeditestUrl}/data/${key}`);

        if (!res.ok) {
          throw new Error(`Failed to fetch data for ${key}`);
        }

        cache.set(key, await res.json());
      }
    }

    results[key] = cache.get(key);
  }

  return results;
}

module.exports = { loadTestData };
