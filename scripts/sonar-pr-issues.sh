#!/usr/bin/env bash
# The open SonarCloud issues on a pull request's new code, one line each, and the commit Sonar last
# analysed (compare it with the PR head before acting: an older analysis lists issues already fixed).
# Reads SonarCloud's public API; no token needed for this public project.
#
#   scripts/sonar-pr-issues.sh 9919
set -euo pipefail

pr="${1:?usage: scripts/sonar-pr-issues.sh <pull request number>}"
project="formbricks_formbricks"
api="https://sonarcloud.io/api"

# Exit code 3 from this step means Sonar has not analysed the PR yet: say so and stop.
status=0
curl -fsS "${api}/project_pull_requests/list?project=${project}" |
  PR="${pr}" node -e '
    let raw = "";
    process.stdin.on("data", (chunk) => (raw += chunk)).on("end", () => {
      const entry = JSON.parse(raw).pullRequests.find((pull) => pull.key === process.env.PR);
      if (!entry) {
        console.log(`No SonarCloud analysis for PR ${process.env.PR} yet.`);
        process.exit(3);
      }
      console.log(`Analysed ${entry.commit?.sha?.slice(0, 10) ?? "?"} at ${entry.analysisDate}`);
    });' || status=$?
if [ "${status}" -eq 3 ]; then exit 0; fi
if [ "${status}" -ne 0 ]; then exit "${status}"; fi

PR="${pr}" PROJECT="${project}" API="${api}" node --input-type=module -e '
  const { API, PROJECT, PR } = process.env;
  const pageSize = 100;
  const issues = [];
  for (let page = 1; ; page++) {
    const url = `${API}/issues/search?componentKeys=${PROJECT}&pullRequest=${PR}` +
      `&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true&ps=${pageSize}&p=${page}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    const body = await response.json();
    issues.push(...body.issues);
    if (body.issues.length === 0 || issues.length >= body.paging.total) break;
  }
  for (const issue of issues) {
    const severity = (issue.impacts ?? []).map((impact) => impact.severity).join(",") || issue.severity;
    const where = `${issue.component.split(":").pop()}:${issue.line ?? "-"}`;
    console.log(`${severity}\t${issue.rule}\t${where}\t${issue.message}`);
  }
  console.log(`${issues.length} open issue(s)`);
'
