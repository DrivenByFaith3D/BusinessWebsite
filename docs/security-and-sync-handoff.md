# Security and Etsy sync fixes

## Changes

- Upgrade Next.js 14 to 16.4.0, React to 19.2.4, and NextAuth to 4.24.15. Migrate the admin product route to async params and the authentication middleware to `proxy.ts`. The existing credentials login, admin role checks, and guest product checkout remain in place.
- Upgrade Tailwind and its PostCSS integration to 4.3.3; explicitly load the existing brand theme and preserve the old shadow, outline, border, and button defaults. Tailwind 4 requires modern browsers (Safari 16.4+, Chrome 111+, Firefox 128+); visually review key pages before release.
- Remove the unused Auth.js Prisma adapter. It was installed but not referenced by the credentials authentication implementation.
- Update Undici and PostCSS overrides to patched versions. Replace `eslint-config-next`, whose `braces` dependency has no published patched version, with React/hooks checks and TypeScript parsing. Next-specific ESLint rules are temporarily unavailable; the production build still runs Next.js type validation. Remove obsolete Next lint suppressions.
- Distinguish incomplete inventory (`null`) from confirmed no variations (`[]`). Reject malformed options or offerings. Preserve saved options and `hasVariations` on incomplete responses. Newly imported products with unknown options stay unavailable until a complete sync. Report partial sync warnings in the admin screen and refresh the catalog without erasing that report.
- Validate every incoming gallery image before replacing any photos. Only HTTPS Etsy image URLs are accepted. Product metadata, gallery replacement, and option replacement now share a Prisma transaction. An insertion failure rolls back that product's changes; the entire shop sync is not one transaction.
- Weight the overall average by review count, including both site and Etsy reviews attached to products. One 5-star review and one hundred 1-star reviews now average 105/101, rather than 3 stars.
- Require `CRON_SECRET` for scheduled product sync even when the environment variable is absent. Manual sync remains restricted to administrators.

## Initial security warning classification

`npm ci` initially reported 22 affected package entries: 4 critical, 15 high, 3 moderate. These include transitive entries and are not 22 distinct vulnerabilities.

| Area | Exposure in this app | Resolution |
| --- | --- | --- |
| Next.js and its dependencies | Deployed server, App Router, image optimizer. Some advisories affect configurations not used here, such as Windows hosting or Pages Router i18n; the package still required patching. | Next 16.4.0 and patched PostCSS |
| NextAuth | Deployed login/session code. Email-provider and multi-provider OAuth advisories are not exercised by this credentials-only configuration. | NextAuth 4.24.15 |
| Auth.js core / Prisma adapter | Installed through an unused adapter; not used by the current login implementation. | Remove unused adapter |
| Undici / Vercel Blob | Deployed file upload client dependencies; exploitability depends on the affected HTTP feature and input. | Undici 6.29.0 override |
| PostCSS and related CSS packages | Build-time CSS processing, including a copy formerly nested under Next.js. | Patched packages and override |
| Tailwind / glob / pattern matching / browser metadata | Development and build tools, not customer request handlers. | Tailwind 4, lockfile updates |
| Next ESLint config / braces | Development linting; the latest config still depends on an unpatched braces release. | Replace the config instead of ignoring the warning |

## Verified locally

- `npm audit`: zero vulnerabilities across all dependencies.
- `npm audit --omit=dev`: zero vulnerabilities in production dependencies.
- `npm run build`: successful Next.js production build.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm test`: eight regression tests passed. Gallery rollback coverage uses a transactional test double; a real PostgreSQL fault-injection check is still required on staging.
- Production-server HTTP checks: login page 200, providers/session endpoints 200, unauthenticated admin redirect to login, scheduled sync 401 with no secret, manual sync 403 for an anonymous caller, order checkout 401 without authentication, empty guest cart 400, local image optimization 200.

## Before production release

Use a preview with its own database and Stripe test-mode keys. The existing Vercel project has a Preview environment, but it is incomplete: `DATABASE_URL`, `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are scoped only to Production. Preview has imported database variables under other names, but this app reads `DATABASE_URL`. No custom staging environment or Git staging branch was found. Some Blob, Etsy, and Supabase entries are shared between Preview and Production. A separate preview database and Stripe test-mode configuration must be established before mutating tests. Production secrets were not copied to preview.

1. Test successful customer login, successful admin login, and rejection of customer access to admin pages/API routes.
2. Test a complete Etsy sync and simulate an unavailable detail endpoint. Verify saved options remain and the admin screen reports a partial sync.
3. Force a gallery insertion failure in staging PostgreSQL; confirm old images, thumbnail, and product options remain intact.
4. Check storefront cards, galleries, option selection, color image overrides, cart thumbnails, and admin pages on desktop/mobile after the framework/CSS upgrade.
5. Complete a Stripe test checkout with an option-bearing product and verify the test webhook/order flow. Confirm sold-out and missing-option requests are rejected.
6. Confirm `CRON_SECRET` exists and matches the scheduled request's Bearer token. Confirm the project uses Node.js 22.13+ (current Vercel project runtime: 24.x).
7. Merge/publish only after these staging checks pass. No schema migration is required by these changes.

No production deployment, production sync, real payment, or customer notification was performed during implementation.
