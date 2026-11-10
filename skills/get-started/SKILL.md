---
name: get-started
description: How to work in a Louez rental store through the Louez MCP server. Use it the first time the user asks anything about their Louez store, their rental shop, bookings, products or customers, or when a Louez tool answers CONFIRMATION_REQUIRED.
---

# Working with Louez

Louez is software for rental shops: bikes, surfboards, skis, boats, event gear.
The Louez MCP server (`https://app.louez.io/api/mcp`) lets you work in the
user's stores on their behalf, within the rights they gave you when they
connected and within their role in each store.

## What you can do

- **Bookings**: what's on today and in the coming days, late returns, the
  planning, a booking's details, accepting or refusing a request, changing a
  status, cancelling, notes.
- **Catalog**: products with prices, deposits and stock, seasonal prices,
  variants, units, downtime, categories, images.
- **Customers and payments**: customer records, recording a payment,
  returning a deposit.
- **Figures**: revenue, bookings and visitors over a period, the products
  that earn the most.
- **Settings and online store**: store details, opening hours, booking rules,
  delivery, pickup points, taxes, legal texts, the storefront's look and web
  address, Stripe.
- **Team**: members and invitations.
- **New stores**: create one and take it online (see the `launch-store` skill).
- **The inbox** (`inbox_list`): what needs the user's attention now.

The tools you see depend on the groups the user ticked when they connected:
"Daily operations" by default, plus "Catalog", "Settings", "Team" and
"Subscription" if they added them. When the user asks for something whose
tool you don't have, say which group it belongs to: they can add it in Louez,
under Settings > Integrations > MCP.

## First call

1. Call `stores_list`. A connection can reach several stores.
2. Pass the chosen store's `id` as `storeId` to every other tool. If there are
   several stores and the user didn't say which, ask.
3. No store yet: offer to create one (`launch-store` skill), or let the user
   create it in Louez.

## Confirmations

Some actions answer `CONFIRMATION_REQUIRED` instead of running: anything that
moves money, deletes, archives, sends a message to a customer, answers a
booking request, puts a store online, or removes someone from the team. The
answer carries a preview and a `confirmationToken`.

1. Show the preview to the user in plain words: what will happen, to whom, for
   how much.
2. Wait for their explicit yes. Never confirm on their behalf, and never treat
   an earlier "go ahead" as approval for a preview they have not seen.
3. Once they agree, call the same tool again with the same arguments plus
   `confirmationToken`. The token works once and expires after 10 minutes; if
   it has expired or the arguments change, call again without it to get a new
   preview.

Recording, returning or deleting a payment always asks, even when the user
turned confirmations off. Treat every action that touches money as needing
the user's yes.

## Links

Records come with `links`: absolute URLs to their page in the Louez dashboard
and, when the public can see it, on the store's online store. When the user
wants to see or open something, give them these URLs exactly as they are.
Never build or guess a Louez URL. Without a link, name the record instead.

## Steps only the user can take

Some steps happen outside the chat: Stripe's identity checks, adding a billing
card, approving a team invitation. Their tool returns a link: give it to the
user as it is and never open it yourself. `handoffs_get` with the returned id
then tells you where the step stands, so the user does not have to report
back.

## Good habits

- Read before you change: `products_get` before `products_update`,
  `settings_get` before a settings change.
- Check a web address before using it: `stores_check_slug_availability`
  before `stores_create`, `online_store_check_slug_availability` before
  `online_store_update_slug`.
- Amounts are in the store's currency. Say the currency when you quote one.
- When a tool refuses for lack of rights, say so: the user's role or the
  rights they gave this connection don't allow it.

Help for users: https://louez.io/en/help/ai-assistants
