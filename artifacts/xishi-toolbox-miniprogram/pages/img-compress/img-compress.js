const { track } = require("../../utils/track");
const { ensureLoggedIn } = require("../../utils/auth");

function fmtSize(bytes) {
  if (!bytes) return "未知大小";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(2) + " MB";
}

function savedPercent(originalSize, compressedSize) {
  if (!originalSize || !compressedSize || compressedSize >= originalSize) return 0;
  return Math.round((1 - compressedSize / originalSize) * 100);
}

Page({
  data: {
    originalPath: "",
    compressedPath: "",
    originalSize: 0,
    compressedSize: 0,
    originalSizeText: "",
    compressedSizeText: "",
    savedPercentText: "",
    quality: 80,
    compressing: false,
    saving: false,
    hasResult: false,
  },

  onLoad() {
    if (!ensureLoggedIn({ from: "img-compress", redirect: "/pages/img-compress/img-compress" })) return;
    track("page_view", { page: "img-compress" });
  },

  _updateSizeTexts(original, compressed) {
    const data = {};
    if (original !== undefined) {
      data.originalSizeText = fmtSize(original);
    }
    if (compressed !== undefined) {
      data.compressedSizeText = fmtSize(compressed);
      const orig = original !== undefined ? original : this.data.originalSize;
      const pct = savedPercent(orig, compressed);
      data.savedPercentText = pct > 0 ? "节省 " + pct + "%" : "";
    }
    return data;
  },

  selectImage() {
    const self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success(res) {
        const path = res.tempFiles[0].tempFilePath;
        wx.getFileSystemManager().stat({
          path,
          success(statRes) {
            const size = statRes.stats.size;
            const sizeTexts = self._updateSizeTexts(size, 0);
            self.setData(Object.assign({
              originalPath: path,
              originalSize: size,
              compressedPath: "",
              compressedSize: 0,
              compressedSizeText: "",
              savedPercentText: "",
              hasResult: false,
            }, sizeTexts));
          },
          fail() {
            self.setData({
              originalPath: path,
              originalSize: 0,
              originalSizeText: "未知大小",
              compressedPath: "",
              compressedSize: 0,
              compressedSizeText: "",
              savedPercentText: "",
              hasResult: false,
            });
          },
        });
      },
    });
  },

  onQualityChange(e) {
    this.setData({ quality: Number(e.detail.value) });
  },

  compress() {
    if (!this.data.originalPath) return;
    const self = this;
    const quality = this.data.quality;
    const originalPath = this.data.originalPath;
    this.setData({ compressing: true, hasResult: false });
    wx.compressImage({
      src: originalPath,
      quality,
      success(res) {
        const compressedPath = res.tempFilePath;
        wx.getFileSystemManager().stat({
          path: compressedPath,
          success(statRes) {
            const size = statRes.stats.size;
            const sizeTexts = self._updateSizeTexts(self.data.originalSize, size);
            self.setData(Object.assign({
              compressedPath,
              compressedSize: size,
              hasResult: true,
              compressing: false,
            }, sizeTexts));
          },
          fail() {
            self.setData({
              compressedPath,
              compressedSize: 0,
              compressedSizeText: "未知大小",
              savedPercentText: "",
              hasResult: true,
              compressing: false,
            });
          },
        });
      },
      fail(err) {
        self.setData({ compressing: false });
        wx.showToast({ title: "压缩失败，请重试", icon: "none" });
        console.error("compressImage fail", err);
      },
    });
  },

  saveImage() {
    if (!this.data.compressedPath) return;
    const self = this;
    this.setData({ saving: true });
    wx.saveImageToPhotosAlbum({
      filePath: this.data.compressedPath,
      success() {
        self.setData({ saving: false });
        wx.showToast({ title: "已保存到相册", icon: "success" });
      },
      fail(err) {
        self.setData({ saving: false });
        if (err.errMsg && err.errMsg.indexOf("auth deny") > -1) {
          wx.showModal({
            title: "需要权限",
            content: "请在设置中允许访问相册",
            confirmText: "去设置",
            success(r) {
              if (r.confirm) wx.openSetting();
            },
          });
        } else {
          wx.showToast({ title: "保存失败", icon: "none" });
        }
      },
    });
  },

  reset() {
    this.setData({
      originalPath: "",
      compressedPath: "",
      originalSize: 0,
      compressedSize: 0,
      originalSizeText: "",
      compressedSizeText: "",
      savedPercentText: "",
      quality: 80,
      hasResult: false,
    });
  },
});
