import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import path from "path";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { objectStorageClient } from "./lib/objectStorage.js";
import { LOCAL_UPLOAD_DIR } from "./routes/upload.js";

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

export default app;
