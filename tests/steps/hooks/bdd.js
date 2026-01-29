const { createBdd } = require('playwright-bdd');
const { wrapStep } = require('../../support/stepWrapper');

const bdd = createBdd();

module.exports = {
  Given: (text, fn) => bdd.Given(text, wrapStep(fn)),
  When: (text, fn) => bdd.When(text, wrapStep(fn)),
  Then: (text, fn) => bdd.Then(text, wrapStep(fn)),
  Before: bdd.Before,
  After: bdd.After
};
