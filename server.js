const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { exec } = require("child_process");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.json());
app.use(express.static("public"));

let latestGraph = null;
let latestApi = null;

// =========================
// UPLOAD APK
// =========================
app.post("/upload", upload.single("apk"), (req, res) => {
    const apkPath = req.file.path;

    console.log("[+] APK uploaded:", apkPath);

    processAPK(apkPath, res);
});

// =========================
// PROCESS APK
// =========================
function processAPK(apkPath, res) {

    const outDir = "work";

    exec(`rm -rf ${outDir}`, () => {

        exec(`java -jar baksmali.jar d ${apkPath} -o ${outDir}`, () => {

            console.log("[*] Decompiling done");

            exec(`python3 parser.py ${outDir}`, (err) => {

                latestGraph = fs.readFileSync("graph.json", "utf8");
                latestApi = fs.readFileSync("api_map.json", "utf8");

                res.json({
                    status: "done",
                    graph: JSON.parse(latestGraph),
                    api: JSON.parse(latestApi)
                });
            });
        });
    });
});

// =========================
// GET GRAPH
// =========================
app.get("/graph", (req, res) => {
    res.json(JSON.parse(latestGraph || "{}"));
});

// =========================
// GET API MAP
// =========================
app.get("/api-map", (req, res) => {
    res.json(JSON.parse(latestApi || "{}"));
});
const { replay } = require("./replay");

app.post("/replay", async (req,res)=>{
    const result = await replay(req.body);
    res.json(result);
});

app.listen(3000, () => {
    console.log("Server running http://localhost:3000");
});
