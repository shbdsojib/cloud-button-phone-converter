const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { google } = require("googleapis");

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

<input id="video" type="file" accept="video/*">

<button onclick="convertVideo()">
Convert to 144p MPEG-4
</button>

<div id="status"></div>

</div>

<script>

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
