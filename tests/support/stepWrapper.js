function formatDurationMs(durationMs) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds}s`;
}

function wrapStep(stepFn, stepTextOverride) {
  return async function ({ page, $test }, ...stepArgs) {
    const resolvedTestInfo = $test?.info?.();
    const logger = resolvedTestInfo?.logger;

    const stepText = stepTextOverride ?? resolvedTestInfo?.title ?? 'Step';
    const meta = resolvedTestInfo?._meta ?? (resolvedTestInfo ? { steps: [] } : null);
    if (resolvedTestInfo && !resolvedTestInfo._meta) {
      resolvedTestInfo._meta = meta;
    }

    const stepNumber = meta ? (meta.steps.length + 1) : null;
    const stepLabel = stepNumber ? `${stepNumber}: ${stepText}` : stepText;
    const startTime = Date.now();

    try {
      logger?.log(`START STEP #${stepLabel} : `);
      logger?.log(`⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇⬇`);
      await stepFn.apply(this, [{ page }, resolvedTestInfo, ...stepArgs]);
      const durationMs = Date.now() - startTime;
      logger?.log(`⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆⬆`);
      logger?.log(`END STEP #${stepLabel} (${formatDurationMs(durationMs)})\n\n`);
      // logger?.log(`STEP PASSED: ${stepLabel}`);

      if (meta) {
        meta.steps.push({ title: stepText, durationMs });
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger?.log(`STEP END: ${stepLabel} (${formatDurationMs(durationMs)})`);
      logger?.log(`STEP FAILED: ${stepLabel}`);
      logger?.log(`ERROR: ${error.message}`);
      throw error; // IMPORTANT: do not swallow
    }
  };
}

module.exports = { wrapStep };
  