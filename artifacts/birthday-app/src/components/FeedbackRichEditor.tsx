import { useRef, useEffect, useCallback, useState, type CSSProperties } from "react";
import { Bold, Image as ImageIcon, List, X } from "lucide-react";

type FeedbackRichEditorProps = {
  value: string;
  onChange: (html: string) => void;
  adminKey: string;
  placeholder?: string;
  /** Relative API path for image upload. Defaults to feedback upload. */
  uploadPath?: string;
};

function toEditorImageSrc(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = import.meta.env.BASE_URL || "/";
  const origin = window.location.origin;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${origin}${base.replace(/\/$/, "")}${path}`.replace(/([^:]\/)\/+/g, "$1");
}

function toPublicImageSrc(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = import.meta.env.BASE_URL || "/";
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base.replace(/\/$/, "")}${path}`.replace(/([^:]\/)\/+/g, "$1");
}

function normalizeHtmlForStorage(html: string): string {
  if (!html) return "";
  const origin = window.location.origin;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const prefix = `${origin}${base}`;
  return html
    .replaceAll(prefix, "")
    .replaceAll(origin, "")
    .replace(/src="(https?:\/\/[^"]+\/api\/uploads\/[^"]+)"/g, (_m, full: string) => {
      const idx = full.indexOf("/api/uploads/");
      return idx >= 0 ? `src="${full.slice(idx)}"` : `src="${full}"`;
    });
}

function splitReplyHtml(html: string): Array<{ kind: "html"; content: string } | { kind: "image"; src: string }> {
  const parts: Array<{ kind: "html"; content: string } | { kind: "image"; src: string }> = [];
  const re = /<img\b[^>]*>/gi;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (match.index > last) {
      parts.push({ kind: "html", content: html.slice(last, match.index) });
    }
    const srcMatch = match[0].match(/\bsrc=["']([^"']+)["']/i);
    if (srcMatch?.[1]) {
      parts.push({ kind: "image", src: toPublicImageSrc(srcMatch[1]) });
    }
    last = match.index + match[0].length;
  }
  if (last < html.length) {
    parts.push({ kind: "html", content: html.slice(last) });
  }
  return parts.length ? parts : [{ kind: "html", content: html }];
}

const FEEDBACK_THUMB_STYLE: CSSProperties = {
  maxWidth: 120,
  maxHeight: 120,
  width: "auto",
  height: "auto",
  objectFit: "cover",
  display: "block",
  borderRadius: 8,
  border: "1px solid #fecdd3",
  cursor: "zoom-in",
};

export function FeedbackImageLightbox({
  src,
  onClose,
}: {
  src: string | null;
  onClose: () => void;
}) {
  if (!src) return null;
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
        aria-label="关闭预览"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt=""
        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function FeedbackRichEditor({
  value,
  onChange,
  adminKey,
  placeholder = "填写处理结果或回复内容…",
  uploadPath = "api/admin/feedback/upload-image",
}: FeedbackRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || syncingRef.current) return;
    const displayHtml = value || "";
    if (el.innerHTML !== displayHtml) {
      el.innerHTML = displayHtml;
    }
    el.querySelectorAll("img").forEach((node) => {
      const img = node as HTMLImageElement;
      img.className = "feedback-editor-img";
      img.removeAttribute("width");
      img.removeAttribute("height");
      Object.assign(img.style, {
        maxWidth: "120px",
        maxHeight: "120px",
        width: "auto",
        height: "auto",
        objectFit: "cover",
        display: "inline-block",
        verticalAlign: "top",
        margin: "8px 8px 0 0",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
      });
    });
  }, [value]);

  const sync = useCallback(() => {
    const html = normalizeHtmlForStorage(editorRef.current?.innerHTML || "");
    syncingRef.current = true;
    onChange(html);
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, [onChange]);

  const runCommand = (command: string, valueArg?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, valueArg);
    sync();
  };

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`${import.meta.env.BASE_URL}${uploadPath}`, {
      method: "POST",
      headers: { "x-admin-key": adminKey },
      body: formData,
    });
    if (!res.ok) throw new Error("上传失败");
    const data = await res.json();
    const src = toEditorImageSrc(data.url || "");
    editorRef.current?.focus();
    document.execCommand(
      "insertHTML",
      false,
      `<img src="${src}" alt="image" class="feedback-editor-img" />`,
    );
    sync();
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
        <button
          type="button"
          title="加粗"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCommand("bold")}
          className="p-1.5 rounded-md text-gray-600 hover:bg-white hover:text-gray-900 transition-colors"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="换行"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCommand("insertLineBreak")}
          className="p-1.5 rounded-md text-gray-600 hover:bg-white hover:text-gray-900 transition-colors"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="插入图片"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="p-1.5 rounded-md text-gray-600 hover:bg-white hover:text-gray-900 transition-colors"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              await uploadImage(file);
            } catch {
              window.alert("图片上传失败，请重试");
            }
          }}
        />
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="feedback-rich-editor min-h-[160px] max-h-[280px] overflow-y-auto px-3 py-2.5 text-sm text-gray-800 focus:outline-none"
        data-placeholder={placeholder}
        onInput={sync}
        onBlur={sync}
      />
      <style>{`
        .feedback-rich-editor:empty:before {
          content: attr(data-placeholder);
          color: #cbd5e1;
          pointer-events: none;
        }
        .feedback-rich-editor img,
        .feedback-rich-editor .feedback-editor-img {
          max-width: 120px;
          max-height: 120px;
          width: auto;
          height: auto;
          object-fit: cover;
          display: inline-block;
          vertical-align: top;
          margin: 8px 8px 0 0;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }
      `}</style>
    </div>
  );
}

export function FeedbackReplyHtml({ html }: { html: string }) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  if (!html) return null;
  const hasTags = /<[^>]+>/.test(html);
  if (!hasTags) {
    return <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{html}</p>;
  }

  const parts = splitReplyHtml(html);

  return (
    <>
      <div className="feedback-reply-html text-sm text-gray-700 break-words max-w-full overflow-hidden">
        {parts.map((part, idx) => {
          if (part.kind === "image") {
            return (
              <button
                key={`img-${idx}`}
                type="button"
                onClick={() => setPreviewSrc(part.src)}
                className="inline-block p-0 m-0 mr-2 mb-2 border-0 bg-transparent align-top"
                title="点击查看大图"
              >
                <img src={part.src} alt="" style={FEEDBACK_THUMB_STYLE} loading="lazy" />
              </button>
            );
          }
          if (!part.content.trim()) return null;
          return (
            <div
              key={`html-${idx}`}
              className="feedback-reply-html-block"
              dangerouslySetInnerHTML={{ __html: part.content }}
            />
          );
        })}
      </div>
      <FeedbackImageLightbox src={previewSrc} onClose={() => setPreviewSrc(null)} />
    </>
  );
}

export function FeedbackImageList({
  images,
  className = "",
}: {
  images: string[];
  className?: string;
}) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  if (!images.length) return null;
  return (
    <>
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {images.map((url) => {
          const src = toPublicImageSrc(url);
          return (
            <button
              key={url}
              type="button"
              onClick={() => setPreviewSrc(src)}
              className="block w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 cursor-zoom-in hover:opacity-90 transition-opacity"
              title="点击查看大图"
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          );
        })}
      </div>
      <FeedbackImageLightbox src={previewSrc} onClose={() => setPreviewSrc(null)} />
    </>
  );
}
