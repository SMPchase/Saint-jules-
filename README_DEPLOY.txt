SAINT JULES — MUSIC PLAYER + TIDEFORGE

Place these files at the root of the GitHub Pages repository:
- index.html
- catalog.json
- manifest.webmanifest
- album-cover.jpeg
- minecraft/

Keep these existing audio folders next to index.html:
- Lord Have Mercy, He's A Crash Dummy!
- The Proposition comple

The site reads catalog.json first and falls back to the same catalog embedded in index.html.
To add a future project such as Jasper, add another collection object to catalog.json with:
- id
- title
- cover
- normalRoot
- orderRoot
- tracks

The live music and social destinations are managed in catalog.json. Keep its
relative Minecraft destination set to minecraft/ so the main player links to
the public install page.

The minecraft/ directory contains the Tideforge 1.3 landing page, artwork,
pack downloads, OBS scene collection, and SHA-256 checksums. The public game
address shown there is play.saintjules.org, clearly marked pending until the
separate Minecraft hosting and DNS record are activated.
