const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { google } = require("googleapis");

const app = express();

const PORT = process.env.PORT || 10000;


// ======================================================
// Middleware
// ======================================================

app.use(
  express.json({
    limit: "1mb"
  })
);


// ======================================================
// Temporary folders
// ======================================================

const uploadDir = "/tmp/uploads";
const outputDir = "/tmp/outputs";

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });


// ======================================================
// Multer
// ======================================================

const upload = multer({
  dest: uploadDir,

  limits: {
    fileSize: 500 * 1024 * 1024
  }
});


// ======================================================
// Google configuration
// ======================================================

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || "";

const GOOGLE_API_KEY =
  process.env.GOOGLE_API_KEY || "";

const GOOGLE_APP_ID =
  "54132452919";


// ======================================================
// Safe filename
// ======================================================

function safeBaseName(filename) {

  return path.parse(filename)
    .name
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);

}


// ======================================================
// Sleep
// ======================================================

function sleep(ms) {

  return new Promise(
    resolve => setTimeout(resolve, ms)
  );

}


// ======================================================
// FFmpeg conversion
// ======================================================

function convertVideo(inputPath, outputPath) {

  return new Promise((resolve, reject) => {

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
      "Starting FFmpeg conversion..."
    );


    execFile(
      "ffmpeg",
      ffmpegArgs,
      {
        maxBuffer: 10 * 1024 * 1024
      },
      (error, stdout, stderr) => {

        if (error) {

          console.error(
            "FFmpeg conversion failed."
          );

          console.error(
            stderr.slice(-4000)
          );

          reject(
            new Error(
              "FFmpeg conversion failed.\n\n" +
              stderr.slice(-4000)
            )
          );

          return;
        }


        console.log(
          "FFmpeg conversion completed."
        );


        resolve();

      }
    );

  });

}


// ======================================================
// Homepage
// ======================================================

app.get("/", (req, res) => {

  res.send(`
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1.0"
>

<title>
Button Phone Video Converter
</title>


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


hr {

  margin: 25px 0;

  border: 0;

  border-top: 1px solid #444;

}

</style>

</head>


<body>


<div class="box">


<h1>
Button Phone Video Converter
</h1>


<p>
144p • MPEG-4 Part 2 • MP4 • 15 FPS • AAC mono 32 kbps
</p>


<hr>


<h3>
Local Video
</h3>


<input
  type="file"
  id="videoFile"
  accept="video/*"
>


<button id="convertButton">
Convert Local Video
</button>


<hr>


<h3>
Google Drive
</h3>


<button id="driveButton">
Select Video from Google Drive
</button>


<div id="status">
JavaScript is starting...
</div>


</div>


<script src="https://accounts.google.com/gsi/client"></script>

<script src="https://apis.google.com/js/api.js"></script>


<script>


// ======================================================
// Google configuration
// ======================================================

const GOOGLE_CLIENT_ID =
  ${JSON.stringify(GOOGLE_CLIENT_ID)};


const GOOGLE_API_KEY =
  ${JSON.stringify(GOOGLE_API_KEY)};


const APP_ID =
  ${JSON.stringify(GOOGLE_APP_ID)};


// ======================================================
// DOM
// ======================================================

const statusBox =
  document.getElementById("status");


const videoFile =
  document.getElementById("videoFile");


const convertButton =
  document.getElementById("convertButton");


const driveButton =
  document.getElementById("driveButton");


// ======================================================
// Google variables
// ======================================================

let pickerApiLoaded = false;

let tokenClient = null;

let accessToken = null;


// ======================================================
// JavaScript startup
// ======================================================

statusBox.textContent =
  "JavaScript is working successfully.\\n\\n" +
  "Select a local video or use Google Drive.";

console.log(
  "JavaScript started successfully."
);


// ======================================================
// Local video selection
// ======================================================

videoFile.addEventListener(
  "change",
  function () {

    if (
      !videoFile.files ||
      !videoFile.files.length
    ) {

      statusBox.textContent =
        "No video selected.";

      return;

    }


    const file =
      videoFile.files[0];


    statusBox.textContent =
      "Video selected successfully.\\n\\n" +

      "File: " +
      file.name +

      "\\n" +

      "Size: " +
      (
        file.size /
        1024 /
        1024
      ).toFixed(2) +

      " MB\\n\\n" +

      "Press Convert to start.";

  }
);


// ======================================================
// Local conversion request
// ======================================================

async function sendLocalConversion(file) {

  let lastError = null;


  for (
    let attempt = 1;
    attempt <= 3;
    attempt++
  ) {

    try {

      statusBox.textContent =
        "Connecting to conversion server...\\n\\n" +

        "Attempt " +
        attempt +
        " of 3";


      // Small delay before the first request.
      // This helps during Render startup/wake-up.
      if (attempt === 1) {

        await sleep(1000);

      }


      const formData =
        new FormData();


      formData.append(
        "video",
        file
      );


      statusBox.textContent =
        "Uploading video to server...\\n\\n" +

        "Attempt " +
        attempt +
        " of 3";


      const response =
        await fetch(
          "/convert",
          {
            method: "POST",
            body: formData,
            cache: "no-store"
          }
        );


      if (!response.ok) {

        const errorText =
          await response.text();


        throw new Error(
          errorText ||
          "Server conversion failed."
        );

      }


      const result =
        await response.json();


      if (
        !result ||
        !result.downloadUrl
      ) {

        throw new Error(
          "Server returned an invalid conversion result."
        );

      }


      return result;

    }


    catch (error) {

      console.error(
        "Conversion attempt failed:",
        error
      );


      lastError = error;


      if (attempt < 3) {

        statusBox.textContent =
          "Server connection interrupted.\\n\\n" +

          "Retrying automatically...\\n\\n" +

          "Attempt " +
          (attempt + 1) +
          " of 3";


        await sleep(2000);

      }

    }

  }


  throw lastError ||
    new Error(
      "Conversion request failed."
    );

}


// ======================================================
// Local conversion button
// ======================================================

convertButton.addEventListener(
  "click",
  async function () {

    if (
      !videoFile.files ||
      !videoFile.files.length
    ) {

      statusBox.textContent =
        "Please select a video first.";

      return;

    }


    const file =
      videoFile.files[0];


    convertButton.disabled = true;


    try {

      const result =
        await sendLocalConversion(file);


      statusBox.innerHTML =
        "Conversion completed successfully.<br><br>" +

        '<a href="' +
        result.downloadUrl +
        '" ' +
        'style="color:#4ade80;font-size:18px;">' +

        "Download Converted Video" +

        "</a>";

    }


    catch (error) {

      statusBox.textContent =
        "Conversion failed.\\n\\n" +
        error.message;

    }


    finally {

      convertButton.disabled = false;

    }

  }
);


// ======================================================
// Google Picker API loading
// ======================================================

function loadPickerApi() {

  if (
    typeof gapi === "undefined"
  ) {

    console.error(
      "Google API library is not available."
    );

    return;

  }


  gapi.load(
    "picker",
    function () {

      pickerApiLoaded = true;

      console.log(
        "Google Picker API loaded."
      );

    }
  );

}


loadPickerApi();


// ======================================================
// Google Drive button
// ======================================================

driveButton.addEventListener(
  "click",
  function () {

    if (!GOOGLE_CLIENT_ID) {

      statusBox.textContent =
        "Google Client ID is missing.";

      return;

    }


    if (!GOOGLE_API_KEY) {

      statusBox.textContent =
        "Google API Key is missing.";

      return;

    }


    statusBox.textContent =
      "Opening Google Drive...\\n\\n" +
      "Please wait.";


    startGoogleLogin();

  }
);


// ======================================================
// Google OAuth token
// ======================================================

function startGoogleLogin() {

  try {

    if (
      typeof google === "undefined" ||
      !google.accounts ||
      !google.accounts.oauth2
    ) {

      throw new Error(
        "Google Identity Services did not load."
      );

    }


    tokenClient =
      google.accounts.oauth2.initTokenClient({

        client_id:
          GOOGLE_CLIENT_ID,

        scope:
          "https://www.googleapis.com/auth/drive.file",

        callback:
          function (response) {

            if (response.error) {

              statusBox.textContent =
                "Google authorization failed.\\n\\n" +
                (
                  response.error_description ||
                  response.error
                );

              return;

            }


            if (
              !response.access_token
            ) {

              statusBox.textContent =
                "Google did not return an access token.";

              return;

            }


            accessToken =
              response.access_token;


            statusBox.textContent =
              "Google Drive connected.\\n\\n" +
              "Opening file picker...";


            openPicker();

          }

      });


    tokenClient.requestAccessToken({

      prompt: "select_account"

    });

  }


  catch (error) {

    console.error(
      "Google login error:",
      error
    );


    statusBox.textContent =
      "Google authorization error.\\n\\n" +
      error.message;

  }

}


// ======================================================
// Google Picker
// ======================================================

function openPicker() {

  if (!pickerApiLoaded) {

    statusBox.textContent =
      "Google Picker is still loading.\\n\\n" +
      "Please try again.";

    return;

  }


  if (!accessToken) {

    statusBox.textContent =
      "Google access token is missing.";

    return;

  }


  try {

    const videoView =
      new google.picker.DocsView(
        google.picker.ViewId.DOCS
      );


    videoView.setMimeTypes(
      "video/mp4,video/x-msvideo,video/quicktime,video/webm,video/*"
    );


    const picker =
      new google.picker.PickerBuilder()

        .setDeveloperKey(
          GOOGLE_API_KEY
        )

        .setAppId(
          APP_ID
        )

        .setOAuthToken(
          accessToken
        )

        .setOrigin(
          window.location.protocol +
          "//" +
          window.location.host
        )

        .addView(
          videoView
        )

        .setCallback(
          pickerCallback
        )

        .enableFeature(
          google.picker.Feature.NAV_HIDDEN
        )

        .build();


    picker.setVisible(true);

  }


  catch (error) {

    console.error(
      "Google Picker error:",
      error
    );


    statusBox.textContent =
      "Google Picker could not open.\\n\\n" +
      error.message;

  }

}


// ======================================================
// Picker callback
// ======================================================

function pickerCallback(data) {

  if (
    data.action ===
    google.picker.Action.PICKED
  ) {

    const file =
      data.docs[0];


    const fileName =
      file.name ||
      "Google Drive video";


    const fileId =
      file.id ||
      "";


    statusBox.textContent =
      "Google Drive video selected successfully.\\n\\n" +

      "File name: " +
      fileName +

      "\\n\\n" +

      "Starting server download...";


    downloadDriveVideo(
      fileId,
      fileName
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


// ======================================================
// Google Drive conversion
// ======================================================

async function downloadDriveVideo(
  fileId,
  fileName
) {

  if (!accessToken) {

    statusBox.textContent =
      "Google access token is missing.";

    return;

  }


  try {

    const response =
      await fetch(
        "/convert-drive",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            fileId:
              fileId,

            fileName:
              fileName,

            accessToken:
              accessToken

          })

        }
      );


    if (!response.ok) {

      const errorText =
        await response.text();


      throw new Error(
        errorText ||
        "Google Drive conversion failed."
      );

    }


    const result =
      await response.json();


    statusBox.innerHTML =
      "Google Drive conversion completed successfully.<br><br>" +

      '<a href="' +
      result.downloadUrl +
      '" ' +
      'style="color:#4ade80;font-size:18px;">' +

      "Download Converted Video" +

      "</a>";

  }


  catch (error) {

    console.error(
      "Google Drive conversion error:",
      error
    );


    statusBox.textContent =
      "Google Drive conversion failed.\\n\\n" +
      error.message;

  }

}


</script>


</body>

</html>
  `);

});


// ======================================================
// Local video conversion endpoint
// ======================================================

app.post(
  "/convert",
  upload.single("video"),
  async (req, res) => {

    if (!req.file) {

      return res.status(400).send(
        "No video file received."
      );

    }


    const inputPath =
      req.file.path;


    const originalName =
      path.basename(
        req.file.originalname
      );


    const baseName =
      safeBaseName(
        originalName
      );


    const outputName =
      baseName +
      "_144p_MPEG4.mp4";


    const outputPath =
      path.join(
        outputDir,
        outputName
      );


    try {

      console.log(
        "Local video received:",
        originalName
      );


      await convertVideo(
        inputPath,
        outputPath
      );


      console.log(
        "Local conversion completed:",
        outputName
      );


      return res.json({

        success: true,

        filename:
          outputName,

        downloadUrl:
          "/download/" +
          encodeURIComponent(
            outputName
          )

      });

    }


    catch (error) {

      console.error(
        "Local conversion error:",
        error
      );


      return res.status(500).send(
        error.message
      );

    }


    finally {

      try {

        if (
          fs.existsSync(inputPath)
        ) {

          fs.unlinkSync(
            inputPath
          );

        }

      }

      catch (_) {}

    }

  }
);


// ======================================================
// Google Drive conversion endpoint
// ======================================================

app.post(
  "/convert-drive",
  async (req, res) => {

    const {
      fileId,
      fileName,
      accessToken
    } = req.body;


    if (
      !fileId ||
      !accessToken
    ) {

      return res.status(400).send(
        "Google Drive file information is missing."
      );

    }


    const safeName =
      safeBaseName(
        fileName ||
        "drive_video"
      );


    const inputPath =
      path.join(
        uploadDir,
        "drive_" +
        Date.now() +
        "_" +
        safeName +
        ".input"
      );


    const outputName =
      safeName +
      "_144p_MPEG4.mp4";


    const outputPath =
      path.join(
        outputDir,
        outputName
      );


    try {

      console.log(
        "Starting Google Drive download:",
        safeName
      );


      const auth =
        new google.auth.OAuth2();


      auth.setCredentials({

        access_token:
          accessToken

      });


      const drive =
        google.drive({

          version: "v3",

          auth

        });


      const response =
        await drive.files.get(

          {
            fileId:
              fileId,

            alt:
              "media"

          },

          {
            responseType:
              "stream"
          }

        );


      await new Promise(
        (resolve, reject) => {

          const writer =
            fs.createWriteStream(
              inputPath
            );


          response.data
            .on(
              "error",
              reject
            )
            .pipe(writer);


          writer.on(
            "finish",
            resolve
          );


          writer.on(
            "error",
            reject
          );

        }
      );


      console.log(
        "Google Drive download completed:",
        safeName
      );


      await convertVideo(
        inputPath,
        outputPath
      );


      console.log(
        "Google Drive conversion completed:",
        outputName
      );


      return res.json({

        success: true,

        filename:
          outputName,

        downloadUrl:
          "/download/" +
          encodeURIComponent(
            outputName
          )

      });

    }


    catch (error) {

      console.error(
        "Google Drive conversion error:",
        error
      );


      return res.status(500).send(
        "Google Drive conversion failed.\n\n" +
        error.message
      );

    }


    finally {

      try {

        if (
          fs.existsSync(inputPath)
        ) {

          fs.unlinkSync(
            inputPath
          );

        }

      }

      catch (_) {}

    }

  }
);


// ======================================================
// Download converted video
// ======================================================

app.get(
  "/download/:filename",
  (req, res) => {

    const filename =
      path.basename(
        decodeURIComponent(
          req.params.filename
        )
      );


    const filePath =
      path.join(
        outputDir,
        filename
      );


    if (
      !fs.existsSync(filePath)
    ) {

      return res.status(404).send(
        "Converted file not found."
      );

    }


    res.download(
      filePath,
      filename
    );

  }
);


// ======================================================
// Health check
// ======================================================

app.get(
  "/health",
  (req, res) => {

    res.json({

      status:
        "ok"

    });

  }
);


// ======================================================
// Start server
// ======================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "Cloud Button Phone Video Converter running on port " +
      PORT
    );

  }
);

//এই ভার্সনে মূল পরিবর্তনগুলো আমি করে দিয়েছি: "serverReady"/"waitForServer()" সম্পূর্ণ বাদ, Local conversion-এর automatic retry রাখা হয়েছে, "express.json()" সঠিক জায়গায় নেওয়া হয়েছে, এবং Google Drive conversion flow-টিও রাখা হয়েছে।

//এখন শুধু পুরো "server.js" replace → commit → Render deploy করুন। তারপর প্রথমে Local Video দিয়ে test করবেন। Google Drive-এ আপাতত কিছু পরিবর্তন করার প্রয়োজন নেই।
