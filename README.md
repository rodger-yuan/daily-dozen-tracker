# Daily Dozen — Friends League 🏆

A free, static website that tracks your friend group's daily scores on
[The Daily Dozen](https://dailydozentrivia.com/) and shows historical
performance — standings, per-game results, grids, and trend charts.

Friends just **paste their share-result** and it's parsed and saved. No
server to run, no monthly cost.

---

## How it works

```
Friend pastes their result  ─►  parsed in the browser  ─►  saved to a Google
Sheet (via a tiny Apps Script)  ─►  everyone reads it back from the Sheet
```

- **Entry:** on the **Submit** tab, a friend pastes the text The Dozen gives
  them when they tap *Share*. The site reads the game #, score, correct count,
  time, and the 🟩🟥🟪 grid automatically.
- **Storage:** each result is POSTed to a **Google Apps Script web app** that
  appends it to a **Google Sheet** — your permanent history. (Re-submitting the
  same game just updates that row.)
- **Display:** the site reads the Sheet's published CSV and renders standings,
  per-game results, and charts.
- **Instant feedback:** a submission is also cached in the submitter's browser
  (`localStorage`) so they see it immediately, even before the Sheet's CSV
  refreshes (which lags a couple of minutes).

Until you connect a Sheet, the site runs on the sample data in
[`data/results.csv`](data/results.csv) and pastes save to your browser only —
so you can try the whole flow right now.

---

## Setup (~15 minutes)

### 1. Host the site on GitHub Pages
1. Push these files to a new repo (e.g. `dozen-league`).
2. **Settings → Pages**: deploy from `main`, folder `/ (root)`.
3. Live at `https://<your-username>.github.io/dozen-league/`.

### 2. Create the database (Google Sheet + Apps Script)
1. Make a new **Google Sheet**.
2. **Extensions → Apps Script**. Delete the sample code and paste the contents
   of [`apps-script/Code.gs`](apps-script/Code.gs). Save.
3. **Deploy → New deployment → Web app**:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Deploy, authorize when prompted, and **copy the `/exec` URL**.

### 3. Publish the Sheet for reading
1. In the Sheet: **File → Share → Publish to web**.
2. Pick the **`results`** tab, format **CSV**, **Publish**, and copy the URL.

### 4. Wire it up
Open [`config.js`](config.js) and paste both URLs:

```js
submitEndpoint: "https://script.google.com/macros/s/..../exec",
sheetCsvUrl:    "https://docs.google.com/spreadsheets/d/e/..../pub?output=csv",
players:        ["Rodger", "Alex", "Sam", "Jordan"],
```

Commit. The header pill flips from **Sample data** to **● Live**, and pasted
results now save for the whole group.

> **Quick test:** open the `/exec` URL in a browser — you should see
> `{"ok":true,...}`. That confirms the web app is deployed.

---

## The paste format it understands

```
The Dozen: Daily Trivia
Game 1071

Score: 50
🟩🟥🟩
🟥🟩🟪
🟥🟥🟩
5 Correct, Time 01:11
```

| Field | Parsed from |
|---|---|
| Game # | `Game 1071` (groups everyone's results for that day) |
| Score | `Score: 50` (the ranking number) |
| Correct | `5 Correct`, or counted from the grid (🟩 + 🟪) |
| Time | `Time 01:11` |
| Grid | 🟩 correct · 🟥 wrong · 🟪 second-guess correct |

Parsing is forgiving about spacing and extra lines, so the raw share text
works as-is.

---

## Auto-logging from the group chat (iPhone Shortcuts)

Instead of pasting on the site, your iPhone can log results straight from the
iMessage group chat. The Apps Script accepts `{ "player": "...", "raw": "<share text>" }`
and parses it itself.

**One-time:** after updating `apps-script/Code.gs`, paste it into the Apps
Script editor, Save, then **Deploy → Manage deployments → ✏️ Edit → Version:
New version → Deploy**. (Editing the existing deployment keeps the same `/exec` URL.)

### Friends' results: one automation per friend
Written for current iOS (18+). Shortcuts app → **Automation** tab → **+** → **Message**:
1. **Sender:** tap **Choose** → pick the friend (e.g. Harry) → **Done**.
2. **Message Contains:** tap **Choose** → type `Score:` → **Done**.
3. Select **Run Immediately**; turn off **Notify When Run** if you like. **Next**.
4. Tap **Create New Shortcut** (older iOS: *New Blank Automation*).
5. In **Search Actions** at the bottom, add **Get Contents of URL**:
   - Tap the blue **URL** → paste your `/exec` URL (same as `submitEndpoint` in `config.js`).
   - Tap the **›** chevron on the action to expand it. **Method:** `POST`,
     **Request Body:** `JSON`.
   - **Add new field → Text**: key `player`, value `Harry` (must match the roster exactly).
   - **Add new field → Text**: key `raw`; tap the value box → **Shortcut Input** in the
     bar above the keyboard → tap the inserted blue **Shortcut Input** token →
     choose **Content** (so it's the message text, not the whole message).
6. Tap **Done**. Repeat for each friend, changing the Sender and `player`.

Non-result messages that happen to contain "Score:" are ignored (`Not a Dozen result`).

### Your own results: a share-sheet shortcut
Received-message automations don't fire for messages *you* send, so make a
regular shortcut:
1. Shortcuts tab → **+** → rename it **Log Dozen**.
2. Tap **ⓘ** → turn on **Show in Share Sheet** → close the panel. A block appears at
   the top: *Receive **Images and 18 more** input from Share Sheet*. Tap
   **Images and 18 more** → select only **Text**. Tap **If there's no input:
   Continue** → **Get Clipboard**.
3. Add **Get Contents of URL**, same as above, with `player` = your name and
   `raw` = **Shortcut Input**.
4. Add **Show Content** (or **Quick Look**) to see `{"ok":true,...}`.
5. After playing, copy/share your result → run **Log Dozen**. (Then paste into
   the chat as usual.)

---

## Customizing

In [`config.js`](config.js): `leagueName`, `tagline`, the `players` roster, and
`higherIsBetter` (Score-based ranking).

## Local preview

```bash
node serve.cjs    # then visit http://localhost:8000
```
