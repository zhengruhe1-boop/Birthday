import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { objectStorageClient } from "../lib/objectStorage.js";

const router: IRouter = Router();

function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return objectStorageClient.bucket(bucketId);
}

const storage = multer.memoryStorage();

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
  // 如果扩展名未知，使用声明的 MIME，但需是图片类型
  if (declaredMime.startsWith("image/")) return declaredMime;
  return "image/jpeg"; // 兜底
}

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // 允许所有图片类型以及 application/octet-stream（微信上传可能用此类型）
    const isImage = file.mimetype.startsWith("image/") || file.mimetype === "application/octet-stream";
    if (isImage) {
      cb(null, true);
    } else {
      cb(new Error("只支持 JPG、PNG、GIF、WEBP 格式图片"));
    }
  },
});

router.post("/", requireAuth, upload.single("image"), async (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: "请上传图片文件" });
    return;
  }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
    const filename = crypto.randomBytes(16).toString("hex") + ext;
    const objectPath = `uploads/${filename}`;
    const contentType = resolveMime(req.file.originalname, req.file.mimetype);

    const bucket = getBucket();
    await bucket.file(objectPath).save(req.file.buffer, {
      contentType,
      resumable: false,
    });

    res.json({ url: `/api/uploads/${filename}` });
  } catch (err) {
    req.log.error({ err }, "Upload to object storage failed");
    res.status(500).json({ error: "上传失败，请稍后重试" });
  }
});

export default router;
