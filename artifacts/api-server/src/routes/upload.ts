import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { objectStorageClient } from "../lib/objectStorage.js";

const router: IRouter = Router();

// 用 import.meta.url 定位构建产物目录，确保无论从哪个目录启动服务，
// 上传文件始终存放在 <api-server根目录>/uploads/，不随 cwd 变化
const _dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/index.mjs → dist/ → ../ → api-server根目录
export const LOCAL_UPLOAD_DIR = path.resolve(_dirname, "../uploads");

function useObjectStorage(): boolean {
  return !!process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
}

function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return objectStorageClient.bucket(bucketId);
}

function ensureLocalUploadDir() {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }
}

// 从文件扩展名推断 MIME 类型（应对 wx.uploadFile 有时发 application/octet-stream 的情况）
function resolveMime(originalname: string, declaredMime: string): string {
  const ext = path.extname(originalname).toLowerCase();
  const extMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  if (extMap[ext]) return extMap[ext];
  if (declaredMime.startsWith("image/")) return declaredMime;
  return "image/jpeg";
}

// ── 内存存储（用于对象存储模式：buffer 上传到 GCS）─────────────────────────────
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith("image/") || file.mimetype === "application/octet-stream";
    cb(ok ? null : new Error("只支持 JPG、PNG、GIF、WEBP 格式图片"), ok);
  },
});

// ── 磁盘存储（用于本地文件系统模式：直接落盘）───────────────────────────────────
const diskUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      ensureLocalUploadDir();
      cb(null, LOCAL_UPLOAD_DIR);
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, crypto.randomBytes(16).toString("hex") + ext);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith("image/") || file.mimetype === "application/octet-stream";
    cb(ok ? null : new Error("只支持 JPG、PNG、GIF、WEBP 格式图片"), ok);
  },
});

router.post(
  "/",
  requireAuth,
  // 根据是否有对象存储环境变量动态选择存储方式
  (req, res, next) => {
    const uploader = useObjectStorage() ? memoryUpload : diskUpload;
    uploader.single("image")(req, res, next);
  },
  async (req: AuthRequest, res) => {
    if (!req.file) {
      res.status(400).json({ error: "请上传图片文件" });
      return;
    }

    try {
      if (useObjectStorage()) {
        // ── 对象存储模式 ──────────────────────────────────────────────────────
        const file = req.file as Express.Multer.File & { buffer: Buffer };
        const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
        const filename = crypto.randomBytes(16).toString("hex") + ext;
        const objectPath = `uploads/${filename}`;
        const contentType = resolveMime(file.originalname, file.mimetype);

        const bucket = getBucket();
        await bucket.file(objectPath).save(file.buffer, { contentType, resumable: false });

        res.json({ url: `/api/uploads/${filename}` });
      } else {
        // ── 本地磁盘模式（降级）──────────────────────────────────────────────
        const filename = (req.file as Express.Multer.File).filename;
        req.log.info({ filename }, "Uploaded to local disk (object storage not configured)");
        res.json({ url: `/api/uploads/${filename}` });
      }
    } catch (err) {
      req.log.error({ err }, "Upload failed");
      res.status(500).json({ error: "上传失败，请稍后重试" });
    }
  },
);

export default router;
