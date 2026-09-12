# Vercel preview access

The concept pages are deployed by the Vercel GitHub integration. Production tracks
`master`. Every branch also gets a preview that follows the latest commit on that
branch, so the preview link stays valid as work is pushed.

Preview link for the redesign branch:

    https://carnegie-hill-concept-git-red-9512b2-wajidalishah2004s-projects.vercel.app

## Current state

Vercel Authentication is **off** for this project, so preview deployments are
readable by anyone with the link. It was turned off on 12 September 2026 so the
owner could review the concepts without a Vercel account.

This applies to every preview on the project, present and future, not only the
redesign branch. There is nothing secret in this repo and every page carries
`<meta name="robots" content="noindex">`, so the pages will not appear in search
results, but the link should still only go to people who are meant to see the
drafts.

## Put protection back when the review is done

    MSYS_NO_PATHCONV=1 sh -c "echo '{\"ssoProtection\": {\"deploymentType\": \"all_except_custom_domains\"}}' | vercel api -X PATCH /v9/projects/carnegie-hill-concept --input -"

That restores Standard Protection: previews require a Vercel account with access
to the team, production stays public.

## Make previews public again

    MSYS_NO_PATHCONV=1 sh -c "echo '{\"ssoProtection\": null}' | vercel api -X PATCH /v9/projects/carnegie-hill-concept --input -"

## Check which one is set

    MSYS_NO_PATHCONV=1 vercel api /v9/projects/carnegie-hill-concept | grep ssoProtection

`null` means previews are public. `{"deploymentType": "all_except_custom_domains"}`
means they are behind the Vercel login.

## Notes

- `MSYS_NO_PATHCONV=1` is only needed in Git Bash on Windows, which otherwise
  rewrites the leading slash of the API path into a Windows path and the command
  fails with "Use an API path starting with /". On macOS and Linux you can drop it.
- The commands need `vercel login` first, and the repo linked with `vercel link`,
  which writes `.vercel/project.json`.
- `vercel link` also writes `.env.local` holding a `VERCEL_OIDC_TOKEN`. That file is
  ignored by `.gitignore` and must not be committed.
- The same setting can be changed by hand at
  https://vercel.com/wajidalishah2004s-projects/carnegie-hill-concept/settings/deployment-protection
