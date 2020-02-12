docker container run `
-e TZ=Asia/Tokyo `
-e GITLAB_API_ENDPOINT=https://gitlab.com/api/v4/ `
-e GITLAB_PERSONAL_TOKEN=NeC5krPegYzhSqB_kxiZ `
-e GITLAB_PROJECT_ID=16454318 `
-e TARGET_BRANCH=ci-integration `
-e DEPLOYGATE_TOKEN=3168634583495412eada6eac97fd611d1bc0ecd1 `
-e DEPLOYGATE_ENDPOINT=https://deploygate.com/api/users/plusone-inc/apps `
-v "$((Get-Location).Path)\Build:\Build" local-gitlab-release-note-generator