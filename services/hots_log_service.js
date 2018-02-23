let fetchHotsLogsData = require('../scrapers/hots_log_scraper');
const { readFile, writeJSONFile } = require('../services/file_service');
const { uploadtoS3, downloadFromS3 } = require('../services/s3_service');
const { v2PatchData } = require('../services/patch_service');
let compare = require('compare-semver');

let _hotsLogData = {};
let hotsLogWinrates = {};
let _lastRead;

const _hotsLogFileName = 'hots_log';

// fetch latest and then schedule getting latest

setTimeout(() => _getInitialData().then(() => _updateHotslogData()), 3000);
let cron = require('node-cron');
cron.schedule('13 8 * * *', () => _updateHotslogData().catch( e => {console.error('Error scraping hotslogs'); console.error(e)}), false);

function _buildPatchFileName (patchNumber) {
  return `${_hotsLogFileName}_${patchNumber}.json`;
}

function _generateData (data, patchNumber) {
  return new Promise(function (resolve, reject) {
    if (data) {
      _lastRead = Date.now();
      _hotsLogData[patchNumber] = data.heroes;
      let wr = JSON.parse(JSON.stringify(data.heroes));
      wr.forEach(hero => {
        delete hero.builds;
      });
      hotsLogWinrates = wr;
      console.log(`Last read hots_log from file ${_lastRead}`);
      resolve();
    }
  });
}

function _updateHotslogData () {
  let fileName = '';
  let currentPatchNumber = compare.max(Object.keys(_hotsLogData).map( a => {let index = a.lastIndexOf('.'); return a.slice(0, index);}));
  currentPatchNumber = Object.keys(_hotsLogData).find(a => a.includes(currentPatchNumber));

  let thisPatchNumber;
  fetchHotsLogsData(_hotsLogData[currentPatchNumber], currentPatchNumber)
    .then(fullVersion => {
      thisPatchNumber = fullVersion;
      fileName = _buildPatchFileName(fullVersion);
      return readFile(fileName);
    })
    .then(data => {
      _generateData(JSON.parse(data), thisPatchNumber);
      return uploadtoS3(fileName);
    })
    .catch( e => console.error(e));
}

function _getStoredS3Data (patch) {
  const fileName = _buildPatchFileName(patch.fullVersion);
  return downloadFromS3(fileName)
    .then(data => writeJSONFile(fileName, data, () =>
        console.log(`Got hots log data from S3 for patch ${patch.fullVersion}`)
      )
    )
    .then(data => _generateData(data, patch.fullVersion))
    .catch(error =>
      console.error(
        `Failed to get hotslog data from S3 for patch ${patch.fullVersion}`
      )
    );
}

function _getInitialData () {
  // FOR EACH PATCH SERVED BY V2 PATCHES
  let patches = v2PatchData();
  let promises = [];
  for (let i = 0; i < patches.length; i++) {
    promises.push(_getStoredS3Data(patches[i]));
  }
  return Promise.all(promises);
}

function hotsLogBuilds (heroName, patchNumber) {
  let patch;
  if (!patchNumber) {
    // A patch that's at least 5 days old
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    patchNumber = v2PatchData().find(
      p => p.hotsDogId !== '' && new Date(p.liveDate) <= fiveDaysAgo
    ).fullVersion;
  }

  let data = _hotsLogData[patchNumber];
  if (data == null) {
    return null;
  } else {
    let hero = data.find(h => h.name === heroName);
    if (hero) {
      return hero.builds;
    }
  }
  return null;
}

module.exports = { hotslogsWinRates: () => hotsLogWinrates, hotsLogBuilds };
