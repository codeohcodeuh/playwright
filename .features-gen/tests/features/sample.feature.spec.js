// Generated from: tests/features/sample.feature
import { test } from "playwright-bdd";

test.describe('Login functionality', () => {

  test('Navigate to the application', { tag: ['@env=\'QA\'', '@App=\'AeriaLink\'', '@data={\'AeriaLink.MCH.Niche.00002\',\'AeriaLink.MCH.Niche.00003\'}'] }, async ({ Given, When, page }) => { 
    await Given('the user navigates to the application', null, { page }); 
    await When('the user clicks on the webElement BTN-Login on the Landing.default page', null, { page }); 
    await When('the user enters a value nishan.manoraj@goconvey.com on the webElement INP-Email on the Login.default page', null, { page }); 
    await When('the user enters a value Surekha@123 on the webElement INP-Password on the Login.default page', null, { page }); 
    await When('the user right clicks the webElement BTN-SignIn on the Login.default page', null, { page }); 
    await When('the user double clicks the webElement BTN-SignIn on the Login.default page', null, { page }); 
    await When('the user clicks on the webElement BTN-SignIn on the Login.default page', null, { page }); 
  });

});

// == technical section ==

test.beforeEach('BeforeEach Hooks', ({ $runScenarioHooks, $bddFileData, page }) => $runScenarioHooks('before', { $bddFileData, page }));
test.afterEach('AfterEach Hooks', ({ $runScenarioHooks }) => $runScenarioHooks('after', {  }));

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('tests/features/sample.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":5,"tags":["@env='QA'","@App='AeriaLink'","@data={'AeriaLink.MCH.Niche.00002','AeriaLink.MCH.Niche.00003'}"],"steps":[{"pwStepLine":7,"gherkinStepLine":6,"keywordType":"Context","textWithKeyword":"Given the user navigates to the application","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":7,"keywordType":"Action","textWithKeyword":"When the user clicks on the webElement BTN-Login on the Landing.default page","stepMatchArguments":[{"group":{"start":34,"value":"BTN-Login","children":[]}},{"group":{"start":51,"value":"Landing.default","children":[]}}]},{"pwStepLine":9,"gherkinStepLine":8,"keywordType":"Action","textWithKeyword":"When the user enters a value nishan.manoraj@goconvey.com on the webElement INP-Email on the Login.default page","stepMatchArguments":[{"group":{"start":24,"value":"nishan.manoraj@goconvey.com","children":[]}},{"group":{"start":70,"value":"INP-Email","children":[]}},{"group":{"start":87,"value":"Login.default","children":[]}}]},{"pwStepLine":10,"gherkinStepLine":9,"keywordType":"Action","textWithKeyword":"When the user enters a value Surekha@123 on the webElement INP-Password on the Login.default page","stepMatchArguments":[{"group":{"start":24,"value":"Surekha@123","children":[]}},{"group":{"start":54,"value":"INP-Password","children":[]}},{"group":{"start":74,"value":"Login.default","children":[]}}]},{"pwStepLine":11,"gherkinStepLine":10,"keywordType":"Action","textWithKeyword":"When the user right clicks the webElement BTN-SignIn on the Login.default page","stepMatchArguments":[{"group":{"start":37,"value":"BTN-SignIn","children":[]}},{"group":{"start":55,"value":"Login.default","children":[]}}]},{"pwStepLine":12,"gherkinStepLine":11,"keywordType":"Action","textWithKeyword":"When the user double clicks the webElement BTN-SignIn on the Login.default page","stepMatchArguments":[{"group":{"start":38,"value":"BTN-SignIn","children":[]}},{"group":{"start":56,"value":"Login.default","children":[]}}]},{"pwStepLine":13,"gherkinStepLine":12,"keywordType":"Action","textWithKeyword":"When the user clicks on the webElement BTN-SignIn on the Login.default page","stepMatchArguments":[{"group":{"start":34,"value":"BTN-SignIn","children":[]}},{"group":{"start":52,"value":"Login.default","children":[]}}]}]},
]; // bdd-data-end