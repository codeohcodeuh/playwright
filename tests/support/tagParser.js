function parseTags(tags) {
  const ctx = {};

  for (const tag of tags) {
    if (tag.startsWith("@env=")) {
      ctx.env = tag.split("=")[1].replace(/'/g, "");
    }

    if (tag.startsWith("@App=")) {
      ctx.app = tag.split("=")[1].replace(/'/g, "");
    }

    if (tag.startsWith("@browser=")) {
      ctx.browser = tag.split("=")[1].replace(/'/g, "");
    }

    if (tag.startsWith("@data=")) {
      const raw = tag.split("=")[1];

      // Remove { } and split safely
      const values = raw
        .replace(/^{|}$/g, "")     // remove { }
        .split(",")                // split multiple values
        .map(v => v.trim())        // trim spaces
        .map(v => v.replace(/'/g, "")) // remove quotes
        .filter(Boolean);          // safety

      ctx.dataKeys = values;
    }
  }

  return ctx;
}

module.exports = { parseTags };
