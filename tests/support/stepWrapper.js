function wrapStep(stepFn) {
  return async function ({ page }, testInfo) {
    const logger = testInfo?.logger;

    const stepText = testInfo?.title;

    try {
      logger?.log(`STEP START: ${stepText}`);
      await stepFn.apply(this, [{ page }, testInfo]);
      logger?.log(`STEP PASSED: ${stepText}`);
    } catch (error) {
      logger?.log(`STEP FAILED: ${stepText}`);
      logger?.log(`ERROR: ${error.message}`);
      throw error; // IMPORTANT: do not swallow
    }
  };
}

module.exports = { wrapStep };
  