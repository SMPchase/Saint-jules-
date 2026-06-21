SAINT JULES — LUCKY 13 MOBILE BUILD

Place these files at the root of the GitHub Pages repository:
- index.html
- catalog.json
- manifest.webmanifest
- album-cover.jpeg

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

Spotify, YouTube, and Instagram are currently # placeholders. Replace those values in catalog.json with the real URLs.
