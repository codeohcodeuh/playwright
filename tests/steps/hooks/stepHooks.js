const { createBdd } = require('playwright-bdd');
const { logStep, endScenarioLog } = require('../../support/logger');

const { After } = createBdd();

After(async ({ $test }) => {
  const testInfo = $test.info();
  endScenarioLog(testInfo);
});

// test.on('step:end', (step) => {
//   if (step.category === 'test.step') {
//     logStep(step, step.error ? 'failed' : 'passed', step.error);
//   }
// });
