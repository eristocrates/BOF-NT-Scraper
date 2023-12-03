import { google } from 'googleapis';
import keys from './keys.json' assert { type: 'json' };
const { client_email, private_key } = keys;
const BOFNTSHEET = '1Phlz_XjsrfvSKq1UQ6tOe-7ZWcxqtm69ukWsVt80pxE';

// Define the API you want to access
const scopes = ['https://www.googleapis.com/auth/spreadsheets']; // Example scope for Google Sheets API

// Create an OAuth2 client with the service account credentials
const jwtClient = new google.auth.JWT(client_email, null, private_key, scopes);

console.log('\n\n\n****************************************************************************************************')
// Authenticate using the JWT client
jwtClient.authorize((err, tokens) => {
    if (err) {
        console.error('Error authenticating:', err);
        return;
    }
    // You are now authenticated and can make API requests using jwtClient
    const sheets = google.sheets({ version: 'v4', auth: jwtClient });

    const body = {
        values: [
            ['multi', 'array', 'test', ['sub 1', 'sub 2', 'sub 3'].join(', ')],
        ]
    }

    try {
        sheets.spreadsheets.values.update({
            spreadsheetId: BOFNTSHEET,
            range: 'Songs',
            // valueInputOption: 'RAW',
            valueInputOption: 'USER_ENTERED',
            resource: body,
        }).then((response) => {
        console.dir(response.data.updatedCells, { depth: null });
        });
    } catch (err) {
        console.log('Error:', err);
        return;
    }





});



