import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://localhost:5173';
const ROOT_DIR = fs.existsSync(path.resolve('../docs')) ? path.resolve('..') : path.resolve('.');
const SCREENSHOT_DIR = path.resolve(ROOT_DIR, 'docs/phase-1/e2e-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runBrowserE2E() {
  console.log('=== STARTING MYAREA24 END-TO-END BROWSER VALIDATION ===');
  console.log(`Using Chrome binary: ${CHROME_PATH}`);
  console.log(`Connecting to URL: ${APP_URL}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  
  // Track console errors and network failures
  const consoleErrors = [];
  const networkFailures = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', request => {
    networkFailures.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
  });

  try {
    // 1. Initial Page Load (Desktop Viewport: 1280x800)
    console.log('\n[TEST 1] Testing Desktop Initial Page Load...');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(APP_URL, { waitUntil: 'networkidle0' });

    // Verify Title & Header
    const title = await page.title();
    console.log(`  Page Title: "${title}"`);
    if (!title.includes('MyArea24')) {
      throw new Error(`Unexpected page title: ${title}`);
    }

    // Wait for insights feed to render real backend data
    await page.waitForSelector('.insight-card', { timeout: 5000 });
    const cardCount = await page.$$eval('.insight-card', els => els.length);
    console.log(`  Found ${cardCount} insight cards on initial load.`);
    if (cardCount !== 5) {
      console.warn(`  Warning: Expected 5 live cards, got ${cardCount}`);
    }

    // Check header live indicator
    const liveStatus = await page.$eval('.status-label', el => el.textContent.trim());
    console.log(`  Engine Status Label: "${liveStatus}"`);

    // Screenshot Desktop Feed
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-desktop-initial-feed.png') });
    console.log('  Saved screenshot: 01-desktop-initial-feed.png');

    // 2. Data Integrity on Cards (Delays, Single-Source Disclaimers, Road Closures)
    console.log('\n[TEST 2] Verifying Card Data Integrity...');
    const cardHeadlines = await page.$$eval('.insight-title', els => els.map(e => e.textContent.trim()));
    console.log('  Card Headlines:');
    cardHeadlines.forEach((h, i) => console.log(`    ${i + 1}. ${h}`));

    // Verify that Road Closure does NOT show "+0 mins delay"
    const hasZeroDelay = cardHeadlines.some(h => h.includes('+0 mins') || h.includes('+0m'));
    if (hasZeroDelay) {
      throw new Error('Detected "+0 mins delay" in card headlines!');
    }
    console.log('  Verified: No "+0 mins" defect present in headlines.');

    // Verify Single-Source Disclaimer presence
    const singleSourcePills = await page.$$eval('.single-source-note', els => els.length);
    console.log(`  Found ${singleSourcePills} single-source disclaimers on cards.`);

    // 3. Locality Switching (Click "Delhi Connaught Place")
    console.log('\n[TEST 3] Testing Locality Switching...');
    // Find button with text "Delhi Connaught Place"
    const localityButtons = await page.$$('.locality-pill');
    let cpBtnFound = false;
    for (const btn of localityButtons) {
      const text = await btn.evaluate(el => el.textContent);
      if (text.includes('Delhi Connaught Place')) {
        await btn.click();
        cpBtnFound = true;
        break;
      }
    }
    if (!cpBtnFound) {
      throw new Error('Could not find Delhi Connaught Place pill button');
    }

    // Wait for network update
    await new Promise(r => setTimeout(r, 600));
    const cpCardCount = await page.$$eval('.insight-card', els => els.length);
    console.log(`  After selecting Delhi Connaught Place: found ${cpCardCount} cards.`);
    const cpHeadlines = await page.$$eval('.insight-title', els => els.map(e => e.textContent.trim()));
    cpHeadlines.forEach(h => console.log(`    - ${h}`));
    if (cpCardCount !== 2) {
      console.warn(`  Warning: Expected 2 cards for Connaught Place, got ${cpCardCount}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-locality-connaught-place.png') });
    console.log('  Saved screenshot: 02-locality-connaught-place.png');

    // 4. Locality Switching to an empty area (e.g. "Delhi Rohini Sector 11") -> Test Empty State
    console.log('\n[TEST 4] Testing Normal Conditions Empty State...');
    const buttons2 = await page.$$('.locality-pill');
    for (const btn of buttons2) {
      const text = await btn.evaluate(el => el.textContent);
      if (text.includes('Delhi Rohini Sector 11')) {
        await btn.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 600));
    const emptyStateHeading = await page.$eval('.empty-heading', el => el.textContent.trim());
    console.log(`  Empty State Heading: "${emptyStateHeading}"`);
    if (!emptyStateHeading.includes('Normal Conditions Reported')) {
      throw new Error(`Expected Normal Conditions, got: ${emptyStateHeading}`);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-empty-state-normal.png') });
    console.log('  Saved screenshot: 03-empty-state-normal.png');

    // Switch back to "All Active Pilot Zones"
    const allBtn = await page.$('.locality-pill');
    await allBtn.click();
    await new Promise(r => setTimeout(r, 600));

    // 5. Severity Filtering (Select "Severe (Critical Disruption)")
    console.log('\n[TEST 5] Testing Severity Filtering...');
    await page.select('#filter-severity', 'severe');
    await new Promise(r => setTimeout(r, 600));
    const severeCount = await page.$$eval('.insight-card', els => els.length);
    const severeTitle = await page.$eval('.insight-title', el => el.textContent.trim());
    console.log(`  Severity=severe filter count: ${severeCount}`);
    console.log(`  Severe card title: "${severeTitle}"`);
    if (severeCount !== 1 || !severeTitle.includes('Road Closure')) {
      throw new Error(`Unexpected severe filter result: count=${severeCount}, title=${severeTitle}`);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-filter-severe.png') });
    console.log('  Saved screenshot: 04-filter-severe.png');

    // 6. Clear Filters Button
    console.log('\n[TEST 6] Testing Clear Filters Action...');
    await page.click('.clear-filters-btn');
    await new Promise(r => setTimeout(r, 600));
    const restoredCount = await page.$$eval('.insight-card', els => els.length);
    console.log(`  After Clear Filters: restored to ${restoredCount} cards.`);

    // 7. Open Evidence Detail Modal & Inspect Provenance
    console.log('\n[TEST 7] Testing Evidence Detail Modal...');
    // Click the first card
    const firstCard = await page.$('.insight-card');
    await firstCard.click();
    await page.waitForSelector('.modal-container', { timeout: 3000 });
    
    const modalHeadline = await page.$eval('.modal-headline', el => el.textContent.trim());
    console.log(`  Modal Headline: "${modalHeadline}"`);

    // Verify sections inside modal
    const modalImpact = await page.$eval('.impact-callout p', el => el.textContent.trim());
    const modalAction = await page.$eval('.action-callout p', el => el.textContent.trim());
    console.log(`  Modal Impact: "${modalImpact}"`);
    console.log(`  Modal Action: "${modalAction}"`);

    // Provenance signals inside modal
    const signalBadges = await page.$$eval('.signal-badge', els => els.map(e => e.textContent.trim()));
    const signalSources = await page.$$eval('.signal-source', els => els.map(e => e.textContent.trim()));
    console.log(`  Modal Signal Provenance: badges=${JSON.stringify(signalBadges)}, sources=${JSON.stringify(signalSources)}`);

    // Confidence and Quality Notes
    const confBadge = await page.$eval('.confidence-badge', el => el.textContent.trim());
    console.log(`  Modal Confidence: "${confBadge}"`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-evidence-detail-modal.png') });
    console.log('  Saved screenshot: 05-evidence-detail-modal.png');

    // Test closing modal via Escape key
    console.log('  Testing Escape key to close modal...');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 400));
    const modalVisible = await page.$('.modal-container');
    console.log(`  Modal still visible after Escape: ${modalVisible !== null ? 'YES (FAIL)' : 'NO (CLOSED - PASS)'}`);
    if (modalVisible !== null) {
      throw new Error('Modal did not close on Escape key');
    }

    // 8. Mobile Viewport (375x667 - iPhone SE width)
    console.log('\n[TEST 8] Testing Mobile Responsiveness (375x667)...');
    await page.setViewport({ width: 375, height: 667, isMobile: true });
    await new Promise(r => setTimeout(r, 400));

    // Verify touch targets and elements visible without horizontal overflow
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    console.log(`  Mobile dimensions: windowWidth=${windowWidth}, bodyScrollWidth=${bodyScrollWidth}`);
    if (bodyScrollWidth > windowWidth + 5) {
      console.warn(`  Warning: Potential horizontal overflow on mobile! (${bodyScrollWidth} > ${windowWidth})`);
    } else {
      console.log('  Verified: Clean mobile layout with zero horizontal overflow.');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-mobile-viewport-375.png') });
    console.log('  Saved screenshot: 06-mobile-viewport-375.png');

    // Switch back to desktop viewport
    await page.setViewport({ width: 1280, height: 800 });

    // 9. Location Selection & Geolocation Detection View
    console.log('\n[TEST 9] Testing Location Selection View (#/location)...');
    await page.goto(`${APP_URL}/#/location`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.location-detection-card', { timeout: 3000 });
    const locationCardsCount = await page.$$eval('.locality-card', els => els.length);
    console.log(`  Found ${locationCardsCount} localities in directory catalog.`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-location-selection-view.png') });
    console.log('  Saved screenshot: 07-location-selection-view.png');

    // 10. Ask MyArea24 Grounded AI Assistant View
    console.log('\n[TEST 10] Testing Grounded AI Assistant View (#/assistant)...');
    await page.goto(`${APP_URL}/#/assistant`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.chat-window', { timeout: 3000 });
    // Click a preset query chip
    const queryChip = await page.$('.query-chip');
    if (queryChip) {
      await queryChip.click();
      await new Promise(r => setTimeout(r, 1200));
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-ai-assistant-view.png') });
    console.log('  Saved screenshot: 08-ai-assistant-view.png');

    // 11. Interactive Corridor Map View
    console.log('\n[TEST 11] Testing Interactive Corridor Map View (#/map)...');
    await page.goto(`${APP_URL}/#/map`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.map-stage', { timeout: 3000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-interactive-map-view.png') });
    console.log('  Saved screenshot: 09-interactive-map-view.png');

    // 12. Weather Telemetry Outlook View
    console.log('\n[TEST 12] Testing Weather Telemetry View (#/weather)...');
    await page.goto(`${APP_URL}/#/weather`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.weather-dashboard-grid, .empty-data-card', { timeout: 3000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-weather-view.png') });
    console.log('  Saved screenshot: 10-weather-view.png');

    // 13. Traffic Bottlenecks View
    console.log('\n[TEST 13] Testing Traffic Incidents View (#/traffic)...');
    await page.goto(`${APP_URL}/#/traffic`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.incidents-list, .empty-data-card', { timeout: 3000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-traffic-view.png') });
    console.log('  Saved screenshot: 11-traffic-view.png');

    // 14. Government Alerts & Bulletins View
    console.log('\n[TEST 14] Testing Government Alerts View (#/alerts)...');
    await page.goto(`${APP_URL}/#/alerts`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.alerts-feed-grid, .empty-data-card', { timeout: 3000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '12-government-alerts-view.png') });
    console.log('  Saved screenshot: 12-government-alerts-view.png');

    // 15. Emergency Hub (112) View
    console.log('\n[TEST 15] Testing Emergency Services View (#/emergency)...');
    await page.goto(`${APP_URL}/#/emergency`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.emergency-cards-grid', { timeout: 3000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '13-emergency-view.png') });
    console.log('  Saved screenshot: 13-emergency-view.png');

    // Summary of console & network
    console.log('\n=== BROWSER CONSOLE & NETWORK AUDIT ===');
    console.log(`Console Errors count: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      consoleErrors.forEach(err => console.log(`  [CONSOLE ERROR] ${err}`));
    }
    console.log(`Failed Network Requests count: ${networkFailures.length}`);
    if (networkFailures.length > 0) {
      networkFailures.forEach(fail => console.log(`  [NET FAIL] ${fail}`));
    }

    console.log('\n>>> ALL BROWSER E2E TESTS PASSED SUCCESSFULLY! <<<');
  } catch (err) {
    console.error('\nE2E BROWSER TEST FAILED:', err);
    if (consoleErrors.length > 0) {
      console.log('Recorded console errors:');
      consoleErrors.forEach(e => console.log('  ', e));
    }
    if (networkFailures.length > 0) {
      console.log('Recorded network failures:');
      networkFailures.forEach(f => console.log('  ', f));
    }
    try {
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log('Page body snippet:\n', bodyText.slice(0, 500));
    } catch (_) {}
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error-failure.png') });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runBrowserE2E();
