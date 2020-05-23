require('events').EventEmitter.prototype._maxListeners = 20;
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://app.powerbigov.us/view?r=eyJrIjoiNDMwMDI0YmQtNmUyYS00ZmFjLWI0MGItZDM0OTY1Y2Y0YzNhIiwidCI6ImU0YTM0MGU2LWI4OWUtNGU2OC04ZWFhLTE1NDRkMjcwMzk4MCJ9')

  // Select the type of facility
  await page.waitForSelector('[aria-label="Facility Type Slicer"] .slicer-dropdown-menu');
  await page.focus('[aria-label="Facility Type Slicer"] .slicer-dropdown-menu');
  // use Power BI keyboard shortcut to gain focus of dropdowns
  await page.keyboard.down('ControlLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('ControlLeft');

  await page.keyboard.press('Enter');
  await page.waitFor(1000);
  await page.click('.slicerItemContainer[aria-label^="Skilled"]'); // Selects Skilled Nursing... For assisted living replace "Skilled" with "Assisted"


  // Select Facility
  // Setup for iteration
  await page.waitForSelector('[aria-label="Facility Name Slicer"] .slicer-dropdown-menu');
  await page.focus('[aria-label="Facility Name Slicer"] .slicer-dropdown-menu')
  await page.keyboard.down('ControlLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('ControlLeft');

  await page.keyboard.press('Enter');
  await page.waitFor(1000);

  var dataToReturn = [];
  // iterate over options
  while (true) {
    await page.waitFor(2000);
    await goToNext();
    await waitForData();
    await page.screenshot({ path: 'testing.png' })
    dataToReturn.push(await getData());
    fs.writeFileSync('./data.json', JSON.stringify(dataToReturn, null, 2) , 'utf-8');
  }
  
  async function goToNext() {
    await page.keyboard.press('ArrowDown');
    await page.waitFor(1000);
    await page.keyboard.press('Enter');
  }

  // waits for the 14 requests... workaround solution for knowing when the dataset has been updated for the new property
  async function waitForData() {
    try {
      await Promise.all([
        page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true'),
        page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true'),
        page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true'),
        page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true'),
        page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true'),
        page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true'),
        page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true'),
        page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true'),
        page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true'),
        page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true'),
        page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true'),
        page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true'),
        page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true'),
        page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true')
      ]);
    }
    catch(error) {
      // If the timeout happens, then us changing the next item on the dropdown created no new requests...
      // Using that to inference that we are at the end of the list and should quit
      console.log(`Done... ${dataToReturn.length} facilities parsed...`);
      process.exit(0);
    }
    await page.waitFor(3000); // Just waiting a bit more for rendering to take place
  }

  async function getData() {
    return {
      facilityName: await page.$eval('[aria-label="Facility Name Slicer"] .slicer-restatement', data => data.innerHTML),
      confirmedCases: await page.$$eval('svg[aria-label^="Confirmed Cases"] > g > text > title', data => data.map(x => x.__data__.value)[0]),
      recoveries: await page.$$eval('svg[aria-label^="Recoveries"] > g > text > title', data => data.map(x => x.__data__.value)[0]),
      staffDeaths: await page.$$eval('svg[aria-label^="Staff"] > g > text > title', data => data.map(x => x.__data__.value)[2]),
      residentDeaths: await page.$$eval('svg[aria-label^="Residents"] > g > text > title', data => data.map(x => x.__data__.value)[0]),
    }
  }
})()