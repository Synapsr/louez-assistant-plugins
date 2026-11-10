#!/usr/bin/env node
/**
 * Builds the ZIP uploaded to OpenAI's Plugin Directory (platform.openai.com/plugins)
 * for Louez.io, after checking it against OpenAI's documented rules
 * (https://developers.openai.com/plugins/deploy/submission and .../submission-errors).
 *
 *   node scripts/build-openai-zip.mjs           dist/louez-openai-<version>.zip
 *   node scripts/build-openai-zip.mjs --draft   dist/louez-openai-<version>-draft.zip,
 *                                               even while a placeholder remains
 *
 * The package lives in openai/ (not at the repository root, where Cursor would
 * read plugin.json as its own manifest). The ZIP holds, at its root:
 * openai/plugin.json, openai/mcp.json, the images plugin.json names (paths
 * relative to openai/), and the shared skills/ in SKILLS below. Nothing else.
 * No dependency: Node 22 or later.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = path.join(root, "openai");
const draft = process.argv.includes("--draft");

/**
 * The skills ChatGPT and Codex get. launch-store stays out: an OpenAI client
 * cannot create a store (Louez withholds stores_create from it).
 */
const SKILLS = ["get-started", "daily-briefing"];

/** Tools an OpenAI client never gets (Louez's `clientWithholding`): never named in the package. */
const WITHHELD_TOOLS = /\b(?:stores_create|billing_[a-z_]+)\b/;

const CATEGORIES = [
  "Productivity",
  "Creativity",
  "Developer Tools",
  "Business & Operations",
  "Data & Analytics",
  "Communication",
  "Education & Research",
  "Security",
  "Finance",
  "Healthcare",
  "Travel",
  "Entertainment",
  "Other",
];

const errors = [];
const placeholders = [];
const fail = (message) => errors.push(message);
const check = (ok, message) => ok || fail(message);

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(path.join(pkg, file), "utf8"));
  } catch (error) {
    fail(`${file}: ${error.message}`);
    return {};
  }
};

const isText = (value) => typeof value === "string" && value.trim() !== "";
const oneLine = (value) => isText(value) && !/[\r\n]/.test(value);
const isHttps = (value, max = 1024) => {
  if (!isText(value) || value.length > max) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const isPlaceholder = (value) => typeof value === "string" && /TODO|TBD|XXX|<[^>]+>|_{3,}/.test(value);

/** WCAG contrast ratio of two #RRGGBB colours. */
function contrast(a, b) {
  const luminance = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Width and height of a PNG, from its IHDR chunk; null when it is not a PNG. */
function pngSize(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) return null;
  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

// ---------------------------------------------------------------------------
// plugin.json
// ---------------------------------------------------------------------------
const plugin = readJson("plugin.json");
const openai = plugin.extensions?.["com.openai"] ?? {};
const ui = openai.interface ?? {};
const review = openai.review ?? {};
const publication = openai.publication ?? {};

check(
  plugin.$schema === "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "plugin.json: $schema must be the agent-plugins 1.0.0 plugin schema",
);
check(
  isText(plugin.name) && plugin.name.length <= 64 && /^[a-z0-9][a-z0-9_-]*$/.test(plugin.name),
  "plugin.json: name must be lowercase letters, digits, - or _, at most 64 characters",
);
check(
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(plugin.version ?? ""),
  "plugin.json: version must be semver, and higher than the published one",
);
check(isText(plugin.description) && plugin.description.length <= 1024, "plugin.json: description, at most 1,024 characters");
check(isText(plugin.author?.name) && plugin.author.name.length <= 120, "plugin.json: author.name is required");
check(!plugin.author?.url || isHttps(plugin.author.url, 2048), "plugin.json: author.url must be HTTPS");
check(!plugin.homepage || isHttps(plugin.homepage, 2048), "plugin.json: homepage must be HTTPS");
for (const key of ["apps", "hooks", "mcpServers", "skills"]) {
  check(!(key in plugin), `plugin.json: "${key}" is not allowed at the root of a public package`);
}

check(oneLine(ui.displayName) && ui.displayName.length <= 30, "interface.displayName: one line, at most 30 characters");
check(!/\b(?:mcp|plugin)\b/i.test(ui.displayName ?? ""), 'interface.displayName: no "MCP" or "Plugin" (OpenAI naming rule)');
check(oneLine(ui.shortDescription) && ui.shortDescription.length <= 30, "interface.shortDescription: one line, at most 30 characters");
check(isText(ui.longDescription) && ui.longDescription.length <= 4000, "interface.longDescription: at most 4,000 characters");
check(oneLine(ui.developerName) && ui.developerName.length <= 80, "interface.developerName: one line, at most 80 characters");
check(CATEGORIES.includes(ui.category), `interface.category: one of ${CATEGORIES.join(", ")}`);
check(Array.isArray(ui.capabilities) && ui.capabilities.length <= 20, "interface.capabilities: an array of at most 20");
for (const capability of ui.capabilities ?? []) {
  check(oneLine(capability) && capability.length <= 120, `interface.capabilities: "${capability}" must be one line of at most 120 characters`);
}
for (const key of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
  check(isHttps(ui[key]), `interface.${key}: an HTTPS URL of at most 1,024 characters`);
}
const prompts = ui.defaultPrompt === undefined ? [] : [ui.defaultPrompt].flat();
check(prompts.length <= 3, "interface.defaultPrompt: at most 3");
check(new Set(prompts.map((p) => p.trim().toLowerCase())).size === prompts.length, "interface.defaultPrompt: prompts must differ");
for (const prompt of prompts) {
  check(oneLine(prompt) && prompt.length <= 128, `interface.defaultPrompt: "${prompt}" must be one line of at most 128 characters`);
  check(!prompt.includes("@"), `interface.defaultPrompt: "${prompt}" must not @mention`);
}
for (const [key, ground] of [
  ["brandColor", "#FFFFFF"],
  ["brandColorDark", "#212121"],
]) {
  if (ui[key] === undefined) continue;
  if (!/^#[0-9A-Fa-f]{6}$/.test(ui[key])) fail(`interface.${key}: #RRGGBB`);
  else check(contrast(ui[key], ground) >= 2, `interface.${key}: contrast with ${ground} below 2:1`);
}

// Images: the paths plugin.json names, square PNGs between 48 and 4,096 px, 5 MiB at most.
const files = new Map(); // path in the ZIP -> absolute path
const addFile = (relative) => {
  const clean = relative.replace(/^\.\//, "");
  files.set(clean, path.join(pkg, clean));
};
for (const key of ["logo", "logoDark", "composerIcon", "composerIconDark"]) {
  const value = ui[key];
  if (value === undefined) {
    check(key.endsWith("Dark"), `interface.${key} is required`);
    continue;
  }
  if (!isText(value) || !value.startsWith("./") || value.includes("..")) {
    fail(`interface.${key}: a path inside the package starting with ./`);
    continue;
  }
  const file = path.join(pkg, value);
  if (!existsSync(file)) {
    fail(`interface.${key}: ${value} does not exist`);
    continue;
  }
  const buffer = readFileSync(file);
  const size = pngSize(buffer);
  check(value.endsWith(".png") && size, `interface.${key}: ${value} must be a PNG`);
  check(buffer.length <= 5 * 1024 * 1024, `interface.${key}: ${value} is over 5 MiB`);
  if (size) {
    check(size.width === size.height, `interface.${key}: ${value} is not square`);
    check(size.width >= 48 && size.width <= 4096, `interface.${key}: ${value} must be 48 to 4,096 px`);
  }
  addFile(value);
}

// Review: exactly 5 positive and 3 negative cases, and the demo recording.
const positive = review.test_cases?.positive ?? [];
const negative = review.test_cases?.negative ?? [];
check(positive.length === 5, `review.test_cases.positive: exactly 5 (has ${positive.length})`);
check(negative.length === 3, `review.test_cases.negative: exactly 3 (has ${negative.length})`);
positive.forEach((test, i) => {
  for (const key of ["description", "prompt", "tools_triggered", "expected_behavior"]) {
    check(isText(test[key]), `review.test_cases.positive[${i}].${key} is required`);
  }
  check((test.description ?? "").length <= 4000, `review.test_cases.positive[${i}].description: at most 4,000 characters`);
});
negative.forEach((test, i) => {
  for (const key of ["description", "prompt"]) check(isText(test[key]), `review.test_cases.negative[${i}].${key} is required`);
});
if (isPlaceholder(review.demo_recording_url) || !isHttps(review.demo_recording_url, 2048)) {
  placeholders.push(`review.demo_recording_url is "${review.demo_recording_url}": put the demo video's public link`);
}
for (const key of ["test_credentials", "reviewer_instructions"]) {
  check(!(key in review), `review.${key}: credentials and reviewer notes go in the portal, never in the ZIP`);
}

// Publication.
check(isText(publication.release_notes), "publication.release_notes is required for a remote MCP submission");
check(
  publication.countries === undefined ||
    (Array.isArray(publication.countries) && publication.countries.every((c) => /^[A-Z]{2}$/.test(c))),
  "publication.countries: uppercase two-letter codes ([] for every country)",
);
for (const [locale, text] of Object.entries(publication.translations ?? {})) {
  check(text.subtitle == null || (oneLine(text.subtitle) && text.subtitle.length <= 30), `translations.${locale}.subtitle: one line, at most 30 characters`);
  check(text.description == null || text.description.length <= 4000, `translations.${locale}.description: at most 4,000 characters`);
}

// ---------------------------------------------------------------------------
// mcp.json
// ---------------------------------------------------------------------------
const mcp = readJson("mcp.json");
const servers = Object.entries(mcp.mcpServers ?? {});
check(mcp.$schema === "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json", "mcp.json: $schema must be the agent-plugins 1.0.0 MCP schema");
check(servers.length === 1, "mcp.json: exactly one MCP server");
for (const [name, server] of servers) {
  check(server.type === "streamable-http", `mcp.json: ${name} must be streamable-http`);
  check(isHttps(server.url, 2048), `mcp.json: ${name}.url must be HTTPS`);
  check(!server.headers || Object.keys(server.headers).length === 0, `mcp.json: ${name} must not send headers`);
  const auth = server.extensions?.["com.openai"]?.auth;
  check(auth?.type === "oauth", `mcp.json: ${name} must declare OAuth`);
  check(!JSON.stringify(auth ?? {}).includes("clientSecret"), `mcp.json: ${name}: no client secret in the package`);
}
addFile("plugin.json");
addFile("mcp.json");

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------
/** The frontmatter's `name` and `description`, and the body. */
function readSkill(file) {
  const text = readFileSync(file, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return null;
  const field = (key) => {
    const found = new RegExp(`^${key}:[ \\t]*(.*)((?:\\r?\\n[ \\t]+.*)*)`, "m").exec(match[1]);
    if (!found) return "";
    // A block scalar (`>` or `|`) or a plain value continued on indented lines.
    const head = /^[>|][+-]?$/.test(found[1].trim()) ? "" : found[1];
    const text = `${head} ${found[2]}`.replace(/\s+/g, " ").trim();
    return text.replace(/^(["'])(.*)\1$/, "$2");
  };
  return { name: field("name"), description: field("description"), body: match[2].trim() };
}

const listFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) return [];
      return entry.isDirectory() ? listFiles(full) : [full];
    });

for (const skill of SKILLS) {
  const dir = path.join(root, "skills", skill);
  const manifest = path.join(dir, "SKILL.md");
  if (!existsSync(manifest)) {
    fail(`skills/${skill}/SKILL.md is missing`);
    continue;
  }
  const parsed = readSkill(manifest);
  if (!parsed) {
    fail(`skills/${skill}/SKILL.md: no YAML frontmatter`);
    continue;
  }
  check(isText(parsed.name), `skills/${skill}: frontmatter name is required`);
  check(`${plugin.name}:${parsed.name}`.length <= 64, `skills/${skill}: "${plugin.name}:${parsed.name}" is over 64 characters`);
  check(isText(parsed.description) && parsed.description.length <= 1024, `skills/${skill}: description, at most 1,024 characters`);
  check(isText(parsed.body), `skills/${skill}: the body is empty`);
  for (const file of listFiles(dir)) files.set(path.relative(root, file).split(path.sep).join("/"), file);
}
if (openai.onboardingSkill !== undefined) {
  const target = String(openai.onboardingSkill).replace(/^\.\//, "");
  check(files.has(target), `onboardingSkill: ${openai.onboardingSkill} is not among the skills packaged (${SKILLS.join(", ")})`);
}

// ---------------------------------------------------------------------------
// Content rules, over every text file packaged
// ---------------------------------------------------------------------------
const listing = [
  ui.displayName,
  ui.shortDescription,
  ui.longDescription,
  ...(ui.capabilities ?? []),
  ...prompts,
  publication.release_notes,
  ...Object.values(publication.translations ?? {}).flatMap((t) => [t.subtitle, t.description]),
]
  .filter(Boolean)
  .join("\n");
// "Do not advertise pricing, subscriptions, free trials, discounts, or promotions."
const promotion = /\b(?:free|gratuit\w*|pricing|tarif\w*|plans?|forfaits?|abonnement\w*|subscriptions?|trials?|essai|discounts?|remises?|promo\w*|upgrade\w*|cheap\w*|moins cher|best|meilleur\w*|vs\.?|versus)\b|\d+\s?%/i;
const promotionHit = promotion.exec(listing);
check(!promotionHit, `listing texts: "${promotionHit?.[0]}" reads as pricing, promotion or comparison`);

const storeCreation =
  /\b(?:creat\w*|launch\w*|set(?:ting)?\s+up|open\w*|start\w*)\s+(?:a\s+|an\s+|your\s+)?(?:new\s+|another\s+)?(?:rental\s+)?(?:store|shop)\b|\b(?:cré\w*|lanc\w*|ouvr\w*)\s+(?:une\s+|votre\s+)?(?:nouvelle\s+|autre\s+)?boutique\b/i;
for (const [name, file] of files) {
  if (!/\.(?:json|md|ya?ml|txt)$/.test(name)) continue;
  const text = readFileSync(file, "utf8");
  const withheld = WITHHELD_TOOLS.exec(text);
  check(!withheld, `${name}: names ${withheld?.[0]}, which ChatGPT and Codex never get`);
  const creation = storeCreation.exec(text);
  check(!creation, `${name}: "${creation?.[0]}" — ChatGPT and Codex cannot create a store`);
  // Reviewer credentials go in the portal. The only address packaged is the author's.
  const emails = (text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []).filter((e) => e !== plugin.author?.email);
  check(!emails.length && !/password|mot de passe/i.test(text), `${name}: an e-mail address or a password; reviewer credentials go in the portal, never in the ZIP`);
  for (const match of text.matchAll(/TODO[A-Z_]*|TBD/g)) {
    if (name === "plugin.json" && match[0] === review.demo_recording_url) continue;
    placeholders.push(`${name}: placeholder "${match[0]}"`);
  }
}

// ---------------------------------------------------------------------------
// Report, then the ZIP
// ---------------------------------------------------------------------------
if (errors.length) {
  console.error(`Not built: ${errors.length} problem(s)\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
if (placeholders.length && !draft) {
  console.error(
    `Not built: placeholders remain\n- ${placeholders.join("\n- ")}\n` +
      "Fill them in, or pass --draft for a ZIP that is not for submission.",
  );
  process.exit(1);
}
if (placeholders.length) console.warn(`Draft: placeholders remain\n- ${placeholders.join("\n- ")}`);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** A deflated ZIP of `entries` ([name, buffer]), with fixed dates so a build is reproducible. */
function zip(entries) {
  const DOS_TIME = 0;
  const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nameBuffer = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    locals.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4); // made by Unix, ZIP 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // a regular file, rw-r--r--
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + compressed.length;
  }
  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

const entries = [...files.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, file]) => {
    check(statSync(file).isFile(), `${name} is not a regular file`);
    return [name, readFileSync(file)];
  });
const outDir = path.join(root, "dist");
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${plugin.name}-openai-${plugin.version}${placeholders.length ? "-draft" : ""}.zip`);
writeFileSync(out, zip(entries));
console.log(`${path.relative(root, out)}: ${entries.length} files\n  ${entries.map(([name]) => name).join("\n  ")}`);
