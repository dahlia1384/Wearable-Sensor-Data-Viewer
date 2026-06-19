# Wearable Sensor Data Detector — Browser Extension

A Chrome extension that automatically scans GitHub repositories for wearable sensor data files (accelerometer, heart rate, SpO₂, temperature) and gives you an instant visual summary — without leaving the page.

---

## Table of Contents

1. [What does it do?](#what-does-it-do)
2. [What sensor types are supported?](#what-sensor-types-are-supported)
3. [File structure explained](#file-structure-explained)
4. [How to install it (step by step)](#how-to-install-it-step-by-step)
5. [How to use it](#how-to-use-it)
6. [How detection works](#how-detection-works)
7. [How the chart works](#how-the-chart-works)
8. [How to modify it](#how-to-modify-it)
9. [Troubleshooting](#troubleshooting)
10. [Key concepts for beginners](#key-concepts-for-beginners)

---

## What does it do?

When you visit a GitHub repository page, this extension automatically:

1. Scans all the files listed in the repo for wearable sensor data files
2. Shows a floating panel on the right side of the screen listing every detected file
3. Lets you click **Analyze** on any file to instantly see:
   - How many rows of data it contains
   - The column names (e.g., `heart_rate`, `acc_x`, `temperature`)
   - Min, max, and average values for each sensor column
   - A sparkline chart showing the shape of the data over time

No login required. No data leaves your browser except to fetch the file from GitHub's own servers.

---

## What sensor types are supported?

| Sensor | What it measures | Typical unit | Example filenames |
|---|---|---|---|
| **Accelerometer** | Movement / motion in 3D space | m/s² | `accel_data.csv`, `imu_log.csv`, `gyro.dat` |
| **Heart Rate** | Beats per minute | bpm | `heart_rate.csv`, `hr_monitor.json`, `ecg.dat` |
| **SpO₂** | Blood oxygen saturation level | % | `spo2.csv`, `oxygen_saturation.csv`, `pulseox.json` |
| **Temperature** | Body or skin temperature | °C | `temperature.csv`, `skin_temp.dat`, `body_temp.json` |

Supported file formats: `.csv`, `.tsv`, `.json`, `.txt`, `.dat`, `.ndjson`

---

## File structure explained

```
wearable-detector-extension/
│
├── manifest.json       ← Tells Chrome what the extension is and what it can do
├── content.js          ← The main brain: runs on GitHub pages, detects files, shows the panel
├── content.css         ← Visual styling for the panel and toggle button
├── background.js       ← Lightweight background process (manages the toolbar badge)
├── popup.html          ← The small window that appears when you click the toolbar icon
├── popup.js            ← Logic for the popup window
├── popup.css           ← Styling for the popup window
│
└── icons/
    ├── icon16.svg      ← Tiny icon (shown in browser tabs)
    ├── icon48.svg      ← Medium icon (shown in extension settings)
    └── icon128.svg     ← Large icon (shown in Chrome Web Store)
```

### What each file does in plain English

**`manifest.json`**
This is like a passport for the extension. It tells Chrome:
- The extension's name, version, and description
- Which websites it's allowed to run on (`github.com`)
- Which files to load and when
- What permissions it needs (e.g., reading the active tab)

**`content.js`**
This is the heart of the extension. It runs automatically every time you visit a GitHub page. It:
- Scans the page for links to data files
- Checks filenames against sensor keyword lists
- Creates the floating panel you see on-screen
- Fetches and parses data files when you click Analyze
- Computes statistics and draws charts

**`content.css`**
All the visual design for the panel injected into GitHub pages — colors, fonts, layout, dark mode support.

**`background.js`**
A small always-running script (called a "service worker"). It currently manages clearing the badge count when you leave GitHub.

**`popup.html` / `popup.js` / `popup.css`**
The small dropdown that appears when you click the extension icon in your browser toolbar. It shows a summary of detected files and a button to open/close the panel on the page.

---

## How to install it (step by step)

This extension is not published to the Chrome Web Store, so you install it in **Developer Mode**. This is safe and common for personal or in-development extensions.

### Step 1 — Download or locate the extension folder

If you cloned this repository, the extension lives in:
```
Wearable-Sensor-Data-Viewer/wearable-detector-extension/
```

### Step 2 — Open Chrome's extension settings

In your Chrome browser address bar, type:
```
chrome://extensions/
```
Press Enter. You'll see a page listing all your installed extensions.

### Step 3 — Enable Developer Mode

In the top-right corner of the extensions page, you'll see a toggle labeled **Developer mode**. Click it to turn it **on**. New buttons will appear.

### Step 4 — Load the extension

Click the **Load unpacked** button (top-left of the page). A file picker will open.

Navigate to and select the `wearable-detector-extension` folder (the folder that contains `manifest.json`). Click **Select**.

### Step 5 — Confirm it loaded

The extension called **Wearable Sensor Data Detector** should now appear in your list. You'll also see its icon (an ECG waveform on a dark circle) in your browser toolbar.

> If you don't see the icon in the toolbar, click the puzzle-piece icon in the top-right of Chrome and pin the extension.

---

## How to use it

### On a repository page

1. Go to any GitHub repository that contains sensor data files.
2. The extension scans the file listing automatically.
3. If sensor files are found, a **floating panel** appears on the right side of the page, and a **toggle button** appears in the bottom-right corner.
4. In the panel, each detected file shows:
   - A colored badge with the sensor type (Accelerometer, HR, SpO₂, or Temp)
   - The filename (click it to open the file on GitHub)
   - An **Analyze** button

### Analyzing a file

1. Click the **Analyze** button next to a file.
2. The extension fetches the raw file content directly from GitHub.
3. After a moment, it displays:
   - Row count and column count
   - For each sensor column: average, min, max, and a sparkline chart
4. The sparkline shows you the shape of the data at a glance — spikes, trends, flat lines.

### On a single file view

If you open a sensor data file directly (e.g., click into `heart_rate.csv` on GitHub), the extension detects this automatically and runs the analysis immediately without needing to click Analyze.

### Using the toolbar popup

Click the extension icon in the top-right of Chrome to see a compact summary of:
- How many sensor files were found
- Which sensor types are present
- A list of all filenames
- A **View panel on page** button to open/close the main panel

### Closing the panel

Click the **×** button in the top-right of the panel, or click the toggle button in the bottom-right corner of the page.

---

## How detection works

### Step 1: Find candidate files

The extension looks at every link on the GitHub page that points to a file (these links contain `/blob/` in the URL). For example:

```
https://github.com/user/repo/blob/main/data/heart_rate.csv
                                         ^^^^^^^^^^^^^^^^^^^
                                         this part is checked
```

### Step 2: Check the file extension

Only files with these extensions are considered:

```
.csv  .tsv  .txt  .dat  .json  .ndjson
```

### Step 3: Match the filename against sensor keywords

Each sensor type has a list of keywords that are checked against the filename:

```
Accelerometer  →  accel, acceleromet, imu, gyro, inertial, motion_sensor
Heart Rate     →  heart, hr, bpm, pulse, ecg, ekg, ppg, cardiac
SpO₂           →  spo2, spO2, oxygen, oxim, saturation, pulseox
Temperature    →  temp, temperature, thermal, fever, body_temp, skin_temp
```

For example, a file named `wrist_accel_2024.csv` matches the `accel` keyword → classified as **Accelerometer**.

### Step 4: Parse the file

When you click Analyze, the extension:
1. Builds the raw file URL (swapping `github.com` for `raw.githubusercontent.com`)
2. Downloads the file content as plain text
3. Parses it:
   - **CSV**: detects the delimiter (comma, tab, semicolon, pipe), reads headers from row 1, parses up to 500 rows
   - **JSON**: expects an array of objects, reads keys as column names

### Step 5: Find sensor columns

Within the parsed data, the extension looks for columns whose names match sensor-specific keywords. For example, in a heart rate file it looks for columns named `hr`, `heart_rate`, `bpm`, `pulse`, etc.

If no sensor-specific columns are found, it falls back to using any numeric column.

---

## How the chart works

The sparkline chart is drawn using the **HTML Canvas API** — a built-in browser feature for drawing 2D graphics with JavaScript. No external charting library is used.

Here's what happens step by step:

1. The numeric values for a column are collected (e.g., 500 heart rate readings)
2. If there are more than 120 values, they are downsampled evenly so the chart stays readable
3. The minimum and maximum values are found to set the vertical scale
4. Each value is plotted as a point on the canvas, connected by a line
5. A gradient (colored at the top, transparent at the bottom) is filled under the line
6. Each sensor type has its own color:
   - Accelerometer: blue (`#3b82f6`)
   - Heart Rate: red (`#ef4444`)
   - SpO₂: purple (`#8b5cf6`)
   - Temperature: orange (`#f97316`)

---

## How to modify it

### Add a new sensor type

Open [content.js](content.js) and find the `SENSORS` object near the top. Add a new entry:

```javascript
const SENSORS = {
  // ... existing sensors ...

  emg: {
    fileKeywords: ['emg', 'electromyography', 'muscle'],
    columnKeywords: ['emg', 'muscle_activation', 'mv'],
    label: 'EMG',
    color: '#10b981',   // green
    unit: 'mV'
  }
};
```

That's it — the detection, panel, and charts will all pick it up automatically.

### Change the maximum number of rows parsed

In [content.js](content.js), find this line near the top:

```javascript
const MAX_ROWS = 500;
```

Increase it to parse more rows. Be aware that very large values may make analysis slow on big files.

### Add support for a new file extension

In [content.js](content.js), find:

```javascript
const DATA_EXTS = new Set(['.csv', '.tsv', '.txt', '.dat', '.json', '.ndjson']);
```

Add your extension to the set, for example `.parquet` or `.xlsx`. Note: you would also need to add a parser function for non-text formats.

### Change the panel position

In [content.css](content.css), find the `#wdd-panel` rule:

```css
#wdd-panel {
  position: fixed;
  top: 64px;
  right: 16px;   ← change to left: 16px to move it to the left
  width: 330px;
  ...
}
```

### After making changes

Because the extension is loaded in Developer Mode, you need to reload it after editing files:

1. Go to `chrome://extensions/`
2. Find **Wearable Sensor Data Detector**
3. Click the circular **reload** arrow icon
4. Refresh the GitHub page you're testing on

---

## Troubleshooting

**The panel doesn't appear**

- Make sure the extension is enabled on the `chrome://extensions/` page
- Refresh the GitHub page (press `Cmd+R` / `Ctrl+R`)
- Make sure you're on a repository page that actually has `.csv`, `.json`, or similar files with sensor-related names
- GitHub sometimes renders pages slowly — wait a second and try scrolling

**"Could not communicate with the page" in the popup**

- The content script hasn't loaded yet. Refresh the GitHub page and click the toolbar icon again.

**"HTTP 404" or fetch error when analyzing**

- The file may be in a private repository. This extension only works on public repos (no authentication is set up).
- The file URL may have changed. Try navigating directly to the file on GitHub first.

**The chart looks flat (no variation)**

- The column may contain constant values, or all the same number. This is valid data — it just means no change over time.

**The extension reloads when navigating between pages**

- This is normal. GitHub is a single-page app (SPA) — pages change without a full browser reload. The extension listens for URL changes and re-scans automatically. There's a brief delay (about 600ms) to let GitHub finish rendering before scanning.

**Dark mode looks wrong**

- The extension auto-detects your system's dark mode setting using CSS `prefers-color-scheme`. If it looks off, check your system's appearance settings.

---

## Key concepts for beginners

If you're new to browser extensions, here are the core ideas:

**Content Script**
A JavaScript file that the browser injects into web pages. It can read and modify the page's HTML, add new elements (like our panel), and fetch data. It runs in an isolated context — it can't access the page's own JavaScript variables, and the page can't access the extension's variables.

**Service Worker (background.js)**
A script that runs in the background, separate from any tab. In Manifest V3 (the current Chrome extension format), this replaces the older "background page." It wakes up when needed and goes to sleep when idle.

**Manifest V3**
The current version of Chrome's extension API (as of 2023+). It's more secure and performant than V2. Key differences include using service workers instead of persistent background pages.

**Permissions**
Extensions must declare exactly what they're allowed to do. This extension requests:
- `activeTab` — read information about the currently active tab
- `storage` — save small amounts of data locally (available but not currently used)
- Host permission for `github.com` and `raw.githubusercontent.com` — allowed to run scripts on GitHub and fetch raw file content

**Raw GitHub URL**
When you view a file on GitHub at `github.com/user/repo/blob/main/file.csv`, the downloadable raw content lives at `raw.githubusercontent.com/user/repo/main/file.csv`. The extension automatically converts blob URLs to raw URLs for fetching.

**Canvas API**
A browser API for drawing 2D graphics directly in the browser using JavaScript. The sparkline charts are drawn pixel-by-pixel on a `<canvas>` HTML element — no images, no external libraries.

**MutationObserver**
A browser API that watches for changes to the page's DOM (HTML structure). The extension uses it to detect when GitHub's single-page app navigates to a new repository without reloading the page, so it can re-run the file scan in the file.
