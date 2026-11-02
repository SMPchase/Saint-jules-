import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { updateMinecraftPageHtml } from "../../../controller/src/pack-publisher.js";

const site = new URL("../", import.meta.url);
const html = await readFile(new URL("minecraft/index.html", site), "utf8");
const javascript = await readFile(new URL("minecraft/assets/site.js", site), "utf8");
const feed = JSON.parse(await readFile(new URL("minecraft/downloads/latest.json", site), "utf8"));
const fallback = JSON.parse(html.match(/const\s+fallbackRelease\s*=\s*(\{[^;]*\});/)?.[1] ?? "null");
const address = html.match(/const\s+serverAddress\s*=\s*"([^"]+)"/)?.[1];
const stable = "downloads/Saint-Jules-Minecraft-Latest.mrpack";
const decode = (text) => text.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'");
const inventoryMarkup = html.match(/<ul\b[^>]*data-pack-mod-list[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? "";
const inventory = [...inventoryMarkup.matchAll(/<li\s+data-pack-source="(hosted|included)">([^<]+)<\/li>/g)]
  .map((match) => ({ source: match[1], name: decode(match[2]) }));

class Element {
  constructor(text = "", tagName = "SPAN") {
    this.textContent = text;
    this.tagName = tagName;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this.value = "";
    this.disabled = false;
    this.hidden = false;
    this.removed = false;
    this.focused = false;
  }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  removeAttribute(key) { this.attributes.delete(key); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  querySelectorAll(selector) { return selector === "[data-server-status-label]" && this.label ? [this.label] : []; }
  select() { this.selected = true; }
  remove() { this.removed = true; }
  focus() { this.focused = true; }
}

async function settle() {
  for (let index = 0; index < 14; index += 1) await Promise.resolve();
}

async function browser({ release = feed, status = { online: false }, clipboard, legacyCopy = false, pendingStatus = false, releaseError = false, vanilla = null, vanillaStatus = { online: false } } = {}) {
  const selectors = new Map();
  const register = (selector, items = [new Element()]) => { selectors.set(selector, items); return items; };
  const mods = register("[data-pack-mod-list] li", inventory.map(({ source, name }) => {
    const node = new Element(name, "LI"); node.dataset.packSource = source; return node;
  }));
  const downloads = register("[data-pack-download]", [new Element("Download", "A"), new Element("Get pack", "A")]);
  const copyButtons = register("[data-copy]", [new Element("Copy address", "BUTTON"), new Element("Copy server address", "BUTTON")]);
  const refreshButtons = register("[data-refresh-status]", [new Element("Refresh status", "BUTTON"), new Element("Check again", "BUTTON")]);
  const statusNodes = register("[data-server-status]", [new Element(), new Element()]);
  const statusLabels = register("[data-server-status-label]", [new Element(), new Element()]);
  statusNodes.forEach((node, index) => { node.label = statusLabels[index]; });
  for (const selector of ["pack-version", "minecraft-version", "forge-version", "pack-sha", "pack-published", "pack-count", "hosted-count", "included-count", "copy-message", "server-detail", "release-note", "mod-search-result"]) {
    register(`[data-${selector}]`);
  }
  register("[data-server-checked]", [new Element("", "TIME")]);
  const [search] = register("[data-mod-search]", [new Element("", "INPUT")]);
  let vanillaNodes;
  if (vanilla) {
    vanillaNodes = {};
    for (const key of ["copy", "refresh-status", "server-status", "copy-message", "server-detail", "server-checked"]) {
      const node = new Element(key === "copy" ? "Copy vanilla address" : key === "refresh-status" ? "Check vanilla" : "");
      node.setAttribute(`data-${key}`, "vanilla");
      selectors.get(`[data-${key}]`).push(node);
      vanillaNodes[key] = node;
    }
    vanillaNodes["server-status"].label = new Element();
    selectors.get("[data-server-status-label]").push(vanillaNodes["server-status"].label);
    for (const key of ["vanilla-address", "vanilla-version", "vanilla-ready"]) register(`[data-${key}]`);
  }
  const appended = [];
  const focused = new Element("Existing focus", "BUTTON");
  const document = {
    querySelectorAll: (selector) => selectors.get(selector) ?? [],
    querySelector: (selector) => selectors.get(selector)?.[0] ?? null,
    createElement: (tag) => new Element("", tag.toUpperCase()),
    body: { appendChild: (node) => appended.push(node) },
    activeElement: focused,
    execCommand: () => legacyCopy,
  };
  let now = Date.parse("2026-11-02T16:00:00Z");
  const timers = new Map();
  let timerId = 0;
  const window = {
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
  };
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, options });
    if (url === "downloads/latest.json") {
      if (releaseError) throw new Error("offline");
      return { ok: true, json: async () => release };
    }
    if (pendingStatus && (!vanilla?.address || !url.endsWith(encodeURIComponent(vanilla.address)))) return new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("AbortError")));
    });
    return { ok: true, json: async () => vanilla?.address && url.endsWith(encodeURIComponent(vanilla.address)) ? vanillaStatus : status };
  };
  const context = vm.createContext({ document, navigator: { clipboard }, window, fetch, AbortController, Date: Clock, Intl, console });
  vm.runInContext(`const fallbackRelease=${JSON.stringify(fallback)}; const serverAddress=${JSON.stringify(address)}; const vanillaServer=${JSON.stringify(vanilla)};\n${javascript}`, context);
  await settle();
  return {
    nodes: (selector) => selectors.get(selector), mods, downloads, copyButtons, refreshButtons, search, appended, focused, requests, vanilla: vanillaNodes,
    text: (selector) => selectors.get(selector)?.[0]?.textContent,
    async click(node) { await node.listeners.get("click")?.(); await settle(); },
    async input(value) { search.value = value; search.listeners.get("input")?.(); await settle(); },
    async advance(milliseconds) {
      const end = now + milliseconds;
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((left, right) => left[1].at - right[1].at)[0];
        if (!next) break;
        timers.delete(next[0]); now = next[1].at; next[1].callback(); await settle();
      }
      now = end; await settle();
    },
  };
}

test("published fallback and complete inventory agree with the unchanged pack", () => {
  assert.equal(fallback.version, feed.version);
  assert.equal(fallback.sha256, feed.sha256);
  assert.equal(fallback.publishedAt, feed.publishedAt);
  assert.equal(address, feed.serverAddress);
  assert.equal(inventory.length, feed.inventory.hosted.length + feed.inventory.included.length);
  for (const source of ["hosted", "included"]) {
    assert.deepEqual(inventory.filter((entry) => entry.source === source).map((entry) => entry.name).sort(), [...feed.inventory[source]].sort());
  }
  assert.match(html, /<script\b[^>]*\bsrc="assets\/site\.js"[^>]*\bdefer\b|<script\b[^>]*\bdefer\b[^>]*\bsrc="assets\/site\.js"/);
  assert.match(html, /data-copy-message[^>]*(?:role="status"|aria-live="polite")|(?:role="status"|aria-live="polite")[^>]*data-copy-message/);
  assert.doesNotMatch(javascript, /localStorage|sessionStorage|\/api\/server\/|controller-password/);
});

test("matching metadata keeps every download on the stable URL", async () => {
  const app = await browser();
  assert.ok(app.downloads.every((node) => node.getAttribute("href") === stable && !node.getAttribute("aria-disabled")));
  assert.match(app.text("[data-release-note]"), /matches the published pack/);
  assert.equal(app.text("[data-pack-count]"), inventory.length);
});

test("unavailable metadata preserves the published download without fabricating verification", async () => {
  const app = await browser({ releaseError: true });
  assert.ok(app.downloads.every((node) => node.getAttribute("href") === stable));
  assert.match(app.text("[data-release-note]"), /update check is unavailable/i);
});

test("changed identity, redirect URL, or inventory cannot mix with rendered release", async () => {
  const mutations = [
    { ...feed, version: "9.0.0" },
    { ...feed, sha256: "a".repeat(64) },
    { ...feed, publishedAt: "2026-11-02T16:00:00Z" },
    { ...feed, serverAddress: "other.invalid" },
    { ...feed, packUrl: "https://example.invalid/pack.mrpack" },
    { ...feed, inventory: { ...feed.inventory, included: [] } },
    { ...feed, inventory: { ...feed.inventory, hosted: [...feed.inventory.hosted, feed.inventory.hosted[0]] } },
  ];
  for (const release of mutations) {
    const app = await browser({ release });
    assert.ok(app.downloads.every((node) => node.getAttribute("href") === null && node.getAttribute("aria-disabled") === "true"));
    assert.equal(app.text("[data-pack-version]"), fallback.version);
    assert.match(app.text("[data-release-note]"), /Reload this page/);
  }
});

test("negative and malformed status results are not false claims of downtime", async () => {
  for (const status of [{ online: false }, {}, { online: true, players: { online: "4", max: 12 } }]) {
    const app = await browser({ status });
    assert.ok(app.nodes("[data-server-status]").every((node) => node.dataset.state === "unknown"));
    assert.ok(app.nodes("[data-server-status-label]").every((node) => node.textContent === "Could not confirm"));
    assert.match(app.text("[data-server-detail]"), /does not prove the world is down/);
    assert.match(app.text("[data-server-detail]"), /Checked /);
  }
});

test("positive status reports source and player count, with synchronized throttled refresh", async () => {
  const app = await browser({ status: { online: true, players: { online: 2, max: 12 } } });
  assert.ok(app.nodes("[data-server-status-label]").every((node) => node.textContent === "Reported online"));
  assert.match(app.text("[data-server-detail]"), /service reports 2 of 12/);
  assert.ok(app.refreshButtons.every((node) => node.disabled));
  await app.click(app.refreshButtons[1]);
  assert.equal(app.requests.length, 2);
  await app.advance(2000);
  assert.ok(app.refreshButtons.every((node) => !node.disabled));
  await app.click(app.refreshButtons[0]);
  assert.equal(app.requests.length, 3);
});

test("a stalled status request aborts after eight seconds and recovers controls", async () => {
  const app = await browser({ pendingStatus: true });
  assert.ok(app.refreshButtons.every((node) => node.disabled));
  await app.click(app.refreshButtons[1]);
  assert.equal(app.requests.length, 2);
  await app.advance(7999);
  assert.equal(app.nodes("[data-server-status]")[0].dataset.state, "checking");
  await app.advance(1);
  assert.equal(app.text("[data-server-status-label]"), "Status unavailable");
  assert.match(app.text("[data-server-detail]"), /No online or offline claim/);
  await app.advance(2000);
  assert.ok(app.refreshButtons.every((node) => !node.disabled));
});

test("successful clipboard operation reports copied on both controls and restores labels", async () => {
  const writes = [];
  const app = await browser({ clipboard: { writeText: async (text) => writes.push(text) } });
  await app.click(app.copyButtons[1]);
  assert.deepEqual(writes, [address]);
  assert.ok(app.copyButtons.every((node) => node.textContent === "Copied"));
  assert.match(app.text("[data-copy-message]"), /Server address copied/);
  await app.advance(2200);
  assert.deepEqual(app.copyButtons.map((node) => node.textContent), ["Copy address", "Copy server address"]);
});

test("denied clipboard and failed fallback never claim success; focus is restored", async () => {
  const app = await browser({ clipboard: { writeText: async () => { throw new Error("denied"); } }, legacyCopy: false });
  await app.click(app.copyButtons[0]);
  assert.ok(app.copyButtons.every((node) => node.textContent !== "Copied" && !node.disabled));
  assert.match(app.text("[data-copy-message]"), /Copy was not allowed/);
  assert.ok(app.text("[data-copy-message]").includes(address));
  assert.equal(app.appended.length, 1);
  assert.equal(app.appended[0].removed, true);
  assert.equal(app.focused.focused, true);
});

test("legacy clipboard success is supported when modern clipboard is unavailable", async () => {
  const app = await browser({ legacyCopy: true });
  await app.click(app.copyButtons[0]);
  assert.match(app.text("[data-copy-message]"), /Server address copied/);
});

test("mod search filters case-insensitively, reports empty results, and resets", async () => {
  const app = await browser();
  await app.input("PROJECTRED");
  assert.equal(app.mods.filter((node) => !node.hidden).length, 7);
  assert.match(app.text("[data-mod-search-result]"), /^7 of /);
  await app.input("definitely-no-such-mod");
  assert.ok(app.mods.every((node) => node.hidden));
  assert.match(app.text("[data-mod-search-result]"), /^0 of /);
  await app.input("");
  assert.ok(app.mods.every((node) => !node.hidden));
  assert.match(app.text("[data-mod-search-result]"), /^Showing all /);
});

test("vanilla without an endpoint stays preparing without fake checks or copy controls", async () => {
  const app = await browser({ vanilla: { address: null, version: "26.3", state: "preparing" } });
  assert.equal(app.vanilla.copy.disabled, true);
  assert.equal(app.vanilla["refresh-status"].disabled, true);
  assert.equal(app.vanilla["server-status"].dataset.state, "preparing");
  assert.match(app.vanilla["server-detail"].textContent, /No connection check has been made/);
  assert.equal(app.requests.length, 2);
  assert.equal(app.text("[data-vanilla-version]"), "26.3");
});

test("configured vanilla uses its own copy address and independent connection state", async () => {
  const writes = [];
  const app = await browser({
    vanilla: { address: "vanilla.example.invalid:25566", version: "26.3", state: "ready" },
    vanillaStatus: { online: true, players: { online: 1, max: 8 } },
    pendingStatus: true,
    clipboard: { writeText: async (text) => writes.push(text) },
  });
  assert.equal(app.vanilla["server-status"].dataset.state, "online");
  assert.match(app.vanilla["server-detail"].textContent, /1 of 8/);
  assert.equal(app.nodes("[data-server-status]")[0].dataset.state, "checking");
  await app.click(app.vanilla.copy);
  assert.deepEqual(writes, ["vanilla.example.invalid:25566"]);
  assert.equal(app.copyButtons[0].textContent, "Copy address");
  await app.advance(2000);
  assert.equal(app.vanilla["refresh-status"].disabled, false);
  assert.equal(app.refreshButtons[0].disabled, true);
  assert.equal(app.requests.length, 3);
});

test("future publisher updates keep release hooks and exact inventory functional", () => {
  const nextVersion = "1.8.2";
  const nextSha = "b".repeat(64);
  const nextDate = "2026-11-03T12:00:00.000Z";
  const updated = updateMinecraftPageHtml(html, {
    currentVersion: feed.version,
    version: nextVersion,
    componentVersions: { loaderVersion: feed.loaderVersion },
    inventory: feed.inventory,
    serverAddress: "future.example.invalid",
    sha256: nextSha,
    publishedAt: nextDate,
  });
  const nextFallback = JSON.parse(updated.match(/const\s+fallbackRelease\s*=\s*(\{[^;]*\});/)[1]);
  assert.equal(nextFallback.version, nextVersion);
  assert.equal(nextFallback.sha256, nextSha);
  assert.equal(nextFallback.publishedAt, nextDate);
  assert.match(updated, /const serverAddress="future\.example\.invalid"/);
  assert.match(updated, /<code\b[^>]*class="[^"]*\baddress\b[^"]*"[^>]*>future\.example\.invalid<\/code>/);
  assert.match(updated, /bbbbbbbb…/);
  assert.ok(updated.includes(stable));
  assert.match(updated, /data-pack-mod-list/);
});
