---
name: launch-store
description: Create a new Louez rental store and take it online, step by step. Use it when the user wants to start a rental shop, open a new store or location on Louez, or finish setting up and launch a store that is still offline.
---

# Launch a store

Take the user from "I want to rent out surfboards in Brest" to a store that
customers can book. Ask for what you don't know; don't invent business
details (prices, address, legal identity).

**Some assistants can't create stores.** If you have no `stores_create`, ask
the user to create the store in Louez themselves, then carry on from step 3
with the new store.

## 1. Check the web address

Ask for the store's name, country, currency, address, contact e-mail and
phone. Then call `stores_check_slug_availability` with the slug you'd like (a
name works too). It answers `available`, the `reason` when not, and up to
three free `suggestions`. Let the user pick.

## 2. Create the store

Call `stores_create` with `name`, `slug`, `country` (ISO code such as `FR`),
`currency` (such as `EUR`), `address`, `email`, `phone`, and an
`idempotencyKey` so a retry never creates a second store.

Before calling, sum up what you will create (name, address, country,
currency) and get the user's yes. With confirmations on (the default), the
first call answers `CONFIRMATION_REQUIRED` with a preview, which also shows the
pricing Louez applies: show it, wait for the user's yes, then call again with
the `confirmationToken`. With confirmations off, the first call creates the
store at once.

The store is created **offline**. Use its `id` as `storeId` from now on.
Creating a store needs a connection with "Read and edit" rights on all the
user's stores; if it is refused, the user can change that in Louez.

## 3. Fill it in

These tools are in the "Catalog" and "Settings" groups. If you don't see them,
ask the user to add those groups to this connection in Louez (Settings >
Integrations > MCP).

- **Catalog**: `categories_create`, then `products_create` for each product
  with its price, deposit and stock. Seasonal prices:
  `products_create_seasonal_pricing`.
- **Store details**: `settings_get` shows every setting. Then
  `settings_update_store_info` (description, contact, coordinates),
  `settings_update_business_hours`, `settings_update_reservation_rules`,
  `settings_update_delivery`, `settings_create_location` (pickup points),
  `settings_update_taxes`.
- **Legal**: `settings_search_company_registry`, show the matches, then
  `settings_update_legal_profile` with the one the user picks. You may draft
  the terms and legal notice from the store's data; show the draft and save it
  with `settings_update_legal` once the user agrees.
- **Storefront**: images through `online_store_create_image_upload` and
  `online_store_complete_image_upload` (or `online_store_upload_image`), then
  `online_store_update_appearance` for the logo and banner.
- **Online payment** (optional): `payments_start_stripe_onboarding` returns a
  link for the user to open themselves. Without Stripe, customers send booking
  requests the store accepts or refuses.

## 4. Check what's missing

Call `stores_get_launch_checklist`. Each item is `done`, `missing` (a
`required` one blocks the launch), `optional`, `blocked` or `unverified`, with
why it matters and the tools that fix it. Fix what you can; tell the user
what only they can do, with the item's link. Pass on its `warnings`: they say
what the law of the store's country asks.

## 5. Go live

Ask the user before calling `stores_go_live` (optionally with
`reservationMode`: `payment` or `request`): with confirmations off, it puts
the store online at once. With confirmations on, it answers
`CONFIRMATION_REQUIRED` with a preview: the public address, how customers
book, what is still missing. Show it, wait for the user's yes, then call again
with the `confirmationToken`. It returns the storefront's address and the
store's `links`: give them to the user as they are.

The user can also finish in the Louez dashboard at any point, from the
store's dashboard link: everything you filled in is there.
