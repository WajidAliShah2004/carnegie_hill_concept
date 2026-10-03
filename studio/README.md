# Sanity Studio for Carnegie Hill Gallery & Custom Framing

This is where all the words and photos on nyframing.com are kept. The website
itself is built from this content. Nothing on the site is written in code.

Two desks share one set of content:

- **The owner's desk** at `/owner`. One item, Photos, and a large Add photo button.
  The bare address opens it too, because it is the first workspace.
- **The full desk** at `/full`. Photos, reviews, social posts, services, business
  info, and the seven pages, for the family and the agency.

Sanity requires every workspace path to have the same number of segments, which
is why neither desk sits at `/`.

## Where it lives

| What | Value |
| --- | --- |
| Organization | Carnegie Hill Gallery (`o84jws2i3`), under the agency's Google login for now |
| Project | Carnegie Hill Gallery (`vw3f3n6v`), free plan |
| Dataset | `production`, public |
| Studio | https://carnegie-hill.sanity.studio, owner's desk at `/owner`, full desk at `/full` |

Set up on 3 October 2026. Steps 1 to 5 below are done; they stay here so the
project could be rebuilt. Without a `.env` the Studio falls back to a
placeholder project id: `npm run build` and `npm run typecheck` still work,
`npm run dev` and `npm run deploy` do not.

## 1. Create the free project

1. Sign in at https://www.sanity.io/manage. The project starts in an
   organization named for the shop, under the agency's login, so the Studio can
   be tested before the client has an account. When the client sends an email
   address, add it as an administrator of that organization and the agency can
   step back.
2. Create a new project on the free plan. Name it Carnegie Hill Gallery.
3. Create a dataset called `production` and make it **public**. The free plan
   offers public datasets only. Public means anyone with the project id can read
   every published document, including the `source` fields. Drafts stay
   private. Never publish anything in the Studio that has to stay private.
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
npm run dev        # http://localhost:3333/owner and http://localhost:3333/full
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
free plan. `deployment.appId` in `sanity.cli.ts` stops the deploy asking which
Studio to replace.

Sanity now sends `<name>.sanity.studio` on to its dashboard, at
`https://www.sanity.io/@<organization>/studio/<appId>/...`, which asks for a
sanity.io sign in and shows the Studio under a thin bar of Sanity's own icons.
The owner's desk works the same inside it, on a phone too.

`sanity.cli.ts` also lists `lexorank` under `vite.ssr.external`. Without it the
deploy stops with "exports is not defined" while it reads the schema, because
the drag to order plugin depends on that CommonJS only package.

## 5. CORS

In https://www.sanity.io/manage, under API, add these origins with credentials
allowed:

- `https://<name>.sanity.studio`
- `http://localhost:3333` (Sanity adds this one by itself)

The website does not need a CORS entry. It reads Sanity during the build, on a
server. The dataset is public, so the build needs no read token.

## 6. The publish webhook

For now a webhook called "Vercel staging build" rebuilds the staging copy on
Vercel instead. See "Staging on Vercel, for now" in `docs/deploy.md`. The
GitHub webhook below is for when a production host exists.

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
npx sanity datasets import seed/seed.ndjson --dataset production --replace
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

### Sort order

The working agreement in `docs/production-build-contract.md` calls the sort field
`order`, and the seed files carry `order` as a number. The drag to order plugin,
which is the free way to let the owner reorder photos on a phone, writes its own
field called `orderRank` and the name cannot be changed. So the Studio sorts on
`orderRank`, and the site reads `orderRank` and sorts it as text, ascending.

The seed script turns each numeric `order` into an `orderRank` the same way the
plugin's reset order action does, then drops `order`, so an import keeps the
order the seed intended and no field shows up as unknown in the Studio.

## 8. Invite the owner

1. In https://www.sanity.io/manage, open the project, then Members, then Invite.
2. Send the invitation to the owner's email address.
3. Give him the Administrator role. The free plan has two roles, Administrator
   and Viewer, and a Viewer cannot publish. Administrator also opens every
   project setting to him; see the next section.
4. Add the same email to `SANITY_STUDIO_OWNER_EMAILS`, then deploy the Studio again
   so the setting takes effect.
5. Send him the link to `https://carnegie-hill.sanity.studio/owner` and the guide
   in `docs/owner-guide.md`.

## How the owner's desk works, and what it does not do

Sanity's free plan does not include custom roles, so there is no way to buy a
"photos only" permission. The owner's desk is therefore built in the Studio code,
in two ways that work together:

1. **A second workspace** at `/owner`. Its structure has one item. Its create menu
   offers only Photos. Its document actions are limited to photos.
2. **An allow list.** `SANITY_STUDIO_OWNER_EMAILS` names the accounts that get the
   simple desk. If one of those accounts opens the full desk at `/full` instead, it
   still sees the Photos only desk and the Photos only actions.

Both of these are interface, not security. Be honest with the client about this:

- On the free plan the owner is an Administrator, because that is the only role
  that can publish. He can write anything in the dataset and change any project
  setting at https://www.sanity.io/manage. The Studio can hide the reviews and
  the pages from him, but the Sanity API cannot. Anyone determined enough could
  edit other content through the API or through another Studio.
- The allow list is read from an environment variable that is baked into the built
  Studio at deploy time. Changing it means deploying the Studio again.
- If the plan later includes custom roles, the honest fix is a real role that
  grants create, update, and publish on `photo` only. The desk here stays useful
  either way, because it is what makes the flow simple on a phone.

The risk is small in practice. The people with access are the owner, his family,
and the agency, and the site can be rebuilt from git and from the dataset history.

Two things seen when the desk was tested on a phone on 3 October 2026:

- The Add photo bar hides while a photo is open. Before that it covered the
  Publish button on a phone. `components/OwnerAddPhotoLayout.tsx` decides this
  from the router state, so it depends on the owner's desk staying two panes
  deep: the list, then one photo.
- Opening Add photo saves a draft straight away, holding only the default
  values (the slider switch off, a sort position). If he backs out, that empty
  draft stays in his list. It never reaches the site, which reads published
  documents only, and the owner guide tells him to delete it.

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
