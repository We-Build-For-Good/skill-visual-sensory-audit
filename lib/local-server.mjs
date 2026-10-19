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
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

export function startLocalServer(rootDir, defaultFile = "index.html") {
  return new Promise((resolve, reject) => {
    const isSingleFile = fs.existsSync(rootDir) && fs.statSync(rootDir).isFile();
    const baseDir = isSingleFile ? path.dirname(rootDir) : rootDir;
    const targetFile = isSingleFile ? path.basename(rootDir) : defaultFile;

    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent(req.url.split("?")[0]);
      if (reqPath === "/" || reqPath === "") {
        reqPath = "/" + targetFile;
      }

      const filePath = path.join(baseDir, reqPath.replace(/^\//, ""));

      // Prevent directory traversal
      if (!filePath.startsWith(path.resolve(baseDir))) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Forbidden");
        return;
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        res.writeHead(200, {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
        });

        fs.createReadStream(filePath).pipe(res);
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const url = `http://127.0.0.1:${port}/${targetFile}`;
      resolve({
        url,
        port,
        close: () => new Promise((res) => server.close(res)),
      });
    });

    server.on("error", reject);
  });
}
