// ───────────────────────────────────────────────────────────────────
//  Daily Dozen Friends League — configuration
// ───────────────────────────────────────────────────────────────────
//
//  Friends paste their Dozen share-result into the site. It's parsed and
//  saved to a Google Sheet via a tiny Google Apps Script web app.
//
//  SETUP (see README.md for the click-by-click version):
//    1. Make a Google Sheet. Extensions > Apps Script, paste apps-script/Code.gs.
//    2. Deploy > New deployment > Web app > Execute as "Me",
//       access "Anyone". Copy the /exec URL  ->  submitEndpoint below.
//    3. Sheet > File > Share > Publish to web > the results tab > CSV.
//       Copy that URL  ->  sheetCsvUrl below.
//
//  Leave both EMPTY to demo locally: pastes save to this browser only
//  (localStorage) and the bundled data/results.csv provides sample history.

window.DDT_CONFIG = {
  // Where pasted results are SAVED (Apps Script web-app /exec URL).
  submitEndpoint: "",

  // Where saved results are READ from (published Google Sheet CSV).
  // Empty = use the bundled data/results.csv sample file.
  sheetCsvUrl: "",

  // Header text.
  leagueName: "Daily Dozen — Friends League",
  tagline: "Tracking our daily trivia glory (and shame).",

  // Roster for the "Who are you?" dropdown on the submit screen.
  // Players not listed here can still type their name.
  players: ["Rodger", "Harry", "Mac", "RJ"],

  // Ranking: higher Score wins (matches the Dozen leaderboard).
  higherIsBetter: true,
};
