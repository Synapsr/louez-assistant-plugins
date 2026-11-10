<p align="center">
  <img src="brand/louez-icon.png" alt="Louez" width="96" height="96">
</p>

# Louez for AI assistants

[Louez](https://louez.io) is software for rental shops: bikes, surfboards,
skis, boats, event gear. Shops take bookings online, manage their stock,
contracts, deposits and payments, and run their team from one place.

This repository holds the plugins that connect Louez to AI assistants. With
them, your assistant can tell you what's on at the shop today, manage
bookings, build your catalog with seasonal prices, set up your store and
launch a new one. You sign in with your Louez account, with no key to copy,
and you choose which stores it reaches, whether it may change things, and
which groups of tools it sees. Money, deletions and messages to customers
wait for your approval.

Everything goes through Louez's MCP server:

```
https://app.louez.io/api/mcp
```

It is a remote server (Streamable HTTP) with OAuth sign-in. Clients can
register themselves (dynamic client registration) or use a client ID
metadata document.

## Install

### Claude

**claude.ai, the desktop app and mobile.** Open Customize > Connectors,
click "+ Add" then "Add custom connector", name it Louez and paste the
address above. Sign in to Louez when Claude asks you to, then choose what it
can do. Step-by-step guide: https://louez.io/en/help/ai-assistants

**Claude Code.** Install the plugin, which adds the server and the skills
below:

```
/plugin marketplace add Synapsr/louez-assistant-plugins
/plugin install louez@louez
```

Then type `/mcp` to sign in to Louez. To add the server alone, without the
skills:

```
claude mcp add --transport http louez https://app.louez.io/api/mcp
```

### Cursor

The Louez plugin is awaiting review for the Cursor Marketplace. Once listed,
install it from the Marketplace in Cursor. Until then, add the MCP server
with the "Add to Cursor" link on the
[help page](https://louez.io/en/help/ai-assistants), or copy this repository
to `~/.cursor/plugins/local/louez` and reload the window.

### Grok

**grok.com.** Open Grok's connectors, click "New Connector" then "Custom",
paste the address above and sign in to Louez.

**Grok Bot.** Louez will appear in Connect Apps once its plugin is approved
in the Cursor Marketplace, which also serves Grok Bot's catalog.

### ChatGPT and Codex

A ChatGPT and Codex plugin is coming. Until then, on ChatGPT Business,
Enterprise and Edu (web), a workspace owner or admin, or on Enterprise and Edu
a member they allow, opens Plugins, clicks "+" then "Add custom MCP server",
names it Louez, pastes the address above and chooses OAuth. ChatGPT can't create
a store: create it in Louez first, then let ChatGPT carry on.

### Other assistants

Any client that accepts a remote MCP server with OAuth sign-in connects with
the same address. For a tool that can't sign in with OAuth, create an API key
in Louez (Settings > Integrations > MCP) and send it in the `Authorization`
header.

## Skills

The plugins ship three skills, shared by every format:

| Skill | What it does |
| --- | --- |
| [`get-started`](skills/get-started/SKILL.md) | How to work in Louez: the first call, confirmations, links, steps only the user can take |
| [`daily-briefing`](skills/daily-briefing/SKILL.md) | "What's on at my shop today?": inbox, pickups and returns, late returns, figures |
| [`launch-store`](skills/launch-store/SKILL.md) | Create a store, fill it in, check what's missing and take it online |

## What you allow

After you sign in, Louez shows a permission page. Nothing is shared until you
click "Allow".

- **Stores**: one, several, or all of them, including future ones.
- **Rights**: read only, or read and edit, always within your role in each
  store.
- **Confirmations**: on by default. Before a sensitive action (a payment, a
  deletion, a message to a customer, an answer to a booking request, a store
  going online), Louez answers with a preview and acts only when the
  assistant calls again with that preview's token. The assistant is told to
  show you the preview and wait for your yes; Louez cannot check that you
  said it. Payments always ask, even with confirmations off.
- **Tools shown**: "Daily operations" by default; add "Catalog", "Settings",
  "Team" or "Subscription" as you need them.

You can change or remove this access at any time in Louez, under Settings >
Integrations > MCP.

## Repository layout

```
.claude-plugin/plugin.json        Claude Code plugin manifest (registers the MCP server)
.claude-plugin/marketplace.json   Claude Code marketplace with this one plugin
.cursor-plugin/plugin.json        Cursor plugin manifest
skills/                           Skills shared by every format
brand/                            Louez icon (SVG, and a 512 px PNG)
.github/                          CI: checks the manifests and skills
```

The root `plugin.json`, `mcp.json` and `assets/` are kept for the ChatGPT and
Codex plugin ([Agent Plugins](https://agent-plugins.org) format).

To check your changes:

```
npm install --no-save --no-package-lock ajv@8 ajv-formats@3
node .github/scripts/validate.mjs
claude plugin validate --strict .
```

When you change a plugin, bump `version` in its manifest: Claude Code only
offers an update when it changes, and Cursor reviews each version.

## Privacy, terms and support

- Privacy policy: https://louez.io/en/legal/privacy-policy
- Terms of service: https://louez.io/en/legal/terms
- Help: https://louez.io/en/help/ai-assistants
- Support: contact@louez.io

The Louez application itself is open source under the AGPL at
[Synapsr/Louez](https://github.com/Synapsr/Louez). This repository contains
no Louez code.

## License

[MIT](LICENSE), © 2026 LUMY.MEDIA SAS.
