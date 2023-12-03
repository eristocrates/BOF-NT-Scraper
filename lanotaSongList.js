
import puppeteer from 'puppeteer';
import { google } from 'googleapis';
import keys from './keys.json' assert { type: 'json' };
const { client_email, private_key } = keys;
const LANOTASHEET = '1tUNOlKEzmtrjguAjKHaHbQaDCUM9sQ5CyHPxD07SZy0';


let songSheetBody = {
    values: [
        [
            'Title',
            'Artist'
        ],
    ]
};



console.time('programExecution');

(async () => {
    const browser = await puppeteer.launch({
        headless: "new"
        /*
        headless: false,
        devtools: true
        */
    });

    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    // await page.setViewport({ width: 1080, height: 1920 });

    page.setDefaultNavigationTimeout(60000);
    await page.goto('https://lanota.fandom.com/wiki/Subscription_Chapter._%E2%88%9E#Song_List');
    console.log('\n\n\n****************************************************************************************************')
    const tableRows = await page.$$('table.wikitable tr:not(:nth-child(1)):not(:nth-child(2))');

    let songRow = [];

    for (const row of tableRows) {
        const [titleElement, artistElement] = await row.$$('td');
        const title = await titleElement.$eval('a', (a) => a.textContent);
        const artist = await artistElement.evaluate((node) => node.textContent);
        console.log(`Title: ${title.trim()}, Artist: ${artist.trim()}`);
        songRow =
            [
                title.trim(),
                artist.trim()
            ];
        songSheetBody.values.push(songRow);
    }

    // await page.waitForTimeout(120000);
    await browser.close();

    // Define the API you want to access
    const scopes = ['https://www.googleapis.com/auth/spreadsheets']; // Example scope for Google Sheets API

    // Create an OAuth2 client with the service account credentials
    const jwtClient = new google.auth.JWT(client_email, null, private_key, scopes);

    // Authenticate using the JWT client
    jwtClient.authorize((err, tokens) => {
        if (err) {
            console.error('Error authenticating:', err);
            return;
        }
        // You are now authenticated and can make API requests using jwtClient
        const sheets = google.sheets({ version: 'v4', auth: jwtClient });
        try {
            sheets.spreadsheets.values.update({
                spreadsheetId: LANOTASHEET,
                range: 'Songs',
                valueInputOption: 'RAW',
                resource: songSheetBody,
            }).then((response) => {
                console.dir(response, { depth: null });
            });
        } catch (err) {
            console.log('Error:', err);
            // return;
        }
    });

    console.timeEnd('programExecution'); // End the timer

})();