require('events').EventEmitter.prototype._maxListeners = 20;
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const { promisify } = require('util'); 
const csv = promisify(require('csv-stringify'));
const inquirer = require('inquirer');
const flat = require('flat');

module.exports = scraper;

async function scraper(options) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  try {
    await page.goto('https://app.powerbigov.us/view?r=eyJrIjoiNDMwMDI0YmQtNmUyYS00ZmFjLWI0MGItZDM0OTY1Y2Y0YzNhIiwidCI6ImU0YTM0MGU2LWI4OWUtNGU2OC04ZWFhLTE1NDRkMjcwMzk4MCJ9')
  }
  catch (error) {
    console.error(error);
    process.exit(1);
  }

  // Select the type of facility
  const facilityTypeOptions = await buildFacilityTypeOptions();
  const {facilityType: facilityTypeSelections} = await inquirer.prompt({
    type: 'checkbox',
    name: 'facilityType',
    message: 'Select Facility Types',
    choices() {
      return facilityTypeOptions;
    },
    default: [1, 7] // Assisted living and Skilled nursing
  })
  await selectFacilityTypes();

  // Select Facility
  // Setup for iteration
  await page.waitForSelector('[aria-label^="Facility Name Slicer"] .slicer-dropdown-menu');
  await page.focus('[aria-label^="Facility Name Slicer"] .slicer-dropdown-menu')
  await page.waitForSelector('[aria-label^="Facility Name Slicer"] .slicer-dropdown-menu');
  await page.focus('[aria-label^="Facility Name Slicer"] .slicer-dropdown-menu')
  await page.keyboard.down('ControlLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('ControlLeft');

  await page.keyboard.press('Enter');
  await page.waitFor(1000);

  let dataToReturn = [];
  // iterate over options
  while (true) {
    await goToNext();
    await waitForData();
    const facilityData = await getData();
    if (options.debug) {
      await page.screenshot({ path: 'testing.png' });
      console.debug(facilityData);
    }
    dataToReturn.push(facilityData);
    await writeData(options, dataToReturn);
    console.info('...');
  }
  
  async function goToNext() {
    await page.keyboard.press('ArrowDown');
    await page.waitFor(250);
    await page.keyboard.press('Enter');
  }

  // waits for the 14 requests... workaround solution for knowing when the dataset has been updated for the new property
  async function waitForData() {
    try {
      const requests = new Array(14).fill(page.waitForResponse('https://wabi-us-gov-iowa-api.analysis.usgovcloudapi.net/public/reports/querydata?synchronous=true'))
      await Promise.all(requests);
    }
    catch(error) {
      // If the timeout happens, then us changing the next item on the dropdown created no new requests...
      // Using that to inference that we are at the end of the list and should quit
      console.log(`Done... ${dataToReturn.length} facilities parsed...`);
      process.exit(0);
    }
    await page.waitFor(2000); // Just waiting a bit more for rendering to take place
  }

  async function getData() {
    const facilityName = await page.$eval('[aria-label^="Facility Name Slicer"] .slicer-restatement', data => data.innerHTML);
    
    // These grab an alternation between data and display label. So far datapoints have been the even, labels odd.
    // data only could change text selector to text.value - label only could changes selector to text.label
    const residentData = await page.$$eval('svg[aria-label^="Residents"] > g > text > title', data => data.map(x => x.__data__.value));
    const staffData = await page.$$eval('svg[aria-label^="Staff"] > g > text > title', data => data.map(x => x.__data__.value));
    
    const confirmedCaseData = await page.$$eval('[aria-label^="Confirmed COVID-19 Cases"] svg g.labelGraphicsContext > text.label', data => data.map(x => x.innerHTML));
    const uniqueConfirmedCaseTotal =  await page.$$eval('svg[aria-label^="Unique Confirmed"] > g > text.value > title', data => data.map(x => x.__data__.value));

    const residentConfirmedCaseCount = Number(confirmedCaseData[0]);
    const staffConfirmedCaseCount = Number(confirmedCaseData[1]);
    const importedConfirmedCaseCount = Number(confirmedCaseData[2]);
    const confirmedCaseCount = Number(uniqueConfirmedCaseTotal[0]); // Excludes imported count

    const residentDeaths = Number(residentData[0]);
    const staffDeaths = Number(staffData[2]);

    const residentRecoveries = Number(residentData[4]);
    const staffRecoveries = Number(staffData[4]);

    return {
      facilityName: facilityName,
      cases: {
        resident: residentConfirmedCaseCount,
        staff: staffConfirmedCaseCount,
        imported: importedConfirmedCaseCount,
        total: confirmedCaseCount
      },
      recoveries: {
        resident: residentRecoveries,
        staff: staffRecoveries,
      },
      deaths: {
        resident: residentDeaths,
        staff: staffDeaths,
      }
    };
  }

  async function writeData({ outputFile, format }, data) {
    let output;
    switch(format) {
      case 'csv':
        const flattened = data.map(x => flat(x));
        output = await csv(flattened, { header: true });
        break;
      case 'json':
        output = JSON.stringify(data, null, 2)
        break;
    }
    await fs.writeFile(outputFile, output);
  }

  async function buildFacilityTypeOptions() {
    console.info('Building option list...');
    await page.waitForSelector('[aria-label^="Facility Type Slicer"] .slicer-dropdown-menu');
    await page.focus('[aria-label^="Facility Type Slicer"] .slicer-dropdown-menu');
    // use Power BI keyboard shortcut to gain focus of dropdowns
    await page.keyboard.down('ControlLeft');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.up('ControlLeft');

    await page.keyboard.press('Enter');
    await page.waitFor(300);

    const opts = await (await page.$('.slicer-dropdown-content')).$$eval('div.row .slicerItemContainer', data => data.map((x, index) => {
      return {
        name: x.innerText,
        value: index,
        short: x.innerText
      };
    }).filter(x => x.name !== 'Select all'));

    return opts;
  }

  async function selectFacilityTypes() {
    const rowElements = await (await (await page.$('.slicer-dropdown-content')).$$('div.row .slicerItemContainer .slicerText')).filter((x, index) => facilityTypeSelections.includes(index));
    await page.keyboard.down('ControlLeft');
    await Promise.all(
      rowElements.map(async row => {
        await row.click();
        await page.waitFor(500);
      })
    );
    await page.keyboard.up('ControlLeft');

    if (options.debug) {
      await page.screenshot({ path: 'testing.png' });
      await page.waitFor(2000);
    }
  }
}
