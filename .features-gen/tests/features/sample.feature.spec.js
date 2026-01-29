// Generated from: tests/features/sample.feature
import { test } from "playwright-bdd";

test.describe('Login functionality', () => {

  test('Navigate to the application', { tag: ['@env=\'QA\'', '@App=\'AeriaLink\'', '@data={\'AeriaLink.MCH.Niche.00002\',\'AeriaLink.MCH.Niche.00003\'}', '@browser=\'chrome\''] }, async ({ Given, page }) => { 
    await Given('the user navigates to the application', null, { page }); 
  });

});

// == technical section ==

test.beforeEach('BeforeEach Hooks', ({ $runScenarioHooks, page }) => $runScenarioHooks('before', { page }));
test.afterEach('AfterEach Hooks', ({ $runScenarioHooks }) => $runScenarioHooks('after', {  }));

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('tests/features/sample.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":4,"tags":["@env='QA'","@App='AeriaLink'","@data={'AeriaLink.MCH.Niche.00002','AeriaLink.MCH.Niche.00003'}","@browser='chrome'"],"steps":[{"pwStepLine":7,"gherkinStepLine":5,"keywordType":"Context","textWithKeyword":"Given the user navigates to the application","stepMatchArguments":[]}]},
]; // bdd-data-end