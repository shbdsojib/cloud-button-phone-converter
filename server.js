const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { google } = require("googleapis");

const app = express();

const PORT = process.env.PORT || 10000;

/* =========================================================
   Google OAuth - SERVER SIDE
   ========================================================= */

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/* =========================================================
   Google Cloud Project Number
   ========================================================= */

const GOOGLE_APP_ID = "54132452919";

/* =========================================================
   Temporary directories
   ========================================================= */

const UPLOAD_DIR = "/tmp/uploads";
const OUTPUT_DIR = "/tmp/outputs";

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/* =========================================================
   Multer upload configuration
   ========================================================= */

const upload = multer({
  dest: UPLOAD_DIR,

  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

/* =========================================================
   Google OAuth test route
   ========================================================= */

app.get("/auth/google", (req, res) => {

  try {

    const authUrl = oauth2Client.generateAuthUrl({

      access_type: "offline",

      prompt: "consent",

      scope: [
        "https://www.googleapis.com/auth/drive.file"
      ]

    });

    res.redirect(authUrl);

  } catch (error) {

    console.error(
      "Google OAuth start error:",
      error
    );

    res
      .status(500)
      .send(
        "Could not start Google authorization."
      );

  }

});

/* =========================================================
   Google OAuth callback
   ========================================================= */

app.get("/oauth2callback", async (req, res) => {

  try {

    const { code } = req.query;

    if (!code) {

      return res
        .status(400)
        .send(
          "Authorization code missing."
        );

    }

    const { tokens } =
      await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    console.log(
      "Google OAuth authorization completed."
    );

    res.send(`

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>Google Drive Connected</title>

<style>

body{
  font-family:Arial,sans-serif;
  background:#111;
  color:#fff;
  text-align:center;
  padding:40px 20px;
}

.box{
  max-width:500px;
  margin:auto;
  background:#222;
  padding:30px;
  border-radius:14px;
}

</style>

</head>

<body>

<div class="box">

<h2>
Google Drive Connected Successfully
</h2>

<p>
You can close this page and return to the converter.
</p>

</div>

</body>

</html>

    `);

  } catch (error) {

    console.error(
      "OAuth callback error:",
      error
    );

    res
      .status(500)
      .send(
        "Google authorization failed."
      );

  }

});

/* =========================================================
   Homepage
   ========================================================= */

app.get("/", (req, res) => {

  res.send(`

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>
Cloud Button Phone Video Converter
</title>

<style>

*{
  box-sizing:border-box;
}

body{

  font-family:Arial,sans-serif;

  max-width:600px;

  margin:0 auto;

  padding:20px;

  background:#111;

  color:#fff;

}

h1{

  font-size:24px;

  margin-top:0;

}

.box{

  background:#222;

  padding:20px;

  border-radius:14px;

}

.description{

  color:#bbb;

  margin-bottom:20px;

}

button{

  width:100%;

  padding:14px;

  margin-top:15px;

  border:0;

  border-radius:8px;

  font-size:16px;

  cursor:pointer;

  background:#fff;

  color:#111;

}

button:disabled{

  opacity:0.5;

  cursor:not-allowed;

}

input[type="file"]{

  width:100%;

  margin-top:15px;

  padding:10px;

  background:#333;

  color:#fff;

  border-radius:8px;

}

#status{

  margin-top:20px;

  padding:15px;

  background:#181818;

  border-radius:8px;

  white-space:pre-wrap;

  word-break:break-word;

  line-height:1.5;

}

.success{

  color:#4ade80;

}

.error{

  color:#f87171;

}

.info{

  color:#60a5fa;

}

a.download-link{

  display:block;

  margin-top:15px;

  color:#4ade80;

  font-size:18px;

}

</style>

</head>

<body>

<div class="box">

<h1>
Cloud Button Phone Video Converter
</h1>

<p class="description">
Server-side FFmpeg test
</p>

<button
  id="driveButton"
  type="button"
>
Import Video from Google Drive
</button>

<input
  id="video"
  type="file"
  accept="video/*"
>

<button
  id="convertButton"
  type="button"
>
Convert to 144p MPEG-4
</button>

<div
  id="status"
  class="info"
>
Starting JavaScript...
</div>

</div>


<script>

/* =========================================================
   Browser configuration
   ========================================================= */

/*
  IMPORTANT:

  Client ID is public and is intended for browser use.

  API key is also used in the browser, but it must remain
  restricted in Google Cloud Console.
*/

const GOOGLE_CLIENT_ID =
  "54132452919-5s9v4pkqj9bidkvkbr0ot2rbjvkm82oo.apps.googleusercontent.com";

const GOOGLE_API_KEY =
  "AIzaSyBdPEvU-VFi758txglD485239hoA6Lwgsc";

const GOOGLE_APP_ID =
  "54132452919";


/* =========================================================
   Global Google Picker variables
   ========================================================= */

let pickerTokenClient = null;

let pickerAccessToken = null;

let googleIdentityLoaded = false;

let googleApiLoaded = false;

let googlePickerLoaded = false;


/* =========================================================
   Status helper
   ========================================================= */

function setStatus(message, type = "info") {

  const status =
    document.getElementById("status");

  if (!status) {
    return;
  }

  status.className = type;

  status.textContent = message;

}


/* =========================================================
   Dynamic script loader
   ========================================================= */

function loadExternalScript(src) {

  return new Promise((resolve, reject) => {

    const existing =
      document.querySelector(
        'script[src="' + src + '"]'
      );

    if (existing) {

      resolve();

      return;

    }

    const script =
      document.createElement("script");

    script.src = src;

    script.async = true;

    script.onload = () => {

      resolve();

    };

    script.onerror = () => {

      reject(
        new Error(
          "Could not load:\n" + src
        )
      );

    };

    document.head.appendChild(script);

  });

}


/* =========================================================
   Load Google Identity Services
   ========================================================= */

async function loadGoogleIdentityServices() {

  if (
    googleIdentityLoaded &&
    window.google &&
    window.google.accounts &&
    window.google.accounts.oauth2
  ) {

    return;

  }

  setStatus(
    "Loading Google authentication...",
    "info"
  );

  await loadExternalScript(
    "https://accounts.google.com/gsi/client"
  );

  if (
    !window.google ||
    !window.google.accounts ||
    !window.google.accounts.oauth2
  ) {

    throw new Error(
      "Google Identity Services did not load correctly."
    );

  }

  googleIdentityLoaded = true;

}


/* =========================================================
   Load Google API client
   ========================================================= */

async function loadGoogleApiClient() {

  if (
    googleApiLoaded &&
    window.gapi
  ) {

    return;

  }

  setStatus(
    "Loading Google Picker library...",
    "info"
  );

  await loadExternalScript(
    "https://apis.google.com/js/api.js"
  );

  if (!window.gapi) {

    throw new Error(
      "Google API client did not load."
    );

  }

  await new Promise((resolve, reject) => {

    try {

      window.gapi.load(
        "picker",
        {

          callback: function() {

            googlePickerLoaded = true;

            resolve();

          },

          onerror: function() {

            reject(
              new Error(
                "Google Picker API could not be loaded."
              )
            );

          }

        }
      );

    } catch (error) {

      reject(error);

    }

  });

  googleApiLoaded = true;

}


/* =========================================================
   Initialize Google OAuth token client
   ========================================================= */

function initializePickerTokenClient() {

  if (
    !window.google ||
    !window.google.accounts ||
    !window.google.accounts.oauth2
  ) {

    throw new Error(
      "Google Identity Services is not available."
    );

  }

  pickerTokenClient =
    window.google.accounts.oauth2.initTokenClient({

      client_id:
        GOOGLE_CLIENT_ID,

      scope:
        "https://www.googleapis.com/auth/drive.file",

      callback:
        function(response) {

          if (!response) {

            setStatus(
              "Google returned an empty response.",
              "error"
            );

            return;

          }

          if (response.error) {

            console.error(
              "Google OAuth token error:",
              response
            );

            setStatus(
              "Google authorization failed.\\n\\n" +
              (
                response.error_description ||
                response.error
              ),
              "error"
            );

            return;

          }

          if (!response.access_token) {

            setStatus(
              "Google did not return an access token.",
              "error"
            );

            return;

          }

          pickerAccessToken =
            response.access_token;

          setStatus(
            "Google account authorized.\\n" +
            "Opening Google Drive Picker...",
            "info"
          );

          createGooglePicker();

        }

    });

}


/* =========================================================
   Open Google Drive Picker
   ========================================================= */

async function openGoogleDrivePicker() {

  try {

    setStatus(
      "Starting Google Drive...",
      "info"
    );

    await loadGoogleIdentityServices();

    await loadGoogleApiClient();

    if (!pickerTokenClient) {

      initializePickerTokenClient();

    }

    setStatus(
      "Please choose your Google account...",
      "info"
    );

    pickerTokenClient.requestAccessToken({

      prompt: "select_account"

    });

  } catch (error) {

    console.error(
      "Google Drive Picker error:",
      error
    );

    setStatus(
      "Google Drive Picker error:\\n\\n" +
      error.message,
      "error"
    );

  }

}


/* =========================================================
   Create Google Picker
   ========================================================= */

function createGooglePicker() {

  try {

    if (
      !window.google ||
      !window.google.picker
    ) {

      throw new Error(
        "Google Picker API is not available."
      );

    }

    if (!pickerAccessToken) {

      throw new Error(
        "Google access token is missing."
      );

    }


    /*
      DocsView is used instead of the older
      DOCS_VIDEOS style.

      This allows us to explicitly filter
      the displayed files by MIME type.
    */

    const videoView =
      new window.google.picker.DocsView(
        window.google.picker.ViewId.DOCS
      )

        .setIncludeFolders(false)

        .setSelectFolderEnabled(false)

        .setMimeTypes(
          "video/mp4," +
          "video/quicktime," +
          "video/webm," +
          "video/x-msvideo," +
          "video/x-matroska"
        );


    const builder =
      new window.google.picker.PickerBuilder()

        .setDeveloperKey(
          GOOGLE_API_KEY
        )

        .setAppId(
          GOOGLE_APP_ID
        )

        .setOAuthToken(
          pickerAccessToken
        )

        .addView(
          videoView
        )

        .setMaxItems(1)

        .setCallback(
          pickerCallback
        )

        .setOrigin(
          window.location.protocol +
          "//" +
          window.location.host
        );


    const picker =
      builder.build();


    picker.setVisible(true);


    setStatus(
      "Google Drive Picker opened.",
      "info"
    );

  } catch (error) {

    console.error(
      "Picker creation error:",
      error
    );

    setStatus(
      "Google Picker could not open:\\n\\n" +
      error.message,
      "error"
    );

  }

}


/* =========================================================
   Google Picker callback
   ========================================================= */

function pickerCallback(data) {

  try {

    if (!data) {

      setStatus(
        "Google Picker returned no data.",
        "error"
      );

      return;

    }


    if (
      data.action ===
      window.google.picker.Action.PICKED
    ) {

      if (
        !data.docs ||
        !data.docs.length
      ) {

        setStatus(
          "No file information was returned.",
          "error"
        );

        return;

      }


      const file =
        data.docs[0];


      const fileId =
        file.id || "Unknown";


      const fileName =
        file.name || "Unknown";


      setStatus(

        "Google Drive video selected successfully.\\n\\n" +

        "File name:\\n" +
        fileName +
        "\\n\\n" +

        "File ID:\\n" +
        fileId +
        "\\n\\n" +

        "Picker test completed successfully.\\n" +
        "The next stage will send this file to the server.",

        "success"

      );


      console.log(
        "Selected Google Drive file:",
        file
      );


      /*
        IMPORTANT:

        This testing version does NOT download
        the selected Drive file yet.

        That will be implemented after the
        Picker test is confirmed working.
      */

      return;

    }


    if (
      data.action ===
      window.google.picker.Action.CANCEL
    ) {

      setStatus(
        "Google Drive selection cancelled.",
        "info"
      );

      return;

    }


    setStatus(
      "Google Picker returned an unknown action.",
      "error"
    );

  } catch (error) {

    console.error(
      "Picker callback error:",
      error
    );

    setStatus(
      "Picker callback error:\\n\\n" +
      error.message,
      "error"
    );

  }

}


/* =========================================================
   Local device video conversion
   ========================================================= */

async function convertVideo() {

  const input =
    document.getElementById("video");

  const convertButton =
    document.getElementById("convertButton");


  if (
    !input ||
    !input.files ||
    !input.files.length
  ) {

    setStatus(
      "Please select a video from your device first.",
      "error"
    );

    return;

  }


  const selectedFile =
    input.files[0];


  const formData =
    new FormData();


  formData.append(
    "video",
    selectedFile
  );


  convertButton.disabled = true;


  setStatus(
    "Uploading video to server...\\n\\n" +
    "File: " +
    selectedFile.name +
    "\\n" +
    "Size: " +
    formatFileSize(selectedFile.size) +
    "\\n\\n" +
    "Please wait.",
    "info"
  );


  try {

    const response =
      await fetch(
        "/convert",
        {

          method: "POST",

          body: formData

        }
      );


    if (!response.ok) {

      const errorText =
        await response.text();

      throw new Error(
        errorText ||
        "Server returned an error."
      );

    }


    const data =
      await response.json();


    if (
      !data ||
      !data.download
    ) {

      throw new Error(
        "Server completed the conversion but did not return a download link."
      );

    }


    setStatus(
      "Conversion completed successfully.",
      "success"
    );


    const status =
      document.getElementById("status");


    const link =
      document.createElement("a");


    link.href =
      data.download;


    link.className =
      "download-link";


    link.textContent =
      "Download Converted Video";


    link.target =
      "_blank";


    status.appendChild(
      link
    );


  } catch (error) {

    console.error(
      "Conversion error:",
      error
    );

    setStatus(
      "Conversion failed:\\n\\n" +
      error.message,
      "error"
    );

  } finally {

    convertButton.disabled = false;

  }

}


/* =========================================================
   File size helper
   ========================================================= */

function formatFileSize(bytes) {

  if (!bytes) {

    return "0 B";

  }


  const units = [
    "B",
    "KB",
    "MB",
    "GB"
  ];


  const index =
    Math.floor(
      Math.log(bytes) /
      Math.log(1024)
    );


  const safeIndex =
    Math.min(
      index,
      units.length - 1
    );


  return (
    bytes /
    Math.pow(1024, safeIndex)
  ).toFixed(2) +
  " " +
  units[safeIndex];

}


/* =========================================================
   Page initialization
   ========================================================= */

function initializePage() {

  const driveButton =
    document.getElementById("driveButton");

  const convertButton =
    document.getElementById("convertButton");


  if (!driveButton) {

    setStatus(
      "ERROR: Google Drive button was not found.",
      "error"
    );

    return;

  }


  if (!convertButton) {

    setStatus(
      "ERROR: Convert button was not found.",
      "error"
    );

    return;

  }


  driveButton.addEventListener(
    "click",
    openGoogleDrivePicker
  );


  convertButton.addEventListener(
    "click",
    convertVideo
  );


  setStatus(
    "JavaScript loaded successfully.\\n\\n" +
    "Ready for testing.",
    "success"
  );


  console.log(
    "Converter page JavaScript initialized successfully."
  );

}


/* =========================================================
   Start browser application
   ========================================================= */

if (
  document.readyState === "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializePage
  );

} else {

  initializePage();

}

</script>

</body>

</html>

  `);

});


/* =========================================================
   Video conversion endpoint
   ========================================================= */

app.post(
  "/convert",
  upload.single("video"),
  (req, res) => {

    if (!req.file) {

      return res
        .status(400)
        .send(
          "No video uploaded."
        );

    }


    const inputFile =
      req.file.path;


    const originalName =
      path.parse(
        req.file.originalname
      ).name;


    const safeName =
      originalName
        .replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );


    const outputName =
      safeName +
      "_144p_MPEG4.mp4";


    const outputFile =
      path.join(
        OUTPUT_DIR,
        outputName
      );


    const ffmpegArgs = [

      "-y",

      "-i",
      inputFile,

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

      outputFile

    ];


    console.log(
      "========================================"
    );

    console.log(
      "Starting FFmpeg conversion"
    );

    console.log(
      "Input:",
      req.file.originalname
    );

    console.log(
      "Output:",
      outputName
    );

    console.log(
      "========================================"
    );


    execFile(

      "ffmpeg",

      ffmpegArgs,

      {
        maxBuffer:
          10 * 1024 * 1024
      },

      (error, stdout, stderr) => {


        /*
          Delete uploaded temporary input.
        */

        try {

          fs.unlinkSync(
            inputFile
          );

        } catch (_) {}


        if (error) {

          console.error(
            "FFmpeg conversion failed:"
          );

          console.error(
            stderr
          );


          return res
            .status(500)
            .send(
              "FFmpeg conversion failed.\\n\\n" +
              stderr.slice(-3000)
            );

        }


        if (
          !fs.existsSync(
            outputFile
          )
        ) {

          return res
            .status(500)
            .send(
              "Conversion finished but output file was not created."
            );

        }


        console.log(
          "FFmpeg conversion completed successfully."
        );


        res.json({

          success: true,

          filename:
            outputName,

          download:
            "/download/" +
            encodeURIComponent(
              outputName
            )

        });

      }

    );

  }
);


/* =========================================================
   Download converted video
   ========================================================= */

app.get(
  "/download/:filename",
  (req, res) => {

    try {

      const filename =
        path.basename(
          decodeURIComponent(
            req.params.filename
          )
        );


      const filePath =
        path.join(
          OUTPUT_DIR,
          filename
        );


      if (
        !fs.existsSync(
          filePath
        )
      ) {

        return res
          .status(404)
          .send(
            "File not found."
          );

      }


      res.download(
        filePath,
        filename,
        (error) => {

          if (error) {

            console.error(
              "Download error:",
              error
            );

          }

        }
      );

    } catch (error) {

      console.error(
        "Download route error:",
        error
      );

      res
        .status(500)
        .send(
          "Could not download the file."
        );

    }

  }
);


/* =========================================================
   Health check
   ========================================================= */

app.get(
  "/health",
  (req, res) => {

    res.json({

      status: "ok",

      service:
        "cloud-button-phone-converter",

      ffmpeg:
        "server-side",

      time:
        new Date().toISOString()

    });

  }
);


/* =========================================================
   Start server
   ========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "========================================"
    );

    console.log(
      "Cloud Button Phone Video Converter"
    );

    console.log(
      "Server running on port:",
      PORT
    );

    console.log(
      "========================================"
    );

  }
);
