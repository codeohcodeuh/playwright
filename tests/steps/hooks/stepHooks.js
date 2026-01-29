const { test } = require('@playwright/test');
const { logStep, endScenarioLog } = require('../../support/logger');

test.afterEach(async (_, testInfo) => {
  endScenarioLog(testInfo);
});

// test.on('step:end', (step) => {
//   if (step.category === 'test.step') {
//     logStep(step, step.error ? 'failed' : 'passed', step.error);
//   }
// });
