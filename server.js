const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { google } = require("googleapis");

const app = express();

const PORT = process.env.PORT || 10000;

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);


const UPLOAD_DIR = "/tmp/uploads";
const OUTPUT_DIR = "/tmp/outputs";

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

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

const upload = multer({
  dest: UPLOAD_DIR,
  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

app.get("/oauth2callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Authorization code missing.");
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    res.send(`
      <h2>Google Drive Connected Successfully</h2>
      <p>You can close this page and return to the converter.</p>
    `);
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).send("Google authorization failed.");
  }
});

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cloud Button Phone Video Converter</title>
<style>
body{
  font-family:Arial,sans-serif;
  max-width:600px;
  margin:40px auto;
  padding:20px;
  background:#111;
  color:#fff;
}
h1{font-size:24px}
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
#status{
  margin-top:20px;
  white-space:pre-wrap;
}
</style>
</head>

<body>

<div class="box">

<h1>Cloud Button Phone Video Converter</h1>

<p>
Server-side FFmpeg test
</p>

<button onclick="openGoogleDrivePicker()">
  Import Video from Google Drive
</button>

<input id="video" type="file" accept="video/*">

<button onclick="convertVideo()">
Convert to 144p MPEG-4
</button>

<div id="status"></div>

</div>

<script src="https://accounts.google.com/gsi/client"></script>
<script src="https://apis.google.com/js/api.js"></script>

<script>
const GOOGLE_CLIENT_ID = "54132452919-5s9v4pkqj9bidkvkbr0ot2rbjvkm82oo.apps.googleusercontent.com";
const GOOGLE_API_KEY = "AIzaSyBdPEvU-VFi758txglD485239hoA6Lwgsc";

let pickerTokenClient;
let pickerAccessToken = null;

function openGoogleDrivePicker() {

  pickerTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: "https://www.googleapis.com/auth/drive.file",

    callback: (response) => {

      if (response.error) {
        alert("Google authorization failed.");
        return;
      }

      pickerAccessToken = response.access_token;

      gapi.load("picker", () => {

        const picker = new google.picker.PickerBuilder()
          .setDeveloperKey(GOOGLE_API_KEY)
          .setOAuthToken(pickerAccessToken)
          .addView(google.picker.ViewId.VIDEO)
          .setCallback(pickerCallback)
          .build();

        picker.setVisible(true);

      });

    }
  });

  pickerTokenClient.requestAccessToken({
    prompt: "select_account"
  });
}

function pickerCallback(data) {

  if (data.action === google.picker.Action.PICKED) {

    const file = data.docs[0];

    document.getElementById("status").textContent =
      "Selected from Google Drive:\n" + file.name;

    console.log("Selected Drive file:", file);
  }

}

async function convertVideo(){

  const input = document.getElementById("video");
  const status = document.getElementById("status");

  if(!input.files.length){
    status.textContent = "Please select a video first.";
    return;
  }

  const formData = new FormData();

  formData.append("video", input.files[0]);

  status.textContent =
    "Uploading video to server...\\nPlease wait.";

  try{

    const response = await fetch("/convert",{
      method:"POST",
      body:formData
    });

    if(!response.ok){

      const text = await response.text();

      throw new Error(text);

    }

    const data = await response.json();

    status.innerHTML =
      "Conversion completed successfully.\\n\\n" +
      '<a href="' + data.download + '" ' +
      'style="color:#4ade80;font-size:18px;">' +
      "Download Converted Video" +
      "</a>";

  }catch(error){

    status.textContent =
      "Conversion failed:\\n" +
      error.message;

  }

}

</script>

</body>
</html>
`);
});

app.post("/convert", upload.single("video"), (req, res) => {

  if (!req.file) {
    return res.status(400).send("No video uploaded.");
  }

  const inputFile = req.file.path;

  const originalName = path.parse(req.file.originalname).name;

  const safeName = originalName
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const outputName =
    safeName + "_144p_MPEG4.mp4";

  const outputFile =
    path.join(OUTPUT_DIR, outputName);

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

  console.log("Starting FFmpeg conversion...");
  console.log("Input:", req.file.originalname);

  execFile(
    "ffmpeg",
    ffmpegArgs,
    {
      maxBuffer: 10 * 1024 * 1024
    },
    (error, stdout, stderr) => {

      try {
        fs.unlinkSync(inputFile);
      } catch (_) {}

      if (error) {

        console.error(stderr);

        return res.status(500).send(
          "FFmpeg conversion failed.\n\n" +
          stderr.slice(-3000)
        );

      }

      if (!fs.existsSync(outputFile)) {

        return res.status(500).send(
          "Conversion finished but output file was not created."
        );

      }

      console.log("Conversion completed.");
      console.log("Output:", outputFile);

      res.json({
        success: true,
        filename: outputName,
        download: "/download/" +
          encodeURIComponent(outputName)
      });

    }
  );

});

app.get("/download/:filename", (req, res) => {

  const filename = path.basename(
    decodeURIComponent(req.params.filename)
  );

  const filePath =
    path.join(OUTPUT_DIR, filename);

  if (!fs.existsSync(filePath)) {

    return res.status(404).send(
      "File not found."
    );

  }

  res.download(
    filePath,
    filename
  );

});

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    "Cloud Button Phone Video Converter running on port " +
    PORT
  );

});
