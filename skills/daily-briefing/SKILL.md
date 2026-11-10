---
name: daily-briefing
description: Brief the user on their Louez rental store for today. Use it when they ask what's on today, what's happening at the shop, what needs their attention, which pickups and returns are due, or what is late.
---

# Daily briefing

Answer "what's on at my shop today?" in one short, ordered summary. Read
only: nothing in this briefing changes the store.

## Steps

1. **Store.** If you don't have a `storeId` yet, call `stores_list`. With
   several stores and no store named, ask which one, or brief each in turn if
   the user wants all of them.
2. **What needs attention.** Call `inbox_list` with the `storeId` and no
   cursor. Each item has a severity (`critical`, `warning`, `info`), one
   sentence to tell the user, the tools that act on it and `links`. Keep the
   `nextCursor`: called again with it later, `inbox_list` returns only what is
   new.
3. **Today's pickups and returns.** Call `reservations_list_upcoming` with
   `days: 1` for today only (the default is 7 days, which suits "this week").
   For a window with units and delivery legs, use
   `reservations_get_planning_timeline` with `from` and `to` (ISO 8601).
4. **Late returns.** Call `reservations_list_overdue`: ongoing bookings past
   their end date, longest overdue first, with the days late.
5. **Figures, if asked or useful.** Call `get_dashboard_stats` with
   `period: "7d"` for the past week (also `30d`, `90d`, `12m`).

## How to present it

- Start with what can't wait: critical inbox items and late returns.
- Then today's pickups and returns in time order: time, customer, what they
  take or bring back.
- Then other inbox items, grouped, in a sentence each.
- End with the figures in one line, if you fetched them.
- Put each record's link from `links` next to it, as it is. Never build a
  Louez URL.
- If nothing is due, say so in one line.

## Follow-ups

The user may want to act on what you found: accept a request
(`reservations_update_status`), record a payment (`record_payment`), return a
deposit (`return_deposit`). These ask for confirmation: show the preview and
wait for the user's yes before calling again with the `confirmationToken`
(see the `get-started` skill).

If the user asks you to keep an eye on the store, call `inbox_list` with the
last `nextCursor` every few minutes, not more often.
