# Sanity Studio for Carnegie Hill Gallery & Custom Framing

This is where all the words and photos on nyframing.com are kept. The website
itself is built from this content. Nothing on the site is written in code.

Two desks share one set of content:

- **The owner's desk** at `/owner`. One item, Photos, and a large Add photo button.
- **The full desk** at `/`. Photos, reviews, social posts, services, business info,
  and the seven pages, for the family and the agency.

## Before you start

No Sanity project exists yet, because who owns the account has not been decided.
Until it does, the Studio uses a placeholder project id. `npm run build` and
`npm run typecheck` work with the placeholder. `npm run dev` and `npm run deploy`
do not, because there is nothing to connect to.

## 1. Create the free project

1. Sign in at https://www.sanity.io/manage with the account that will own the
   project. Decide this with the client first. Moving a project later is possible
   but it is easier to start in the right place.
2. Create a new project on the free plan. Name it Carnegie Hill Gallery.
3. Create a dataset called `production` and make it **private**. The site reads it
   at build time with a token, so it does not need to be public.
4. Copy the project id from the project page.

## 2. Set the environment

```bash
cp .env.example .env
```

Fill in:

| Name | What it is |
| --- | --- |
| `SANITY_STUDIO_PROJECT_ID` | The project id from step 1. Falls back to a placeholder. |
| `SANITY_STUDIO_DATASET` | `production`. Falls back to `production`. |
| `SANITY_STUDIO_HOST` | The name in `<name>.sanity.studio`. Only used by deploy. |
| `SANITY_STUDIO_OWNER_EMAILS` | The owner's email. Gives that account the simple desk. |

## 3. Run it

```bash
npm install
npm run dev        # http://localhost:3333 and http://localhost:3333/owner
npm run typecheck
npm run build
```

## 4. Deploy the Studio

```bash
npx sanity login
npm run deploy
```

Pick the host name when asked, or set `SANITY_STUDIO_HOST` first. The Studio then
lives at `https://<name>.sanity.studio`, and the owner's desk at
`https://<name>.sanity.studio/owner`. Hosting a Studio this way is part of the
free plan.

## 5. CORS

In https://www.sanity.io/manage, under API, add these origins with credentials
allowed:

- `https://<name>.sanity.studio`
- `http://localhost:3333`

The website does not need a CORS entry. It reads Sanity during the build, on a
server, with a read token.

## 6. The publish webhook

When anyone publishes in the Studio, GitHub Actions should build and deploy the
site. Sanity does that with a webhook that calls GitHub's `repository_dispatch`.

In https://www.sanity.io/manage, open API, then Webhooks, then Create webhook.

| Setting | Value |
| --- | --- |
| Name | GitHub build |
| URL | `https://api.github.com/repos/<github-owner>/<repo>/dispatches` |
| Dataset | `production` |
| Trigger on | Create, Update, Delete |
| Filter | see below |
| Projection | see below |
| HTTP method | `POST` |
| API version | `v2021-06-07` |
| Enable drafts | off |

Filter, so drafts and unrelated documents never start a build:

```groq
!(_id in path("drafts.**")) && _type in [
  "photo", "review", "socialPost", "service", "businessInfo",
  "homePage", "aboutPage", "servicesPage", "galleryPage",
  "reviewsPage", "contactPage", "privacyPage"
]
```

Projection, which is the body GitHub receives:

```groq
{
  "event_type": "sanity-publish",
  "client_payload": {
    "documentId": _id,
    "documentType": _type
  }
}
```

Headers:

```
Content-Type: application/json
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
Authorization: Bearer <github-token>
```

The token is a GitHub fine grained personal access token, limited to this one
repository, with the **Contents** repository permission set to **Read and write**.
That is the permission `repository_dispatch` needs. Nothing else has to be granted.
Put the token in the webhook's Authorization header only. It does not belong in
this repository.

The workflow listens for it:

```yaml
on:
  repository_dispatch:
    types: [sanity-publish]
```

Ten quick uploads should make one build, so the workflow uses a concurrency group
that cancels an in progress run.

## 7. Seed the dataset

The site keeps its starting content as Sanity shaped JSON in
`site/content/seed/*.json`. Sanity imports NDJSON, which is one document per line,
so there is a conversion step:

```bash
npm run seed:ndjson
npx sanity dataset import seed/seed.ndjson production
```

`scripts/seed-to-ndjson.mjs` reads every `.json` file in `site/content/seed/`,
accepts either a single document or an array per file, gives a document an `_id`
if it has none, and writes `seed/seed.ndjson`.

It deliberately leaves photos out. Seed photos point at
`{ "_type": "localImage", ... }`, which is a reduced copy pulled off the live site
for the design concepts. Those files must never ship. The script prints a warning
for each one and skips the whole photo document. On any other document type it
removes the local picture and keeps the rest. The real photos are the originals
from the client's media library, uploaded by hand through the Studio.

If `site/content/seed/` does not exist yet, the script says so and stops.

It also checks each document against the required fields in `schemas/` and
prints what an editor would see as an error before anyone opens the Studio. On
the current seed that is eight reviews with no `sourceUrl`. The documents are
still written to the file, because the gaps are real content gaps to be filled
in the Studio, not conversion faults.

### One thing to settle with the site build

The working agreement in `docs/production-build-contract.md` calls the sort field
`order`, and the seed files carry `order` as a number. The drag to order plugin,
which is the free way to let the owner reorder photos on a phone, writes its own
field called `orderRank` and the name cannot be changed. So the Studio sorts on
`orderRank`.

Pick one of these before launch and tell both sides:

1. The site reads `orderRank` and sorts it as text, ascending. Nothing else changes.
2. The site keeps reading `order`, and someone writes a small job that turns
   `orderRank` into `order`. That is more moving parts for no gain.

Option 1 is the simpler one. After importing the seed, open the photo, review,
social post, and service lists once and use the list menu's reset order action, so
every imported document gets a rank in the order the seed intended.

## 8. Invite the owner

1. In https://www.sanity.io/manage, open the project, then Members, then Invite.
2. Send the invitation to the owner's email address.
3. Give him the lowest predefined role in the project that can still create and
   publish documents. Check the roles the project actually offers before choosing,
   because the list depends on the plan.
4. Add the same email to `SANITY_STUDIO_OWNER_EMAILS`, then deploy the Studio again
   so the setting takes effect.
5. Send him the link to `https://<name>.sanity.studio/owner` and the guide in
   `docs/owner-guide.md`.

## How the owner's desk works, and what it does not do

Sanity's free plan does not include custom roles, so there is no way to buy a
"photos only" permission. The owner's desk is therefore built in the Studio code,
in two ways that work together:

1. **A second workspace** at `/owner`. Its structure has one item. Its create menu
   offers only Photos. Its document actions are limited to photos.
2. **An allow list.** `SANITY_STUDIO_OWNER_EMAILS` names the accounts that get the
   simple desk. If one of those accounts opens the main Studio at `/` instead, it
   still sees the Photos only desk and the Photos only actions.

Both of these are interface, not security. Be honest with the client about this:

- A person with a write role over the dataset can write anything in it. The Studio
  can hide the reviews and the pages from him, but the Sanity API cannot. Anyone
  determined enough could edit other content through the API or through another
  Studio.
- The allow list is read from an environment variable that is baked into the built
  Studio at deploy time. Changing it means deploying the Studio again.
- If the plan later includes custom roles, the honest fix is a real role that
  grants create, update, and publish on `photo` only. The desk here stays useful
  either way, because it is what makes the flow simple on a phone.

The risk is small in practice. The people with access are the owner, his family,
and the agency, and the site can be rebuilt from git and from the dataset history.

## Rules baked into the schema

- Every sentence about the business is stored as `{ text, source: { kind, detail } }`
  and both source fields are required. A statement cannot be published without
  saying where it came from.
- The owner never sees a source field. When he types a caption, the Studio fills
  the source in as written by the owner with today's date, and clears it again if
  he empties the caption.
- There is no rating field anywhere in the schema, and there must never be one.
- A social profile that is not ticked as confirmed does not go on the site.
- `geo` and `foundingYear` stay empty until someone verifies them.

## Where the schema and the site meet

These five were checked line by line against `site/src/content` on
19 September 2026. If you change one side, change the other.

- **A section heading is sourced text.** `pageSection.heading` is a
  `sourcedLine`, not a plain string, because a heading on a page of statements
  can itself be a statement. `site/src/content/types.ts` has always read it as
  `Sourced`.
- **Two pages have an optional main heading.** The Reviews page and the Privacy
  page take their H1 from `site/src/labels.ts` ("Selected customer reviews" and
  "Privacy notice"), because the live site has no wording of its own for either.
  The Studio therefore does not require `h1` on those two, and the site falls
  back to the label. Fill it in only if the owner writes a heading himself.
  Every other page still requires one. See `PAGE_TYPES` in
  `schemas/documents/pages.ts`.
- **A review must link to the review.** `review.sourceUrl` is required and
  stays required: a quote nobody can go and check is not publishable. The eight
  seeded reviews have no permalink yet, so they import but show a validation
  error until somebody pastes the links in. `npm run seed:ndjson` names each
  one before it writes the file.
- **The platform of a social post is worked out from the link.** The field is
  read only and display only. Nothing is stored in it, the site's GROQ query
  does not select it, and `site/src/content/load.ts` derives the platform from
  the URL when it renders. `lib/platformFromUrl.ts` mirrors that function
  exactly, so the Studio can never show a platform the site cannot name. Adding
  one means adding a word to `labels.ts` and getting it signed off.
- **"Mats, glass and display"** is the title of that photo type, with the
  comma, in both the Studio and `labels.photoTypes`.
