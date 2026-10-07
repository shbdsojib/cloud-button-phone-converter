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
// Live debug status
// --------------------------------------------------

const LIVE_STATUS_FILE =
  path.join(
    "/tmp",
    "live-status.json"
  );


let liveStatus = {

  server: "Ready",

  convertRequest:
    "Waiting",

  fileUpload:
    "Waiting",

  ffmpeg:
    "Waiting",

  result:
    "Waiting",

  updatedAt:
    new Date().toISOString()

};


try {

  if (
    fs.existsSync(
      LIVE_STATUS_FILE
    )
  ) {

    liveStatus =
      JSON.parse(
        fs.readFileSync(
          LIVE_STATUS_FILE,
          "utf8"
        )
      );

  }

}
catch (_) {}


function updateLiveStatus(
  field,
  value
) {

  liveStatus[field] =
    value;

  liveStatus.updatedAt =
    new Date().toISOString();


  try {

    fs.writeFileSync(
      LIVE_STATUS_FILE,
      JSON.stringify(
        liveStatus,
        null,
        2
      )
    );

  }

  catch (_) {}

}


// --------------------------------------------------
// Health
// --------------------------------------------------

app.get(
  "/health",
  (req, res) => {

    updateLiveStatus(
      "server",
      "Ready"
    );

    res.status(200).json({

      success: true,

      status:
        "ready"

    });

  }
);


// --------------------------------------------------
// Live status API
// --------------------------------------------------

app.get(
  "/live-status",
  (req, res) => {

    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );

    res.set(
      "Pragma",
      "no-cache"
    );

    res.set(
      "Expires",
      "0"
    );

    res.send(`
<!DOCTYPE html>
<html>
<head>

<meta charset="UTF-8">

<meta
  http-equiv="Cache-Control"
  content="no-cache, no-store, must-revalidate"
>

<meta
  http-equiv="Pragma"
  content="no-cache"
>

<meta
  http-equiv="Expires"
  content="0"
>

<title>Live Server Status</title>

<style>

body {
  margin: 0;
  padding: 15px;
  background: #111;
  color: #fff;
  font-family: monospace;
  font-size: 14px;
}

.status {
  padding: 15px;
  background: #1f1f1f;
  border: 1px solid #444;
  border-radius: 8px;
}

h3 {
  margin-top: 0;
}

</style>

</head>

<body>

<div class="status">

<h3>LIVE SERVER STATUS</h3>

Server:
${liveStatus.server}

<br><br>

Convert Request:
${liveStatus.convertRequest}

<br><br>

File Upload:
${liveStatus.fileUpload}

<br><br>

FFmpeg:
${liveStatus.ffmpeg}

<br><br>

Result:
${liveStatus.result}

<br><br>

Updated:
${liveStatus.updatedAt}

</div>

<script>

setTimeout(function () {

  window.location.replace(
    "/live-status?refresh=" +
    Date.now()
  );

}, 1000);

</script>

</body>
</html>
`);

  }
);

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

<button
  id="connectionTestButton"
  type="button"
>
  Test Server Connection
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

// --------------------------------------------------
// Connection Test
// --------------------------------------------------

const connectionTestButton =
  document.createElement("button");

connectionTestButton.type =
  "button";

connectionTestButton.textContent =
  "Test Server Connection";

connectionTestButton.style.marginTop =
  "10px";

convertButton.parentNode.appendChild(
  connectionTestButton
);


connectionTestButton.addEventListener(
  "click",
  async function () {

    connectionTestButton.disabled =
      true;

    connectionTestButton.textContent =
      "Testing...";

    try {

      const response =
        await fetch(
          "/health?test=" +
          Date.now(),
          {
            method: "GET",
            cache: "no-store"
          }
        );

      if (!response.ok) {

        throw new Error(
          "HTTP " +
          response.status
        );

      }

      const result =
        await response.json();

      statusBox.textContent =
        "SERVER CONNECTION TEST: PASSED\n\n" +
        "Server response: " +
        result.status;

    }

    catch (error) {

      statusBox.textContent =
        "SERVER CONNECTION TEST: FAILED\n\n" +
        "Error: " +
        error.message;

    }

    finally {

      connectionTestButton.disabled =
        false;

      connectionTestButton.textContent =
        "Test Server Connection";

    }

  }
);

//

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


      /*await delay(2000);*/


      // --------------------------------------------
      // Reload as Version 2
      // --------------------------------------------

      /*window.location.href =
        "/?version=2";*/

        return;
    }

  }
);

</script>

<iframe
  src="/live-status"
  style="
    width:100%;
    height:300px;
    border:0;
    border-radius:8px;
    background:#111;
  "
></iframe>

<script>
(function () {

  function updateLiveStatusBox() {

    fetch("/live-status?time=" + Date.now())
      .then(function (response) {
        return response.text();
      })
      .then(function (text) {

        var data;

        try {
          data = JSON.parse(text);
        } catch (error) {
          return;
        }

        var box =
          document.getElementById("liveDebugBox");

        if (!box) {
          return;
        }

        box.textContent =
          "LIVE SERVER STATUS\n\n" +
          "Server: " +
          data.server +
          "\n" +
          "Convert Request: " +
          data.convertRequest +
          "\n" +
          "File Upload: " +
          data.fileUpload +
          "\n" +
          "FFmpeg: " +
          data.ffmpeg +
          "\n" +
          "Result: " +
          data.result +
          "\n\n" +
          "Updated: " +
          data.updatedAt;

      })
      .catch(function () {});

  }

  updateLiveStatusBox();

  setInterval(
    updateLiveStatusBox,
    2000
  );

})();
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

  (req, res, next) => {

    updateLiveStatus(
      "convertRequest",
      "Received"
    );

    updateLiveStatus(
      "result",
      "Waiting"
    );

    upload.single("video")(
      req,
      res,
      function (error) {

        if (error) {

          console.error(
            "UPLOAD ERROR:",
            error
          );

          updateLiveStatus(
            "fileUpload",
            "FAILED"
          );

          updateLiveStatus(
            "ffmpeg",
            "Not started"
          );

          updateLiveStatus(
            "result",
            "Upload failed: " +
            error.message
          );

          return res
            .status(500)
            .send(
              "Upload failed: " +
              error.message
            );

        }

        next();

      }
    );

  },

  async (req, res) => {

    if (!req.file) {

      updateLiveStatus(
        "fileUpload",
        "Failed"
      );

      updateLiveStatus(
        "result",
        "Conversion failed"
      );

      return res
        .status(400)
        .send(
          "No video file received."
        );

    }


    updateLiveStatus(
      "fileUpload",
      "Received"
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


    updateLiveStatus(
      "ffmpeg",
      "Running"
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

  updateLiveStatus(
    "ffmpeg",
    "FAILED"
  );

  updateLiveStatus(
    "result",
    "FFmpeg conversion failed"
  );

  reject(
    new Error(
      "FFmpeg conversion failed.\n\n" +
      stderr.slice(-3000)
    )
  );

  return;

}

              updateLiveStatus(
                "ffmpeg",
                "Completed"
              );

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

        updateLiveStatus(
          "result",
          "Output file missing"
        );

        throw new Error(
          "FFmpeg finished but output file was not created."
        );

      }


      updateLiveStatus(
        "result",
        "Conversion successful"
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

      updateLiveStatus(
        "result",
        "Conversion failed"
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
// all code end