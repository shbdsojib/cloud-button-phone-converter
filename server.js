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

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ready"
  });
});

app.get("/startup-test", (req, res) => {

  const testOutput =
    path.join(
      OUTPUT_DIR,
      "startup-test.mp4"
    );

  const testArgs = [

    "-y",

    "-f",
    "lavfi",

    "-i",
    "testsrc=size=256x144:rate=15",

    "-f",
    "lavfi",

    "-i",
    "anullsrc=channel_layout=mono:sample_rate=44100",

    "-t",
    "2",

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

    testOutput

  ];

  execFile(
    "ffmpeg",
    testArgs,
    {
      maxBuffer:
        10 * 1024 * 1024
    },

    (error, stdout, stderr) => {

      if (error) {

        console.error(
          "Startup test failed:",
          stderr
        );

        return res
          .status(500)
          .send(
            "Startup test failed."
          );

      }

      if (
        !fs.existsSync(
          testOutput
        )
      ) {

        return res
          .status(500)
          .send(
            "Startup test output was not created."
          );

      }

      try {

        fs.unlinkSync(
          testOutput
        );

      }

      catch (_) {}

      return res.json({
        success: true,
        status: "ready"
      });

    }
  );

});

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

// add start now 1
<button
  id="startTestButton"
  type="button"
>
  Start Now
</button>

<div
  id="startTestStatus"
  style="
    margin-top:10px;
    padding:10px;
    background:#292929;
    border-radius:8px;
    white-space:pre-wrap;
  "
>
Ready for Start Now test.
</div>

// add start now 1 end

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
>
Convert Local Video
</button>

<div id="status">
Ready For Convert V1

Select a video to begin.
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

const startTestButton =
  document.getElementById("startTestButton");

const startTestStatus =
  document.getElementById("startTestStatus");


// --------------------------------------------------
// Start Now test
// --------------------------------------------------

startTestButton.addEventListener(
  "click",
  function () {

    startTestStatus.textContent =
      "STARTUP TEST RUNNING";

    startTestButton.disabled = true;

    fetch(
      "/startup-test?test=" +
      Date.now()
    )
      .then(
        function (response) {

          if (
            response.status === 200
          ) {

            startTestStatus.textContent =
              "STARTUP TEST PASSED";

          }
          else {

            startTestStatus.textContent =
              "STARTUP TEST FAILED";

          }

          startTestButton.disabled =
            false;

        }
      )
      .catch(
        function (error) {

          startTestStatus.textContent =
            "STARTUP TEST FAILED";

          console.error(
            "Startup test error:",
            error
          );

          startTestButton.disabled =
            false;

        }
      );

  }
);


// --------------------------------------------------
// Version check
// --------------------------------------------------

const urlParams =
  new URLSearchParams(
    window.location.search
  );

if (
  urlParams.get("version") === "2"
) {

  statusBox.textContent =
    "Ready For Convert V2\\n\\n" +
    "Select a video to begin.";

}


// --------------------------------------------------
// Background server warm-up
// --------------------------------------------------

async function warmUpServer() {

  try {

    await fetch(
      "/health?warmup=" + Date.now(),
      {
        method: "GET",
        cache: "no-store"
      }
    );

    console.log(
      "Server warm-up request completed."
    );

  }

  catch (error) {

    console.log(
      "Background warm-up request:",
      error.message
    );

  }

}

warmUpServer();


// --------------------------------------------------
// Delay helper
// --------------------------------------------------

function delay(ms) {

  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );

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
// Upload + conversion
// --------------------------------------------------

async function convertVideo(file) {

  const formData =
    new FormData();

  formData.append(
    "video",
    file
  );

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
      "Server conversion failed."
    );

  }

  return await response.json();

}


// --------------------------------------------------
// Convert button
// --------------------------------------------------

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

      statusBox.textContent =
        "Uploading and converting video...\\n\\n" +
        "Please wait.";


      const result =
        await convertVideo(file);


      // --------------------------------------------
      // Success
      // --------------------------------------------

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

      console.log(
        "Conversion failed:",
        error
      );


      // --------------------------------------------
      // Automatic recovery
      // --------------------------------------------

      statusBox.textContent =
        "First conversion attempt failed.\\n\\n" +

        "Reconnecting...\\n\\n" +

        "The page will reload automatically in 2 seconds.";


      await delay(2000);


      // --------------------------------------------
      // Reload as Version 2
      // --------------------------------------------

      window.location.href =
        "/?version=2";

    }

  }
);

</script>

</body>

</html>
  `);

});


// --------------------------------------------------
// Video conversion
// --------------------------------------------------

app.post(
  "/convert",
  upload.single("video"),
  async (req, res) => {

    console.log(
      "========================================"
    );

    console.log(
      "CONVERT REQUEST RECEIVED"
    );

    console.log(
      "Request time:",
      new Date().toISOString()
    );


    if (!req.file) {

      console.error(
        "CONVERT ERROR: No video file received."
      );

      return res
        .status(400)
        .send(
          "No video file received."
        );

    }


    console.log(
      "FILE RECEIVED"
    );

    console.log(
      "Original filename:",
      req.file.originalname
    );

    console.log(
      "Uploaded file path:",
      req.file.path
    );

    console.log(
      "Uploaded file size:",
      req.file.size,
      "bytes"
    );


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


    console.log(
      "Output file:",
      outputFile
    );


    const ffmpegArgs = [

      "-y",

      "-i",
      inputFile,

      "-vf",
      "scale=256:144:force_original_aspect_ratio=decrease,pad=256:144:(ow-iw)/2:ih",

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
      "FFMPEG STARTING"
    );

    console.log(
      "FFmpeg input exists:",
      fs.existsSync(inputFile)
    );

    console.log(
      "FFmpeg arguments prepared."
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

              console.log(
                "FFMPEG PROCESS FINISHED"
              );


              if (error) {

                console.error(
                  "FFMPEG FAILED"
                );

                console.error(
                  "FFmpeg error code:",
                  error.code
                );

                console.error(
                  "FFmpeg error signal:",
                  error.signal
                );

                console.error(
                  "FFmpeg stderr:"
                );

                console.error(
                  stderr
                );

                reject(
                  new Error(
                    "FFmpeg conversion failed.\n\n" +
                    stderr.slice(-3000)
                  )
                );

                return;

              }


              console.log(
                "FFMPEG PROCESS SUCCESS"
              );

              resolve();

            }

          );

        }
      );


      console.log(
        "CHECKING OUTPUT FILE"
      );


      if (
        !fs.existsSync(
          outputFile
        )
      ) {

        console.error(
          "OUTPUT FILE NOT FOUND"
        );

        throw new Error(
          "FFmpeg finished but output file was not created."
        );

      }


      console.log(
        "OUTPUT FILE EXISTS"
      );


      const outputStats =
        fs.statSync(
          outputFile
        );


      console.log(
        "Output file size:",
        outputStats.size,
        "bytes"
      );


      console.log(
        "CONVERSION COMPLETED:",
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
        "CONVERSION CATCH ERROR"
      );

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

      console.log(
        "CLEANUP STARTING"
      );


      try {

        if (
          fs.existsSync(
            inputFile
          )
        ) {

          fs.unlinkSync(
            inputFile
          );

          console.log(
            "Input file deleted."
          );

        }

      }

      catch (cleanupError) {

        console.error(
          "Cleanup error:",
          cleanupError
        );

      }


      console.log(
        "CONVERT REQUEST FINISHED"
      );

      console.log(
        "========================================"
      );

    }

  }
);


// --------------------------------------------------
// Download converted video
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