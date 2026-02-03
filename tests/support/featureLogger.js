const fs = require('fs');
const path = require('path');

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function createFeatureLogger(testInfo) {
  const featureName = sanitize(testInfo?.titlePath?.[0] ?? 'unknown_feature');
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '_')
    .replace('Z', '');

  const fileName = `${featureName}.${timestamp}.log`;
  const logDir = path.resolve(process.cwd(), 'tests/logs');

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const filePath = path.join(logDir, fileName);
  const stream = fs.createWriteStream(filePath, { flags: 'a' });

  return {
    filePath,
    log: (msg) => {
      stream.write(`[${new Date().toISOString()}] ${msg}\n`);
    },
    close: () => stream.end()
  };
}

module.exports = { createFeatureLogger };
