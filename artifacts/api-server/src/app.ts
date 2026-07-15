import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { objectStorageClient } from "./lib/objectStorage.js";
import { LOCAL_UPLOAD_DIR } from "./routes/upload.js";

const FRONTEND_DIST = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../birthday-app/dist/public",
);

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 已上传图片的访问路由 ────────────────────────────────────────────────────────
// 优先使用对象存储（Replit GCS），不可用时降级到本地磁盘
app.get("/api/uploads/:filename", async (req: Request, res: Response) => {
  const filename = req.params.filename;
  if (!filename || filename.includes("..") || filename.includes("/")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

  if (!bucketId) {
    // ── 本地磁盘模式（降级） ─────────────────────────────────────────────────
    const localPath = path.join(LOCAL_UPLOAD_DIR, filename);
    res.sendFile(localPath, { maxAge: "365d" }, (err) => {
      if (err) res.status(404).json({ error: "Not found" });
    });
    return;
  }

  // ── 对象存储模式 ─────────────────────────────────────────────────────────────
  try {
    const file = objectStorageClient.bucket(bucketId).file(`uploads/${filename}`);
    const [exists] = await file.exists();
    if (!exists) { res.status(404).json({ error: "Not found" }); return; }

    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", (metadata.contentType as string) || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    file.createReadStream().pipe(res);
  } catch (err) {
    logger.error({ err, filename }, "Failed to serve upload from GCS");
    res.status(500).json({ error: "Failed to load image" });
  }
});

app.use("/api", router);

// ── 前端静态文件（管理后台 + 用户端）────────────────────────────────────────
function setupStaticFrontend(app: Express) {
  const indexPath = path.join(FRONTEND_DIST, "index.html");
  if (!fs.existsSync(indexPath)) {
    logger.warn({ path: FRONTEND_DIST }, "Frontend dist not found; run birthday-app build");
    app.get(/^(?!\/api\/).*/, (_req: Request, res: Response) => {
      res.status(503).type("text/html; charset=utf-8").send(`<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>前端未构建</title></head>
<body style="font-family:sans-serif;max-width:640px;margin:80px auto;padding:0 24px;color:#333">
<h2>前端尚未构建</h2>
<p>请先在项目根目录执行：</p>
<pre style="background:#f5f5f5;padding:16px;border-radius:8px">cd artifacts/birthday-app
$env:BASE_PATH="/"; $env:PORT="3000"; pnpm run build</pre>
<p>构建完成后重启后端，再访问 <a href="/admin">/admin</a> 进入管理后台。</p>
</body></html>`);
    });
    return;
  }

  app.use(express.static(FRONTEND_DIST, { index: false }));

  // SPA 回退：/admin 等前端路由由 React 接管
  app.get(/^(?!\/api\/).*/, (_req: Request, res: Response) => {
    res.sendFile(indexPath);
  });
}

setupStaticFrontend(app);

export default app;
