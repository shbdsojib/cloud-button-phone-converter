const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const app = express();

const PORT = process.env.PORT || 10000;


/* =========================================================
   Temporary directories
   ========================================================= */

const UPLOAD_DIR = "/tmp/uploads";
const OUTPUT_DIR = "/tmp/outputs";

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });


/* =========================================================
   Multer upload
   ========================================================= */

const upload = multer({

  dest: UPLOAD_DIR,

  limits: {
    fileSize: 500 * 1024 * 1024
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
Button Phone Video Converter
</title>

<style>

body {

  font-family: Arial, sans-serif;

  background: #111;

  color: white;

  max-width: 600px;

  margin: 0 auto;

  padding: 20px;

}

.box {

  background: #222;

  padding: 20px;

  border-radius: 12px;

}

h1 {

  font-size: 24px;

}

input[type="file"] {

  width: 100%;

  margin-top: 15px;

  padding: 10px;

  box-sizing: border-box;

}

button {

  width: 100%;

  padding: 15px;

  margin-top: 15px;

  border: 0;

  border-radius: 8px;

  font-size: 16px;

  cursor: pointer;

}

button:disabled {

  opacity: 0.5;

  cursor: not-allowed;

}

#status {

  margin-top: 20px;

  padding: 15px;

  background: #181818;

  border-radius: 8px;

  white-space: pre-wrap;

  word-break: break-word;

  line-height: 1.5;

}

.download {

  display: block;

  margin-top: 15px;

  color: #4ade80;

  font-size: 18px;

}

</style>

</head>


<body>


<div class="box">


<h1>
Button Phone Video Converter
</h1>


<p>
Local Video Conversion Test
</p>


<p>
Target: 144p • MPEG-4 Part 2 • MP4 • 15 FPS • AAC mono 32 kbps
</p>


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


<div id="status">
JavaScript is starting...
</div>


</div>


<script>


/* =========================================================
   Elements
   ========================================================= */

const videoInput =
  document.getElementById("video");


const convertButton =
  document.getElementById("convertButton");


const status =
  document.getElementById("status");


/* =========================================================
   Initial test
   ========================================================= */

status.textContent =
  "JavaScript is working successfully.\\n\\n" +
  "Select a video to begin.";


/* =========================================================
   Convert button
   ========================================================= */

convertButton.addEventListener(
  "click",
  convertVideo
);


/* =========================================================
   File selection
   ========================================================= */

videoInput.addEventListener(
  "change",
  function () {

    if (!videoInput.files.length) {

      status.textContent =
        "No video selected.";

      return;

    }


    const file =
      videoInput.files[0];


    status.textContent =
      "Video selected successfully.\\n\\n" +

      "File: " +
      file.name +
      "\\n" +

      "Size: " +
      formatFileSize(file.size) +
      "\\n\\n" +

      "Press Convert to start.";

  }
);


/* =========================================================
   Convert video
   ========================================================= */

async function convertVideo() {


  if (!videoInput.files.length) {

    status.textContent =
      "Please select a video first.";

    return;

  }


  const file =
    videoInput.files[0];


  const formData =
    new FormData();


  formData.append(
    "video",
    file
  );


  convertButton.disabled =
    true;


  status.textContent =
    "Uploading video to server...\\n\\n" +

    "File: " +
    file.name +
    "\\n" +

    "Size: " +
    formatFileSize(file.size) +
    "\\n\\n" +

    "Please wait.";


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
        "Server conversion failed."
      );

    }


    const data =
      await response.json();


    if (
      !data.download
    ) {

      throw new Error(
        "Conversion completed but download link was not returned."
      );

    }


    status.textContent =
      "Conversion completed successfully.";


    const link =
      document.createElement("a");


    link.href =
      data.download;


    link.className =
      "download";


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


    status.textContent =
      "Conversion failed.\\n\\n" +
      error.message;


  } finally {


    convertButton.disabled =
      false;

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
    Math.min(
      Math.floor(
        Math.log(bytes) /
        Math.log(1024)
      ),
      units.length - 1
    );


  return (
    bytes /
    Math.pow(1024, index)
  ).toFixed(2) +
  " " +
  units[index];

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
      originalName.replace(
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


    /* =====================================================
       FFmpeg settings
       ===================================================== */

    const ffmpegArgs = [

      "-y",

      "-i",
      inputFile,


      /* 256x144 */

      "-vf",
      "scale=256:144:force_original_aspect_ratio=decrease,pad=256:144:(ow-iw)/2:(oh-ih)/2",


      /* 15 FPS */

      "-r",
      "15",


      /* MPEG-4 Part 2 */

      "-c:v",
      "mpeg4",

      "-b:v",
      "180k",


      /* AAC audio */

      "-c:a",
      "aac",

      "-ac",
      "1",

      "-b:a",
      "32k",

      "-ar",
      "44100",


      /* MP4 optimization */

      "-movflags",
      "+faststart",


      outputFile

    ];


    console.log(
      "================================"
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
      "================================"
    );


    execFile(

      "ffmpeg",

      ffmpegArgs,

      {

        maxBuffer:
          10 * 1024 * 1024

      },

      (error, stdout, stderr) => {


        /* -----------------------------------------------
           Delete temporary uploaded input
           ----------------------------------------------- */

        try {

          fs.unlinkSync(
            inputFile
          );

        } catch (_) {}


        /* -----------------------------------------------
           FFmpeg error
           ----------------------------------------------- */

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


        /* -----------------------------------------------
           Check output
           ----------------------------------------------- */

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


        /* -----------------------------------------------
           Send download URL
           ----------------------------------------------- */

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


/* =========================================================
   Health check
   ========================================================= */

app.get(
  "/health",
  (req, res) => {

    res.json({

      status: "ok",

      service:
        "button-phone-video-converter",

      ffmpeg:
        "enabled"

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
      "Button Phone Video Converter running on port " +
      PORT
    );

  }
);
