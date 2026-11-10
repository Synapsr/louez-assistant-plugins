#!/usr/bin/env node
// Checks the plugin manifests and skills of this repository.
// Usage: node .github/scripts/validate.mjs [path/to/cursor-plugin.schema.json]
// With a schema path (CI downloads Cursor's), .cursor-plugin/plugin.json is
// also checked against it with Ajv.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const MCP_URL = "https://app.louez.io/api/mcp";
const SKILL_KEYS = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);

let errors = 0;
const fail = (message) => {
  console.error(`ERROR: ${message}`);
  errors++;
};

function readJson(path) {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch (error) {
    fail(`${path}: ${error.message}`);
    return null;
  }
}

function filesUnder(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.name === ".git" || entry.name === "node_modules") return [];
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function mustExist(owner, path) {
  const clean = path.replace(/^\.\//, "");
  if (path.startsWith("/") || clean.split("/").includes("..")) fail(`${owner}: path "${path}" must be relative, without ".."`);
  else if (!existsSync(join(root, clean))) fail(`${owner}: "${path}" does not exist`);
}

// 1. Every JSON file parses.
for (const path of filesUnder(".").filter((p) => p.endsWith(".json"))) readJson(path);

// 2. Claude Code plugin and marketplace.
const claude = readJson(".claude-plugin/plugin.json");
if (claude) {
  if (claude.name !== "louez") fail(".claude-plugin/plugin.json: name must be louez");
  const server = claude.mcpServers?.louez;
  if (server?.type !== "http" || server?.url !== MCP_URL) fail(`.claude-plugin/plugin.json: mcpServers.louez must be { type: "http", url: "${MCP_URL}" }`);
  if (claude.icon) mustExist(".claude-plugin/plugin.json icon", claude.icon);
  for (const key of ["homepage", "documentationUrl", "supportUrl", "privacyPolicyUrl", "termsOfServiceUrl"]) {
    if (claude[key] && !claude[key].startsWith("https://")) fail(`.claude-plugin/plugin.json: ${key} must be an https:// URL`);
  }
}
const market = readJson(".claude-plugin/marketplace.json");
if (market && claude) {
  const entry = market.plugins?.find((p) => p.name === claude.name);
  if (!entry) fail(".claude-plugin/marketplace.json: no entry named like plugin.json");
  else if (entry.source !== "./") fail('.claude-plugin/marketplace.json: the entry\'s source must be "./"');
}

// 3. Cursor plugin.
const cursor = readJson(".cursor-plugin/plugin.json");
if (cursor) {
  if (cursor.name !== "louez") fail(".cursor-plugin/plugin.json: name must be louez");
  if (cursor.mcpServers?.louez?.url !== MCP_URL) fail(`.cursor-plugin/plugin.json: mcpServers.louez.url must be ${MCP_URL}`);
  if (cursor.logo) mustExist(".cursor-plugin/plugin.json logo", cursor.logo);
  for (const path of [cursor.skills].flat().filter(Boolean)) mustExist(".cursor-plugin/plugin.json skills", path);
  const schemaPath = process.argv[2];
  if (schemaPath) {
    const { default: Ajv } = await import("ajv");
    const { default: addFormats } = await import("ajv-formats");
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(JSON.parse(readFileSync(schemaPath, "utf8")));
    if (!validate(cursor)) {
      for (const error of validate.errors) fail(`.cursor-plugin/plugin.json${error.instancePath}: ${error.message}`);
    }
  }
}

// 4. Skills: a folder per skill, a SKILL.md whose name matches it, portable frontmatter.
for (const dir of readdirSync(join(root, "skills"))) {
  if (!statSync(join(root, "skills", dir)).isDirectory()) continue;
  const path = `skills/${dir}/SKILL.md`;
  if (!existsSync(join(root, path))) {
    fail(`${path} is missing`);
    continue;
  }
  const match = readFileSync(join(root, path), "utf8").match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    fail(`${path}: no frontmatter`);
    continue;
  }
  const fields = Object.fromEntries(
    match[1].split("\n").filter((line) => /^[\w-]+:/.test(line)).map((line) => {
      const at = line.indexOf(":");
      return [line.slice(0, at), line.slice(at + 1).trim()];
    }),
  );
  for (const key of Object.keys(fields)) if (!SKILL_KEYS.has(key)) fail(`${path}: frontmatter key "${key}" is not portable`);
  if (fields.name !== dir) fail(`${path}: name must be "${dir}"`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fields.name ?? "")) fail(`${path}: name must be lowercase kebab-case`);
  if (!fields.description) fail(`${path}: description is required`);
  else if (fields.description.length > 1024) fail(`${path}: description is over 1024 characters`);
}

if (errors) {
  console.error(`${errors} problem(s) found.`);
  process.exit(1);
}
console.log("All manifests and skills are valid.");
