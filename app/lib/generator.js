const _ = require("lodash");
const IssueLib = require("./issue");
const MergeRequestLib = require("./mergeRequest");
const TagLib = require("./tag");
const ChangelogLib = require("./changelog");
const Logger = require("../logger");
const Moment = require("moment-timezone");
const Env = require("../env");
const fs = require('fs');

// added by Arun to upload result to project CI string variable
const { Curl } = require('node-libcurl');
const curl = new Curl();
const close = curl.close.bind(curl);

Logger.debug(`Sanity check: Arun's GITLAB_PERSONAL_TOKEN is ${Env.GITLAB_PERSONAL_TOKEN}`);

exports.generate = async () => {
  const tags = await TagLib.getLatestAndSecondLatestTagByProjectId(Env.GITLAB_PROJECT_ID);
  if (tags.length !== 2) throw new Error("Cannot find latest and second latest tag. Tag Result: " + JSON.stringify(tags));
  const [latestTag, secondLatestTag] = tags;

  if (!_.get(latestTag, "commit.committed_date") || !_.get(secondLatestTag, "commit.committed_date")) throw new Error(`Cannot find latest and second latest tag. Abort the program!`);
  const startDate = _.get(secondLatestTag, "commit.committed_date");
  let endDate = _.get(latestTag, "commit.committed_date");

  // allow the end date to be adjusted by a few seconds to catch issues that are automatially closed by
  // a MR and are time stamped a few seconds later.
  if (Env.ISSUE_CLOSED_SECONDS > 0) {
    Logger.debug(`EndDate:        ${endDate}`);
    Logger.debug(`Adding Seconds: ${Env.ISSUE_CLOSED_SECONDS}`);
    endDate = Moment.tz(endDate, Env.TZ).add(Env.ISSUE_CLOSED_SECONDS, "seconds").utc().format();
    Logger.debug(`New End Date:   ${endDate}`);
  }

  const changeLog = await ChangelogLib.getChangelogByStartAndEndDate(startDate, endDate);
  const changeLogContent = await ChangelogLib.generateChangeLogContent(changeLog, {useSlack: false});
  Logger.debug(`Changelog: ${changeLogContent}`);

  // Write the Changelog file at app root (remember, we are in a Dockerized app)
  fs.writeFile("my-changelog.md", "Hey there!", function(err)
  {
    if(err) {
      return console.log(err);
    }
    console.log("The file was saved!");
  }); 

  // added by Arun to upload generated changelog to update the Gitlab project CI variable 'changelog_str'
  // curl --request PUT --header "PRIVATE-TOKEN: NeC5krPegYzhSqB_kxiZ" "https://gitlab.com/api/v4/projects/16454318/variables/changelog_str" --form "value=Hi curl"
  //curl.setOpt(Curl.option.HTTPHEADER, `PRIVATE-TOKEN: ${Env.GITLAB_PERSONAL_TOKEN}`)
  curl.setOpt(Curl.option.VERBOSE, true);
  curl.setOpt(Curl.option.URL, `https://gitlab.com/api/v4/projects/${Env.GITLAB_PROJECT_ID}/variables/changelog_str`);
  curl.setOpt(Curl.option.UPLOAD, true);

  curl.setOpt(Curl.option.HEADER, `PRIVATE-TOKEN: NeC5krPegYzhSqB_kxiZ`);
  //curl.setOpt(Curl.option.HTTPHEADER, [`PRIVATE-TOKEN: NeC5krPegYzhSqB_kxiZ`])

  curl.setOpt(Curl.option.READDATA, `value=${changeLogContent}`);
  curl.on('end', close);
  curl.on('error', close);
  curl.perform();
  
  Logger.debug(`done (PRIVATE-TOKEN: ${Env.GITLAB_PERSONAL_TOKEN})`);

  // This would optionally allow us to update the tag descripting in Gitlab as well
  //return await TagLib.upsertTagDescriptionByProjectIdAndTag(Env.GITLAB_PROJECT_ID, latestTag, changeLogContent);
};
