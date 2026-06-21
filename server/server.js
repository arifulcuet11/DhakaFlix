const express = require("express");
const http    = require("http");
const https   = require("https");

const app  = express();
const PORT = 3001;

// Allow the React app (any local origin) to call this server
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  next();
});

// Health check — React app pings this to show a green "Server Online" badge
app.get("/ping", (req, res) => {
  res.json({ ok: true, version: "1.0.0" });
});

// /stream?url=<encoded-ftp-url>
// Proxies the FTP file to the browser with video/x-matroska content-type
// so VLC (or the browser) opens it as a stream, not a download
app.get("/stream", (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing ?url= parameter" });
  }

  // Only allow requests to our trusted local network IPs
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const allowedHosts = ["172.16.50.7", "172.16.50.8", "172.16.50.9", "172.16.50.12", "172.16.50.14"];
  if (!allowedHosts.includes(parsed.hostname)) {
    return res.status(403).json({ error: `Host ${parsed.hostname} not allowed` });
  }

  // Forward Range header from client (needed for VLC seeking)
  const headers = { "User-Agent": "DhakaFlix-Proxy/1.0" };
  if (req.headers.range) {
    headers["Range"] = req.headers.range;
  }

  const client = parsed.protocol === "https:" ? https : http;

  const upstream = client.get(url, { headers }, (upRes) => {
    // Detect file type from extension for correct Content-Type
    const ext = parsed.pathname.split(".").pop().toLowerCase();
    const mimeMap = {
      mkv:  "video/x-matroska",
      mp4:  "video/mp4",
      avi:  "video/x-msvideo",
      webm: "video/webm",
      mov:  "video/quicktime",
    };
    const contentType = mimeMap[ext] || "application/octet-stream";

    // Pass through status (200 or 206 Partial Content for Range requests)
    const status = upRes.statusCode || 200;
    res.status(status);

    // Forward critical headers from upstream
    const forwardHeaders = [
      "content-length",
      "content-range",
      "accept-ranges",
      "last-modified",
      "etag",
    ];
    forwardHeaders.forEach(h => {
      if (upRes.headers[h]) res.setHeader(h, upRes.headers[h]);
    });

    // Set video content-type so browser/VLC treats it as a stream
    res.setHeader("Content-Type", contentType);

    // Pipe the upstream response directly to the client
    upRes.pipe(res);

    upRes.on("error", (err) => {
      console.error("Upstream error:", err.message);
      if (!res.headersSent) res.status(502).end();
    });
  });

  upstream.on("error", (err) => {
    console.error("Request error:", err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: "Could not reach upstream server", detail: err.message });
    }
  });

  // If client disconnects, abort the upstream request
  req.on("close", () => upstream.destroy());
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  DhakaFlix Stream Server`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Also accessible at http://<your-ip>:${PORT}`);
  console.log(`  Allowed hosts: 172.16.50.{7,8,9,12,14}\n`);
});
