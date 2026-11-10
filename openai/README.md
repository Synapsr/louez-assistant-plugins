# Louez.io for ChatGPT and Codex

The package uploaded to OpenAI's Plugin Directory (platform.openai.com/plugins).
It uses the [Agent Plugins](https://agent-plugins.org) format with OpenAI's
`extensions.com.openai` block.

| Path | What |
| --- | --- |
| `plugin.json` | Manifest: listing, review test cases, publication |
| `mcp.json` | The remote server `https://app.louez.io/api/mcp`, streamable HTTP, OAuth (CIMD, falls back to DCR) |
| `assets/` | Duo logos 512 px (light, on #212121) and composer icons 256 px, rendered by `scripts/render-openai-assets.mjs` from `brand/duo.svg` |

The ZIP also carries the shared `skills/get-started` and `skills/daily-briefing`.
`skills/launch-store` is never packaged: Louez does not give ChatGPT or Codex
the tool that creates a store.

## Build

```
node scripts/build-openai-zip.mjs          # dist/louez-openai-<version>.zip
node scripts/build-openai-zip.mjs --draft  # builds even while a placeholder remains
```

Before writing anything the script checks OpenAI's documented limits (name,
descriptions, capabilities, prompts, colors, images), exactly 5 positive and 3
negative test cases, the skills, and refuses: tools ChatGPT never gets
(`stores_create`, `billing_*`), wording about creating a store, pricing or
promotion words, the word "password", and any e-mail address other than the
author's. Reviewer credentials go in the portal (Review details), never in the
ZIP.

The only placeholder is `review.demo_recording_url`: the demo video's public
link (2 to 3 minutes, desktop and mobile, the consent page and the test
cases).

## Rules this relies on

Read on 2026-11-10 in
[submission](https://developers.openai.com/plugins/deploy/submission),
[submission errors](https://developers.openai.com/plugins/deploy/submission-errors),
[plugins](https://developers.openai.com/plugins/build/plugins),
[skills](https://developers.openai.com/plugins/build/skills),
[auth](https://developers.openai.com/plugins/build/auth) and
[guidelines](https://developers.openai.com/apps-sdk/app-submission-guidelines).

- `name` can never change; `version` must go up with every upload.
- Anything in the package (texts, images, skills, test cases) needs a new ZIP
  and a new review. Tool changes on the server do not: OpenAI rescans daily.
  The MCP URL can never change.
- The domain is proven by `https://app.louez.io/.well-known/openai-apps-challenge`,
  which serves the portal's token (Louez env `OPENAI_APPS_CHALLENGE`).
- No pricing, plans, trials, discounts or comparisons in the listing; physical
  goods only, no checkout links.

Where OpenAI's docs disagree, the portal decides:
- `description`: up to 4,000 characters in one table, 1,024 in the error list.
  Ours is far below both.
- The published `mcp.schema.json` has no `extensions` on a server, while the
  auth guide puts `extensions.com.openai.auth` there. We follow the guide; if
  the portal rejects `mcp.json`, drop that block and OAuth discovery finds the
  rest.
- Annotation justifications are "required" in the error list and "no longer
  required" in the guidelines. Be ready to give one sentence per tool in
  MCPs > Issues.

## Test cases

Played on the review account's demo store. Before submitting, check that its
bookings make each case true (one booking out with a customer, upcoming
bookings, a Surfboards category, wetsuits) and play the five cases in ChatGPT
and in Codex.

## Submitting

1. In the portal (organisation "Lumy", identity LUMY.MEDIA SAS): Upload new
   plugin, with the ZIP.
2. Put the domain token shown by the portal in `OPENAI_APPS_CHALLENGE`, then
   Verify domain.
3. MCPs > Connect: sign in with the review account and grant every tool group
   with "Read and edit": a tool missing from that scan stays unavailable.
   Read Issues.
4. Review details: the review account's e-mail and password.
5. Check the project's data residency is "global", accept the attestations,
   Submit for review. Once approved: Publish, and write to press@openai.com
   before announcing it.
