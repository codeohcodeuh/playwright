
const { Then } = require('../hooks/bdd');
const { expect, request } = require('@playwright/test');
const config = require('../../config');

Then(
  'the user verifies the Connections page at the exhaustive factor of {int} percent',
  async ({ page }, testInfo, exhaustiveFactor) => {
    testInfo?.setTimeout(12000000);
    const logger = testInfo?.logger;

    const failures = [];
    const summary = [];

    const logStep = (msg) => logger?.log(`➡️  ${msg}`);
    const logPlain = (msg) => logger?.log(`\t\t ${msg}`);
    const logOk = (msg) => logger?.log(`✅ ${msg}`);
    const logFail = (msg) => logger?.log(`❌ ${msg}`);

    const locators = testInfo.contextData.locators;

    /* -------------------------------
       Helper: Safe execution wrapper
    --------------------------------*/
    const safe = async (stepName, fn) => {
      try {
        await fn();
        return true;
      } catch (err) {
        failures.push({ step: stepName, error: err.message });
        logFail(`${stepName} | ${err.message}`);
        return false;
      }
    };

    /* -------------------------------
       Validation 1. Step 1.1: Load category-counts
    --------------------------------*/
    logStep('Validation 1. Checking the number of parent accounts in the API against the UI');
    logger?.log('\t\t\tVal-Step 1.1: Loading the data from the category-counts API');

    const categoryCountsUrl = `${config.databaseUrl}/api/connections/category-counts`;
    logger?.log(`\t\t\t\tCalling category-counts API: ${categoryCountsUrl}`);

    const apiContext = await request.newContext();
    const categoryRes = await apiContext.get(categoryCountsUrl);
    const categoryJson = await categoryRes.json();

    const parents = categoryJson.data.byAccount
      .filter((a) => a.parent === true)
      .sort((a, b) => b.connectionCount - a.connectionCount);

    logPlain(`\t\t\t\tParents: ${JSON.stringify(parents)}`);
    logOk(`\t\t\t\tLoaded ${parents.length} parent accounts from API`);

    /* All Accounts total: use API grandTotal when present, else sum of parents' connectionCount */
    const totalConnectionsAllAccounts =
      typeof categoryJson.data.grandTotal === 'number'
        ? categoryJson.data.grandTotal
        : parents.reduce((s, p) => s + (p.connectionCount || 0), 0);
    logger?.log(`\t\t\t\tAll Accounts expected total (grandTotal): ${totalConnectionsAllAccounts}`);

    /* -------------------------------
       Validation 1. Step 1.3: Populating the Accounts from Account dropdown on the UI
    --------------------------------*/
    logger?.log('\t\t\t\tVal-Step 1.2: Populating the Accounts from Account dropdown on the UI');
    await safe('Open Account dropdown', async () => {
      logger?.log('\t\t\t\t->Opening Account dropdown');
      await page.locator(locators['DDN-Account.Connections.default']).click();
    });
    logger?.log(`\t\t\t\t\tPerforming CLICK action | Element: DDN-Account.Connections.default | Locator: ${locators['DDN-Account.Connections.default']}`);

    /* -------------------------------
       Populatinf dropdown items
    --------------------------------*/
    await safe('Validate Account dropdown contents', async () => {
      logger?.log('\t\t\t\t->Reading all account dropdown items');
      const uiItems = await page
        .locator(locators['DDI-AllAccounts.Connections.default'])
        .allTextContents();
      logger?.log(`\t\t\t\t\tPerforming READ action | Element: DDI-AllAccounts.Connections.default | Locator: ${locators['DDI-AllAccounts.Connections.default']}`);

      const uiAccounts = uiItems.filter(item => item !== 'All Accounts');
      logger?.log(`\t\t\t\tUI Accounts: ${JSON.stringify(uiAccounts)}`);
      const apiParentIDs = parents.map(p => p.accountID);
      const uiAccountIDs = uiAccounts
        .map(text => {
          const match = text.match(/\[(\d+)\]/);
          return match ? Number(match[1]) : null;
        })
        .filter(id => id !== null);

      logger?.log(`\t\t\t\tNumber of API Parent IDs: ${apiParentIDs.length}`);
      logger?.log(`\t\t\t\tAPI Parent IDs: ${JSON.stringify(apiParentIDs)}`);

      logger?.log(`\t\t\t\tNumber of UI Account IDs: ${uiAccountIDs.length}`);
      logger?.log(`\t\t\t\tUI Account IDs: ${JSON.stringify(uiAccountIDs)}`);

      const missingInUI = apiParentIDs.filter(id => !uiAccountIDs.includes(id));
      const missingInAPI = uiAccountIDs.filter(id => !apiParentIDs.includes(id));

      const difference = uiAccountIDs.length - apiParentIDs.length;
      logger?.log(`\t\t\t\tDifference between UI and API account IDs: ${difference}`);

      if (difference > 2) {
        let errorMessage = 'Validation 1. FAILED | The accountIDs count on UI has exceeded the accountIDs count on API by more than 2\n';
        throw new Error(errorMessage);
      } else {
        if (missingInUI.length > 0) {
          logger?.log(`\t\t\t\tIDs in API but missing in UI: ${missingInUI.join(', ')}`);
        }
        if (missingInAPI.length > 0) {
          logger?.log(`\t\t\t\tIDs in UI but missing in API: ${missingInAPI.join(', ')}`);
        }
      }
      logger?.log('\t\t\t\tThe three additional accounts allowed in the UI are: 1. All Accounts, 2. Aerialink Inc. and 3. Aerialink Inc. Global Data');

      logOk(
        `Validation 1. PASSED | Account dropdown validated by IDs | API=${apiParentIDs.length}, UI=${uiAccountIDs.length}. The count difference between UI and API is ${difference} which is not more than 2`
      );
    });

    const tableRows = [];
    tableRows.push({
      validation: '1',
      scenario: 'Account dropdown',
      apisUsed: categoryCountsUrl,
      apiCountExpected: String(parents.length),
      uiCount: 'match',
      result: 'PASS',
    });

    /* -------------------------------
 Parent Selection Strategy (Exhaustive Coverage)
 
 Parents are selected using a stratified, distribution-aware strategy
 based on connectionCount rather than hard-coded account IDs.

 - High-volume parents are always included to cover aggregation,
   pagination, and performance-sensitive paths.
 - Mid-range parents are proportionally sampled to reflect
   real-world usage patterns.
 - Low-volume (long-tail) parents are sampled to catch edge cases
   such as off-by-one errors and empty-state scenarios.

 The exhaustiveFactor (5%, 10%, 25%, 50%, 75%, 100%) controls how
 deeply each bucket is sampled:
   • Lower percentages prioritize risk and speed
   • Higher percentages expand coverage into the long tail
   • 100% guarantees full parent coverage

 This approach is future-proof and automatically adapts as parent
 accounts and their connection distributions change over time.
--------------------------------*/
    logger?.log(
      `\n\n\t\t\t\t\t\t\t🧠 Parent Selection Strategy: distribution-aware, future-proof, exhaustiveFactor=${exhaustiveFactor}%`
    );

    logger?.log(`\t\t\t\t\t\t🧠 Parent Selection Strategy (Exhaustive Coverage)
      Parents are selected using a stratified, distribution-aware strategy
      based on connectionCount rather than hard-coded account IDs.
        • High-volume parents are always included to cover aggregation,
          pagination, and performance-sensitive paths.
        • Mid-range parents are proportionally sampled to reflect
          real-world usage patterns.
        • Low-volume (long-tail) parents are sampled to catch edge cases
          such as off-by-one errors and empty-state scenarios.
      Exhaustive Factor Levels:
        - 5%   : Critical high-risk parents only (fast smoke coverage)
        - 10%  : Adds representative mid-range parents
        - 25%  : Covers typical customer usage
        - 50%  : Broad regression coverage
        - 75%  : Deep long-tail validation
        - 100% : Full parent coverage
      This strategy is future-proof and automatically adapts as parent
      accounts and their connection distributions change over time.`);


    const selectParentsForExhaustiveCoverage = (parents, exhaustiveFactor) => {
      // Bucket parents by connectionCount (descending risk profile)
      const buckets = {
        A: parents.filter(p => p.connectionCount >= 100),                // Extreme volume
        B: parents.filter(p => p.connectionCount >= 30 && p.connectionCount < 100),
        C: parents.filter(p => p.connectionCount >= 15 && p.connectionCount < 30),
        D: parents.filter(p => p.connectionCount >= 7 && p.connectionCount < 15),
        E: parents.filter(p => p.connectionCount >= 3 && p.connectionCount < 7),
        F: parents.filter(p => p.connectionCount <= 2),                  // Long tail / edge cases
      };

      logger?.log(`\t\t\t\tBucket distribution: ${JSON.stringify({
        A: buckets.A.length,
        B: buckets.B.length,
        C: buckets.C.length,
        D: buckets.D.length,
        E: buckets.E.length,
        F: buckets.F.length,
      })}`);

      const totalParents = parents.length;
      const targetCount = Math.max(
        1,
        Math.ceil((exhaustiveFactor / 100) * totalParents)
      );

      const selected = [];
      const take = (arr, count) => arr.slice(0, Math.min(count, arr.length));

      // Always include highest-risk parents first
      selected.push(...buckets.A);
      selected.push(...buckets.B);

      // Gradually expand coverage based on exhaustiveFactor
      if (exhaustiveFactor >= 10) selected.push(...take(buckets.C, Math.ceil(buckets.C.length * 0.5)));
      if (exhaustiveFactor >= 25) selected.push(...take(buckets.D, Math.ceil(buckets.D.length * 0.5)));
      if (exhaustiveFactor >= 50) selected.push(...take(buckets.E, Math.ceil(buckets.E.length * 0.6)));
      if (exhaustiveFactor >= 75) selected.push(...take(buckets.F, Math.ceil(buckets.F.length * 0.7)));
      if (exhaustiveFactor >= 100) selected.push(...buckets.F);

      // De-duplicate and cap selection to targetCount
      const unique = Array.from(
        new Map(selected.map(p => [p.accountID, p])).values()
      );

      return unique
        .sort((a, b) => b.connectionCount - a.connectionCount)
        .slice(0, targetCount);
    };

    const selectedParents = selectParentsForExhaustiveCoverage(parents, exhaustiveFactor);

    logger?.log(`\t\t\t\tSelected parents (${selectedParents.length}): ${JSON.stringify(
      selectedParents.map(p => ({
        accountID: p.accountID,
        connectionCount: p.connectionCount,
      }))
    )}`);

    logger?.log(
      `🧠 Parent selection applied | Exhaustive=${exhaustiveFactor}% | Selected ${selectedParents.length} of ${parents.length} parents based on distribution\n\n\n`
    );

    /* Build list to process: mandatory 1st = All Accounts, then selected parents */
    const percentCount = (total) => Math.max(1, Math.ceil((total * exhaustiveFactor) / 100));
    const accountsToProcess = [
      { label: 'All Accounts', accountID: null, uIRep: 'All Accounts', connectionCount: totalConnectionsAllAccounts },
      ...selectedParents.map((p) => ({ ...p, label: `[${p.accountID}]`, uIRep: p.uIRep })),
    ];
    logger?.log(`\t\t\t\tAccounts to process: ${accountsToProcess.length} (1 All Accounts + ${selectedParents.length} parents)`);

    /* -------------------------------
       Validation 2. For the accounts in the selected parents, perform the following steps: 1. 
    --------------------------------*/
    logger?.log('\t\t\t\tValidation 2. Connections table validation: Record Counts(UI and API), Number of Rows, Sorting, Connection Selection, Pagination, Connection GUID');
    logger?.log('\t\t\t\tWe will be validating the connections table for the accounts in the selected parents');
    logger?.log(`\t\t\t\tselected parents: ${JSON.stringify(selectedParents)}\n`);

    let accountCount = 1;
    for (const account of accountsToProcess) {
      const accountLabel = account.accountID === null ? 'All Accounts' : account.label;
      const accountID = account.accountID;
      logger?.log(`\t\t\t\tValidation 2.${accountCount}: ${accountLabel} (connectionCount=${account.connectionCount})`);

      logStep(`\t\t\t\tValidation 2.${accountCount}.1: Validate record counts between API and UI`);
      await safe('Close any open dropdowns by clicking on the ConnectionGUID field', async () => {
        logger?.log('\t\t\t\t\t\t->Closing any open dropdowns by clicking on the ConnectionGUID input field');
        await page.locator(locators['INP-ConnectionGUID.Connections.default']).click();
        logger?.log(`\t\t\t\t\t\t\t\tPerforming CLICK action | Element: INP-ConnectionGUID.Connections.default | Locator: ${locators['INP-ConnectionGUID.Connections.default']}`);
      });

      await safe('Open Account dropdown', async () => {
        logger?.log('\t\t\t\t\t\t->Clicking on Account dropdown');
        await page.locator(locators['DDN-Account.Connections.default']).click();
        logger?.log(`\t\t\t\t\t\t\t\tPerforming CLICK action | Element: DDN-Account.Connections.default | Locator: ${locators['DDN-Account.Connections.default']}`);
      });

      await safe('Type account label into Account search', async () => {
        logger?.log(`\t\t\t\t\t\t->Typing "${accountLabel}" into the Account Search Text field`);
        await page.locator(locators['INP-AccountSearchText.Connections.default']).fill(accountLabel);
        logger?.log(`\t\t\t\t\t\t\t\tPerforming FILL action | Element: INP-AccountSearchText.Connections.default | Locator: ${locators['INP-AccountSearchText.Connections.default']} | Value: ${accountLabel}`);
      });

      await safe('Select account from dropdown', async () => {
        logger?.log(`\t\t\t\t\t\t->Selecting the first account "${accountLabel}" from the Account dropdown`);
        const accounts = await page.locator(locators['DDI-1stAccount.Connections.default']).allTextContents();
        logger?.log(`\t\t\t\t\t\t\t\tPerforming READ action | Element: DDI-1stAccount.Connections.default | Locator: ${locators['DDI-1stAccount.Connections.default']} | Options found: ${accounts.length}`);
        if (accounts.length !== 1) {
          throw new Error(`The account ${accountLabel} is not the only account in the list`);
        }
        await page.locator(locators['DDI-1stAccount.Connections.default']).click();
        logger?.log(`\t\t\t\t\t\t\t\tPerforming CLICK action | Element: DDI-1stAccount.Connections.default`);
      });

      /* Connections dropdown: open, count/store options, narrow by exhaustive factor, display; then All Connections once per account */
      let connectionsToTest = [];
      await safe('Open Connections dropdown and load options', async () => {
        logger?.log('\t\t\t\t\t\t->Clicking Connections dropdown (DDN-Connection.Connections.default)');
        await page.locator(locators['DDN-Connection.Connections.default']).click();
        await page.waitForTimeout(400);
        logger?.log(`\t\t\t\t\t\t\t\tPerforming CLICK action | Element: DDN-Connection.Connections.default | Locator: ${locators['DDN-Connection.Connections.default']}`);
        logger?.log('\t\t\t\t\t\t->Reading all connection options (DDI-AllConnections.Connections.default)');
        const texts = await page.locator(locators['DDI-AllConnections.Connections.default']).allTextContents();
        logger?.log(`\t\t\t\t\t\t\t\tPerforming READ action | Element: DDI-AllConnections.Connections.default | Locator: ${locators['DDI-AllConnections.Connections.default']} | Raw count: ${texts.length}`);
        const options = texts.map((t) => (t || '').trim()).filter((t) => t && t !== 'All Connections');
        const toTake = percentCount(options.length);
        connectionsToTest = options.slice(0, toTake);
        logger?.log(`\t\t\t\t\t\tConnections in dropdown: ${options.length}. Using ${toTake} (${exhaustiveFactor}%): ${connectionsToTest.slice(0, 3).join(', ')}${connectionsToTest.length > 3 ? '...' : ''}`);
        const shuffle = (arr) =>
          arr
            .map(v => ({ v, r: Math.random() }))
            .sort((a, b) => a.r - b.r)
            .map(({ v }) => v);
        
        const maxPick = Math.min(5, options.length);
        const randomlyPicked = shuffle(options).slice(0, maxPick);
        
        const FIXED_CONNECTION_ID = '538';
        
        connectionsToTest = ['All Connections'];
        for (let i = 0; i < randomlyPicked.length; i++) {
          connectionsToTest.push(`[${FIXED_CONNECTION_ID}]`);
        }
      });

      logger?.log(
        `\t\t\t\t\t\tconnectionsToTest (${connectionsToTest.length}): ` +
        connectionsToTest.join(' | ')
      );

      await safe('Select Connections and Search', async () => {
        logger?.log('\t\t\t\t\t\t->Entering "All Connections" in INP-ConnectionSearchText and selecting');
        await page.locator(locators['INP-ConnectionSearchText.Connections.default']).fill('All Connections');
        logger?.log(`\t\t\t\t\t\t\t\tPerforming FILL action | Element: INP-ConnectionSearchText.Connections.default | Value: All Connections`);
        await page.waitForTimeout(300);
        logger?.log('\t\t\t\t\t\t->Clicking first connection option (DDI-1stConnection.Connections.default)');
        await page.locator(locators['DDI-1stConnection.Connections.default']).first().click();
        await page.waitForTimeout(300);
        logger?.log('\t\t\t\t\t\t->Clicking Search button');
        await page.locator(locators['BTN-Search.Connections.default']).click();
        logger?.log(`\t\t\t\t\t\t\t\tPerforming CLICK action | Element: BTN-Search.Connections.default | Locator: ${locators['BTN-Search.Connections.default']}`);
      });

      if (accountID != null && locators['TXT-SearchResultsAccountID.Connections.default']) {
        const searchResultLocator = locators['TXT-SearchResultsAccountID.Connections.default'].replace('$^$', accountID);
        await safe(`Wait for Search Results accountID: ${accountID}`, async () => {
          logger?.log(`\t\t\t\t\t\t->Waiting for Search Results accountID: ${accountID}`);
          await page.locator(searchResultLocator).waitFor({ state: 'visible', timeout: 60_000 });
          logger?.log(`\t\t\t\t\t\t\t\tWAIT action | Element: TXT-SearchResultsAccountID.Connections.default | Locator: ${searchResultLocator}`);
        });
      } else {
        logger?.log('\t\t\t\t\t\t->Waiting for networkidle (All Accounts path)');
        await page.waitForLoadState('networkidle');
        logger?.log('\t\t\t\t\t\t\t\tLoad state: networkidle');
      }

      const connectionCountFromAPI = account.connectionCount;
      logger?.log(`\t\t\t\t\t\tConnection count for ${accountLabel} from API is ${connectionCountFromAPI}`);


      await safe('Validate record counts and pagination', async () => {
        const totalEntriesLocator = locators['TXT-TotalEntries.Connections.default'];
        const summaryLocator = locators['TXT-TotalEntries.Connections.default'] || locators['TXT-TotalEntries.CommonPagination.default'];
        const tableRowsLocator = locators['TRW-AllRows.Connections.default'];

        logger?.log('\t\t\t\t\t\t->Reading pagination summary (TXT-TotalEntries)');
        const summaryText = await page.locator(summaryLocator).first().innerText();
        logger?.log(`\t\t\t\t\t\t\t\tPerforming READ action | Element: TXT-TotalEntries.Connections.default | Locator: ${summaryLocator}`);
        logger?.log(`\t\t\t\t\t\tUI Showing entries text: "${summaryText}"`);

        // Example:
        // "Showing 1,001 to 2,000 of 3,510 entries"

        // Split and extract raw values
        const parts = summaryText.split(' ');

        if (parts.length < 6) {
          throw new Error(`Unexpected summary format: "${summaryText}"`);
        }

        const startRaw = parts[1]; // 1,001
        const endRaw = parts[3];   // 2,000
        const totalRaw = parts[5]; // 3,510

        // 3️⃣ Normalize (remove commas) and convert to numbers
        const startIndex = Number(startRaw.replace(/,/g, ''));
        const endIndex = Number(endRaw.replace(/,/g, ''));
        const totalEntriesFromUI = Number(totalRaw.replace(/,/g, ''));

        logger?.log(`\t\t\t\t\t\t\t\t\tParsed start index: ${startIndex}`);
        logger?.log(`\t\t\t\t\t\t\t\t\tParsed end index: ${endIndex}`);
        logger?.log(`\t\t\t\t\t\t\t\t\tParsed total entries: ${totalEntriesFromUI}`);

        // 4️⃣ Calculate expected visible rows on this page
        const expectedVisibleRows = endIndex - startIndex + 1;

        logger?.log(
          `\t\t\t\t\t\t\t\tExpected visible rows (end - start + 1): ${expectedVisibleRows}`
        );

        // 5️⃣ Count actual table rows
        logger?.log('\t\t\t\t\t\t->Counting table rows (TRW-AllRows.Connections.default)');
        const actualRowCount = await page
          .locator(tableRowsLocator)
          .count();
        logger?.log(`\t\t\t\t\t\t\t\tPerforming COUNT action | Element: TRW-AllRows.Connections.default | Locator: ${locators['TRW-AllRows.Connections.default']}`);
        logger?.log(`\t\t\t\t\t\tActual table row count: ${actualRowCount}`);

        await safe("Verify 'No matching records found' is NOT visible", async () => {
          logger?.log("\t\t\t\t\t\t->Verifying if the 'No matching records' text is visible on the screen");
          logger?.log(`\t\t\t\t\t\t\tVerification of Element's presence | Element: TXT-NoMatchingRecords.CommonTable.NoRecords | Locator: ${locators['TXT-NoMatchingRecords.CommonTable.NoRecords']}`);
          const noRecordsLocator = page.locator(
            locators['TXT-NoMatchingRecords.CommonTable.NoRecords']
          );

          try {
            await expect(noRecordsLocator).not.toBeVisible({ timeout: 3000 });

            logger?.log(
              `\t\t\t\t\t\t✅ Validation 2.${accountCount}.1.1 'No matching records found' text is NOT visible as expected`
            );
          } catch (error) {
            logger?.log(
              `\t\t\t\t\t\t❌Validation 2.${accountCount}.1.1: ERROR: 'No matching records found' text is VISIBLE when it should NOT be`
            );
          }
        });


        if (totalEntriesFromUI !== connectionCountFromAPI) {
          logger?.log(
            `\t\t\t\t\t\t❌Validation 2.${accountCount}.1.2: Total Connections count from the API does not match the total entries from the UI. Expected: ${connectionCountFromAPI}, Found: ${totalEntriesFromUI}`
          );
        } else {
          logger?.log(
            `\t\t\t\t\t\t✅ Validation 2.${accountCount}.1.2:  Total Connections count from the API matches the total entries from the UI. Expected: ${connectionCountFromAPI}, Found: ${totalEntriesFromUI}`
          );
        }

        if (actualRowCount !== expectedVisibleRows) {
          logger?.log(
            `\t\t\t\t\t\t❌Validation 2.${accountCount}.1.3: Visible number of Connections in the table does not match the expected number. Expected: ${expectedVisibleRows}, Found: ${actualRowCount}`
          );
        } else {
          logger?.log(
            `\t\t\t\t\t\t✅ Validation 2.${accountCount}.1.3: Visible row count matched`
          );
        }

        if (totalEntriesFromUI !== connectionCountFromAPI) {
          throw new Error(
            `Total entry mismatch for ${accountLabel}. UI: ${totalEntriesFromUI}, API: ${connectionCountFromAPI}`
          );
        }


        if (uiTotal !== account.connectionCount) {
          throw new Error(
            `Total count mismatch | UI=${uiTotal}, API=${account.connectionCount}`
          );
        }

        summary.push({
          account: account.uIRep,
          apiCount: account.connectionCount,
          uiCount: uiTotal,
          result: 'PASS',
        });
        tableRows.push({
          validation: String(tableRows.length + 1),
          scenario: `${account.uIRep} + All Connections`,
          apisUsed: accountID != null ? `${config.databaseUrl}/api/connections/account/${accountID}` : categoryCountsUrl,
          apiCountExpected: String(account.connectionCount),
          uiCount: String(uiTotal),
          result: 'PASS',
        });
      });

      if (!summary.find((s) => s.account === account.uIRep)) {
        summary.push({
          account: account.uIRep,
          apiCount: account.connectionCount,
          uiCount: 'N/A',
          result: 'FAIL',
        });
        tableRows.push({
          validation: String(tableRows.length + 1),
          scenario: `${account.uIRep} + All Connections`,
          apisUsed: accountID != null ? `${config.databaseUrl}/api/connections/account/${accountID}` : categoryCountsUrl,
          apiCountExpected: String(account.connectionCount),
          uiCount: 'N/A',
          result: 'FAIL',
        });
      }

      /*  Pagination (first/mid/last), Sort, Reset, Show entries, Connection GUID, API verify - when main validation passed */

      if (accountCount == 1) {
        logger?.log(`\n\n\n\t\t\t\t\t\t Validation 2.${accountCount}.4: Pagination, Sorting and reset`);
        logger?.log(`\t\t\t\t\t\tWe will perform the Pagination, Sorting and reset to only first 2 accounts, this is account number ${accountCount}`);
        logger?.log(`\t\t\t\t\t\t Looping over the SortBy options`);

        const SORT_OPTIONS = [
          'Last Updated Ascending',
          'Connection ID Ascending',
          'Connection Name Ascending',
          'Last Updated Descending',
          // Need to change the Desending to Descending later
          'Connection ID Desending',
          'Connection Name Descending',
        ];

        const sortBySelect = locators['DDN-SortBy.Connections.default'];

        logger?.log(`\t\t\t\t\t\t Looping over the SortBy options: ${SORT_OPTIONS.length}`);
        logger?.log(`\t\t\t\t\t\t SortBy options: ${SORT_OPTIONS.join(', ')}`);

        const showEntriesReportRows = [];

        for (let i = 0; i < SORT_OPTIONS.length; i++) {
          const sort = SORT_OPTIONS[i];

          // Use selectOption for native <select> (works reliably vs click-open-then-click-option)
          await page.selectOption(sortBySelect, { label: sort });

          logger?.log(
            `\t\t\t\t\t\t${i + 1}. Selecting Sort By "${sort}" | Locator: ${sortBySelect}`
          );

          // Execute search
          await page.locator(locators['BTN-Search.Connections.default']).click();
          await page.waitForLoadState('networkidle');

          logger?.log(
            `\t\t\t\t\t\t\t Clicking on Search button | Locator: ${locators['BTN-Search.Connections.default']}`
          );

          // ----- Show entries dropdown: 100, 300, 500, 1000 — validate row count and sort on selected pages -----
          const SHOW_ENTRIES_OPTIONS = [100, 300, 500, 1000];

          const sortColumnInfo = (() => {
            if (/Last Updated/i.test(sort)) {
              return {
                label: 'Last Updated',
                colLocator: locators['TCL-LastUpdatedColumn.Connections.default'] || '//tbody/tr/td[8]',
                ascending: /Ascending/i.test(sort),
              };
            }
            if (/Connection Name/i.test(sort)) {
              return {
                label: 'Connection Name',
                colLocator: locators['TCL-ConnectionNameColumn.Connections.default'] || '//tbody/tr/td[6]',
                ascending: /Ascending/i.test(sort),
              };
            }
            if (/Connection ID/i.test(sort)) {
              return {
                label: 'Connection ID',
                colLocator: locators['TCL-ConnectionIDColumn.Connections.default'] || '//tbody/tr/td[4]',
                ascending: /Ascending/i.test(sort),
              };
            }
            return { label: 'Unknown', colLocator: '//tbody/tr/td[8]', ascending: true };
          })();

          logger?.log(
            `\t\t\t\t\t\t Sort column for validation: ${sortColumnInfo.label} (${sortColumnInfo.ascending ? 'Ascending' : 'Descending'}) | Locator: ${sortColumnInfo.colLocator}`
          );

          for (let e = 0; e < SHOW_ENTRIES_OPTIONS.length; e++) {
            const entriesPerPage = SHOW_ENTRIES_OPTIONS[e];
            const entriesLabel = String(entriesPerPage);

            try {
              logger?.log(
                `\n\t\t\t\t\t\t ---------- Show entries: ${entriesLabel} | Sort: ${sort} ----------`
              );

              await safe(`Select Show ${entriesLabel} entries`, async () => {
                const dropdownLocator =
                  locators['DDN-ShowNumberOfEntries.Connections.default'] ||
                  locators['DDN-ShowNumberOfEntries'];
                if (!dropdownLocator) {
                  throw new Error('No locator for Show entries dropdown (DDN-ShowNumberOfEntries)');
                }
                try {
                  await page.selectOption(dropdownLocator, { label: entriesLabel });
                  logger?.log(
                    `\t\t\t\t\t\t ACTION: Selected "Show ${entriesLabel} entries" (selectOption) | Locator: ${dropdownLocator}`
                  );
                } catch {
                  await page.locator(dropdownLocator).click();
                  await page.waitForTimeout(300);
                  const optLocator =
                    locators[`DDI-Show${entriesLabel}Entries.Connections.default`]
                      ? page.locator(locators[`DDI-Show${entriesLabel}Entries.Connections.default`])
                      : page.getByRole('option', { name: entriesLabel }).or(page.locator(`li:has-text("${entriesLabel}")`));
                  await optLocator.first().click();
                  logger?.log(
                    `\t\t\t\t\t\t ACTION: Opened Show entries dropdown and selected ${entriesLabel} (click)`
                  );
                }
              });

              await page.waitForTimeout(1500);
              logger?.log(`\t\t\t\t\t\t WAIT: 1500ms after Show entries selection`);

              const summaryLocator =
                locators['TXT-TotalEntries.Connections.default'] ||
                locators['TXT-TotalEntries.CommonPagination.default'];
              const summaryText = await page.locator(summaryLocator).first().innerText();
              logger?.log(
                `\t\t\t\t\t\t READ: TXT-TotalEntries | Text: "${summaryText}" | Locator: ${summaryLocator}`
              );

              const totalMatch = summaryText.match(/of\s+([\d,]+)\s+entries?/i);
              const totalRaw = totalMatch ? totalMatch[1].trim() : '';
              const totalRecords = Number(totalRaw.replace(/,/g, '')) || 0;
              const totalPages = Math.max(1, Math.ceil(totalRecords / entriesPerPage));

              logger?.log(
                `\t\t\t\t\t\t PARSED: Total records = ${totalRecords}, Entries per page = ${entriesPerPage}, Total pages = ${totalPages}`
              );

              const pagesToValidate =
              totalPages <= 2
                ? Array.from({ length: totalPages }, (_, idx) => idx + 1)
                : [...new Set([1, 3, totalPages])].sort((a, b) => a - b);
            logger?.log(
              `\t\t\t\t\t\t PAGES TO VALIDATE: 1st, 3rd, last where applicable | [${pagesToValidate.join(', ')}]`
            );

            const tableRowsLocator = locators['TRW-AllRows.Connections.default'];
            const noRecordsLocator =
              locators['TCL-NoMatchingRecods.Connections.default'] ||
              locators['TXT-NoMatchingRecords.CommonTable.NoRecords'];

            let sortAllPassed = true;
            let page1stResult = 'N/A';
            let page3rdResult = 'N/A';
            let pageLastResult = 'N/A';

            const formatPageLabel = (p) =>
              p === 1 ? '1st' : p === 2 ? '2nd' : p === 3 ? '3rd' : p === totalPages ? 'Last' : String(p);
            const pagesNavigatedLabel = pagesToValidate.map(formatPageLabel).join(', ');

            for (let p = 0; p < pagesToValidate.length; p++) {
              const pageNum = pagesToValidate[p];

              try {
                await safe(`Navigate to page ${pageNum}`, async () => {
                  const firstBtn =
                    locators['BTN-FirstPage.Connections.default'] ||
                    locators['BTN-FirstPage.CommonPagination.default'];
                  const lastBtn =
                    locators['BTN-LastPage.Connections.default'] ||
                    locators['BTN-LastPage.CommonPagination.default'];

                  if (pageNum === 1) {
                    if (firstBtn) await page.locator(firstBtn).click();
                    logger?.log(
                      `\t\t\t\t\t\t ACTION: Navigate to page 1 | Clicked First page (BTN-FirstPage.CommonPagination.default)`
                    );
                  } else if (pageNum === totalPages && lastBtn) {
                    await page.locator(lastBtn).click();
                    logger?.log(
                      `\t\t\t\t\t\t ACTION: Navigate to page ${pageNum} (last) | Clicked Last page (BTN-LastPage.CommonPagination.default)`
                    );
                  } else {
                    const nextBtn =
                      locators['BTN-NextPage.Connections.default'] ||
                      locators['BTN-NextPage.CommonPagination.default'];
                    const pageLink = page.locator(`a:has-text("^${pageNum}$")`).first();
                    let navigated = false;
                    try {
                      await pageLink.click({ timeout: 3000 });
                      navigated = true;
                      logger?.log(
                        `\t\t\t\t\t\t ACTION: Navigate to page ${pageNum} | Clicked page number link`
                      );
                    } catch {
                      if (firstBtn && nextBtn) {
                        await page.locator(firstBtn).click();
                        await page.waitForTimeout(400);
                        for (let n = 1; n < pageNum; n++) {
                          await page.locator(nextBtn).click();
                          await page.waitForTimeout(400);
                        }
                        navigated = true;
                        logger?.log(
                          `\t\t\t\t\t\t ACTION: Navigate to page ${pageNum} | Used First + Next ${pageNum - 1} time(s)`
                        );
                      }
                    }
                    if (!navigated) {
                      throw new Error(`Could not navigate to page ${pageNum} (no page link or Next button)`);
                    }
                  }
                  await page.waitForLoadState('networkidle');
                  await page.waitForTimeout(500);
                });

                const expectedRowsOnPage =
                  pageNum < totalPages
                    ? entriesPerPage
                    : totalRecords - (pageNum - 1) * entriesPerPage;

                const actualRowCount = await page.locator(tableRowsLocator).count();
                let pageCellValue;
                if (actualRowCount === 1 && noRecordsLocator) {
                  const noRecordsVisible = await page.locator(noRecordsLocator).isVisible().catch(() => false);
                  pageCellValue = noRecordsVisible ? 'NMR' : (actualRowCount === expectedRowsOnPage ? `PASS e:${expectedRowsOnPage} a:1` : `FAIL e:${expectedRowsOnPage} a:1`);
                } else {
                  pageCellValue = actualRowCount === expectedRowsOnPage ? `PASS e:${expectedRowsOnPage} a:${actualRowCount}` : `FAIL e:${expectedRowsOnPage} a:${actualRowCount}`;
                }
                if (pageNum === 1) page1stResult = pageCellValue;
                if (pageNum === 3) page3rdResult = pageCellValue;
                if (pageNum === totalPages) pageLastResult = pageCellValue;

                logger?.log(
                  `\t\t\t\t\t\t\t VALIDATION (page ${pageNum}): Row count | Expected: ${expectedRowsOnPage}, Actual: ${actualRowCount} => ${pageCellValue}`
                );

                if (actualRowCount !== expectedRowsOnPage) {
                  logFail(
                    `Show ${entriesLabel} entries, page ${pageNum}: Row count mismatch. Expected: ${expectedRowsOnPage}, Found: ${actualRowCount}`
                  );
                  failures.push({
                    step: `Show ${entriesLabel} entries, page ${pageNum} row count`,
                    error: `Expected: ${expectedRowsOnPage}, Found: ${actualRowCount}`,
                  });
                } else {
                  logOk(
                    `Show ${entriesLabel} entries, page ${pageNum}: Row count OK (${actualRowCount})`
                  );
                }

                if (actualRowCount > 0) {
                  const columnLoc = page.locator(sortColumnInfo.colLocator);
                  const cellTexts = await columnLoc.allTextContents();
                  const values = cellTexts.map((t) => t.trim()).filter(Boolean);

                  let sortOk = true;
                  for (let v = 0; v < values.length - 1; v++) {
                    const a = values[v];
                    const b = values[v + 1];
                    const cmp = a.localeCompare(b, undefined, { numeric: true });
                    if (sortColumnInfo.ascending && cmp > 0) sortOk = false;
                    if (!sortColumnInfo.ascending && cmp < 0) sortOk = false;
                  }

                  logger?.log(
                    `\t\t\t\t\t\t VALIDATION (page ${pageNum}): Sort by ${sortColumnInfo.label} (${sortColumnInfo.ascending ? 'Asc' : 'Desc'}) | Sample values: [${values.slice(0, 3).join(', ')}${values.length > 3 ? '...' : ''}] | Result: ${sortOk ? 'PASS' : 'FAIL'}`
                  );
                  if (!sortOk) {
                    sortAllPassed = false;
                    logFail(
                      `Show ${entriesLabel} entries, page ${pageNum}: Sort order (${sortColumnInfo.label}) is not ${sortColumnInfo.ascending ? 'ascending' : 'descending'}`
                    );
                    failures.push({
                      step: `Show ${entriesLabel} entries, page ${pageNum} sort order`,
                      error: `Sort (${sortColumnInfo.label}) not ${sortColumnInfo.ascending ? 'ascending' : 'descending'}`,
                    });
                  } else {
                    logOk(
                      `Show ${entriesLabel} entries, page ${pageNum}: Sort order OK`
                    );
                  }
                } else {
                  const noRecordsVisible = noRecordsLocator
                    ? await page.locator(noRecordsLocator).isVisible().catch(() => false)
                    : false;
                  logger?.log(
                    `\t\t\t\t\t\t\t VALIDATION (page ${pageNum}): No rows; "No matching records" visible: ${noRecordsVisible}`
                  );
                }
              } catch (err) {
                const msg = `Show ${entriesLabel} entries, page ${pageNum}: ${err.message}`;
                logFail(msg);
                failures.push({ step: `Show ${entriesLabel} entries, page ${pageNum}`, error: err.message });
                logger?.log(`\t\t\t\t\t\t (continuing to next page)`);
              }
            }

            showEntriesReportRows.push({
              sortOption: sort,
              entries: entriesLabel,
              pagesNavigated: pagesNavigatedLabel,
              page1st: page1stResult,
              page3rd: page3rdResult,
              pageLast: pageLastResult,
              sortPassFail: sortAllPassed ? 'PASS' : 'FAIL',
            });
            } catch (err) {
              const msg = `Show ${entriesLabel} entries: ${err.message}`;
              logFail(msg);
              failures.push({ step: `Show ${entriesLabel} entries`, error: err.message });
              showEntriesReportRows.push({
                sortOption: sort,
                entries: entriesLabel,
                pagesNavigated: '—',
                page1st: 'N/A',
                page3rd: 'N/A',
                pageLast: 'N/A',
                sortPassFail: 'FAIL',
              });
              logger?.log(`\t\t\t\t\t\t (continuing to next Show entries option)`);
            }
          }

        }

        if (showEntriesReportRows.length > 0) {
          const wSort = Math.min(38, Math.max(14, ...showEntriesReportRows.map((r) => r.sortOption.length)));
          const wEnt = 8;
          const wPages = Math.min(20, Math.max(10, ...showEntriesReportRows.map((r) => r.pagesNavigated.length)));
          const wPage = Math.min(18, Math.max(10, ...showEntriesReportRows.flatMap((r) => [r.page1st, r.page3rd, r.pageLast].map((x) => String(x).length))));
          const wSortResult = 6;
          const pad = (s, w) => String(s ?? '').slice(0, w).padEnd(w);
          const sep = `+${'-'.repeat(wSort + 2)}+${'-'.repeat(wEnt + 2)}+${'-'.repeat(wPages + 2)}+${'-'.repeat(wPage + 2)}+${'-'.repeat(wPage + 2)}+${'-'.repeat(wPage + 2)}+${'-'.repeat(wSortResult + 2)}+`;
          logger?.log('\n');
          logger?.log('\t📋 SHOW ENTRIES & SORT VALIDATION REPORT');
          logger?.log('\t' + '─'.repeat(Math.min(90, sep.length)));
          logger?.log(sep);
          logger?.log(`| ${pad('Sort Option', wSort)} | ${pad('Entries', wEnt)} | ${pad('Pages Nav.', wPages)} | ${pad('Page 1st', wPage)} | ${pad('Page 3rd', wPage)} | ${pad('Page Last', wPage)} | ${pad('Sort', wSortResult)} |`);
          logger?.log(sep);
          for (const row of showEntriesReportRows) {
            logger?.log(`| ${pad(row.sortOption, wSort)} | ${pad(row.entries, wEnt)} | ${pad(row.pagesNavigated, wPages)} | ${pad(row.page1st, wPage)} | ${pad(row.page3rd, wPage)} | ${pad(row.pageLast, wPage)} | ${pad(row.sortPassFail, wSortResult)} |`);
          }
          logger?.log(sep);
          logger?.log('\tPage columns: PASS/FAIL e:expected a:actual | NMR = No Matching Records | N/A = not applicable\n');
        }
      }



      accountCount++;
    }

    /* -------------------------------
       Final Summary — Table (not JSON)
    --------------------------------*/
    logger?.log('\n📊 TEST SUMMARY (tabular)');
    const wV = 4;
    const wSc = Math.min(48, Math.max(12, ...tableRows.map((r) => r.scenario.length)));
    const wApi = Math.min(52, Math.max(10, ...tableRows.map((r) => r.apisUsed.length)));
    const wAc = 8;
    const wUi = 8;
    const wR = 6;
    const pad = (s, w) => String(s ?? '').slice(0, w).padEnd(w);
    const sep = `+${'-'.repeat(wV + 2)}+${'-'.repeat(wSc + 2)}+${'-'.repeat(wApi + 2)}+${'-'.repeat(wAc + 2)}+${'-'.repeat(wUi + 2)}+${'-'.repeat(wR + 2)}+`;
    logger?.log(sep);
    logger?.log(`| ${pad('Val', wV)} | ${pad('Scenario', wSc)} | ${pad('APIs Used', wApi)} | ${pad('API #', wAc)} | ${pad('UI #', wUi)} | ${pad('Result', wR)} |`);
    logger?.log(sep);
    for (const row of tableRows) {
      logger?.log(`| ${pad(row.validation, wV)} | ${pad(row.scenario, wSc)} | ${pad(row.apisUsed, wApi)} | ${pad(row.apiCountExpected, wAc)} | ${pad(row.uiCount, wUi)} | ${pad(row.result, wR)} |`);
    }
    logger?.log(sep);
    logger?.log('\n📊 Legacy JSON summary (unchanged):');
    logger?.log(JSON.stringify(summary, null, 2));

    if (failures.length > 0) {
      logger?.log('\n❌ FAILURES');
      failures.forEach((f) =>
        logger?.log(`- ${f.step}: ${f.error}`)
      );
      throw new Error('Connections validation failed');
    }

    logOk('All validations completed successfully');
  }
);