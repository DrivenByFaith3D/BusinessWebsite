# Customer and owner flow handoff

## Customer flow

- Shop carts remain in local storage through cancellations, errors, and the Stripe redirect. Only an authoritative paid Stripe session allows the confirmation page to remove purchased quantities. Items added afterward remain; a per-session marker prevents removal again on refresh.
- Personalization is entered before adding a personalizable product, required and limited to 500 characters. Different personalization creates separate cart lines. Details are validated on the server and snapshotted in the order, receipt, owner inbox detail, and confirmation email.
- Product pages put processing and checkout cost information beside the purchase button and add fixed mobile purchase controls. Website checkout preserves the existing policy of adding no shipping charge; synced Etsy shipping rates are explicitly labeled separately. Applicable tax remains a Stripe checkout calculation.
- Checkout collects a shipping address. Successful purchases receive an order number, itemized receipt, next steps, and a private tracking link. The owner adds tracking on the shop-order detail page. Unpredictable receipt tokens and no-index metadata prevent public order-number lookup from exposing purchase details.
- Main customer actions are “Shop Products” and “Request a Custom Print.” Consultation booking remains available on its existing page.

## Owner flow

- `/admin/inbox` combines custom requests, website shop purchases, and Etsy receipts. Search, channel, next-action, unread-message, and older-than-seven-days filters are available. Rows link to their channel's fulfillment tools. Existing custom order archive/export and Etsy label tools remain accessible.
- Both owner dashboards put unread messages, quote requests, production work, older open orders, payment problems, and integration health above the existing summaries. Seven days is an age indicator, not a promised delivery deadline.
- Integration health persists running/full-success/partial/failure status and the last full success. Etsy retry buttons run existing sync endpoints. A running lock prevents overlapping syncs; interrupted runs become retryable after fifteen minutes.
- Website purchases have an owner detail page with their address, options, personalization, payment state, production status, and tracking editor. Paid purchases continue to count toward reporting and verified reviews while in the new `printing` status.

## Payment and inventory invariants

- Prices come from the database, with per-unit rounding to cents. Quantities must be integers from 1 through 99; malformed lines are rejected rather than silently changed.
- Serializable database transactions reserve pending checkout quantities, aggregate demand across personalized lines, and retry serialization conflicts. Stable Etsy product IDs identify option inventory independently of syncs. Existing option row IDs are preserved during normal syncs so saved carts remain valid.
- Reservations are released only after Stripe confirms expiry/failure. A delayed paid webhook is reconciled before stock can be reused. Stripe session creation uses an idempotency key, and custom checkout also resumes its existing open session.
- A durable Stripe event marker commits with payment state and stock deduction. Repeated events don't decrement stock again, regress shipped orders, or send a second confirmation. Database failures return HTTP 500 so Stripe can retry. The receipt page can reconcile a verified payment before the webhook arrives.
- Local `websiteSold` counters prevent the next Etsy sync from undoing website stock deductions. Etsy itself is still an external sales channel: this release does not write website purchases into Etsy inventory. Stock is refreshed on the existing daily sync or a manual retry. Simultaneous Etsy/site sales between syncs remain an external coordination limit. If stock is manually reconciled directly in Etsy, reconcile the website counters too rather than counting the same sale twice.
- An unknown stock count on a manually created product remains made-to-order stock (`quantity = null`). Etsy products get a numeric total on product sync; the existing live product total was initialized during the deployment check. existing options already have numeric counts.
- Receipt email failures are visible in integration health for owner follow-up. Emails aren't a transactional provider outbox: a process interruption after payment commits can require manual follow-up. Payment and receipt records remain intact.
- Very old pre-upgrade pending rows without a Stripe session aren't counted as live reservations. Recorded legacy Stripe sessions are checked for expiry on checkout. Existing paid orders without a receipt token retain their previous account-order display.

## Database and release

`scripts/customer-owner-flow.sql` is an idempotent additive migration. Run it against the business production database before releasing the new application. It creates no destructive changes and enables RLS on the two new server-only tables with no public access policies. Existing application builds tolerate the added columns if a rollback is necessary.

Do not use `prisma db push` against production. For a database behind a transaction pool, run the reviewed statements sequentially inside one Prisma interactive transaction if the schema-engine CLI cannot connect. Use only the business project's production environment. Never copy secrets into GitHub, documentation, or logs.

## Verification

- Etsy retired Inventory/Shipping includes in July 2026. Public images and metadata now refresh independently from the new scoped inventory/shipping batch endpoints. The existing business connection only grants transaction permissions: the owner must reconnect once to grant `listings_r` and `shops_r`. Until then, inventory/shipping details remain partial and saved values stay intact. The dashboard shows the required reconnection link. See [Etsy’s migration guide](https://developer.etsy.com/documentation/tutorials/inventory-shipping-migration/).

- 14 unit/regression tests cover Etsy partial responses, gallery rollback, weighted ratings, cart recovery, personalization, quantity validation, and inbox next actions.
- 10 isolated PostgreSQL integration tests cover concurrent buyers, duplicate session creation, duplicate signed webhook deliveries, atomic payment/event rollback, delayed webhooks, stock preservation through sync, unlimited stock, custom-payment status preservation, and persistent/retryable sync health.
- The opt-in integration suite refuses non-loopback databases and requires the database name `flow_test`. Run `DATABASE_URL=<isolated loopback connection> npm run test:integration` after applying the schema to a disposable database. Stripe calls are mocked and no real payments or receipt emails are sent.
- Lint, TypeScript, production build, and production dependency audit pass.
- Local authenticated HTTP checks cover the inbox filters, dashboard, paid purchase detail, private receipt, unauthorized access, tracking URL validation, fulfillment PATCH, and the customer's resulting tracking page.
- A staged production build is verified using the business Vercel environment before changing the public domains. Production schema validation confirms the added columns, RLS, and unchanged existing record counts.
- Browser screenshot/device interaction checks were unavailable in this session; responsive controls were checked in code and server-rendered markup. No real card charge is required for these checks.
