const _ = require("lodash")
const IssueLib = require("./issue")
const MergeRequestLib = require("./mergeRequest")
const TagLib = require("./tag")
const ChangelogLib = require("./changelog")
const Logger = require("../logger")
const Moment = require("moment-timezone")
const Env = require("../env")
const fs = require('fs')

Logger.debug(`Sanity check: Arun's GITLAB_PERSONAL_TOKEN is ${Env.GITLAB_PERSONAL_TOKEN}`)
Logger.debug(` is ${Env.GITLAB_PERSONAL_TOKEN}`)



exports.generate = async () => {
  console.log(`Fetching tag data..`)
  const tags = await TagLib.getLatestAndSecondLatestTagByProjectId(Env.GITLAB_PROJECT_ID)
  if (tags.length !== 2) throw new Error("Cannot find latest and second latest tag. Tag Result: " + JSON.stringify(tags))
  const [latestTag, secondLatestTag] = tags

  if (!_.get(latestTag, "commit.committed_date") || !_.get(secondLatestTag, "commit.committed_date")) throw new Error(`Cannot find latest and second latest tag. Abort the program!`);
  const startDate = _.get(secondLatestTag, "commit.committed_date")
  let endDate = _.get(latestTag, "commit.committed_date")

  // allow the end date to be adjusted by a few seconds to catch issues that are automatially closed by
  // a MR and are time stamped a few seconds later.
  if (Env.ISSUE_CLOSED_SECONDS > 0) {
    Logger.debug(`EndDate:        ${endDate}`)
    Logger.debug(`Adding Seconds: ${Env.ISSUE_CLOSED_SECONDS}`)
    endDate = Moment.tz(endDate, Env.TZ).add(Env.ISSUE_CLOSED_SECONDS, "seconds").utc().format()
    Logger.debug(`New End Date:   ${endDate}`)
  }

  console.log(`Generating changelog..`)
  const changeLog = await ChangelogLib.getChangelogByStartAndEndDate(startDate, endDate)
  const changeLogContent = await ChangelogLib.generateChangeLogContent(changeLog, {useSlack: false})
  Logger.debug(`[DEBUG] New changelog = ${changeLogContent}`)

  // strip markdown for DeployGate release notes
  const removeMd = require('remove-markdown');
  const plainLog = removeMd(changeLogContent);
  Logger.debug(`[DEBUG] New planelog (md stripped) = ${plainLog}`)

  // Upload apk to DeployGate with release notes
  // cURL equivalent: curl -H  "Authorization: token %1" -F "file=@Build/app.apk" -F "message=%2" "https://deploygate.com/api/users/plusone-inc/apps"
  var request = require('request') // https://www.npmjs.com/package/request/v/2.88.0
  
  var headers = {
    'Authorization': `token ${Env.DEPLOYGATE_TOKEN}`
  };

  fs.readdirSync('./Build').forEach(file => {
    console.log(file);
  });

  var formData = {
    message: `${plainLog}`,
    file: fs.createReadStream('./Build/app.apk')
  };

  var options = {
    url: `${Env.DEPLOYGATE_UPLOAD_ENDPOINT}`,
    headers: headers,
    formData: formData
  }

  console.log(`Uploading apk to DeployGate..`)
  request
    .post(options, function optionalCallback(err, httpResponse, body) {
      if (err) {
        return console.error('Upload failed: ', err);
      }
      console.log('Upload successful! Server responded with: ', body);
    });

  // Option #1: set an existing CI environment variable for our project equal to the changelog string (could be useful)
  // cURL equivalent: curl --request PUT --data "name=staging&external_url=https://staging.example.gitlab.com" --header "PRIVATE-TOKEN: <your_access_token>" "https://gitlab.example.com/api/v4/projects/1/environments/1"
  /*
  var request = require('request')

  var headers = {
      'PRIVATE-TOKEN': `${Env.GITLAB_PERSONAL_TOKEN}`
  };

  var options = {
      url: `https://gitlab.com/api/v4/projects/${Env.GITLAB_PROJECT_ID}/variables/CHANGELOG_STR`,
      headers: headers,
      form: {value: `${changeLogContent}`}
  }

  request
    .put(options)
    .on('error', function(err) {
      Logger.debug(err)
    })
  */

  // Option #2: Update the tag descripting within the Gitlab project 'release' page
  //return await TagLib.upsertTagDescriptionByProjectIdAndTag(Env.GITLAB_PROJECT_ID, latestTag, changeLogContent);
};
