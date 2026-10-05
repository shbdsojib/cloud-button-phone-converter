const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const app = express();
const PORT = process.env.PORT || 10000;

// ===============================
// Folders
// ===============================
const uploadDir = "/tmp/uploads";
const outputDir = "/tmp/outputs";

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });

// ===============================
// Multer
// ===============================
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

// ===============================
// Google configuration
// ===============================
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// ===============================
// Home page
// ===============================
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Button Phone Video Converter</title>

  <style>
    body {
      font-family: Arial, sans-serif;
      background: #111;
      color: #fff;
      margin: 0;
      padding: 20px;
    }

    .box {
      max-width: 600px;
      margin: auto;
      background: #1d1d1d;
      padding: 20px;
      border-radius: 12px;
    }

    h1 {
      font-size: 24px;
      margin-top: 0;
    }

    button,
    input[type="file"] {
      width: 100%;
      box-sizing: border-box;
      margin-top: 12px;
      padding: 12px;
      border-radius: 8px;
      border: none;
    }

    button {
      background: #1976d2;
      color: white;
      font-size: 16px;
      cursor: pointer;
    }

    button:disabled {
      background: #555;
      cursor: not-allowed;
    }

    #status {
      margin-top: 20px;
      padding: 12px;
      background: #292929;
      border-radius: 8px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    a {
      color: #4db8ff;
    }
  </style>
</head>

<body>

<div class="box">

  <h1>Button Phone Video Converter</h1>

  <p>
    144p • MPEG-4 Part 2 • MP4 • 15 FPS • AAC mono 32 kbps
  </p>

  <hr>

  <h3>Local Video</h3>

  <input
    type="file"
    id="videoFile"
    accept="video/*"
  >

  <button id="convertButton">
    Convert Local Video
  </button>

  <hr>

  <h3>Google Drive</h3>

  <button id="driveButton">
    Select Video from Google Drive
  </button>

  <div id="status">
    JavaScript is starting...
  </div>

</div>

<!-- Google Identity Services -->
<script src="https://accounts.google.com/gsi/client"></script>

<!-- Google Picker -->
<script src="https://apis.google.com/js/api.js"></script>

<script>

const GOOGLE_CLIENT_ID = ${JSON.stringify(GOOGLE_CLIENT_ID || "")};
const GOOGLE_API_KEY = ${JSON.stringify(GOOGLE_API_KEY || "")};

const APP_ID = "54132452919";

const statusBox = document.getElementById("status");
const videoFile = document.getElementById("videoFile");
const convertButton = document.getElementById("convertButton");
const driveButton = document.getElementById("driveButton");

let pickerApiLoaded = false;
let tokenClient = null;
let accessToken = null;


// ==========================================
// Basic status
// ==========================================

statusBox.textContent =
  "JavaScript is working successfully.\\n\\nSelect a local video or use Google Drive.";

console.log("Button Phone Converter started.");


// ==========================================
// Local video selection
// ==========================================

videoFile.addEventListener("change", function () {

  if (!videoFile.files || !videoFile.files.length) {
    statusBox.textContent = "No video selected.";
    return;
  }

  const file = videoFile.files[0];

  statusBox.textContent =
    "Video selected successfully.\\n\\n" +
    "File: " + file.name + "\\n" +
    "Size: " + (file.size / 1024 / 1024).toFixed(2) + " MB\\n\\n" +
    "Press Convert to start.";
});


// ==========================================
// Local conversion
// ==========================================

convertButton.addEventListener("click", async function () {

  if (!videoFile.files || !videoFile.files.length) {
    statusBox.textContent = "Please select a video first.";
    return;
  }

  const file = videoFile.files[0];

  const formData = new FormData();
  formData.append("video", file);

  convertButton.disabled = true;

  statusBox.textContent =
    "Uploading video...\\n\\n" +
    "Please wait.";

  try {

    const response = await fetch("/convert", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {

      const errorText = await response.text();

      throw new Error(
        errorText || "Server conversion failed."
      );
    }

    const result = await response.json();

    statusBox.innerHTML =
      "Conversion completed successfully.\\n\\n" +
      '<a href="' + result.downloadUrl + '">' +
      "Download Converted Video" +
      "</a>";

  } catch (error) {

    statusBox.textContent =
      "Conversion failed.\\n\\n" +
      error.message;

  } finally {

    convertButton.disabled = false;
  }

});


// ==========================================
// Google Picker API loading
// ==========================================

function loadPickerApi() {

  gapi.load("picker", function () {

    pickerApiLoaded = true;

    console.log("Google Picker API loaded.");

  });
}

loadPickerApi();


// ==========================================
// Google Drive button
// ==========================================

driveButton.addEventListener("click", function () {

  if (!GOOGLE_CLIENT_ID) {

    statusBox.textContent =
      "Google Client ID is missing from Render Environment Variables.";

    return;
  }

  if (!GOOGLE_API_KEY) {

    statusBox.textContent =
      "Google API Key is missing from Render Environment Variables.";

    return;
  }

  statusBox.textContent =
    "Opening Google Drive...\\n\\nPlease wait.";

  startGoogleLogin();

});


// ==========================================
// Google Identity Services
// ==========================================

function startGoogleLogin() {

  try {

    tokenClient = google.accounts.oauth2.initTokenClient({

      client_id: GOOGLE_CLIENT_ID,

      scope:
        "https://www.googleapis.com/auth/drive.file",

      callback: function(response) {

        if (response.error) {

          statusBox.textContent =
            "Google authorization failed.\\n\\n" +
            response.error;

          return;
        }

        accessToken = response.access_token;

        statusBox.textContent =
          "Google Drive connected.\\n\\n" +
          "Opening file picker...";

        openPicker();

      }

    });

    tokenClient.requestAccessToken({
      prompt: ""
    });

  } catch (error) {

    statusBox.textContent =
      "Google authorization error.\\n\\n" +
      error.message;

  }

}


// ==========================================
// Google Picker
// ==========================================

function openPicker() {

  if (!pickerApiLoaded) {

    statusBox.textContent =
      "Google Picker is still loading.\\n\\nPlease try again.";

    return;
  }

  if (!accessToken) {

    statusBox.textContent =
      "Google access token is missing.";

    return;
  }

  const videoView = new google.picker.DocsView(
    google.picker.ViewId.DOCS
  );

  videoView.setMimeTypes(
    "video/mp4,video/x-msvideo,video/quicktime,video/webm,video/*"
  );

  const picker = new google.picker.PickerBuilder()

    .setDeveloperKey(GOOGLE_API_KEY)

    .setAppId(APP_ID)

    .setOAuthToken(accessToken)

    .setOrigin(
      window.location.protocol +
      "//" +
      window.location.host
    )

    .addView(videoView)

    .setCallback(pickerCallback)

    .enableFeature(
      google.picker.Feature.NAV_HIDDEN
    )

    .build();

  picker.setVisible(true);
}


// ==========================================
// Picker callback
// ==========================================

function pickerCallback(data) {

  if (
    data.action ===
    google.picker.Action.PICKED
  ) {

    const file = data.docs[0];

    statusBox.textContent =
      "Google Drive video selected successfully.\\n\\n" +

      "File name: " +
      (file.name || "Unknown") +

      "\\n\\nFile ID: " +
      (file.id || "Unknown") +

      "\\n\\nPicker test successful.";

    console.log(
      "Selected Google Drive file:",
      file
    );

  }

  else if (
    data.action ===
    google.picker.Action.CANCEL
  ) {

    statusBox.textContent =
      "Google Drive picker cancelled.";

  }

}

</script>

</body>
</html>
  `);
});


// ==========================================
// Local conversion endpoint
// ==========================================

app.post("/convert", upload.single("video"), (req, res) => {

  if (!req.file) {

    return res.status(400).send(
      "No video file received."
    );
  }

  const inputPath = req.file.path;

  const originalName =
    path.basename(req.file.originalname);

  const baseName =
    path.parse(originalName).name
      .replace(/[^a-zA-Z0-9_-]/g, "_");

  const outputName =
    baseName + "_144p_MPEG4.mp4";

  const outputPath =
    path.join(outputDir, outputName);


  const ffmpegArgs = [

    "-y",

    "-i",
    inputPath,

    "-vf",
    "scale=256:144:force_original_aspect_ratio=decrease,pad=256:144:(ow-iw)/2:(oh-ih)/2",

    "-r",
    "15",

    "-c:v",
    "mpeg4",

    "-b:v",
    "180k",

    "-c:a",
    "aac",

    "-ac",
    "1",

    "-b:a",
    "32k",

    "-ar",
    "44100",

    "-movflags",
    "+faststart",

    outputPath
  ];


  console.log(
    "Starting FFmpeg conversion:",
    originalName
  );


  execFile(
    "ffmpeg",
    ffmpegArgs,
    {
      maxBuffer: 10 * 1024 * 1024
    },
    (error, stdout, stderr) => {

      try {
        fs.unlinkSync(inputPath);
      } catch (_) {}


      if (error) {

        console.error(
          "FFmpeg conversion failed:"
        );

        console.error(stderr);

        return res.status(500).send(
          "FFmpeg conversion failed.\\n\\n" +
          stderr.slice(-4000)
        );
      }


      console.log(
        "FFmpeg conversion completed:",
        outputName
      );


      res.json({

        success: true,

        filename: outputName,

        downloadUrl:
          "/download/" +
          encodeURIComponent(outputName)

      });

    }
  );

});


// ==========================================
// Download
// ==========================================

app.get("/download/:filename", (req, res) => {

  const filename =
    path.basename(req.params.filename);

  const filePath =
    path.join(outputDir, filename);


  if (!fs.existsSync(filePath)) {

    return res.status(404).send(
      "Converted file not found."
    );
  }


  res.download(filePath, filename);

});


// ==========================================
// Health check
// ==========================================

app.get("/health", (req, res) => {

  res.json({
    status: "ok"
  });

});


// ==========================================
// Start server
// ==========================================

app.listen(PORT, () => {

  console.log(
    "Cloud Button Phone Video Converter running on port " +
    PORT
  );

});
