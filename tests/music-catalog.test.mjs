import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const landingHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
const helperSource = landingHtml.match(
  /\/\* music-catalog:start \*\/([\s\S]*?)\/\* music-catalog:end \*\//,
)?.[1];
assert.ok(helperSource, "landing page exposes its catalog normalization helpers");
const { normalizeCommunityCatalog, safeMusicUrl } = new Function(
  `${helperSource}; return { normalizeCommunityCatalog, safeMusicUrl };`,
)();

const apiUrl = "https://room.saintjules.org/api/music";

function track(id, releaseGroup, trackOrder, extra = {}) {
  return {
    id,
    title: `Track ${id}`,
    audio: { url: `/api/music/media/${id}.mp3` },
    releaseType: "album",
    releaseGroup,
    trackOrder,
    ...extra,
  };
}

test("groups enhanced catalog tracks and starts with the default release", () => {
  const result = normalizeCommunityCatalog(
    {
      tracks: [
        track("old-1", "Older Album", 1),
        track("new-2", "New Album", 2),
        track("new-1", "New Album", 1),
      ],
      defaultFirst: { kind: "release", target: "New Album" },
      releases: [
        { key: "old", title: "Older Album", type: "album", tracks: ["old-1"] },
        { key: "new", title: "New Album", type: "album", tracks: ["new-1", "new-2"] },
      ],
      playlists: [],
    },
    { apiUrl, startNumber: 14 },
  );

  assert.deepEqual(result.tracks.map((entry) => entry.id), ["new-1", "new-2", "old-1"]);
  assert.deepEqual(result.tracks.map((entry) => entry.num), ["14", "15", "16"]);
  assert.equal(result.defaultTrackId, "new-1");
  assert.equal(result.defaultFirst.kind, "release");
  assert.equal(result.tracks[0].releaseGroup, "New Album");
});

test("accepts playlist and track defaults without changing the catalog", () => {
  const payload = {
    tracks: [
      track("album-1", "Album", 1),
      track("mix-2", "Road Mix", 2, { releaseType: "playlist" }),
      track("mix-1", "Road Mix", 1, { releaseType: "playlist" }),
    ],
    playlists: [{ key: "road-mix", title: "Road Mix", tracks: ["mix-1", "mix-2"] }],
    releases: [],
  };

  const playlist = normalizeCommunityCatalog(
    { ...payload, defaultFirst: { kind: "playlist", target: "Road Mix" } },
    { apiUrl },
  );
  assert.equal(playlist.defaultTrackId, "mix-1");

  const selectedTrack = normalizeCommunityCatalog(
    { ...payload, defaultFirst: { kind: "track", target: "mix-2" } },
    { apiUrl },
  );
  assert.equal(selectedTrack.defaultTrackId, "mix-2");
  assert.equal(selectedTrack.tracks.length, 3);
});

test("keeps the original flat response compatible and filters unsafe entries", () => {
  const result = normalizeCommunityCatalog(
    {
      tracks: [
        { id: "live", title: "Live", audio: { url: "media/live.mp3" }, release: "Singles" },
        { id: "draft", title: "Draft", audio: { url: "media/draft.mp3" }, status: "draft" },
        { id: "bad", title: "Bad", audio: { url: "javascript:alert(1)" } },
      ],
    },
    { apiUrl },
  );

  assert.equal(result.tracks.length, 1);
  assert.equal(result.tracks[0].source, "https://room.saintjules.org/api/media/live.mp3");
  assert.equal(result.tracks[0].releaseGroup, "Singles");
  assert.equal(safeMusicUrl("data:text/plain,no", apiUrl), null);
});

test("landing player consumes Studio music while retaining fallback and roll mode", async () => {
  assert.match(landingHtml, /https:\/\/room\.saintjules\.org\/api\/music/);
  assert.match(landingHtml, /https:\/\/studio\.saintjules\.org\//);
  assert.match(landingHtml, /ADD \/ MANAGE MUSIC/);
  assert.match(landingHtml, /normalizeCommunityCatalog/);
  assert.match(landingHtml, /bundledTracks/);
  assert.match(landingHtml, /\.\.\.bundledTracks,\.\.\.uniqueAdditions/);
  assert.match(landingHtml, /defaultTrackId/);
  assert.match(landingHtml, /appliedCommunityDefault/);
  assert.match(landingHtml, /track\.releaseGroup/);
  assert.match(landingHtml, /class="track-group"/);
  assert.match(landingHtml, /function rollSong/);
  assert.match(landingHtml, /window\.setInterval\(\(\)=>void syncCommunityMusic\(\),60_000\)/);
});

test("keeps one mobile-friendly player and no install-page prompt", () => {
  assert.equal((landingHtml.match(/<audio\b/g) || []).length, 1);
  assert.match(landingHtml, /class="transport" aria-label="Playback controls"/);
  assert.match(landingHtml, /id="prevButton"/);
  assert.match(landingHtml, /id="mainPlay"/);
  assert.match(landingHtml, /id="nextButton"/);
  assert.match(landingHtml, /id="seek" type="range"/);
  assert.match(landingHtml, /id="tracksButton"/);
  assert.match(landingHtml, /id="muteButton"/);
  assert.match(landingHtml, /min-height:44px/);
  assert.doesNotMatch(landingHtml, /ADD APP|Add to Home Screen|beforeinstallprompt/i);
  assert.match(landingHtml, /href="https:\/\/room\.saintjules\.org\/">BLOG<\/a>/);
  assert.match(landingHtml, /href="minecraft\/">PLAY WITH ME<\/a>/);
});
