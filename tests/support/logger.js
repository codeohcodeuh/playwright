function startScenarioLog(testInfo) {
  if (!testInfo) {
    return;
  }

  testInfo._meta = {
    feature: testInfo.titlePath?.[0] ?? 'unknown_feature',
    scenario: testInfo.title ?? 'unknown_scenario',
    startTime: new Date(),
    steps: []
  };

  console.log(`\n▶ FEATURE: ${testInfo._meta.feature}`);
  console.log(`▶ SCENARIO: ${testInfo._meta.scenario}`);
  console.log(`▶ START: ${testInfo._meta.startTime.toISOString()}`);
}

function logStep(step, status, error) {
  if (!step?.testInfo?._meta) {
    return;
  }

  const entry = {
    step: step.title,
    status,
    error: error?.message
  };

  step.testInfo._meta.steps.push(entry);

  console.log(
    `  ${status === 'passed' ? '✅' : '❌'} ${step.title}`
  );

  if (error) {
    console.log(`     ↳ ${error.message}`);
  }
}

function endScenarioLog(testInfo) {
  if (!testInfo?._meta?.startTime) {
    return;
  }

  const endTime = new Date();
  const duration = endTime - testInfo._meta.startTime;

  console.log(`▶ END: ${endTime.toISOString()}`);
  console.log(`▶ STATUS: ${testInfo.status.toUpperCase()}`);
  console.log(`▶ DURATION: ${duration} ms\n`);
}

module.exports = {
  startScenarioLog,
  logStep,
  endScenarioLog
};
  