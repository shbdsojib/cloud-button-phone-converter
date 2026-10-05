const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const app = express();

const PORT = process.env.PORT || 10000;

const UPLOAD_DIR = "/tmp/uploads";
const OUTPUT_DIR = "/tmp/outputs";

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: {
    fileSize: 500 * 1024 * 1024
  }
});


// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ready"
  });
});


// --------------------------------------------------
// Homepage
// --------------------------------------------------

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

<title>Button Phone Video Converter</title>

<style>

body {
  font-family: Arial, sans-serif;
  background: #111;
  color: white;
  margin: 0;
  padding: 20px;
}

.container {
  max-width: 600px;
  margin: 30px auto;
}

.box {
  background: #222;
  padding: 20px;
  border-radius: 12px;
}

h1 {
  font-size: 24px;
}

input,
button {
  width: 100%;
  box-sizing: border-box;
  padding: 14px;
  margin-top: 15px;
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
  padding: 15px;
  background: #292929;
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-word;
}

a {
  color: #4ade80;
  font-size: 18px;
}

</style>

</head>

<body>

<div class="container">

<div class="box">

<h1>
Cloud Button Phone Video Converter
</h1>

<p>
Clean Local Testing Version
</p>

<p>
Target: 144p • MPEG-4 Part 2 • MP4 • 15 FPS • AAC mono 32 kbps
</p>

<input
  id="videoFile"
  type="file"
  accept="video/*"
>

<button
  id="convertButton"
  disabled
>
Convert Local Video
</button>

<div id="status">
Checking server...
</div>

</div>

</div>


<script>

const videoFile =
  document.getElementById("videoFile");

const convertButton =
  document.getElementById("convertButton");

const statusBox =
  document.getElementById("status");


// --------------------------------------------------
// Server check
// --------------------------------------------------

async function checkServer() {

  statusBox.textContent =
    "Connecting to conversion server...";

  try {

    const response =
      await fetch(
        "/health?time=" + Date.now(),
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        "Server health check failed."
      );
    }

    const data =
      await response.json();

    if (
      data.success !== true
    ) {
      throw new Error(
        "Server is not ready."
      );
    }

    convertButton.disabled = false;

    statusBox.textContent =
      "Server Ready.\\n\\n" +
      "Select a video to begin.";

  }

  catch (error) {

    statusBox.textContent =
      "Server connection failed.\\n\\n" +
      error.message;

    convertButton.disabled = true;

  }

}


// --------------------------------------------------
// Video selection
// --------------------------------------------------

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

    const sizeMB =
      (
        file.size /
        1024 /
        1024
      ).toFixed(2);

    statusBox.textContent =
      "Video selected successfully.\\n\\n" +

      "File: " +
      file.name +

      "\\n" +

      "Size: " +
      sizeMB +
      " MB\\n\\n" +

      "Press Convert to start.";

  }
);


// --------------------------------------------------
// Conversion
// --------------------------------------------------

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {

  for (let attempt = 1; attempt <= 15; attempt++) {

    statusBox.textContent =
      "Starting conversion server...\n\n" +
      "Please wait. Attempt " +
      attempt +
      " of 15.";

    try {

      const response = await fetch(
        "/health?time=" + Date.now(),
        {
          cache: "no-store"
        }
      );

      if (response.ok) {

        const data =
          await response.json();

        if (data.success === true) {
          return true;
        }

      }

    } catch (error) {

      console.log(
        "Server is waking up:",
        error.message
      );

    }

    await delay(2000);
  }

  return false;
}


async function uploadAndConvert(file) {

  const formData = new FormData();

  formData.append(
    "video",
    file
  );

  const response = await fetch(
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
      "Conversion failed."
    );

  }

  return await response.json();
}


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

      // ------------------------------------------
      // Step 1: Wake Render server
      // ------------------------------------------

      const serverReady =
        await waitForServer();

      if (!serverReady) {

        throw new Error(
          "Conversion server could not be started. Please try again."
        );

      }


      // ------------------------------------------
      // Step 2: Upload and convert
      // ------------------------------------------

      statusBox.textContent =
        "Server is ready.\n\n" +
        "Uploading video...\n\n" +
        "Please wait.";

      let result = null;

      let lastError = null;


      for (
        let attempt = 1;
        attempt <= 3;
        attempt++
      ) {

        try {

          statusBox.textContent =
            "Uploading and converting video...\n\n" +
            "Attempt " +
            attempt +
            " of 3.\n\n" +
            "Please wait.";

          result =
            await uploadAndConvert(file);

          break;

        }

        catch (error) {

          lastError = error;

          console.log(
            "Conversion attempt failed:",
            error.message
          );

          if (attempt < 3) {

            statusBox.textContent =
              "Connection interrupted.\n\n" +
              "Retrying automatically...\n\n" +
              "Please wait.";

            await delay(3000);

          }

        }

      }


      if (!result) {

        throw (
          lastError ||
          new Error(
            "Conversion failed."
          )
        );

      }


      // ------------------------------------------
      // Step 3: Success
      // ------------------------------------------

      statusBox.innerHTML =
        "Conversion completed successfully." +
        "<br><br>" +

        '<a href="' +
        result.downloadUrl +
        '">' +

        "Download Converted Video" +

        "</a>";

    }

    catch (error) {

      statusBox.textContent =
        "Conversion failed.\n\n" +
        error.message;

    }

    finally {

      convertButton.disabled = false;

    }

  }
);


// --------------------------------------------------
// Start
// --------------------------------------------------

checkServer();

</script>

</body>

</html>
  `);

});


// --------------------------------------------------
// Conversion endpoint
// --------------------------------------------------

app.post(
  "/convert",
  upload.single("video"),
  async (req, res) => {

    if (!req.file) {

      return res
        .status(400)
        .send("No video file received.");

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
          /[^a-zA-Z0-9_-]/g,
          "_"
        )
        .slice(0, 100);

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


    try {

      await new Promise(
        (resolve, reject) => {

          execFile(
            "ffmpeg",
            ffmpegArgs,
            {
              maxBuffer:
                10 * 1024 * 1024
            },

            (
              error,
              stdout,
              stderr
            ) => {

              if (error) {

                console.error(
                  "FFmpeg error:"
                );

                console.error(
                  stderr
                );

                reject(
                  new Error(
                    "FFmpeg conversion failed.\\n\\n" +
                    stderr.slice(-3000)
                  )
                );

                return;

              }

              resolve();

            }

          );

        }
      );


      if (
        !fs.existsSync(
          outputFile
        )
      ) {

        throw new Error(
          "FFmpeg finished but output file was not created."
        );

      }


      console.log(
        "Conversion completed:",
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
        error
      );

      return res
        .status(500)
        .send(
          error.message
        );

    }

    finally {

      try {

        if (
          fs.existsSync(
            inputFile
          )
        ) {

          fs.unlinkSync(
            inputFile
          );

        }

      }

      catch (_) {}

    }

  }
);


// --------------------------------------------------
// Download
// --------------------------------------------------

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
          "Converted file not found."
        );

    }

    res.download(
      filePath,
      filename
    );

  }
);


// --------------------------------------------------
// Start server
// --------------------------------------------------

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
