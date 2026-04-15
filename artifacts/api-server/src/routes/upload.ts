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

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) {
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

    const bucket = getBucket();
    await bucket.file(objectPath).save(req.file.buffer, {
      contentType: req.file.mimetype,
      metadata: { cacheControl: "public, max-age=31536000" },
    });

    res.json({ url: `/api/uploads/${filename}` });
  } catch (err) {
    req.log.error({ err }, "Upload to object storage failed");
    res.status(500).json({ error: "上传失败，请稍后重试" });
  }
});

export default router;
