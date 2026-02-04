const { createBdd } = require('playwright-bdd');
const { expect, request } = require('@playwright/test');
const { Then } = require('../hooks/bdd');

Then(
  'the user verifies the Connections page at the exhaustive factor of {int} percent',
  async ({ page }, testInfo, exhaustiveFactor) => {
    // Exhaustive validation (API + multiple parents + pagination) needs more than default 30s
    testInfo?.setTimeout(120000);

    const logger = testInfo?.logger;
    const locators = testInfo.contextData.locators;
    const failures = [];
    const summary = [];
    const apiCache = new Map();

    /* =====================================================
       LOGGER HEADER
    ===================================================== */
    logger?.log(`\n========== CONNECTIONS EXHAUSTIVE VALIDATION ==========\n`);
    logger?.log(`Exhaustive Factor: ${exhaustiveFactor}%`);

    /* =====================================================
       SEEDED RANDOMNESS
    ===================================================== */
    function createSeededRng(seed) {
      let value = seed % 2147483647;
      if (value <= 0) value += 2147483646;
      return () => (value = (value * 16807) % 2147483647) / 2147483647;
    }

    const rng = createSeededRng(exhaustiveFactor);

    const pickRandom = (arr) => arr[Math.floor(rng() * arr.length)];

    const percentCount = (total) =>
      Math.max(1, Math.ceil((total * exhaustiveFactor) / 100));

    /* =====================================================
       API HELPER (CACHED)
    ===================================================== */
    async function apiGet(url) {
      if (!apiCache.has(url)) {
        const ctx = await request.newContext();
        const res = await ctx.get(url);
        const json = await res.json();
        apiCache.set(url, json);
      }
      return apiCache.get(url);
    }

    /* =====================================================
       LOCATOR LOGGING (ALL DETAILS)
    ===================================================== */
    logger?.log(`\n--- LOCATOR RESOLUTION ---`);
    Object.entries(locators).forEach(([key, value]) => {
      logger?.log(`${key} => ${value}`);
    });

    /* =====================================================
       PAGINATION NAVIGATOR
    ===================================================== */
    class PaginationNavigator {
      constructor(page, locators, logger) {
        this.page = page;
        this.locators = locators;
        this.logger = logger;
      }

      async first() {
        this.logger?.log('\tPagination: FIRST');
        await this.page.click(this.locators['BTN-FirstPage.CommonPagination.default']);
        await this.page.waitForLoadState('networkidle');
      }

      async next() {
        this.logger?.log('\tPagination: NEXT');
        await this.page.click(this.locators['BTN-NextPage.CommonPagination.default']);
        await this.page.waitForLoadState('networkidle');
      }

      async last() {
        this.logger?.log('\tPagination: LAST');
        await this.page.click(this.locators['BTN-LastPage.CommonPagination.default']);
        await this.page.waitForLoadState('networkidle');
      }
    }

    const paginator = new PaginationNavigator(page, locators, logger);

    function pickPaginationHops() {
      const hops = ['FIRST', 'NEXT', 'LAST'];
      const hopCount = Math.max(1, Math.floor(exhaustiveFactor / 10));
      return Array.from({ length: hopCount }, () => pickRandom(hops));
    }

    /* =====================================================
       LOAD CATEGORY COUNTS
    ===================================================== */
    const categoryCounts = await apiGet(
      'http://localhost:3000/api/connections/category-counts'
    );

    const parentAccounts = categoryCounts.data.byAccount
      .filter((a) => a.parent === true)
      .sort((a, b) => b.connectionCount - a.connectionCount);

    const parentsToTest = parentAccounts.slice(
      0,
      percentCount(parentAccounts.length)
    );

    logger?.log(
      `Parent Accounts Total: ${parentAccounts.length}, Executing: ${parentsToTest.length}`
    );

    /* =====================================================
       ACCOUNT DROPDOWN VALIDATION
    ===================================================== */
    try {
      await page.click(locators['DDN-Account.Connections.default']);
      await page.waitForSelector(locators['DDI-AllAccounts.Connections.default']);

      const uiAccounts = await page.$$eval(
        locators['DDI-AllAccounts.Connections.default'],
        (els) => els.map((e) => e.textContent.trim())
      );

      const expected = parentsToTest.map((a) => a.uIRep);
      expected.unshift('All Accounts');

      expected.forEach((acc) => {
        if (!uiAccounts.includes(acc)) {
          failures.push(`Dropdown missing account: ${acc}`);
        }
      });

      summary.push({
        stage: 'Account Dropdown',
        expected: expected.length,
        actual: uiAccounts.length,
        result: failures.length ? 'FAIL' : 'PASS',
      });
    } catch (e) {
      failures.push(`Dropdown validation error: ${e.message}`);
    }

    /* =====================================================
       PARENT ACCOUNT EXECUTION
    ===================================================== */
    for (const parent of parentsToTest) {
      logger?.log(`\n--- PARENT: ${parent.uIRep} ---`);

      const apiConnections = await apiGet(
        `http://localhost:3000/api/connections/account/${parent.accountID}`
      );

      /* ---------------- Pagination Strategy ---------------- */
      const hops = pickPaginationHops();
      logger?.log(`Pagination hops: ${hops.join(' → ')}`);

      for (const hop of hops) {
        try {
          if (hop === 'FIRST') await paginator.first();
          if (hop === 'NEXT') await paginator.next();
          if (hop === 'LAST') await paginator.last();
        } catch (err) {
          failures.push(`Pagination hop failed (${hop}): ${err.message}`);
        }
      }

      /* ---------------- UI Count Validation ---------------- */
      const totalText = await page.textContent(
        locators['TXT-TotalEntries.CommonPagination.default']
      );

      const uiTotal = Number(
        totalText.match(/of\s([\d,]+)/)[1].replace(/,/g, '')
      );

      if (uiTotal !== apiConnections.count) {
        failures.push(
          `Count mismatch for ${parent.uIRep}: API=${apiConnections.count}, UI=${uiTotal}`
        );
      }

      const noRecordsVisible = await page
        .locator(locators['TXT-NoMatchingRecords.CommonTable.NoRecords'])
        .isVisible()
        .catch(() => false);

      if (noRecordsVisible && apiConnections.count > 0) {
        failures.push(`No records shown for ${parent.uIRep}`);
      }

      /* ---------------- Connection-Level Validation ---------------- */
      const connectionsToTest = apiConnections.data
        .sort((a, b) => b.connectionID - a.connectionID)
        .slice(0, percentCount(apiConnections.count));

      for (const conn of connectionsToTest) {
        const connApi = await apiGet(
          `http://localhost:3000/api/connections/account/${parent.accountID}/connection/${conn.connectionID}`
        );

        const rows = await page.$$eval(
          locators['TRW-AllRows.Connections.default'],
          (trs) => trs.map((tr) => tr.textContent)
        );

        const exists = rows.some((r) =>
          r.includes(connApi.data[0].connectionGUID)
        );

        if (!exists) {
          failures.push(
            `Connection ${conn.connectionID} missing for ${parent.uIRep}`
          );
        }
      }

      summary.push({
        parent: parent.uIRep,
        apiCount: apiConnections.count,
        uiCount: uiTotal,
        hops,
        connectionsTested: connectionsToTest.length,
        result: failures.length ? 'FAIL' : 'PASS',
      });
    }

    /* =====================================================
       FINAL SUMMARY & ASSERTION
    ===================================================== */
    logger?.log(`\n========== TEST SUMMARY ==========\n`);
    summary.forEach((row) => logger?.log(JSON.stringify(row, null, 2)));

    if (failures.length) {
      logger?.log(`\nFAILURES:\n${failures.join('\n')}`);
    }

    expect(
      failures.length,
      `Failures detected:\n${failures.join('\n')}`
    ).toBe(0);
  }
);
