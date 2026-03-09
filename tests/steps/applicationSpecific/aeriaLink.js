const fs = require('fs');
const path = require('path');
const { Then } = require('../hooks/bdd');
const { expect, request } = require('@playwright/test');
const config = require('../../config');

Then(
  'the user verifies the Connections page as a {word}',
  async ({ page }, testInfo, role) => {

    const exhaustiveFactor = config.exhaustiveFactor;

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


    const excludeSubAccountsLocator = locators['CHK-ExcludeSubAccounts.Connections.default'];
    await safe('Click on the Exclude Sub-accounts checkbox', async () => {
      logger?.log('Clicking on the Exclude Sub-accounts checkbox');
      await page.locator(excludeSubAccountsLocator).click();
      logger?.log(`\t\t\t\t\t\t\t\tPerforming CLICK action | Element: CHK-ExcludeSubAccounts.Connections.default | Locator: ${excludeSubAccountsLocator}`);
    });

    if (role === 'admin') {
      logger?.log('The selected role is "admin"');
      console.log('Lets verify the Connections page as an admin');
    } else if (role === 'parent') {
      logger?.log('The selected role is "parent"');
      console.log('Lets verify the Connections page as a parent');
    } else if (role === 'user') {
      logger?.log('The selected role is "user"');
      console.log('Lets verify the Connections page as a user');
    } else {
      logger?.log('The selected role is invalid');
      console.log('Lets verify the Connections page as a admin');
      role = 'admin';
    }

    logger?.log(`\t\t\t\t\t\t Exhaustive Factor from config (exhaustiveFactor in config.js) = ${exhaustiveFactor}\n\n`);
    /* -------------------------------
       Validation 1. Step 1.1: Load category-counts
    --------------------------------*/
    logStep('Validation I. Checking the number of parent accounts in the API against the UI');
    logger?.log('\t\tSELECTION-Step I.1: Loading the data from the category-counts API');

    const categoryCountsUrl = `${config.databaseUrl}/api/connections/category-counts`;
    logger?.log(`\t\t\t\tCalling category-counts API: ${categoryCountsUrl}`);

    const apiContext = await request.newContext();
    const categoryRes = await apiContext.get(categoryCountsUrl);
    const categoryJson = await categoryRes.json();

    const parents = categoryJson.data.byAccount
      .filter((a) => a.parent === true)
      .sort((a, b) => b.connectionCount - a.connectionCount);

    const allAccounts = categoryJson.data.byAccount || [];

    logPlain(`\t\t\t\tParents: ${JSON.stringify(parents)}`);
    logger?.log(`\t\t\t\tLoaded ${parents.length} parent accounts from API`);

    /* All Accounts total: use API grandTotal when present, else sum of parents' connectionCount */
    const totalConnectionsAllAccounts =
      typeof categoryJson.data.grandTotal === 'number'
        ? categoryJson.data.grandTotal
        : parents.reduce((s, p) => s + (p.connectionCount || 0), 0);
    logger?.log(`\t\t\t\tAll Accounts expected total (grandTotal): ${totalConnectionsAllAccounts}\n`);

    /* -------------------------------
       Account Switch for parent/user roles (before exhaustive factor)
       Required locators: BTN-AccoutSelectPen, INP-AccountName, DDI-AccountNameWithID,
       DDI-1stAccount, BTN-Switch (all .AccountSwitch.default)
    --------------------------------*/
    let switchedAccount = null;
    if (role === 'parent' || role === 'user') {
      const required = [
        'BTN-AccoutSelectPen.AccountSwitch.default',
        'INP-AccountName.AccountSwitch.default',
        'BTN-Switch.AccountSwitch.default',
      ];
      for (const k of required) {
        if (!locators[k]) throw new Error(`Missing locator for account switch: ${k}`);
      }
      if (role === 'parent' && !locators['DDI-AccountNameWithID.AccountSwitch.default']) {
        throw new Error('Missing locator: DDI-AccountNameWithID.AccountSwitch.default');
      }
      if (role === 'user' && !locators['DDI-1stAccount.AccountSwitch.default']) {
        throw new Error('Missing locator: DDI-1stAccount.AccountSwitch.default');
      }
    }
    if (role === 'parent') {
      const parentAccounts = parents;
      if (parentAccounts.length === 0) {
        throw new Error('No parent accounts found in category-counts API');
      }
      const selectedParent = parentAccounts[Math.floor(Math.random() * parentAccounts.length)];
      const uIRep = selectedParent.uIRep || '';
      const match = uIRep.match(/^(.+?)\s*\[(\d+)\]/);
      const A = match ? match[1].trim() : uIRep;
      const B = match ? `${match[1].trim()} (${match[2]})` : uIRep;
      logger?.log(`\t\t\t\tParent role: selected random parent: ${JSON.stringify(selectedParent)}`);
      logger?.log(`\t\t\t\tInput text A: "${A}", Search text B: "${B}"`);

      await safe('Click Account Select Pen (parent switch)', async () => {
        await page.locator(locators['BTN-AccoutSelectPen.AccountSwitch.default']).click();
        logger?.log(`\t\t\t\tPerforming CLICK | BTN-AccoutSelectPen.AccountSwitch.default`);
      });
      await safe('Enter account name and select (parent)', async () => {
        await page.locator(locators['INP-AccountName.AccountSwitch.default']).fill(A);
        await page.waitForTimeout(1000);
        const ddiLocator = locators['DDI-AccountNameWithID.AccountSwitch.default'].replace('AccountName', B);
        await page.locator(ddiLocator).click();
        logger?.log(`\t\t\t\tPerforming FILL then SELECT | INP-AccountName, DDI-AccountNameWithID with B="${B}"`);
      });
      await safe('Click Switch button (parent)', async () => {
        await page.locator(locators['BTN-Switch.AccountSwitch.default']).click();
        logger?.log(`\t\t\t\tPerforming CLICK | BTN-Switch.AccountSwitch.default`);
      });
      await page.waitForTimeout(10000);
      switchedAccount = selectedParent;
      logger?.log(`\t\t\t\tSwitched to parent account: ${switchedAccount.uIRep}\n`);
    } else if (role === 'user') {
      const childAccounts = allAccounts.filter(
        (a) => a.parent === false && a.accountID >= 1000 && a.accountID <= 9999
      );
      if (childAccounts.length === 0) {
        throw new Error('No child accounts with 4-digit accountID found in category-counts API');
      }
      const selectedChild = childAccounts[Math.floor(Math.random() * childAccounts.length)];
      const A = String(selectedChild.accountID);
      logger?.log(`\t\t\t\tUser role: selected random 4-digit child: ${JSON.stringify(selectedChild)}`);
      logger?.log(`\t\t\t\tInput text A (accountID): "${A}"`);

      await safe('Click Account Select Pen (user switch)', async () => {
        await page.locator(locators['BTN-AccoutSelectPen.AccountSwitch.default']).click();
        logger?.log(`\t\t\t\tPerforming CLICK | BTN-AccoutSelectPen.AccountSwitch.default`);
      });
      await safe('Enter account ID and select first (user)', async () => {
        await page.locator(locators['INP-AccountName.AccountSwitch.default']).fill(A);
        await page.waitForTimeout(1000);
        await page.locator(locators['DDI-1stAccount.AccountSwitch.default']).click();
        logger?.log(`\t\t\t\tPerforming FILL then SELECT first | INP-AccountName, DDI-1stAccount.AccountSwitch.default`);
      });
      await safe('Click Switch button (user)', async () => {
        await page.locator(locators['BTN-Switch.AccountSwitch.default']).click();
        logger?.log(`\t\t\t\tPerforming CLICK | BTN-Switch.AccountSwitch.default`);
      });
      await page.waitForTimeout(10000);
      switchedAccount = selectedChild;
      logger?.log(`\t\t\t\tSwitched to user account: ${switchedAccount.uIRep}\n`);
    }

    /* -------------------------------
       Validation 1. Step 1.3: Populating the Accounts from Account dropdown on the UI
       (Skipped for parent/user - we switched to a single account scope)
    --------------------------------*/
    if (!switchedAccount) {
      logger?.log('\t\tSELECTION-Step I.2: Populating the Accounts from Account dropdown on the UI');
      await safe('Open Account dropdown', async () => {
        logger?.log('\t\t\t\t->Opening Account dropdown');
        await page.locator(locators['DDN-Account.Connections.default']).click();
      });
      logger?.log(`\t\t\t\t\tPerforming CLICK action | Element: DDN-Account.Connections.default | Locator: ${locators['DDN-Account.Connections.default']}`);

      /* -------------------------------
         Populating dropdown items
      --------------------------------*/
      await safe('Validate Account dropdown contents (UI vs API)', async () => {
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

        logger?.log('\n\t\t\t\tThe 2 additional accounts allowed in the UI are: 1. All Accounts, and 2. Aerialink Inc. Global Data [0]');


        logger?.log(`\n`);

        const missingInUI = apiParentIDs.filter(id => !uiAccountIDs.includes(id));
        const missingInAPI = uiAccountIDs.filter(id => !apiParentIDs.includes(id));

        const difference = uiAccountIDs.length - apiParentIDs.length;
        logger?.log(`\t\t 🆔 → I.1.0`);
        logger?.log(`\t\t\t\tDifference between UI and API account IDs: ${difference}`);


        if (difference > 2) {
          let errorMessage = '\n\t\t\t\t\t\t❌Validation I. FAILED | The accountIDs count on UI has exceeded the accountIDs count on API by more than 2\n';
          throw new Error(errorMessage);
        } else {
          logger?.log('\n\t\t\t\t\t\t✅Validation I. PASSED | The accountIDs count on UI has exceeded the accountIDs count on API by more than 2\n');
          if (missingInUI.length > 0) {
            logger?.log(`\t\t\t\tIDs in API but missing in UI: ${missingInUI.join(', ')}`);
          }
          if (missingInAPI.length > 0) {
            logger?.log(`\t\t\t\tIDs in UI but missing in API: ${missingInAPI.join(', ')}`);
          }
        }
      });
    }

    const tableRows = [];
    const validationITableRows = [];
    validationITableRows.push({
      validation: '1',
      scenario: 'Account dropdown',
      apisUsed: categoryCountsUrl,
      apiCountExpected: String(parents.length),
      uiCount: 'match',
      result: 'PASS',
      remarks: "Excluded accounts: 'All Accounts', 'Aerialink Inc. Global Data [0]'",
    });
    const validationIITableRows = [];
    let showEntriesReportRows = [];
    const guidReportRows = [];
    const resetReportRows = [];
    const csvDownloadReportRows = [];

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

    const selectedParents = switchedAccount
      ? [switchedAccount]
      : selectParentsForExhaustiveCoverage(parents, exhaustiveFactor);

    logger?.log(`\t\t\t\tSelected parents (${selectedParents.length}): ${JSON.stringify(
      selectedParents.map(p => ({
        accountID: p.accountID,
        connectionCount: p.connectionCount,
      }))
    )}`);

    logger?.log(
      switchedAccount
        ? `🧠 Role=${role} | Single account scope: ${switchedAccount.uIRep}\n\n\n`
        : `🧠 Parent selection applied | Exhaustive=${exhaustiveFactor}% | Selected ${selectedParents.length} of ${parents.length} parents based on distribution\n\n\n`
    );

    /* Build list to process: admin = All Accounts + selected parents; parent/user = single switched account */
    const percentCount = (total) => Math.max(1, Math.ceil((total * exhaustiveFactor) / 100));
    const accountsToProcess = switchedAccount
      ? [{ ...switchedAccount, label: `[${switchedAccount.accountID}]`, uIRep: switchedAccount.uIRep }]
      : [
          ...selectedParents.map((p) => ({ ...p, label: `[${p.accountID}]`, uIRep: p.uIRep })),
          { label: '[1]', accountID: 1, uIRep: 'Aerialink Inc. [1]', connectionCount: totalConnectionsAllAccounts },
        ];
    const totalAccounts = accountsToProcess.length;
    logger?.log(`\t\t\t\tTotal accounts: ${totalAccounts}`);
    logger?.log(`\t\t\t\tAccounts to process: ${accountsToProcess.length} (${selectedParents.length} parents + account [1])`);

    /* -------------------------------
       Validation 2. For the accounts in the selected parents, perform the following steps: 1. 
    --------------------------------*/
    logger?.log('\t\t\t\tValidation II. Connections table validation: Record Counts(UI and API), Number of Rows Connection Selection,');
    logger?.log('\t\t\t\tWe will be validating the connections table for the accounts in the selected parents');
    logger?.log(`\t\t\t\tselected parents: ${JSON.stringify(selectedParents)}`);

    let accountCount = 1;
    for (const account of accountsToProcess) {

      const isLastAccount = accountCount === totalAccounts;
      logger?.log(`\t\t\t\t\t\tIs this the last account: ${isLastAccount}\n\n\n\n`);
      let connectionsToTest = [];
      const accountLabel = account.label;
      const accountID = account.accountID;
      logger?.log(`SELECTION II.${accountCount}: ${accountLabel} Selecting CONNECTIONS for the account: ${accountLabel} whose connection-Count is:${account.connectionCount})`);

      logStep(`\t\t\tSELECTION II.${accountCount}: Choosing the Accounts dropdown and selecting the account: ${accountLabel} and opening the Connections dropdown to list its Connections options`);
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
      await page.waitForTimeout(2000);
      connectionsToTest = [];
      logger?.log(`\t\t\t\t\t\tconnectionsToTest before load (account changed to ${accountLabel}): ${JSON.stringify(connectionsToTest)}`);

      /* Connections dropdown: open, count/store options, narrow by exhaustive factor, display; then All Connections once per account */
      await safe('Open Connections dropdown and load options', async () => {
        logger?.log('\t\t\t\t\t\t->Clicking Connections dropdown (DDN-Connection.Connections.default)');
        await page.locator(locators['DDN-Connection.Connections.default']).click();
        await page.waitForTimeout(400);

        logger?.log(
          `\t\t\t\t\t\t\t\tPerforming CLICK action | Element: DDN-Connection.Connections.default | Locator: ${locators['DDN-Connection.Connections.default']}`
        );

        logger?.log('\t\t\t\t\t\t->Reading all connection options (DDI-AllConnections.Connections.default)');
        const texts = await page
          .locator(locators['DDI-AllConnections.Connections.default'])
          .allTextContents();

        logger?.log(
          `\t\t\t\t\t\t\t\tPerforming READ action | Element: DDI-AllConnections.Connections.default | Locator: ${locators['DDI-AllConnections.Connections.default']} | List of Connections count: ${texts.length}\n`
        );

        // Normalize + trim
        const options = texts.map(t => (t || '').trim()).filter(Boolean);

        // Always include "All Connections" first
        connectionsToTest.push('All Connections');

        // Extract only account IDs from remaining options
        const accountIds = options
          .filter(t => t !== 'All Connections')
          .map(t => {
            const match = t.match(/\[\d+\]/);
            return match ? match[0] : null;
          })
          .filter(Boolean);

        const toTake = percentCount(accountIds.length);

        if (toTake > 7) {
          toTake = 7;
          logger?.log('As the connection count is more than 7, we will only select 8 connections to test including "All Connections"');
        }
       

        const selectedIds = accountIds.slice(0, toTake);

        connectionsToTest.push(...selectedIds);

        logger?.log(`\t\t\t\tconnectionsToTest after load: ${JSON.stringify(connectionsToTest)}`);
        logger?.log(`\t\t\t\tConnections to test: ${connectionsToTest.join(', ')}`);



        logger?.log(
          `\t\t\t\tConnections in dropdown: ${accountIds.length}. ` +
          `Using ${toTake} ( exhaustive factor: ${exhaustiveFactor}%): ` +
          `${connectionsToTest.slice(0, 4).join(', ')}${connectionsToTest.length > 4 ? '...' : ''}`
        );
      });
      logger?.log(`\n`);



      logger?.log(
        `\t\t\t\t\t\t\t\t\t\t\t\tConnections selected for testing the account: ${accountLabel}`
      );


      for (let i = 0; i < connectionsToTest.length; i++) {
        const connection = connectionsToTest[i];
        logger?.log(
          `\t\t\t\t\t\t[${i + 1}] : ${connection}`
        );
      }


      for (let i = 0, connectCount = 1; i < connectionsToTest.length; i++, connectCount++) {
        logger?.log(`\t\t\t\t\t\t\t\Account # ${accountCount} of ${totalAccounts}`);
        logger?.log(`\t\t\t\t\t\t\t\tConnection #${connectCount} of ${connectionsToTest.length}`);


       
        // logger?.log(`\t\t\t\t\t\t\t\tPage URL Before Refresh: ${await page.url()}`);
        // logger?.log(`\t\t\t\t\t\t\t\tPage refreshed after each connection`);
        // await page.reload();
        // logger?.log(`\t\t\t\t\t\t\t\tPage URL After Refresh: ${await page.url()}`);

        const isLastConnection = i === connectionsToTest.length - 1;
        logger?.log(`\t\t\t\t\t\t\t\tIs this the last connection: ${isLastConnection}`);
        const connection = connectionsToTest[i];
        logger?.log(
          `Validation II.${accountCount}.${connectCount}: Testing connection filter: ${connection} | ${accountLabel}.${connection}`
        );


        await safe('Select the Connections and Search', async () => {

          await page.locator(locators['DDN-Connection.Connections.default']).click();


          logger?.log(`\t\t\t\t\t\t->Entering '${connection}' in INP-ConnectionSearchText and selecting`);
          // if INP-ConnectionSearchText.Connections.default is not visible, then click on DDN-Connection.Connections.default else dont click on it  
          logger?.log(`\t\t\t\t\t\t->Checking if INP-ConnectionSearchText.Connections.default is visible`);
          const connectionSearchTextLocator = locators['INP-ConnectionSearchText.Connections.default'];
          const connectionSearchTextVisible = await page.locator(connectionSearchTextLocator).isVisible();
          if (connectionSearchTextVisible) {
            logger?.log(`\t\t\t\t\t\t->INP-ConnectionSearchText.Connections.default is visible, so we will fill the connection string in the input`);
            logger?.log(`\t\t\t\t\t\t->INP-ConnectionSearchText.Connections.default is already visible, so we will not click on DDN-Connection.Connections.default`);
          } else {
            logger?.log(`\t\t\t\t\t\t->INP-ConnectionSearchText.Connections.default is not visible, so we will click on DDN-Connection.Connections.default`);
            await page.locator(locators['DDN-Connection.Connections.default']).click();
            logger?.log(`\t\t\t\t\t\t->Clicking on the dropdown | Element: DDN-Connection.Connections.default | Locator: ${locators['DDN-Connection.Connections.default']}`);
            await page.waitForTimeout(500);
          }
          
          await page.locator(locators['INP-ConnectionSearchText.Connections.default']).fill(connection + " ");
          await page.waitForTimeout(1000);
          // delete the space fron the input
          await page.locator(locators['INP-ConnectionSearchText.Connections.default']).press('Backspace');
          await page.waitForTimeout(1000);
          logger?.log(`\t\t\t\t\t\t\t\tPerforming FILL action | Element: INP-ConnectionSearchText.Connections.default | Value: ${connection} | Locator: ${locators['INP-ConnectionSearchText.Connections.default']}`);
          await page.waitForTimeout(300);

          logger?.log(`\t\t\t\t\t\t->Checking if the connection is visible with the connection string: ${connection}`);
          const connectionLocator = locators['DDI-1stConnection.Connections.default'].replace(/\$\^\$/g, connection);

          const optionLoc = page.locator(connectionLocator).first();
          await optionLoc.waitFor({ state: 'visible', timeout: 5000 });
          const connectionText = (await optionLoc.innerText()).trim();

          logger?.log(`\t\t\t\t\t\t\t\tConnection 1st option innerText: ${connectionText}`);


          logger?.log(`\t\t\t\t\t🧪 Val-step II.${accountCount}.${connectCount}.0 Validate if the 1st option in the Connection dropdown contains the connection string: ${connection}`);
          logger?.log(`\t\t\t\t\t 🆔 → II.${accountCount}.${connectCount}.0`);
          if (!connectionText.includes(connection)) {
            throw new Error(`\t\t\t\t\t\t❌ Val-step II.${accountCount}.${connectCount}.0: Connection "${connection}" not found in 1st option text: "${connectionText}"`);
          } else {
            logger?.log(`\t\t\t\t\t\t✅ Val-step II.${accountCount}.${connectCount}.0: Connection "${connection}" is found in the 1st option text: ${connectionText})`);
          }

          logger?.log('\t\t\t\t\t\t->Clicking first connection option (DDI-1stConnection.Connections.default)');
          await optionLoc.click();
          await page.waitForTimeout(300);
          logger?.log('\t\t\t\t\t\t->Clicking Search button');
          await page.locator(locators['BTN-Search.Connections.default']).click();
          logger?.log(`\t\t\t\t\t\t\t\tPerforming CLICK action | Element: BTN-Search.Connections.default | Locator: ${locators['BTN-Search.Connections.default']}`);
        });

        if (accountID != null && locators['TXT-SearchResultsAccountID.Connections.default']) {
          const searchResultLocator = locators['TXT-SearchResultsAccountID.Connections.default'].replace('$^$', accountID);
          await safe(`Wait for Search Results accountID: ${accountID}`, async () => {
            logger?.log(`\t\t\t\t\t\t\t\tWAIT action | Element: TXT-SearchResultsAccountID.Connections.default | Locator: ${searchResultLocator}`);

            logger?.log(`\t\t\t\t\t\t->Waiting for Search Results accountID: ${accountID}`);
            await page.locator(searchResultLocator).waitFor({ state: 'visible', timeout: 60_000 });
            
            const searchResultText = await page.locator(searchResultLocator).innerText();
            logger?.log(`\t\t\t\t\t\t\t\tSearch Results text: ${searchResultText}`);
          });
        } else {
          logger?.log('\t\t\t\t\t\t->Waiting for networkidle (All Accounts path)');
          await page.waitForLoadState('networkidle');
          logger?.log('\t\t\t\t\t\t\t\tLoad state: networkidle');
        }

        const connectionCountFromAPI = account.connectionCount;
        logger?.log(`\t\t\t\t\t\tConnection count for ${accountLabel} from API is ${connectionCountFromAPI}`);


        await safe('\n\n\n\t\t\t\t\t\t\t\t\tValidate record counts and pagination', async () => {
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

          const noRecordsLocator = page.locator(
            locators['TXT-NoMatchingRecords.CommonTable.NoRecords']
          );
          const noRecordsVisible = await noRecordsLocator.isVisible().catch(() => false);
          const nmrPresent = true;

          await safe("Verify 'No matching records found' is NOT visible", async () => {
            logger?.log("\t\t\t\t\t\t->Verifying if the 'No matching records' text is visible on the screen");
            logger?.log(`\t\t\t\t\t\t\tVerification of Element's presence | Element: TXT-NoMatchingRecords.CommonTable.NoRecords | Locator: ${locators['TXT-NoMatchingRecords.CommonTable.NoRecords']}`);
            logger?.log(`\t\t\t\t\t\tValidating for Account: '${accountLabel}' & Connection: '${connection}'`);
            try {
              await expect(noRecordsLocator).not.toBeVisible({ timeout: 3000 });
              nmrPresent = false;
              logger?.log(
                `\t\t\t\t\t\t✅ Val-step II.${accountCount}.${connectCount}.1 'No matching records found' text is NOT visible as expected`
              );
            } catch (error) {
              nmrPresent = true;
              logger?.log(
                `\t\t\t\t\t\t❌ Val-step II.${accountCount}.${connectCount}.1: ERROR: 'No matching records found' text is VISIBLE when it should NOT be`
              );
            }
          });


          if (totalEntriesFromUI !== connectionCountFromAPI) {
            logger?.log(
              `\t\t\t\t\t\t❌ Val-step II.${accountCount}.${connectCount}.2: Total Connections count from the API does not match the total entries from the UI. Expected: ${connectionCountFromAPI}, Found: ${totalEntriesFromUI}`
            );
          } else {
            logger?.log(
              `\t\t\t\t\t\t✅ Val-step II.${accountCount}.${connectCount}.2:  Total Connections count from the API matches the total entries from the UI. Expected: ${connectionCountFromAPI}, Found: ${totalEntriesFromUI}`
            );
          }

          if (actualRowCount !== expectedVisibleRows && nmrPresent === true) {
            logger?.log(
              `\t\t\t\t\t\t❌ Val-step II.${accountCount}.${connectCount}.3: Visible row count does not match the expected number. Expected: ${expectedVisibleRows}, Found: ${actualRowCount}`
            );
          } else {
            logger?.log(
              `\t\t\t\t\t\t✅ Val-step II.${accountCount}.${connectCount}.3: Visible row count matched with the expected number. Expected: ${expectedVisibleRows}, Found: ${actualRowCount}`
            );
          }

          const valId = `II.${accountCount}.${connectCount}`;
          const apiUsedUrl = accountID != null ? `${config.databaseUrl}/api/connections/account/${accountID}` : categoryCountsUrl;
          const nmrResult = noRecordsVisible ? `FAIL (${valId}.1)` : 'PASS';
          const apiUiCountResult = totalEntriesFromUI === connectionCountFromAPI ? `PASS (${valId}.2)` : `FAIL (${valId}.2)`;
          let uiRowsResult;
          if (totalEntriesFromUI === 1 && noRecordsVisible) {
            uiRowsResult = 'FAIL (NMR)';
          } else if (actualRowCount === expectedVisibleRows) {
            uiRowsResult = `PASS e:${expectedVisibleRows} a:${actualRowCount}`;
          } else {
            uiRowsResult = `FAIL e:${expectedVisibleRows} a:${actualRowCount}`;
          }
          validationIITableRows.push({
            validationId: valId,
            accountLabel,
            collection: connection,
            apiUsed: apiUsedUrl,
            apiCount: connectionCountFromAPI,
            uiEntriesCount: totalEntriesFromUI,
            nmr: nmrResult,
            apiUiCount: apiUiCountResult,
            uiRows: uiRowsResult,
          });

          if (totalEntriesFromUI !== connectionCountFromAPI) {
            throw new Error(
              `Total entry mismatch for ${accountLabel}. UI: ${totalEntriesFromUI}, API: ${connectionCountFromAPI}`
            );
          }

          summary.push({
            account: account.uIRep,
            apiCount: account.connectionCount,
            uiCount: totalEntriesFromUI,
            result: 'PASS',
          });
          tableRows.push({
            validation: String(tableRows.length + 1),
            scenario: `${account.uIRep} + ${connection}`,
            apisUsed: apiUsedUrl,
            apiCountExpected: String(account.connectionCount),
            uiCount: String(totalEntriesFromUI),
            result: 'PASS',
          });
        });

        if (!summary.find((s) => s.account === account.uIRep)) {
          const valId = `II.${accountCount}.${connectCount}`;
          const apiUsedUrl = accountID != null ? `${config.databaseUrl}/api/connections/account/${accountID}` : categoryCountsUrl;
          summary.push({
            account: account.uIRep,
            apiCount: account.connectionCount,
            uiCount: 'N/A',
            result: 'FAIL',
          });
          validationIITableRows.push({
            validationId: valId,
            accountLabel,
            collection: connection,
            apiUsed: apiUsedUrl,
            apiCount: account.connectionCount,
            uiEntriesCount: 'N/A',
            nmr: 'N/A',
            apiUiCount: `FAIL (${valId}.2)`,
            uiRows: 'N/A',
          });
          tableRows.push({
            validation: String(tableRows.length + 1),
            scenario: `${account.uIRep} + ${connection}`,
            apisUsed: apiUsedUrl,
            apiCountExpected: String(account.connectionCount),
            uiCount: 'N/A',
            result: 'FAIL',
          });
        }

        /*  Pagination (first/mid/last), Sort, Reset, Show entries, Connection GUID, API verify - when main validation passed */
        var csvDownloadCount = 0;

        if (accountID === 1 && connection === 'All Connections') {

          logger?.log(`\n\n\n\t\t\t\t\t\t TRIAGING Account: ${accountLabel} and Connection: ${connection}`);

          logger?.log(`\n\n\n\t\t\t\t\t\t Validation III.: Pagination, Sorting and reset | For account: '${accountLabel}' & Connection: '${connection}'`); logger?.log(`\t\t\t\t\t\tWe will perform the Pagination, Sorting and reset to only  this is account number ${accountCount}`);
          logger?.log(`\t\t\t\t\t\t Looping over the SortBy options`);

          const SORT_OPTIONS = [
            'Last Updated Ascending',
            'Connection ID Ascending',
            'Connection Name Ascending',
            'Last Updated Descending',
            'Connection ID Descending',
            'Connection Name Descending',
          ];

          const sortBySelect = locators['DDN-SortBy.Connections.default'];

          logger?.log(`\t\t\t\t\t\t Looping over the SortBy options: ${SORT_OPTIONS.length}`);
          logger?.log(`\t\t\t\t\t\t SortBy options: ${SORT_OPTIONS.join(', ')}`);

          showEntriesReportRows = [];

          for (let i = 0; i < SORT_OPTIONS.length; i++) {
            const sort = SORT_OPTIONS[i];

            // Use selectOption for native <select> (works reliably vs click-open-then-click-option)
            await page.selectOption(sortBySelect, { label: sort });

            logger?.log(
              `\t\t\t\t\t\tIII.${i + 1}. Selecting Sort By "${sort}" | Locator: ${sortBySelect}`
            );

            // Click on connection dropdown and enter the connectio name in the input and select the connection  
            await safe('Click on connection dropdown and enter the connection name in the input and select the connection', async () => {
              logger?.log(`\t\t\t\t\t\t->Clicking on connection dropdown and entering the connection name in the input and selecting the connection`);
              // Check if INP-ConnectionSearchText.Connections.default is visible and if it is dont click on DDN-Connection.Connections.default' else click on it
              const connectionSearchTextLocator = locators['INP-ConnectionSearchText.Connections.default'];
              const connectionSearchTextVisible = await page.locator(connectionSearchTextLocator).isVisible();
              if (connectionSearchTextVisible) {
                logger?.log(`\t\t\t\t\t\t->INP-ConnectionSearchText.Connections.default is already visible, so we will not click on DDN-Connection.Connections.default`);
              } else {
                logger?.log(`\t\t\t\t\t\t->INP-ConnectionSearchText.Connections.default is not visible, so we will click on DDN-Connection.Connections.default`);
                await page.locator(locators['DDN-Connection.Connections.default']).click();
                logger?.log(`\t\t\t\t\t\t->Clicking on the dropdown | Element: DDN-Connection.Connections.default | Locator: ${locators['DDN-Connection.Connections.default']}`);
                await page.waitForTimeout(500);
              }


              await page.locator(locators['INP-ConnectionSearchText.Connections.default']).fill(connection + " ");
              logger?.log(`\t\t\t\t\t\t->Filling the connection name in the input | Element: INP-ConnectionSearchText.Connections.default | Locator: ${locators['INP-ConnectionSearchText.Connections.default']} | Value: ${connection + " "}`);
              await page.waitForTimeout(300);
              await page.locator(locators['INP-ConnectionSearchText.Connections.default']).press('Backspace');
              logger?.log(`\t\t\t\t\t\t->Pressing backspace to delete the space | Element: INP-ConnectionSearchText.Connections.default | Locator: ${locators['INP-ConnectionSearchText.Connections.default']}`);
              await page.waitForTimeout(300);
              await page.locator(locators['DDN-Connection.Connections.default']).selectOption({ label: connection });
            });

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
                  `\n\t\t\t\t\t\t\t\t\t\t ---------- III.${i + 1}.${e + 1} Show entries: ${entriesLabel} | Sort: ${sort} ---------- account: ${accountLabel} & connection: ${connection}`
                );



                await safe(`\t\t\t\t\t\tSelect Show ${entriesLabel} entries`, async () => {
                  const selectLocator =
                    locators['DDN-ShowNumberOfEntries.CommonPagination.default'] ||
                    locators['DDN-ShowNumberOfEntries.Connections.default'] ||
                    locators['DDN-ShowNumberOfEntries'];
                  const optionLocatorKey = `DDI-Show${entriesLabel}Entries.CommonPagination.default`;
                  const optionLocator =
                    locators[optionLocatorKey] ||
                    locators[`DDI-Show${entriesLabel}Entries.Connections.default`];
                  if (!selectLocator) {
                    throw new Error('\t\t\t\t\t\t❌ No locator for Show entries dropdown (DDN-ShowNumberOfEntries)');
                  }
                  const selectEl = page.locator(selectLocator);
                  try {
                    await selectEl.selectOption({ label: entriesLabel });
                    logger?.log(
                      `\t\t\t\t\t\t ACTION: Selected "Show ${entriesLabel} entries" (selectOption label) | Locator: ${selectLocator}`
                    );
                  } catch {
                    try {
                      await selectEl.selectOption({ value: entriesLabel });
                      logger?.log(
                        `\t\t\t\t\t\t ACTION: Selected "Show ${entriesLabel} entries" (selectOption value) | Locator: ${selectLocator}`
                      );
                    } catch {
                      if (optionLocator) {
                        await selectEl.click();
                        await page.waitForTimeout(400);
                        await page.locator(optionLocator).click();
                        logger?.log(
                          `\t\t\t\t\t\t ACTION: Selected "Show ${entriesLabel} entries" (click option) | Option: ${optionLocatorKey}`
                        );
                      } else {
                        throw new Error(`No option locator for Show ${entriesLabel} entries (${optionLocatorKey})`);
                      }
                    }
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
                        `\t\t\t\t\t\t\t\t\tShow ${entriesLabel} entries, page ${pageNum}: Row count mismatch. Expected: ${expectedRowsOnPage}, Found: ${actualRowCount}`
                      );
                      failures.push({
                        step: `Show ${entriesLabel} entries, page ${pageNum} row count`,
                        error: `Expected: ${expectedRowsOnPage}, Found: ${actualRowCount}`,
                      });
                    } else {
                      logOk(
                        `\t\t\t\t\t\t\t\t\tShow ${entriesLabel} entries, page ${pageNum}: Row count OK (${actualRowCount})`
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
                          `\t\t\t\t\t\t\t\t\tShow ${entriesLabel} entries, page ${pageNum}: Sort order (${sortColumnInfo.label}) is not ${sortColumnInfo.ascending ? 'ascending' : 'descending'}`
                        );
                        failures.push({
                          step: `Show ${entriesLabel} entries, page ${pageNum} sort order`,
                          error: `Sort (${sortColumnInfo.label}) not ${sortColumnInfo.ascending ? 'ascending' : 'descending'}`,
                        });
                      } else {
                        logOk(
                          `\t\t\t\t\t\t\t\t\tShow ${entriesLabel} entries, page ${pageNum}: Sort order OK`
                        );
                      }
                    } else {
                      const noRecordsVisible = noRecordsLocator
                        ? await page.locator(noRecordsLocator).isVisible().catch(() => false)
                        : false;
                      logger?.log(
                        `\t\t\t\t\t\t\t  VALIDATION (page ${pageNum}): No rows; "No matching records" visible: ${noRecordsVisible}`
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

            // Download the CSV and validate the data

            csvDownloadCount = csvDownloadCount + 1;
            const outputSelectLoc = locators['DDN-Output.Connections.default'];
            const summaryLocatorForCsv = locators['TXT-TotalEntries.Connections.default'] || locators['TXT-TotalEntries.CommonPagination.default'];
            const summaryTextForCsv = await page.locator(summaryLocatorForCsv).first().innerText();
            const totalMatchCsv = summaryTextForCsv.match(/of\s+([\d,]+)\s+entries?/i);
            const uiEntriesCount = totalMatchCsv ? Number(totalMatchCsv[1].replace(/,/g, '')) : 0;


            const beforeDownloadUrl = page.url();
            logger?.log(`\t\t\t\t\t\t->URL before Download | URL: ${beforeDownloadUrl}`);


            logger?.log(`\n\n\n\t\t\t\t\t\tValidation III.II.${accountCount}.${csvDownloadCount}: CSV Download: UI Entries (before download) = ${uiEntriesCount} | Sort: ${sort} | Locator: ${summaryLocatorForCsv}`);
            logger?.log(`\n\n\n\t\t\t\t\t\t Account Count: ${accountCount} and Connection: ${connection}`);
            await safe('Select Download from Output and download CSV', async () => {
              logger?.log(`\t\t\t\t\t\t->Selecting Download from Output dropdown`);
              await page.selectOption(outputSelectLoc, { label: 'Download' });
              logger?.log(`\t\t\t\t\t\t\t\tPerforming SELECT action | Element: DDN-Output.Connections.default | Locator: ${outputSelectLoc} | Value: Download`);
              logger?.log(`\t\t\t\t\t\t->Clicking Search button to trigger download`);
              const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
              await page.locator(locators['BTN-Search.Connections.default']).click();
              logger?.log(`\t\t\t\t\t\t\t\tPerforming CLICK action | Element: BTN-Search.Connections.default | Locator: ${locators['BTN-Search.Connections.default']}`);
              const download = await downloadPromise;
              const downloadDir = path.isAbsolute(config.csvDownloadLocation) ? config.csvDownloadLocation : path.resolve(process.cwd(), config.csvDownloadLocation);
              fs.mkdirSync(downloadDir, { recursive: true });
              const savePath = path.join(downloadDir, download.suggestedFilename());
              await download.saveAs(savePath);
              logger?.log(`\t\t\t\t\t\t\t\tDownload saved to: ${savePath}`);

              const content = fs.readFileSync(savePath, 'utf8');
              const lines = content.split(/\r?\n/).filter(Boolean);
              const headerLine = lines[0] || '';
              const dataRows = lines.slice(1);
              const downloadedCount = dataRows.length;
              let entriesResult = 'PASS';

              // The actual expected rows in csv should be same as uiEntriesCount if it is less than 1000 rows or at maximum 1000 rows
              if (uiEntriesCount < 1000) {
                if (downloadedCount === uiEntriesCount) {
                  entriesResult = 'PASS';
                } else {
                  entriesResult = 'FAIL';
                }
              } else {
                if (downloadedCount === 1000) {
                  entriesResult = 'PASS';
                } else {
                  entriesResult = 'FAIL';
                }
              }
              if (entriesResult === 'PASS') {
                logger?.log(`\t\t\t\t\t\t✅ Validation III.II.${accountCount}.${csvDownloadCount}: CSV: Downloaded rows = ${downloadedCount} | UI entries = ${uiEntriesCount} | Entries Result: PASS`);
              } else {
                logger?.log(`\t\t\t\t\t\t❌Validation III.II.${accountCount}.${csvDownloadCount}: CSV: Downloaded rows = ${downloadedCount} | UI entries = ${uiEntriesCount} | Entries Result: FAIL`);
              }

              //Print the header of the csv
              logger?.log(`\t\t\t\t\t\t Header of the csv: \n${headerLine}`);
              // print first 10 rows of the csv and last 10 rows of the csv
              logger?.log(`\t\t\t\t\t\t First 2 rows of the csv: \n${dataRows.slice(0, 2).join('\n')}`);
              logger?.log(`\t\t\t\t\t\t Last 2 rows of the csv: \n${dataRows.slice(-2).join('\n')}`);

              const ascending = /Ascending/i.test(sort);
              const headerCols = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
              const sortColName = /Last Updated/i.test(sort) ? 'Last Updated' : /Connection ID/i.test(sort) ? 'Connection ID' : /Connection Name/i.test(sort) ? 'Connection Name' : null;
              const sortColIndex = sortColName ? headerCols.findIndex(c => (c && c.includes(sortColName)) || c === sortColName) : -1;
              let sortPassFail = 'N/A';
              if (sortColIndex >= 0 && dataRows.length > 1) {
                const values = dataRows.map(row => {
                  const parts = row.split(',');
                  return (parts[sortColIndex] || '').trim().replace(/^"|"$/g, '');
                });
                let sorted = true;
                for (let v = 0; v < values.length - 1; v++) {
                  const cmp = (values[v] || '').localeCompare(values[v + 1] || '', undefined, { numeric: true });
                  if (ascending && cmp > 0) sorted = false;
                  if (!ascending && cmp < 0) sorted = false;
                }
                sortPassFail = sorted ? 'PASS' : 'FAIL';
                logger?.log(`\t\t\t\t\t\t CSV: Sort column "${sortColName}" (index ${sortColIndex}) | Sort Pass/Fail: ${sortPassFail}`);
              }

              // Save the csv at the config file csvDownloadLocation location with III.II.${csvDownloadCount}.${sort}.${accountLabel}.${connection}.uiEntriesCount.downloadedCount.entriesResult.sortPassFail.csv file
              const csvDownloadLocation = config.csvDownloadLocation;
              const csvFileName = `III.II..${accountCount}.${csvDownloadCount}.${sort}.${accountLabel}.${connection}.csv`;
              const csvFilePath = path.join(csvDownloadLocation, csvFileName);
              fs.writeFileSync(csvFilePath, content);
              logger?.log(`\n\t\t\t\t\t\t CSV saved to: ${csvFilePath}`);

              const totalLinesInFile = lines.length;
              csvDownloadReportRows.push({
                account: accountLabel,
                connection,
                sortOnScreen: sort,
                sortInFile: sortColName && sortColIndex >= 0 ? `${sortColName} (col ${sortColIndex})` : 'N/A',
                sortPassFail,
                uiEntriesCount: String(uiEntriesCount),
                downloadedRecords: String(downloadedCount),
                totalLinesInFile: `${totalLinesInFile} (1h+${downloadedCount}r)`,
                entriesResult,
                fileName: csvFileName,
              });
            });

            await page.goto(beforeDownloadUrl);
            logger?.log(`\t\t\t\t\t\t->Entering the URL later | URL: ${beforeDownloadUrl}`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(500);

          }
          /* Show Entries report printed at end with other tables */
        }
      }

      // Validate the Connection GUID field and reset (Validation V)
      logStep(`\t\t\t\tValidation V.${accountCount}: Validate the Connection GUID field (account: ${accountLabel})`);
      await safe('Close any open dropdowns by clicking on the ConnectionGUID field', async () => {
        logger?.log('\t\t\t\t\t\t->Closing any open dropdowns by clicking on the ConnectionGUID input field');
        await page.locator(locators['INP-ConnectionGUID.Connections.default']).click();
        logger?.log(`\t\t\t\t\t\t\t\tPerforming CLICK action | Element: INP-ConnectionGUID.Connections.default | Locator: ${locators['INP-ConnectionGUID.Connections.default']}`);
      });

      const firstRowCellLocator = (locators['TRW-1stRow.Connections.default'] || '//tbody/tr[1]') + '/td[1]';
      await safe('Get Connection GUID from first row', async () => {
        logger?.log(`\t\t\t\t\t\t->Reading first row first cell (Connection GUID)`);
        const guidFromTable = (await page.locator(firstRowCellLocator).first().innerText()).trim();
        logger?.log(`\t\t\t\t\t\t\t\tPerforming READ action | Element: TRW-1stRow.Connections.default/td[1] | Locator: ${firstRowCellLocator} | Value: ${guidFromTable}`);
        if (guidFromTable.length !== 36) {
          throw new Error(`\t\t\t\t\t\t❌ Validation IV.${accountCount}.1: Connection GUID from table is not 36 characters (got ${guidFromTable.length}): "${guidFromTable}"`);
        }
        logger?.log(`\t\t\t\t\t\t✅ Validation IV.${accountCount}.1: GUID length validated (36 characters)`);

        const guidInputTypes = [
          { name: 'trimmed', value: guidFromTable, expectMatch: true },
          { name: 'spaces at beginning', value: '   ' + guidFromTable, expectMatch: true },
          { name: 'spaces at end', value: guidFromTable + '   ', expectMatch: true },
          { name: 'spaces at both ends', value: '   ' + guidFromTable + '   ', expectMatch: true },
          { name: '30 character substring', value: guidFromTable.slice(0, 30), expectMatch: false },
        ];

        for (let g = 0; g < guidInputTypes.length; g++) {
          const { name, value, expectMatch } = guidInputTypes[g];
          logger?.log(`\t\t\t\t\t\t->GUID test IV.${accountCount}.2:${g + 1}/5: ${name}`);
          await page.locator(locators['INP-ConnectionGUID.Connections.default']).fill(value);
          logger?.log(`\t\t\t\t\t\t\t\tPerforming FILL action | Element: INP-ConnectionGUID.Connections.default | Value: (${value.length} chars) | Locator: ${locators['INP-ConnectionGUID.Connections.default']}`);
          await page.locator(locators['BTN-Search.Connections.default']).click();
          logger?.log(`\t\t\t\t\t\t\t\tPerforming CLICK action | Element: BTN-Search.Connections.default | Locator: ${locators['BTN-Search.Connections.default']}`);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(400);

          const noRecordsLoc = locators['TXT-NoMatchingRecords.CommonTable.NoRecords'];
          const noRecordsVisible = noRecordsLoc ? await page.locator(noRecordsLoc).isVisible().catch(() => false) : false;

          if (expectMatch) {
            const cellText = (await page.locator(firstRowCellLocator).first().innerText()).trim();
            const match = cellText === guidFromTable;
            logger?.log(`\t\t\t\t\t\t\t\tREAD first row td[1] after search | Expected: ${guidFromTable} | Actual: ${cellText} | Match: ${match}`);
            if (!match) {
              failures.push({ step: `Validation IV.${accountCount}.2: GUID test: ${name}`, error: `Expected "${guidFromTable}", got "${cellText}"` });
              logger?.log(`\t\t\t\t\t\t\t\t❌ Validation IV.${accountCount}.2: GUID test: ${name} | Expected "${guidFromTable}", got "${cellText}"`);
            }
            guidReportRows.push({ accountLabel, inputType: name, expectedResult: 'PASS', actualResult: match ? 'PASS' : 'FAIL', detail: match ? `Match: ${cellText}` : `Expected ${guidFromTable}, got ${cellText}` });
          } else {
            logger?.log(`\t\t\t\t\t\t\t\t✅ Validation IV.${accountCount}.2: Expecting No matching records | Visible: ${noRecordsVisible}`);
            guidReportRows.push({ accountLabel, inputType: name, expectedResult: 'No matching records', actualResult: noRecordsVisible ? 'PASS' : 'FAIL', detail: noRecordsVisible ? 'NMR displayed' : 'NMR not displayed' });
          }
        }
        logger?.log(`\t\t\t\t\t\t✅ Validation IV.${accountCount}.2: GUID tests completed`);
      });


      // Validate the Reset button
      logger?.log(`\n\n\n\t\t\t\t\t\tValidation VI.${accountCount}: Validate the Reset button | Account: ${accountLabel}`);



      const accountDropdownLoc = locators['DDN-Account.Connections.default'];
      const connectionDropdownLoc = locators['DDN-Connection.Connections.default'];
      const sortSelectedOptionLoc = "//select[@id='sort']/option[@selected][last()]";
      const outputSelectedOptionLoc = "//select[@id='options-output']/option[@selected='selected']";
      const connectionGuidInputLoc = locators['INP-ConnectionGUID.Connections.default'];
      const resetBtnLoc = locators['BTN-Reset.Connections.default'];

      let previousValues = {};
      await safe('Collect Previous Values (before Reset)', async () => {
        logger?.log('\t\t\t\t\t\t->Collecting Previous Values (before Reset)');
        if (accountDropdownLoc) {
          const selectedAccount = await page.locator(accountDropdownLoc + '/../../span[1]/span').first().innerText().catch(() => '');
          previousValues.selectedAccount = selectedAccount.trim();
          logger?.log(`\t\t\t\t\t\t\t\tREAD selected Account | Element: DDN-Account.Connections.default/../../span[1]/span | Value: ${previousValues.selectedAccount}`);
        }
        if (connectionDropdownLoc) {
          const selectedConnection = await page.locator(connectionDropdownLoc + '/../../span[1]/span').first().innerText().catch(() => '');
          previousValues.selectedConnection = selectedConnection.trim();
          logger?.log(`\t\t\t\t\t\t\t\tREAD selected Connection | Element: DDN-Connection.Connections.default/../../span[1]/span | Value: ${previousValues.selectedConnection}`);
        }
        if (sortSelectedOptionLoc) {
          const sortText = await page.locator(sortSelectedOptionLoc).first().innerText().catch(() => '');
          previousValues.sortBy = sortText.trim();
          logger?.log(`\t\t\t\t\t\t\t\tREAD selected Sort | Locator: ${sortSelectedOptionLoc} | Value: ${previousValues.sortBy}`);
        }
        if (outputSelectedOptionLoc) {
          const outputText = await page.locator(outputSelectedOptionLoc).first().innerText().catch(() => '');
          previousValues.output = outputText.trim();
          logger?.log(`\t\t\t\t\t\t\t\tREAD selected Output | Locator: ${outputSelectedOptionLoc} | Value: ${previousValues.output}`);
        }
        if (connectionGuidInputLoc) {
          previousValues.connectionGuid = await page.locator(connectionGuidInputLoc).inputValue().catch(() => '');
          logger?.log(`\t\t\t\t\t\t\t\tREAD Connection GUID input | Element: INP-ConnectionGUID.Connections.default | Value: ${previousValues.connectionGuid || '(empty)'}`);
        }
        logger?.log(`\t\t\t\t\t\tPrevious Values: ${JSON.stringify(previousValues)}`);
      });


      await safe('Click Reset button', async () => {
        logger?.log('\t\t\t\t\t\t->Clicking Reset button');
        await page.locator(resetBtnLoc).click();
        logger?.log(`\t\t\t\t\t\t\t\tPerforming CLICK action | Element: BTN-Reset.Connections.default | Locator: ${resetBtnLoc}`);
      });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      const expectedAfterReset = {
        account: 'Aerialink Inc. [1]',
        connection: 'All Connections',
        connectionGuid: '',
        output: 'Screen',
        sortBy: 'Last Updated Descending',
      };

      await safe('Verify values after Reset', async () => {
        logger?.log('\t\t\t\t\t\t->Verifying values after Reset');
        let accountAfter = ''; let connectionAfter = ''; let sortAfter = ''; let outputAfter = ''; let guidAfter = '';
        if (accountDropdownLoc) {
          accountAfter = (await page.locator(accountDropdownLoc + '/../../span[1]/span').first().innerText().catch(() => '')).trim();
          logger?.log(`\t\t\t\t\t\t\t\tREAD Account after Reset | Value: ${accountAfter}`);
        }
        if (connectionDropdownLoc) {
          connectionAfter = (await page.locator(connectionDropdownLoc + '/../../span[1]/span').first().innerText().catch(() => '')).trim();
          logger?.log(`\t\t\t\t\t\t\t\tREAD Connection after Reset | Value: ${connectionAfter}`);
        }
        if (sortSelectedOptionLoc) {
          sortAfter = (await page.locator(sortSelectedOptionLoc).first().innerText().catch(() => '')).trim();
          logger?.log(`\t\t\t\t\t\t\t\tREAD Sort after Reset | Value: ${sortAfter}`);
        }
        if (outputSelectedOptionLoc) {
          outputAfter = (await page.locator(outputSelectedOptionLoc).first().innerText().catch(() => '')).trim();
          logger?.log(`\t\t\t\t\t\t\t\tREAD Output after Reset | Value: ${outputAfter}`);
        }
        if (connectionGuidInputLoc) {
          guidAfter = await page.locator(connectionGuidInputLoc).inputValue().catch(() => '');
          logger?.log(`\t\t\t\t\t\t\t\tREAD Connection GUID after Reset | Value: ${guidAfter || '(empty)'}`);
        }

        const noRecLoc = locators['TXT-NoMatchingRecords.CommonTable.NoRecords'];
        const noMatchingVisible = noRecLoc ? await page.locator(noRecLoc).isVisible().catch(() => false) : false;
        const tableRowsLoc = locators['TRW-AllRows.Connections.default'];
        const rowCount = tableRowsLoc ? await page.locator(tableRowsLoc).count() : 0;
        const summaryLoc = locators['TXT-TotalEntries.Connections.default'] || locators['TXT-TotalEntries.CommonPagination.default'];
        let entriesInfo = '';
        try {
          const summaryText = await page.locator(summaryLoc).first().innerText();
          entriesInfo = summaryText;
        } catch { entriesInfo = 'N/A'; }

        const accountOk = accountAfter === expectedAfterReset.account;
        const connectionOk = connectionAfter === expectedAfterReset.connection;
        const guidOk = (guidAfter || '') === expectedAfterReset.connectionGuid;
        const outputOk = outputAfter === expectedAfterReset.output;
        const sortOk = sortAfter === expectedAfterReset.sortBy;
        const noNmrOk = !noMatchingVisible;
        const rowCountOk = rowCount > 0;

        resetReportRows.push({
          accountLabel,
          previousValues: JSON.stringify(previousValues),
          accountAfter: accountAfter,
          connectionAfter: connectionAfter,
          guidAfter: guidAfter || '(empty)',
          outputAfter: outputAfter,
          sortAfter: sortAfter,
          accountOk: accountOk ? 'PASS' : 'FAIL',
          connectionOk: connectionOk ? 'PASS' : 'FAIL',
          guidOk: guidOk ? 'PASS' : 'FAIL',
          outputOk: outputOk ? 'PASS' : 'FAIL',
          sortOk: sortOk ? 'PASS' : 'FAIL',
          noNmrOk: noNmrOk ? 'PASS' : 'FAIL',
          rowCountOk: rowCountOk ? 'PASS' : 'FAIL',
          rowCount: String(rowCount),
          entriesInfo,
        });
        logger?.log(`\t\t\t\t\t\tAfter Reset: Account=${accountAfter} (expected ${expectedAfterReset.account}) ${accountOk ? '✅' : '❌'} | Connection=${connectionAfter} ${connectionOk ? '✅' : '❌'} | GUID empty=${guidOk ? '✅' : '❌'} | Output=${outputAfter} ${outputOk ? '✅' : '❌'} | Sort=${sortAfter} ${sortOk ? '✅' : '❌'} | No NMR=${noNmrOk ? '✅' : '❌'} | Rows=${rowCount}`);
      });

      accountCount++;

    }

    /* -------------------------------
       Final Summary — Three tables at the end
    --------------------------------*/
    const pad = (s, w) => String(s ?? '').slice(0, w).padEnd(w);

    logger?.log('\n\n');
    logger?.log('════════════════════════════════════════════════════════════════════════════════');
    logger?.log('\t\t\t\t\t  VALIDATION SUMMARY — TABLES');
    logger?.log('════════════════════════════════════════════════════════════════════════════════\n');

    if (validationITableRows.length > 0) {
      const wV = 4;
      const wSc = Math.min(32, Math.max(12, ...validationITableRows.map((r) => r.scenario.length)));
      const wApi = Math.min(48, Math.max(10, ...validationITableRows.map((r) => r.apisUsed.length)));
      const wAc = 8;
      const wUi = 8;
      const wR = 6;
      const wRem = Math.min(56, Math.max(20, ...validationITableRows.map((r) => (r.remarks || '').length)));
      const sep1 = `+${'-'.repeat(wV + 2)}+${'-'.repeat(wSc + 2)}+${'-'.repeat(wApi + 2)}+${'-'.repeat(wAc + 2)}+${'-'.repeat(wUi + 2)}+${'-'.repeat(wR + 2)}+${'-'.repeat(wRem + 2)}+`;
      logger?.log('\t📋 TABLE 1 — VALIDATION I');
      logger?.log('\t' + sep1);
      logger?.log(`\t| ${pad('Val', wV)} | ${pad('Scenario', wSc)} | ${pad('APIs Used', wApi)} | ${pad('API #', wAc)} | ${pad('UI #', wUi)} | ${pad('Result', wR)} | ${pad('Remarks', wRem)} |`);
      logger?.log('\t' + sep1);
      for (const row of validationITableRows) {
        logger?.log(`\t| ${pad(row.validation, wV)} | ${pad(row.scenario, wSc)} | ${pad(row.apisUsed, wApi)} | ${pad(row.apiCountExpected, wAc)} | ${pad(row.uiCount, wUi)} | ${pad(row.result, wR)} | ${pad(row.remarks, wRem)} |`);
      }
      logger?.log('\t' + sep1);
      logger?.log('');
    }

    if (validationIITableRows.length > 0) {
      const wId = Math.min(12, Math.max(8, ...validationIITableRows.map((r) => String(r.validationId).length)));
      const wAcc = Math.min(36, Math.max(12, ...validationIITableRows.map((r) => String(r.accountLabel).length)));
      const wCol = Math.min(24, Math.max(10, ...validationIITableRows.map((r) => String(r.collection).length)));
      const wApi = Math.min(52, Math.max(10, ...validationIITableRows.map((r) => String(r.apiUsed).length)));
      const wApiC = 10;
      const wUiC = 14;
      const wNmr = Math.min(18, Math.max(8, ...validationIITableRows.map((r) => String(r.nmr).length)));
      const wApiUi = Math.min(16, Math.max(8, ...validationIITableRows.map((r) => String(r.apiUiCount).length)));
      const wUiR = Math.min(18, Math.max(10, ...validationIITableRows.map((r) => String(r.uiRows).length)));
      const sep2 = `+${'-'.repeat(wId + 2)}+${'-'.repeat(wAcc + 2)}+${'-'.repeat(wCol + 2)}+${'-'.repeat(wApi + 2)}+${'-'.repeat(wApiC + 2)}+${'-'.repeat(wUiC + 2)}+${'-'.repeat(wNmr + 2)}+${'-'.repeat(wApiUi + 2)}+${'-'.repeat(wUiR + 2)}+`;
      logger?.log('\t📋 TABLE 2 — VALIDATION II');
      logger?.log('\t' + sep2);
      logger?.log(`\t| ${pad('Validation Id', wId)} | ${pad('Account', wAcc)} | ${pad('Collection', wCol)} | ${pad('API Used', wApi)} | ${pad('API Count', wApiC)} | ${pad('UI Entries', wUiC)} | ${pad('NMR', wNmr)} | ${pad('API-UI Count', wApiUi)} | ${pad('UI Rows', wUiR)} |`);
      logger?.log('\t' + sep2);
      for (const row of validationIITableRows) {
        logger?.log(`\t| ${pad(row.validationId, wId)} | ${pad(row.accountLabel, wAcc)} | ${pad(row.collection, wCol)} | ${pad(row.apiUsed, wApi)} | ${pad(String(row.apiCount), wApiC)} | ${pad(String(row.uiEntriesCount), wUiC)} | ${pad(row.nmr, wNmr)} | ${pad(row.apiUiCount, wApiUi)} | ${pad(row.uiRows, wUiR)} |`);
      }
      logger?.log('\t' + sep2);
      logger?.log('');
    }

    if (showEntriesReportRows.length > 0) {
      const wSort = Math.min(38, Math.max(14, ...showEntriesReportRows.map((r) => r.sortOption.length)));
      const wEnt = 8;
      const wPages = Math.min(20, Math.max(10, ...showEntriesReportRows.map((r) => r.pagesNavigated.length)));
      const wPage = Math.min(18, Math.max(10, ...showEntriesReportRows.flatMap((r) => [r.page1st, r.page3rd, r.pageLast].map((x) => String(x).length))));
      const wSortResult = 6;
      const sep3 = `+${'-'.repeat(wSort + 2)}+${'-'.repeat(wEnt + 2)}+${'-'.repeat(wPages + 2)}+${'-'.repeat(wPage + 2)}+${'-'.repeat(wPage + 2)}+${'-'.repeat(wPage + 2)}+${'-'.repeat(wSortResult + 2)}+`;
      logger?.log('\t📋 TABLE 3 — SHOW ENTRIES & SORT VALIDATION');
      logger?.log('\t' + sep3);
      logger?.log(`\t| ${pad('Sort Option', wSort)} | ${pad('Entries', wEnt)} | ${pad('Pages Nav.', wPages)} | ${pad('Page 1st', wPage)} | ${pad('Page 3rd', wPage)} | ${pad('Page Last', wPage)} | ${pad('Sort', wSortResult)} |`);
      logger?.log('\t' + sep3);
      for (const row of showEntriesReportRows) {
        logger?.log(`\t| ${pad(row.sortOption, wSort)} | ${pad(row.entries, wEnt)} | ${pad(row.pagesNavigated, wPages)} | ${pad(row.page1st, wPage)} | ${pad(row.page3rd, wPage)} | ${pad(row.pageLast, wPage)} | ${pad(row.sortPassFail, wSortResult)} |`);
      }
      logger?.log('\t' + sep3);
      logger?.log('\tPage columns: PASS/FAIL e:expected a:actual | NMR = No Matching Records | N/A = not applicable');
      logger?.log('');
    }

    if (guidReportRows.length > 0) {
      const wAcc = Math.min(28, Math.max(12, ...guidReportRows.map((r) => String(r.accountLabel).length)));
      const wType = Math.min(26, Math.max(10, ...guidReportRows.map((r) => String(r.inputType).length)));
      const wExp = Math.min(22, Math.max(8, ...guidReportRows.map((r) => String(r.expectedResult).length)));
      const wAct = 8;
      const wDet = Math.min(40, Math.max(12, ...guidReportRows.map((r) => String(r.detail || '').length)));
      const sep4 = `+${'-'.repeat(wAcc + 2)}+${'-'.repeat(wType + 2)}+${'-'.repeat(wExp + 2)}+${'-'.repeat(wAct + 2)}+${'-'.repeat(wDet + 2)}+`;
      logger?.log('\t📋 TABLE 4 — VALIDATION IV: CONNECTION GUID TEST');
      logger?.log('\t' + sep4);
      logger?.log(`\t| ${pad('Account', wAcc)} | ${pad('Input Type', wType)} | ${pad('Expected', wExp)} | ${pad('Actual', wAct)} | ${pad('Detail', wDet)} |`);
      logger?.log('\t' + sep4);
      for (const row of guidReportRows) {
        logger?.log(`\t| ${pad(row.accountLabel, wAcc)} | ${pad(row.inputType, wType)} | ${pad(row.expectedResult, wExp)} | ${pad(row.actualResult, wAct)} | ${pad(row.detail || '', wDet)} |`);
      }
      logger?.log('\t' + sep4);
      logger?.log('');
    }

    if (resetReportRows.length > 0) {
      const wAcc = Math.min(28, Math.max(12, ...resetReportRows.map((r) => String(r.accountLabel).length)));
      const wCol = 10;
      const sep5 = `+${'-'.repeat(wAcc + 2)}+${'-'.repeat(wCol + 2)}+${'-'.repeat(wCol + 2)}+${'-'.repeat(wCol + 2)}+${'-'.repeat(wCol + 2)}+${'-'.repeat(wCol + 2)}+${'-'.repeat(wCol + 2)}+${'-'.repeat(wCol + 2)}+`;
      logger?.log('\t📋 TABLE 5 — VALIDATION IV: RESET VERIFICATION');
      logger?.log('\t' + sep5);
      logger?.log(`\t| ${pad('Account', wAcc)} | ${pad('Acc OK', wCol)} | ${pad('Conn OK', wCol)} | ${pad('GUID OK', wCol)} | ${pad('Out OK', wCol)} | ${pad('Sort OK', wCol)} | ${pad('No NMR', wCol)} | ${pad('Rows OK', wCol)} |`);
      logger?.log('\t' + sep5);
      for (const row of resetReportRows) {
        logger?.log(`\t| ${pad(row.accountLabel, wAcc)} | ${pad(row.accountOk, wCol)} | ${pad(row.connectionOk, wCol)} | ${pad(row.guidOk, wCol)} | ${pad(row.outputOk, wCol)} | ${pad(row.sortOk, wCol)} | ${pad(row.noNmrOk, wCol)} | ${pad(row.rowCountOk, wCol)} |`);
      }
      logger?.log('\t' + sep5);
      logger?.log('');
    }

    if (csvDownloadReportRows.length > 0) {
      const wAcc = Math.min(28, Math.max(10, ...csvDownloadReportRows.map((r) => String(r.account).length)));
      const wConn = Math.min(20, Math.max(12, ...csvDownloadReportRows.map((r) => String(r.connection).length)));
      const wSortScr = Math.min(32, Math.max(14, ...csvDownloadReportRows.map((r) => String(r.sortOnScreen).length)));
      const wSortFile = Math.min(28, Math.max(14, ...csvDownloadReportRows.map((r) => String(r.sortInFile).length)));
      const wSortPF = 6;
      const wUi = Math.min(14, Math.max(10, ...csvDownloadReportRows.map((r) => String(r.uiEntriesCount).length)));
      const wDl = Math.min(14, Math.max(10, ...csvDownloadReportRows.map((r) => String(r.downloadedRecords).length)));
      const wTotal = Math.min(20, Math.max(12, ...csvDownloadReportRows.map((r) => String(r.totalLinesInFile).length)));
      const wEnt = 8;
      const wFile = Math.min(60, Math.max(12, ...csvDownloadReportRows.map((r) => String(r.fileName).length)));
      const sep6 = `+${'-'.repeat(wAcc + 2)}+${'-'.repeat(wConn + 2)}+${'-'.repeat(wSortScr + 2)}+${'-'.repeat(wSortFile + 2)}+${'-'.repeat(wSortPF + 2)}+${'-'.repeat(wUi + 2)}+${'-'.repeat(wDl + 2)}+${'-'.repeat(wTotal + 2)}+${'-'.repeat(wEnt + 2)}+${'-'.repeat(wFile + 2)}+`;
      logger?.log('\t📋 TABLE 6 — CSV DOWNLOAD VALIDATION');
      logger?.log('\t' + sep6);
      logger?.log(`\t| ${pad('Account', wAcc)} | ${pad('Connection', wConn)} | ${pad('Sort (Screen)', wSortScr)} | ${pad('Sort (File)', wSortFile)} | ${pad('Sort', wSortPF)} | ${pad('UI Entries', wUi)} | ${pad('DL Records', wDl)} | ${pad('File Lines', wTotal)} | ${pad('Entries', wEnt)} | ${pad('File Name', wFile)} |`);
      logger?.log('\t' + sep6);
      for (const row of csvDownloadReportRows) {
        logger?.log(`\t| ${pad(row.account, wAcc)} | ${pad(row.connection, wConn)} | ${pad(row.sortOnScreen, wSortScr)} | ${pad(row.sortInFile, wSortFile)} | ${pad(row.sortPassFail, wSortPF)} | ${pad(row.uiEntriesCount, wUi)} | ${pad(row.downloadedRecords, wDl)} | ${pad(row.totalLinesInFile, wTotal)} | ${pad(row.entriesResult, wEnt)} | ${pad(row.fileName, wFile)} |`);
      }
      logger?.log('\t' + sep6);
      logger?.log('\tDL Records = data rows (excl. header) | File Lines = header + records | Sort (File) = column used for sort verification');
      logger?.log('');
    }

    logger?.log('════════════════════════════════════════════════════════════════════════════════\n');

    if (failures.length > 0) {
      logger?.log(`\n❌ Total failures: ${failures.length}`);
      throw new Error('Connections validation failed');
    }

    logOk('All validations completed successfully');
  }
);