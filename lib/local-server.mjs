import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};

/**
 * Serves a folder (or the folder of a single HTML file) on 127.0.0.1 with a random port.
 * Paths are resolved to absolute first, so relative targets work.
 */
export function startLocalServer(rootTarget, defaultFile = "index.html") {
  return new Promise((resolve, reject) => {
    const absTarget = path.resolve(rootTarget);
    if (!fs.existsSync(absTarget)) {
      reject(new Error(`Target not found: ${absTarget}`));
      return;
    }
    const isSingleFile = fs.statSync(absTarget).isFile();
    const baseDir = isSingleFile ? path.dirname(absTarget) : absTarget;
    const entryFile = isSingleFile ? path.basename(absTarget) : defaultFile;

    const server = http.createServer((req, res) => {
      let reqPath;
      try {
        reqPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      } catch {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Bad Request");
        return;
      }

      let filePath = path.resolve(baseDir, "." + reqPath);
      const rel = path.relative(baseDir, filePath);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Forbidden");
        return;
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, reqPath === "/" ? entryFile : "index.html");
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
          return;
        }
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-cache"
        });
        fs.createReadStream(filePath).pipe(res);
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({
        url: `http://127.0.0.1:${port}/${encodeURI(entryFile)}`,
        port,
        close: () => new Promise((done) => server.close(done))
      });
    });
    server.on("error", reject);
  });
}
