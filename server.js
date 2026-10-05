const express = require("express");

const app = express();

const PORT = process.env.PORT || 10000;


/* =========================
   Test page
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

<title>Button Phone Converter Test</title>

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

button {
  width: 100%;
  padding: 15px;
  margin-top: 15px;
  border: 0;
  border-radius: 8px;
  font-size: 16px;
}

#status {
  margin-top: 20px;
  padding: 15px;
  background: #181818;
  border-radius: 8px;
  white-space: pre-wrap;
}

</style>

</head>


<body>


<div class="box">


<h1>
Cloud Button Phone Video Converter
</h1>


<p>
JavaScript Diagnostic Test
</p>


<button
  id="driveButton"
  type="button"
>
Test Google Drive Button
</button>


<button
  id="convertButton"
  type="button"
>
Test Convert Button
</button>


<div
  id="status"
>
Starting JavaScript...
</div>


</div>


<script>

console.log("TEST: JavaScript started");


/* =========================
   Status element
   ========================= */

const status =
  document.getElementById("status");


/* =========================
   Test JavaScript
   ========================= */

status.textContent =
  "JavaScript is working successfully.";


/* =========================
   Google Drive button test
   ========================= */

const driveButton =
  document.getElementById("driveButton");


driveButton.addEventListener(
  "click",
  function () {

    status.textContent =
      "Google Drive button is working.";

  }
);


/* =========================
   Convert button test
   ========================= */

const convertButton =
  document.getElementById("convertButton");


convertButton.addEventListener(
  "click",
  function () {

    status.textContent =
      "Convert button is working.";

  }
);


/* =========================
   Final initialization test
   ========================= */

console.log(
  "TEST: All buttons initialized successfully"
);

</script>


</body>

</html>

  `);

});


/* =========================
   Health check
   ========================= */

app.get("/health", (req, res) => {

  res.json({

    status: "ok",

    test: "javascript-diagnostic",

    time: new Date().toISOString()

  });

});


/* =========================
   Start server
   ========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "Diagnostic test server running on port " +
      PORT
    );

  }
);
