const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { google } = require("googleapis");

const app = express();

const PORT = process.env.PORT || 10000;

/* =========================
   Google OAuth configuration
   ========================= */

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/* =========================
   Google Drive Picker
   ========================= */

// Google Cloud Project Number
const GOOGLE_APP_ID = "54132452919";

/* =========================
   Temporary directories
   ========================= */

const UPLOAD_DIR = "/tmp/uploads";
const OUTPUT_DIR = "/tmp/outputs";

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/* =========================
   Google OAuth
   ========================= */

app.get("/auth/google", (req, res) => {

  const authUrl = oauth2Client.generateAuthUrl({

    access_type: "offline",

    prompt: "consent",

    scope: [
      "https://www.googleapis.com/auth/drive.file"
    ]

  });

  res.redirect(authUrl);

});

/* =========================
   Multer upload
   ========================= */

const upload = multer({

  dest: UPLOAD_DIR,

  limits: {
    fileSize: 500 * 1024 * 1024
  }

});

/* =========================
   OAuth callback
   ========================= */

app.get("/oauth2callback", async (req, res) => {

  try {

    const { code } = req.query;

    if (!code) {

      return res
        .status(400)
        .send("Authorization code missing.");

    }

    const { tokens } =
      await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Google Drive Connected</title>
      </head>
      <body style="
        font-family:Arial,sans-serif;
        background:#111;
        color:#fff;
        padding:30px;
        text-align:center;
      ">

        <h2>Google Drive Connected Successfully</h2>

        <p>
          You can close this page and return to the converter.
        </p>

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
      .send("Google authorization failed.");

  }

});

/* =========================
   Homepage
   ========================= */

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

body{

  font-family:Arial,sans-serif;

  max-width:600px;

  margin:40px auto;

  padding:20px;

  background:#111;

  color:#fff;

}

h1{
  font-size:24px;
}

.box{

  background:#222;

  padding:20px;

  border-radius:12px;

}

button{

  width:100%;

  padding:14px;

  margin-top:15px;

  border:0;

  border-radius:8px;

  font-size:16px;

  cursor:pointer;

}

input{

  width:100%;

  margin-top:15px;

  box-sizing:border-box;

}

#status{

  margin-top:20px;

  white-space:pre-wrap;

}

</style>

</head>

<body>

<div class="box">

<h1>
Cloud Button Phone Video Converter
</h1>

<p>
Server-side FFmpeg test
</p>

<button onclick="openGoogleDrivePicker()">
Import Video from Google Drive
</button>

<input
  id="video"
  type="file"
  accept="video/*"
>

<button onclick="convertVideo()">
Convert to 144p MPEG-4
</button>

<div id="status"></div>

</div>


<!-- Google Identity Services -->
<script src="https://accounts.google.com/gsi/client"></script>

<!-- Google API Client -->
<script src="https://apis.google.com/js/api.js"></script>


<script>

/* =========================
   Google configuration
   ========================= */

// OAuth Web Client ID
const GOOGLE_CLIENT_ID =
  "54132452919-5s9v4pkqj9bidkvkbr0ot2rbjvkm82oo.apps.googleusercontent.com";

// Google API Key
const GOOGLE_API_KEY =
  "AIzaSyBdPEvU-VFi758txglD485239hoA6Lwgsc";

// Google Cloud Project Number
const GOOGLE_APP_ID =
  "54132452919";


/* =========================
   Picker variables
   ========================= */

let pickerTokenClient = null;

let pickerAccessToken = null;


/* =========================
   Open Google Drive Picker
   ========================= */

function openGoogleDrivePicker() {

  const status =
    document.getElementById("status");

  status.textContent =
    "Opening Google Drive...";


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


    pickerTokenClient =
      google.accounts.oauth2.initTokenClient({

        client_id:
          GOOGLE_CLIENT_ID,

        scope:
          "https://www.googleapis.com/auth/drive.file",

        callback:
          function(response) {

            if (
              response.error
            ) {

              console.error(
                "Google OAuth error:",
                response
              );

              status.textContent =
                "Google authorization failed:\n" +
                (
                  response.error_description ||
                  response.error
                );

              return;

            }


            if (
              !response.access_token
            ) {

              status.textContent =
                "Google did not return an access token.";

              return;

            }


            pickerAccessToken =
              response.access_token;


            loadGooglePicker();

          }

      });


    pickerTokenClient.requestAccessToken({

      prompt: "select_account"

    });


  } catch (error) {

    console.error(
      "Google Picker start error:",
      error
    );

    status.textContent =
      "Google Drive Picker error:\n" +
      error.message;

  }

}


/* =========================
   Load Google Picker
   ========================= */

function loadGooglePicker() {

  const status =
    document.getElementById("status");


  if (
    typeof gapi === "undefined"
  ) {

    status.textContent =
      "Google API library did not load.";

    return;

  }


  gapi.load(
    "picker",
    function() {

      createGooglePicker();

    }
  );

}


/* =========================
   Create Google Picker
   ========================= */

function createGooglePicker() {

  const status =
    document.getElementById("status");


  try {

    if (
      !google.picker
    ) {

      throw new Error(
        "Google Picker API did not load."
      );

    }


    const picker =
      new google.picker.PickerBuilder()

        // Google API Key
        .setDeveloperKey(
          GOOGLE_API_KEY
        )

        // OAuth access token
        .setOAuthToken(
          pickerAccessToken
        )

        // Google Cloud Project Number
        .setAppId(
          GOOGLE_APP_ID
        )

        // Show only Google Drive videos
        .addView(
          google.picker.ViewId.DOCS_VIDEOS
        )

        // Picker callback
        .setCallback(
          pickerCallback
        )

        .build();


    picker.setVisible(true);


    status.textContent =
      "Google Drive Picker opened.";

  } catch (error) {

    console.error(
      "Picker creation error:",
      error
    );

    status.textContent =
      "Google Picker could not open:\n" +
      error.message;

  }

}


/* =========================
   Picker callback
   ========================= */

function pickerCallback(data) {

  const status =
    document.getElementById("status");


  if (
    data.action ===
    google.picker.Action.PICKED
  ) {

    const file =
      data.docs[0];


    const fileId =
      file.id;


    const fileName =
      file.name;


    status.textContent =
      "Selected from Google Drive:\n" +
      fileName +
      "\n\nFile ID:\n" +
      fileId;


    console.log(
      "Selected Drive file:",
      file
    );


    /*
      The selected Drive file is currently
      only being identified.

      The next stage will send this file ID
      and the authorized access token to the
      server so the server can download the
      Drive video temporarily and convert it.
    */

  }


  else if (
    data.action ===
    google.picker.Action.CANCEL
  ) {

    status.textContent =
      "Google Drive selection cancelled.";

  }

}


/* =========================
   Local video conversion
   ========================= */

async function convertVideo(){

  const input =
    document.getElementById("video");

  const status =
    document.getElementById("status");


  if(
    !input.files.length
  ){

    status.textContent =
      "Please select a video first.";

    return;

  }


  const formData =
    new FormData();


  formData.append(
    "video",
    input.files[0]
  );


  status.textContent =
    "Uploading video to server...\n" +
    "Please wait.";


  try{

    const response =
      await fetch(
        "/convert",
        {
          method:"POST",
          body:formData
        }
      );


    if(
      !response.ok
    ){

      const text =
        await response.text();

      throw new Error(text);

    }


    const data =
      await response.json();


    status.innerHTML =
      "Conversion completed successfully.\\n\\n" +

      '<a href="' +
      data.download +
      '" ' +

      'style="' +
      'color:#4ade80;' +
      'font-size:18px;' +
      '">' +

      "Download Converted Video" +

      "</a>";


  }catch(error){

    status.textContent =
      "Conversion failed:\\n" +
      error.message;

  }

}


/* =========================
   End JavaScript
   ========================= */

</script>

</body>

</html>

  `);

});


/* =========================
   Video conversion
   ========================= */

app.post(
  "/convert",
  upload.single("video"),
  (req, res) => {

    if (!req.file) {

      return res
        .status(400)
        .send("No video uploaded.");

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
      "Starting FFmpeg conversion..."
    );

    console.log(
      "Input:",
      req.file.originalname
    );


    execFile(

      "ffmpeg",

      ffmpegArgs,

      {
        maxBuffer:
          10 * 1024 * 1024
      },

      (error, stdout, stderr) => {


        try {

          fs.unlinkSync(
            inputFile
          );

        } catch (_) {}


        if (error) {

          console.error(
            stderr
          );


          return res
            .status(500)
            .send(
              "FFmpeg conversion failed.\n\n" +
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
          "Conversion completed."
        );

        console.log(
          "Output:",
          outputFile
        );


        res.json({

          success:true,

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


/* =========================
   Download converted file
   ========================= */

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
      filename
    );

  }
);


/* =========================
   Start server
   ========================= */

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
