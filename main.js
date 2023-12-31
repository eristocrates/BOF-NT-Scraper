import puppeteer from 'puppeteer';
import { google } from 'googleapis';
import keys from './keys.json' assert { type: 'json' };
const { client_email, private_key } = keys;
const BOFNTSHEET = '1Phlz_XjsrfvSKq1UQ6tOe-7ZWcxqtm69ukWsVt80pxE';

let songSheetBody = {
  values: [
    [
      'Jacket',
      'Banner',
      'Name',
      '1rstDownloadLink',
      '1rstDownloadDescription',
      'Genre',
      'Artists',
      'PageLink',
      'Youtube',
      'Soundcloud',
      'Bemuse',
      'Total',
      'Median',
      'Labels',
      'LastUpdated',
      'LastScraped',
      '2ndDownloadLink',
      '2ndDownloadDescription',
      '3rdDownloadLink',
      '3rdDownloadDescription',
      '4thDownloadLink',
      '4thDownloadDescription',
      '5thDownloadLink',
      '5thDownloadDescription',
      '6thDownloadLink',
      '6thDownloadDescription'
    ],
  ]
};

let teamSheetBody = {
  values: [
    [
      'Name',
      'Banner',
      'Emblem',
      'Impression',
      'Total',
      'Median'
    ],
  ]
};

console.time('programExecution');

// puppeteer
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

  await page.goto('https://manbow.nothing.sh/event/event.cgi?action=List_def&event=142#186');
  console.log('\n\n\n****************************************************************************************************')

  const teams = new Map();

  const teamElements = await page.$$('.team_information');
  // console.log('Team Count:', teamElements.length);
  // const numberOfTeamsToLimit = 63;
  // Slice the teamElements array to select a specific number of teams
  // const limitedTeamElements = teamElements.slice(62, numberOfTeamsToLimit);

  let teamIndex = 1;
  // Iterate through teams
  for (const teamElement of teamElements.slice(0, -1)) { // for whatever reason the last element is just empty
    // Iterate through the limited teams
   // for (const teamElement of limitedTeamElements) {
    teamElement.scrollIntoView();
    const teamInfo = await teamElement.$eval('.fancy-title :is(h2, h3) a', (link) => {
      const teamName = link.innerText.trim();
      const bannerImageSrc = link.querySelector('img') ? link.querySelector('img').src : '';
      return { teamName, bannerImageSrc };
    });

    const emblemImageSrc = await teamElement.$eval('.header_emblem', (emblemElement) => {
      const dataBg = emblemElement.getAttribute('data-bg');
      const withoutPeriod = dataBg.substring(1);
      return withoutPeriod.length > 1 ? `https://manbow.nothing.sh/event${withoutPeriod}` : '';
    });
    teamInfo.emblemImageSrc = emblemImageSrc;
    teamInfo.teamImpression = await teamElement.$eval('#team_imp', (element) => element.innerText.trim());
    teamInfo.teamTotal = await teamElement.$eval('#team_total', (element) => element.innerText.trim());
    teamInfo.teamMedian = await teamElement.$eval('#team_med', (element) => element.innerText.trim());

    // console.log(`Processed team #${teamIndex}: ${teamInfo.teamName}`);

    const songElements = await teamElement.$$('.pricing-box.best-price');

    // Initialize an array to store song information for the current team
    const songs = new Map();

    if (!songElements) {
      console.log('No song elements found for this team.');
      continue;
    }

    let songIndex = 1;
    // Iterate through songs within the current team
    for (const songElement of songElements) {
      songElement.scrollIntoView();
      debugger;
      // Song Information and Points Information
      let songName = '';
      try {
        songName = await songElement.$eval('a', (a) => a.innerText.trim());
      } catch (error) {
        const text = await page.$eval('span#notready strong', (strongElement) => {
          return strongElement.textContent;
        });
        if (text === '- NO ENTRY -') {
          console.log('Skipping non entry for team', teamInfo.teamName);
          continue;
        }
      }
      try {
        const genreName = await songElement.$eval('h5', (h5) => h5.innerText.trim());
        const artistName = await songElement.$eval('.textOverflow:nth-child(3)', (textOverflow) => textOverflow.innerText.trim());
        const linkElement = await songElement.$('a');
        const songPageLink = linkElement ? await linkElement.getProperty('href').then(href => href.jsonValue()) : null;

        const pointsElements = await songElement.$$('xpath/ancestor::div[contains(@class, "col-sm-4")]');
        const spans = await pointsElements[0].$$('.bofu_meters span');
        const totalPoints = await spans[0].evaluate(span => span.innerText.replace('Total :', '').replace(' Point', '').trim());
        const medianPoints = await spans[1].evaluate(span => span.innerText.replace('Median :', '').replace(' Points', '').trim());

        const songInfo = {
          songName,
          genreName,
          artistName,
          songPageLink,
          totalPoints,
          medianPoints,
        };



        //BMS labels
        const bmsLabels = await songElement.$eval('.bmsinfo small', (labelElement) => {
          const labels = Array.from(labelElement.querySelectorAll('strong')).map((label) => label.innerText.trim());
          return labels;
        });
        songInfo.bmsLabels = bmsLabels;

        const updateInfo = await songElement.$eval('.pricing-action span small', (updateElement) => {
          const updateText = updateElement.innerText.trim();
          const regex = /update : (\d{4}\/\d{2}\/\d{2} \d{2}:\d{2})/;
          const match = updateText.match(regex);

          let updateDateString = null;
          if (match) {
            updateDateString = match[1];
          }

          return { updateDateString };
        });
        songInfo.updateDateTime = new Date(updateInfo.updateDateString);
        songInfo.scrapedDateTime = new Date();

        // Push the extracted song information to the songs array
        songs.set(songInfo.songName, songInfo);
        songIndex += 1;
        // console.log(`Processed Song #${songIndex}: ${songInfo.songName}`);
      } catch (error) {
        console.log('An Error occured:', error);
        console.log(teamInfo.teamName);
        // await page.waitForTimeout(60000);
      }
    }
    teamInfo.songs = songs;

    teams.set(teamInfo.teamName, teamInfo);
    teamSheetBody.values.push(
      [
        teamInfo.teamName,
        teamInfo.bannerImageSrc === '' ? '' : `=IMAGE("${teamInfo.bannerImageSrc}")`,
        teamInfo.emblemImageSrc === '' ? '' : `=IMAGE("${teamInfo.emblemImageSrc}")`,
        teamInfo.teamImpression,
        teamInfo.teamTotal,
        teamInfo.teamMedian,
      ],
    )
    teamIndex += 1;
  }

  // console.log('teamSheetBody', teamSheetBody);
  let songRow = [];

  // Now, you can access songPageLink within the existing songs map
  for (const [teamName, teamInfo] of teams.entries()) {
    for (const [songName, songInfo] of teamInfo.songs.entries()) {
      const songPageLink = songInfo.songPageLink;
      // Navigate to songPageLink
      await page.goto(songPageLink);

      // Use Puppeteer to extract the jacket source
      try {
        const jacketImageSrc = await page.$eval('.col_one_third.col_last.moreinfo-header.nobottommargin.hidden-xs.hidden-sm img', (imgElement) => {
          const withoutPeriod = imgElement.getAttribute('src').substring(1);
          return `https://manbow.nothing.sh/event${withoutPeriod}`;
        });
        songInfo.jacketImageSrc = jacketImageSrc
      } catch (error) {
        songInfo.jacketImageSrc = '';
      }

      try {
        // Use Puppeteer to extract the banner source
        const bannerImageElement = await page.$x("//div[contains(@style, 'upload')]/@style");
        if (bannerImageElement.length > 0) {
          const styleAttribute = await bannerImageElement[0].getProperty('textContent');
          // console.log('Style Attribute String:', styleAttribute.toString());
          // Use a regular expression to match URLs containing "upload"
          const uploadUrlMatch = (styleAttribute.toString()).match(/url\("([^"]*upload[^"]*)"\)/);
          // console.log('Upload Url Match 1', uploadUrlMatch[1]);
          songInfo.bannerImageSrc = `https://manbow.nothing.sh/event${uploadUrlMatch[1].substring(1)}`;
        } else {
          songInfo.bannerImageSrc = '';
        }
      } catch (error) {
        songInfo.bannerImageSrc = '';
      }


      // Extract youtube link. 
      let youtubeLink = ''; // Initialize to a default value

      const iframeElement = await page.$('div.fluid-width-video-wrapper iframe');
      if (iframeElement) {
        youtubeLink = await page.$eval('div.fluid-width-video-wrapper iframe', (iframe) => {
          return iframe.getAttribute('src');
        });
      }
      songInfo.youtubeLink = youtubeLink;

      // Extract soundcloud link.
      debugger;
      try {
        // Wait for the iframe to load
        await page.waitForSelector('.m_audition iframe');

        // Get the iframe element
        const iframeElement = await page.$('.m_audition iframe');

        // Extract the src attribute of the iframe
        const soundcloudSrc = await page.evaluate(iframe => iframe.src, iframeElement);
        const soundcloudUrlSrc = new URL(soundcloudSrc);
        // Get the value of the 'url' parameter
        const urlParam = soundcloudUrlSrc.searchParams.get('url');
        // Extract the necessary part of the URL
        const soundcloudLink = new URL(urlParam).toString();
        songInfo.soundcloudLink = soundcloudLink;
      } catch (error) {
        songInfo.soundcloudLink = '';
      }


      // Extract only the linkUrls
      const linkUrls = await page.$$eval('blockquote p a', (elements) => {
        return elements.map((element) => element.getAttribute('href'));
      });

      // console.log('Link URLs:', linkUrls);

      // Extract all text within the <p> element separated by <br> tags
      const paragraphTexts = await page.$eval('p[style="font-size:75%"]', (element) => {
        const textWithEntities = element.innerHTML.split('<br>').map((text) => text.trim());

        // Define a mapping of character references to their corresponding characters
        const characterReferences = {
          '&lt;': '<',
          '&gt;': '>',
          '&quot;': '"',
          '&apos;': "'",
          '&amp;': '&',
          // Add more character references here as needed
        };

        // Replace character references in the text
        const textWithoutEntities = textWithEntities.map((text) => {
          for (const entity in characterReferences) {
            if (text.includes(entity)) {
              text = text.replace(new RegExp(entity, 'g'), characterReferences[entity]);
            }
          }
          return text;
        });

        return textWithoutEntities;
      });


      // console.log('Paragraph Text:', paragraphTexts);

      // Initialize the links array
      let links = [];

      // Handle inline link descriptions
      let inlineUrlDescs = [];
      for (const paragraphText of paragraphTexts) {
        let linkElement = {
          linkUrl: '',
          linkDesc: '',
        };

        for (const linkUrl of linkUrls) {
          if (paragraphText.includes(linkUrl)) {
            // Create a regular expression pattern to match the link pattern
            const linkPattern = new RegExp(`<a(.*?)</a>`, 'g');

            // Replace the link pattern with an empty string to remove it
            linkElement.linkDesc = paragraphText.replace(linkPattern, '');
            linkElement.linkUrl = linkUrl;
            break;
          }
        }
        if (linkElement.linkUrl == '') {
          linkElement.linkDesc = paragraphText;
        }

        if (linkElement.linkUrl !== '' || linkElement.linkDesc !== '') { // prevent blank linkElements
          inlineUrlDescs.push(linkElement)
        }
      }

      // handle link descriptions above the link
      const aboveUrlDescs = [];
      try {

        for (let i = 0; i < inlineUrlDescs.length; i++) {
          // match above descriptions to a link directly below

          if (
            i == 0 &&
            inlineUrlDescs[i].linkUrl === '' &&
            inlineUrlDescs[i].linkDesc !== '' &&
            inlineUrlDescs[i + 1].linkUrl !== '' &&
            inlineUrlDescs[i + 1].linkDesc === ''
          ) {
            const newUrl = inlineUrlDescs[i + 1].linkUrl;
            const newDesc = inlineUrlDescs[i].linkDesc;
            i++; // Increment i to skip the next element in the original array
            aboveUrlDescs.push({ linkUrl: newUrl, linkDesc: newDesc });
          } else if (
            i < inlineUrlDescs.length - 1 &&
            inlineUrlDescs[i].linkUrl === '' &&
            inlineUrlDescs[i].linkDesc !== '' &&
            inlineUrlDescs[i + 1].linkUrl !== '' &&
            inlineUrlDescs[i + 1].linkDesc === '' &&
            inlineUrlDescs[i - 1].linkUrl !== '' &&
            inlineUrlDescs[i - 1].linkDesc === ''
          ) {
            const newUrl = inlineUrlDescs[i + 1].linkUrl;
            const newDesc = inlineUrlDescs[i].linkDesc;
            i++; // Increment i to skip the next element in the original array
            aboveUrlDescs.push({ linkUrl: newUrl, linkDesc: newDesc });
          } else if (inlineUrlDescs[i].linkUrl !== '' || inlineUrlDescs[i].linkDesc !== '') {
            aboveUrlDescs.push(inlineUrlDescs[i]); // Keep the current element
          }
        }
      } catch (error) {
        console.log('No Link Found: ', songPageLink)
        // technically this could apply whatever text is there as a description with no url, but i don't have the patience for it atm
      }

      // handle multiline descs
      const multilineUrlDescs = [];
      let pendingUrl = '';
      let pendingDesc = '';

      for (const { linkUrl, linkDesc } of aboveUrlDescs) {
        // debugger;
        if (linkUrl) {
          if (pendingUrl) {
            multilineUrlDescs.push({ linkUrl: pendingUrl, linkDesc: pendingDesc });
            pendingUrl = '';
            pendingDesc = '';
          } else if (pendingDesc) {
            if (linkDesc) {
              multilineUrlDescs.push({ linkUrl: '', linkDesc: pendingDesc });
              pendingUrl = '';
              pendingDesc = '';
            } else {
              multilineUrlDescs.push({ linkUrl, linkDesc: pendingDesc });
              pendingUrl = '';
              pendingDesc = '';
              continue;
            }
          }
          if (linkDesc) {
            multilineUrlDescs.push({ linkUrl, linkDesc });
          }
        } else if (linkDesc) {
          pendingDesc = pendingDesc ? `${pendingDesc}\n${linkDesc}` : linkDesc;
        }
        if (linkUrl && !linkDesc) {
          multilineUrlDescs.push({ linkUrl, linkDesc });
        }
      }

      // Handle any pending items
      if (pendingUrl) {
        multilineUrlDescs.push({ linkUrl: pendingUrl, linkDesc: pendingDesc });
      } else if (pendingDesc) {
        multilineUrlDescs.push({ linkUrl: '', linkDesc: pendingDesc });
      }

      // Replace the original 'links' array with the modified 'newLinks' array
      links = multilineUrlDescs;
      songInfo.links = links;
      // console.log('Link Descriptions:', linkDescs);

      let bemuseLink = '';
      try {
        // Use Puppeteer to extract the Bemuse link
        bemuseLink = await page.$eval('.bmson-iframe-content iframe', (iframe) => {
          return iframe.getAttribute('src');
        });
        songInfo.bemuseLink = bemuseLink;

      } catch (error) {
        songInfo.bemuseLink = '';
      }
      songRow =
        [
          songInfo.jacketImageSrc === '' ? '' : `=IMAGE("${songInfo.jacketImageSrc}")`,
          songInfo.bannerImageSrc === '' ? '' : `=IMAGE("${songInfo.bannerImageSrc}")`,
          songInfo.songName,
          songInfo.links[0] ? songInfo.links[0].linkUrl : '',
          songInfo.links[0] ? songInfo.links[0].linkDesc : '',
          songInfo.genreName,
          songInfo.artistName,
          songInfo.songPageLink,
          songInfo.youtubeLink === '' ? '' : `${songInfo.youtubeLink}`,
          songInfo.soundcloudLink === '' ? '' : `${songInfo.soundcloudLink}`,
          songInfo.bemuseLink === '' ? '' : `${songInfo.bemuseLink}`,
          songInfo.totalPoints,
          songInfo.medianPoints,
          songInfo.bmsLabels.join(', '),
          songInfo.updateDateTime,
          songInfo.scrapedDateTime,
        ];
      if (songInfo.links.length > 1) {
        const extraLinks = songInfo.links.slice(1, songInfo.links.length);
        for (const link of extraLinks) {
          songRow.push(link.linkUrl);
          songRow.push(link.linkDesc);
        }

      }
    songSheetBody.values.push(songRow);
    }

  }
  // console.dir(teams, { depth: null });

  // await page.waitForTimeout(120000);
  await browser.close();

  // Google API
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
        spreadsheetId: BOFNTSHEET,
        range: 'Songs',
        // valueInputOption: 'RAW',
        valueInputOption: 'USER_ENTERED',
        resource: songSheetBody,
      }).then((response) => {
        console.dir(response, { depth: null });
      });
    } catch (err) {
      console.log('Error:', err);
      // return;
    }

    try {
      sheets.spreadsheets.values.update({
        spreadsheetId: BOFNTSHEET,
        range: 'Teams',
        // valueInputOption: 'RAW',
        valueInputOption: 'USER_ENTERED',
        resource: teamSheetBody,
      }).then((response) => {
        console.dir(response, { depth: null });
      });
    } catch (err) {
      console.log('Error:', err);
      return;
    }

  });
  console.timeEnd('programExecution'); // End the timer
})();
