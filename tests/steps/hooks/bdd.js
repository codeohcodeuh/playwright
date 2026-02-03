const { createBdd } = require('playwright-bdd');
const { wrapStep } = require('../../support/stepWrapper');

const bdd = createBdd();

module.exports = {
  Given: (text, fn) => bdd.Given(text, wrapStep(fn, `Given ${text}`)),
  When: (text, fn) => bdd.When(text, wrapStep(fn, `When ${text}`)),
  Then: (text, fn) => bdd.Then(text, wrapStep(fn, `Then ${text}`)),
  Before: bdd.Before,
  After: bdd.After
};
