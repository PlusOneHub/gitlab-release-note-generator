const _ = require("lodash");
const IssueLib = require("./issue");
const MergeRequestLib = require("./mergeRequest");
const TagLib = require("./tag");
const ChangelogLib = require("./changelog");
const Logger = require("../logger");
const Moment = require("moment-timezone");
const Env = require("../env");
const fs = require('fs');
const curl = new (require( 'curl-request' ))();

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

  // Upload generated changelog to update the Gitlab project CI variable  'changelog_str'
  // curl --request PUT --header "PRIVATE-TOKEN: NeC5krPegYzhSqB_kxiZ" "https://gitlab.com/api/v4/projects/16454318/variables/changelog_str" --form "value=Hi curl"
  curl
  .setHeaders([
    'PRIVATE-TOKEN: ${Env.GITLAB_PERSONAL_TOKEN}'
  ])
  .setBody({
   'value': 'Hello (node) curl'
  })
  .post('https://gitlab.com/api/v4/projects/${Env.GITLAB_PROJECT_ID}/variables/changelog_str') // TODO: make 'changelog_str' an environment var and pass it in
  .then(({statusCode, body, headers}) => {
      console.log(statusCode, body, headers)
  })
  .catch((e) => {
      console.log(e);
  });

  //
  //return await TagLib.upsertTagDescriptionByProjectIdAndTag(Env.GITLAB_PROJECT_ID, latestTag, changeLogContent);
};
