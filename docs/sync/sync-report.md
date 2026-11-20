# Frontend ↔ crm-be sync report

Date: 2026-11-20 · Branches: `crm-be` **`feat/frontend-sync`** (from `integration-branch` = `origin/prod` @ `ca01a1d`), `Power_Point_Tribe_Frontend` **`feat/frontend-sync`** (from `dev` @ `03d9447`). Nothing is pushed.

The website now talks only to crm-be. Everything it needed that crm-be lacked was added to crm-be as **additive** changes in crm-be's own conventions (NestJS modules, class-validator DTOs, `ResponseUtil` envelopes, `createPaginatedResult`, `module:action` permissions, `@AuditLog`, Swagger). Gap analysis and decisions: `Power_Point_Tribe_Frontend/docs/sync/gap-analysis.md`.

## 1. Results

| Check | Before (`origin/prod`) | After |
|---|---|---|
| crm-be `npx jest` (CI suite) | 10 suites / 10 tests pass | **16 suites / 58 tests pass** |
| crm-be `npm run test:int` (new, local MongoDB) | n/a | **10 suites / 138 tests** (see §7.1 for the stability fix) |
| crm-be `tsc --noEmit` / `nest build` | 0 errors / ok | 0 errors / ok |
| Frontend `typecheck` / `lint` / `build` | (old API) | 0 errors / 0 errors / builds (64 routes, PPR shape unchanged) |
| Frontend `npm test` (new, vitest) | n/a | **42 tests pass** (mappers, form adapter, iCal, admin BFF) |
| Frontend `npm run test:contract` (new) | n/a | **10 tests pass** against a running local crm-be |
| Manual walk-through (local crm-be + `next start`) | | every public page renders live data (§6) |

## 2. Added to crm-be

### 2.1 Security fixes (requested)

| Commit | Change |
|---|---|
| `b6e9418` | `POST /upload/sign` now needs a staff or portal token. `POST /upload/image` stays public (public forms use it) but anonymous uploads are capped at 5 MB, 5/min per IP, stored under `public-uploads/<folder>`; every image is checked by magic bytes. Signed-in callers unchanged. [`src/upload/upload.controller.ts`](../../src/upload/upload.controller.ts), [`src/upload/guards/`](../../src/upload/guards/) |
| `2ba3f65` | Public event routes (`/events/public/:slug`, register, partner, testimony/feedback forms, public Q&A) treat **draft** events as not found. [`src/events/utils/public-event-filter.util.ts`](../../src/events/utils/public-event-filter.util.ts) |
| `9ae9af0` | `POST /workers-training/trainees/public-enrollment` validates its body ([`dto/public-enrollment.dto.ts`](../../src/workers-training/dto/public-enrollment.dto.ts)): ObjectId cohort, 1-50 trainees, length caps, unknown fields stripped. Malformed ids no longer cause a 500. |

### 2.2 New modules, collections and endpoints

All new collections are prefixed `web_` (precedent: `store_products`). Full endpoint tables: [README → Website API](../../README.md#website-api-public-website).

| Area | Collections | Endpoints | Files |
|---|---|---|---|
| Website content | `web_settings`, `web_sermons`, `web_series`, `web_devotionals`, `web_pastors`, `web_testimonies`, `web_snippets`, `web_faqs` | public `GET /website/public/*`; staff CRUD `/website/<resource>`, `/website/settings` | [`src/website/`](../../src/website/) |
| Website inbox | `web_form_submissions`, `web_subscriptions` | `POST /website/public/forms/{visit,partner,care-dropoff,dc-interest,event-notify}`, `POST /website/public/subscriptions`; staff `/website/submissions*`, `/website/subscriptions*`, `/website/summary` | [`src/website/services/website-forms.service.ts`](../../src/website/services/website-forms.service.ts) |
| Giving | `web_giving_accounts`, `web_donations`, counter | `/giving/public/{accounts,providers,donations}`, staff `/giving/accounts*` (maker ≠ checker), `/giving/donations*` (+totals, CSV) | [`src/giving/`](../../src/giving/) |
| Lost & found | `web_lost_items`, `web_lost_item_claims` | `/lost-found/public/items*`, staff `/lost-found/items*`, `/lost-found/claims*`, daily expiry cron | [`src/lost-found/`](../../src/lost-found/) |
| Website images | — | `POST /upload/website-image` (staff; no crop; metadata stripped) | [`src/upload/upload.controller.ts`](../../src/upload/upload.controller.ts), [`src/common/services/storage.service.ts`](../../src/common/services/storage.service.ts) |

Plan a visit (decision Q4) stores an inbox submission, creates or links a **CRM first-timer** (`dateOfVisit` = planned date, `howDidYouHear: website`, phone required) and emails a confirmation through the editable template `website.visit-confirmation` ([`src/bulk-email/default-templates/website.defaults.ts`](../../src/bulk-email/default-templates/website.defaults.ts)).

### 2.3 New fields on existing models (all optional, with defaults; no backfill)

| Model | Field | Default | Endpoint |
|---|---|---|---|
| `Branch` | `website { showOnWebsite, venue, mapUrl, photoUrl, serviceTimes, order, pastor }` | `{ showOnWebsite: false, serviceTimes: [], order: 0 }` | `PATCH /branches/:id/website`, `GET /branches/public/website` |
| `Event` | `website { showOnWebsite, kind, typeLabel, featured, link }` | `{ showOnWebsite: false, kind: 'one_off', featured: false }` | `PATCH /events/:id/website`, `GET /events/website`, `/events/website/next` |
| `Product` | `category`, `byline`, `badge` | `null` | existing product DTOs |
| `Order` | `channel` (`crm`\|`website`), `fulfilment { method, branch, branchName }` | `crm`, `{ method: 'delivery' }` | `POST /store/public/orders` (optional fields) |
| `AuditEntity` enum | `WEBSITE_CONTENT`, `WEBSITE_SETTINGS`, `WEBSITE_SUBMISSION`, `GIVING_ACCOUNT`, `DONATION`, `LOST_ITEM`, `LOST_ITEM_CLAIM` | — | — |

Existing response shapes are unchanged. Existing CRM delivery orders behave as before (redirect URL byte-identical); the store webhook hands `PPTG-` references to giving and is otherwise unchanged.

### 2.4 Infrastructure

- `MONGODB_TLS=false` (local only; ignored when `NODE_ENV=production`) — `c4e3181`.
- `npm run test:int` + `src/test-utils/*-spec.ts` (local MongoDB, refuses non-localhost / non-`_test` databases) — `bd20c3a`, `c24a9af`.
- `npm run seed:website` (local only; refuses production, remote hosts and non-local db names) — `e39f26a`.
- Indexes added: see each schema (`web_*` filters/sorts; `{status, 'website.showOnWebsite', startDate}` on events; `{ 'website.showOnWebsite', 'website.order' }` on branches; `{ isActive, category }` on products).

## 3. Frontend changes (per domain)

| Domain | Change |
|---|---|
| Data layer | One server client [`src/lib/api/client.ts`](../../../Power_Point_Tribe_Frontend/src/lib/api/client.ts) (env base URL, timeout, one `ApiError`), Zod schemas + mappers per domain in `src/lib/api/<domain>/`, UI types in `src/types/domain/`. `queries.ts` keeps the same cached functions, so pages didn't change. |
| Config | Removed `REVALIDATE_SECRET` + the signed revalidation webhook and the `/api/v1` rewrite. New env: `API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_IMAGE_ORIGINS`, `NEXT_PUBLIC_CRM_URL`, `MOCK_MEDIA_API` (`.env.example`). |
| Campuses | No hard-coded slugs; one cached read feeds `CampusesProvider` / `getCampusOptions()`. |
| Forms | `src/lib/forms.ts` posts browser → crm-be directly (per-visitor rate limits) and maps bodies/errors (campus→branch, kobo→Naira). Visit form: phone required. No Idempotency-Key. |
| Sermons / series / events | Live listing; "load more series" via `/api/series`; month grouping in each event's timezone; one-off `.ics` built as a `data:` download. |
| Give | Flutterwave only (provider list from the API); thank-you status via BFF `/api/payments/status`. |
| Shop | Live store; pickup **or** delivery; size+colour variants; two-call checkout; order status via BFF (the store's verify response never reaches the browser). |
| Care Closet | Live lost & found + claims. |
| Media | Pending: agreed `/media-library/public/*` contract, empty state on 404, dev-only MSW mock (`MOCK_MEDIA_API=true`). |
| Admin | `/admin` re-platformed (`ac3b7bf`): CRM sign-in via BFF (JWT in an `HttpOnly; SameSite=Strict; Path=/admin` cookie, never exposed), allow-list adapter at `/admin/api/*` with an Origin check on writes, revalidates public cache tags after writes. Events, campuses and products are **edit-only website fields** (created/managed in the CRM). Removed (now in the CRM): users, audit, orders, MFA, magic link, Google sign-in, set-password, media screens. |

## 4. Doc ↔ code discrepancies found in crm-be (not fixed unless stated)

1. README/CLAUDE.md: NestJS 10, `PORT=3001`, `JWT_EXPIRES_IN`, scripts `test:e2e`/`migrate`/`lint:fix`, modules `attendance/ministries/units`, `GET /auth/me`, `PATCH /auth/change-password`, a separate `User` model, `POST /upload`, "Bull Board not secured", "27 modules" — none match the code (Nest 11, `PORT` 3000, `JWT_EXPIRATION`, no such scripts/modules/routes, users are `Member`s, `/upload/image|sign|document|video|presign`, Bull Board has basic auth, 28 modules).
2. `docs/api/*.docs.ts` are not wired in (Swagger comes from decorators).
3. **`package-lock.json` is out of sync with `package.json` on `prod`**: `npm ci` (used by both deploy workflows) refuses to install with current npm (missing `@napi-rs/nice-*` optional deps). Verify the CI npm version or regenerate the lockfile.
4. **Fresh-database super admin can't log in**: `AutoInitService` hashes `SUPER_ADMIN_PASSWORD` and `MembersService.create` hashes it again. (Existing production admins are unaffected.)
5. **Audit logging is disabled app-wide**: the `AUDIT_LOGS` queue is not enabled in `queue.module.ts`, so every `@AuditLog` (old and new) is skipped. The new routes are wired correctly and will log once it's re-enabled.
6. Error handling: no exception filter; some routes return HTTP 200 `{ success: false }` for "not found" (`GET /branches/:id`, first-timer branch form config).
7. `GET /first-timers/pending-district` is declared after `GET /first-timers/:id` and is unreachable.
8. `PATCH /branches/:id` takes `Partial<Branch>` (an interface): the body is not validated or whitelisted. (Website fields use the new validated `PATCH /branches/:id/website` instead.)
9. `POST /events/public/:slug/partner` types its body inline, so it isn't validated.
10. `FirstTimersService.findDuplicate` builds a regex from the raw first name (regex injection / ReDoS on the public first-timer routes). The website visit form uses an escaped match instead.
11. `EmailTemplateResolverService.substituteVariables` doesn't HTML-escape values; existing templates receive user names unescaped. Website emails escape every value.
12. Store: webhook credits orders from the payload without re-verifying with Flutterwave; any webhook is accepted when `FLUTTERWAVE_HASH` is unset; `verifyPayment` only rejects too-low amounts and never checks currency, and returns the full Flutterwave transaction on failure; product search passes raw input to `$regex`; `createProduct` passes `user.sub` (unset), so `createdBy` is random; public products expose `createdBy`.
13. Duplicate index declarations on existing schemas (e.g. `Branch.slug`, store `Product.slug`, `Member.email`): Mongoose logs "Duplicate schema index" at boot and its index sync fails for those models.
14. Event data mixes conventions: seeders store full date-times in `startDate`, sometimes inconsistent with `startTime` (`cmit`: `10:00Z` vs `"10:00"`). The website uses `startDate`/`endDate` as the instants and shows `startTime`/`endTime` as given.
15. Existing Jest specs on `master` all fail (they pass on `prod`).

Frontend (pre-existing, not a regression): an unknown series slug renders the not-found UI with HTTP 200 (`notFound()` runs after streaming starts).

## 5. Remaining mocks, TODOs, open questions

- **Media (mock):** `/media-library/public/*` (folders, albums, album, items, downloads) is an agreed contract with an MSW mock only (`src/mocks/media.ts`). Backend still to build; then delete the mock.
- **Campus slugs:** confirm the production branch slugs and switch `website.showOnWebsite` on for the three campuses (data step, §8).
- **Live stream badge:** `sermons/latest` always returns `live: false` (Q12).
- **Admin gaps:** no "assignable staff" list for submissions (assignee picker offers only the signed-in user); the event edit page needs `events:view-details` as well as `events:view`; crm-be login answers 400 (validation) for very short passwords instead of 401; crm-be deletes are permanent (no restore bin).
- **Throttling behind proxies (R1):** public reads use `@SkipThrottle()`; writes are per-IP and the browser posts them directly. Admin traffic goes through the BFF and shares the Next server's IP within the global 300/min limit.
- **PII at rest:** new collections store contact details in plaintext, like the rest of crm-be (R9). Staff lists mask claimant phones.
- Decide on the discrepancies in §4 (especially 3, 4, 5 and 12).

## 6. Manual walk-through (local)

crm-be built and run from an isolated directory with a local-only `.env` (rs0 MongoDB without TLS, local Redis, `CRONS_ENABLED=false`, email pointed at a dead local port); seeded with `npm run seed:website`; website built with `next build` and served with `next start`. Every page returned 200 with live content: home (service strip, SOZO countdown, devotionals, campuses), campuses (venues, pastors), sermons (+ service filter), series detail, events (+ campus filter), ministries (12 units, tribe groups), give (NGN + foreign accounts, FAQ), about (pastors, testimonies), visit, shop (+ category filter), care closet (lost items), media (empty state). Forms, claims and the visit → first-timer flow were verified against the database; admin flows were verified with curl (login cookie, draft → publish, event/campus opt-in, inbox update, giving draft, cross-origin 403, unknown path 404). Not verified: real Flutterwave payments and real image uploads (no keys locally).

## 7. Notes for reviewers

### 7.1 Integration test stability
`openTestDb` empties its database on open and drops it on close, and specs `await db.ready()` (all models' `init()` settled) before inserting fixtures. Without this, Mongoose's background collection/index creation raced with fixtures and recreated databases after the drop, which made the suite flaky.

### 7.2 Why some things look the way they do
- Website content lives in new `web_*` collections, not in CRM `groups`/event testimonies (Q6): they are marketing copy, per-branch CRM groups are operational.
- Public reads skip throttling; public writes are 5/min per IP; the browser posts writes directly so the limit is per visitor.
- `PATCH /branches/:id/website` and `PATCH /events/:id/website` were added instead of changing the existing PATCH routes (additive only).

## 8. Deployment notes (in this order)

1. **Fix or confirm `npm ci`** on the deploy runners (§4.3) before merging, or the deploy job may fail at install.
2. **Environment (crm-be):** set `WEBSITE_URL` (website origin, e.g. `https://powerpointtribe.org`) and add the website origin to `CORS_ORIGINS`. Do **not** set `MONGODB_TLS`. `FLUTTERWAVE_SECRET_KEY` / `FLUTTERWAVE_HASH` enable online giving (already used by the store).
3. **Deploy crm-be.** On start, `AutoInitService` registers the new `website:*`, `giving:*`, `lost-found:*` permissions and gives them to Super Admin. Mongoose creates the new collections and indexes (all on new collections or additive on existing ones; no migration).
4. **Assign permissions to roles** in the CRM roles screen (e.g. content editors: `website:*-content`; finance: `giving:*`; Tribe's Heart desk: `lost-found:*`; publish rights: `website:publish-content`).
5. **Data steps (by staff, in the CRM/website admin, not scripts):** confirm the campus slugs; switch `website.showOnWebsite` on for the three campuses and fill venue/map/service times; enter giving accounts (a second person approves each); opt events into the website; enter content (sermons, series, pastors, units, FAQs, settings). Optionally edit the `website.visit-confirmation` email template.
6. **Environment (website):** `API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL` (build-time), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_IMAGE_ORIGINS` (Cloudinary and/or the R2 public base URL, for CSP and `next/image`), `NEXT_PUBLIC_CRM_URL`. Remove `PPT_API_URL` and `REVALIDATE_SECRET`. Leave `MOCK_MEDIA_API` unset.
7. **Build and deploy the website**; smoke-test with `npm run test:contract` against staging first.
8. Flutterwave dashboard: the existing webhook URL (`/api/v1/store/webhook/flutterwave`) now also settles donations; no change needed.
