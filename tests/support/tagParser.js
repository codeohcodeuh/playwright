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
        ctx.dataKeys = JSON.parse(raw.replace(/'/g, '"'));
      }
    }
  
    return ctx;
  }
  
  module.exports = { parseTags };
  