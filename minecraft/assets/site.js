/* Player-facing controls only. No owner credentials, storage, or server commands. */
(() => {
  "use strict";

  const nodes = (selector) => [...document.querySelectorAll(selector)];
  const setText = (selector, text) => nodes(selector).forEach((node) => { node.textContent = text; });
  const release = typeof fallbackRelease === "object" ? fallbackRelease : null;
  const address = typeof serverAddress === "string" ? serverAddress : "";
  const stableDownload = "downloads/Saint-Jules-Minecraft-Latest.mrpack";
  const modNodes = nodes("[data-pack-mod-list] li");
  const safeJar = /^[^/\\\u0000-\u001f]+\.jar$/i;

  function normalizedInventory(value) {
    if (!value || !Array.isArray(value.hosted) || !Array.isArray(value.included)) return null;
    const all = [...value.hosted, ...value.included];
    if (!all.length || all.length > 1000 || !all.every((name) => typeof name === "string" && safeJar.test(name) && !name.startsWith("._"))) return null;
    if (new Set(all.map((name) => name.toLowerCase())).size !== all.length) return null;
    return {
      hosted: [...value.hosted].sort(),
      included: [...value.included].sort(),
    };
  }

  const renderedInventory = modNodes.every((node) => ["hosted", "included"].includes(node.dataset.packSource)) ? normalizedInventory({
    hosted: modNodes.filter((node) => node.dataset.packSource === "hosted").map((node) => node.textContent.trim()),
    included: modNodes.filter((node) => node.dataset.packSource === "included").map((node) => node.textContent.trim()),
  }) : null;

  function matchingRelease(candidate) {
    if (!release || !candidate || typeof candidate !== "object" || !renderedInventory) return false;
    for (const key of ["version", "minecraftVersion", "loaderVersion", "sha256", "publishedAt"]) {
      if (candidate[key] !== release[key]) return false;
    }
    if (candidate.loader !== "Forge" || candidate.serverAddress !== address) return false;
    const filename = `Saint-Jules-Minecraft-${release.version}.mrpack`;
    if (candidate.filename !== filename || candidate.packUrl !== `https://www.saintjules.org/minecraft/downloads/${filename}`) return false;
    const inventory = normalizedInventory(candidate.inventory);
    return Boolean(inventory && JSON.stringify(inventory) === JSON.stringify(renderedInventory));
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Request unavailable");
      return await response.json();
    } finally {
      window.clearTimeout(timer);
    }
  }

  function downloadAvailability(available) {
    nodes("[data-pack-download]").forEach((link) => {
      if (available) {
        link.setAttribute("href", stableDownload);
        link.removeAttribute("aria-disabled");
        link.removeAttribute("title");
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
        link.setAttribute("title", "Reload this page to get matching release details before downloading.");
      }
    });
  }

  if (release) {
    setText("[data-pack-version]", release.version);
    setText("[data-minecraft-version]", release.minecraftVersion);
    setText("[data-forge-version]", release.loaderVersion);
    setText("[data-pack-sha]", `${release.sha256.slice(0, 8)}…`);
    const published = new Date(release.publishedAt);
    if (!Number.isNaN(published.valueOf())) {
      setText("[data-pack-published]", new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(published));
    }
    if (renderedInventory) {
      setText("[data-pack-count]", renderedInventory.hosted.length + renderedInventory.included.length);
      setText("[data-hosted-count]", renderedInventory.hosted.length);
      setText("[data-included-count]", renderedInventory.included.length);
    }
    downloadAvailability(true);
    fetchJson("downloads/latest.json").then((candidate) => {
      const matches = matchingRelease(candidate);
      downloadAvailability(matches);
      setText("[data-release-note]", matches
        ? "Release details checked. This page matches the published pack."
        : "The release details have changed or could not be verified. Reload this page before downloading.");
    }).catch(() => {
      setText("[data-release-note]", "The update check is unavailable. The published pack download is still available.");
    });
  }

  const vanilla = typeof vanillaServer === "object" && vanillaServer ? vanillaServer : { address: null, version: "", state: "preparing" };
  setText("[data-vanilla-version]", vanilla.version || "Version pending");
  setText("[data-vanilla-address]", vanilla.address || "Address being prepared");
  setText("[data-vanilla-ready]", vanilla.address
    ? "Vanilla is configured. Copy its own address and check the connection before joining."
    : "The separate vanilla server is being prepared. Its address will appear here when setup is complete.");
  const scoped = (attribute, kind) => nodes(`[${attribute}]`).filter((node) => (node.getAttribute(attribute) || "modded") === kind);

  function setupServer(kind, groupAddress) {
  const groupText = (attribute, text) => scoped(attribute, kind).forEach((node) => { node.textContent = text; });
  const copyButtons = scoped("data-copy", kind);
  const refreshButtons = scoped("data-refresh-status", kind);
  const statusNodes = scoped("data-server-status", kind);
  const labels = () => statusNodes.flatMap((node) => [...node.querySelectorAll("[data-server-status-label]")]);
  if (!groupAddress) {
    [...copyButtons, ...refreshButtons].forEach((button) => { button.disabled = true; });
    statusNodes.forEach((node) => { node.dataset.state = "preparing"; });
    labels().forEach((node) => { node.textContent = "Being prepared"; });
    groupText("data-server-detail", "This server does not have a published address yet. No connection check has been made.");
    return;
  }
  copyButtons.forEach((button) => { button.disabled = false; button.removeAttribute("aria-disabled"); });
  const copyLabels = new Map(copyButtons.map((button) => [button, button.textContent]));
  let copying = false;
  let copyReset;

  async function copyAddress() {
    if (copying) return;
    copying = true;
    window.clearTimeout(copyReset);
    copyButtons.forEach((button) => { button.disabled = true; });
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(groupAddress);
        copied = true;
      }
    } catch {
      // A denied clipboard permission can still permit the user-initiated fallback.
    }
    if (!copied) {
      const focused = document.activeElement;
      const field = document.createElement("textarea");
      field.value = groupAddress;
      field.setAttribute("readonly", "");
      field.setAttribute("aria-label", "Minecraft server address");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      try {
        field.select();
        copied = document.execCommand("copy") === true;
      } catch {
        copied = false;
      } finally {
        field.remove();
        focused?.focus({ preventScroll: true });
      }
    }
    copyButtons.forEach((button) => {
      button.disabled = false;
      button.textContent = copied ? "Copied" : copyLabels.get(button);
    });
    groupText("data-copy-message", copied
      ? "Server address copied. Paste it into Minecraft Multiplayer."
      : `Copy was not allowed. Select and copy the address manually: ${groupAddress}`);
    copying = false;
    if (copied) copyReset = window.setTimeout(() => {
      copyButtons.forEach((button) => { button.textContent = copyLabels.get(button); });
    }, 2200);
  }
  copyButtons.forEach((button) => button.addEventListener("click", copyAddress));

  const refreshLabels = new Map(refreshButtons.map((button) => [button, button.textContent]));
  let checking = false;
  let nextCheckAt = 0;

  function status(state, label, detail) {
    statusNodes.forEach((node) => {
      node.dataset.state = state;
      node.setAttribute("aria-busy", String(state === "checking"));
    });
    labels().forEach((node) => { node.textContent = label; });
    groupText("data-server-detail", detail);
  }

  async function refreshStatus() {
    if (checking || Date.now() < nextCheckAt) return;
    checking = true;
    refreshButtons.forEach((button) => { button.disabled = true; button.textContent = "Checking…"; });
    status("checking", "Checking connection…", "Asking the public Minecraft status service. You can still copy the address and try joining.");
    let outcome;
    try {
      const result = await fetchJson(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(groupAddress)}`);
      const online = result?.players?.online;
      const maximum = result?.players?.max;
      if (result?.online === true && Number.isSafeInteger(online) && online >= 0 && Number.isSafeInteger(maximum) && maximum >= online) {
        outcome = ["online", "Reported online", `The public status service reports ${online} of ${maximum} players online. A successful game join is the final connection check.`];
      } else {
        outcome = ["unknown", "Could not confirm", "The public status service could not confirm a connection. This does not prove the world is down; the public relay may be unreachable. Try joining with the address above."];
      }
    } catch {
      outcome = ["unknown", "Status unavailable", "The public status service did not answer in time. No online or offline claim is being made. You can still try joining."];
    } finally {
      const checkedAt = new Date();
      const checkedText = `Checked ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(checkedAt)}.`;
      if (outcome) status(outcome[0], outcome[1], `${outcome[2]} ${checkedText}`);
      scoped("data-server-checked", kind).forEach((node) => {
        node.textContent = checkedText;
        if (node.tagName === "TIME") node.setAttribute("datetime", checkedAt.toISOString());
      });
      checking = false;
      nextCheckAt = Date.now() + 2000;
      refreshButtons.forEach((button) => { button.textContent = "Please wait…"; });
      window.setTimeout(() => refreshButtons.forEach((button) => {
        button.disabled = false;
        button.textContent = refreshLabels.get(button);
      }), 2000);
    }
  }
  refreshButtons.forEach((button) => button.addEventListener("click", refreshStatus));
  if (statusNodes.length) refreshStatus();
  }
  setupServer("modded", address);
  setupServer("vanilla", typeof vanilla.address === "string" ? vanilla.address : null);

  const search = document.querySelector("[data-mod-search]");
  const searchMods = () => {
    const query = String(search?.value ?? "").trim().toLocaleLowerCase();
    let visible = 0;
    modNodes.forEach((node) => {
      node.hidden = !node.textContent.toLocaleLowerCase().includes(query);
      if (!node.hidden) visible += 1;
    });
    setText("[data-mod-search-result]", query
      ? `${visible} of ${modNodes.length} mod files match your search.`
      : `Showing all ${modNodes.length} mod files.`);
  };
  search?.addEventListener("input", searchMods);
  searchMods();
})();
