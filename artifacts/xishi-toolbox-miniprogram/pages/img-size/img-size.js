const { track } = require("../../utils/track");
const { ensureLoggedIn } = require("../../utils/auth");

var FORMAT_EXT = { png: ".png", jpg: ".jpg", jpeg: ".jpg", webp: ".webp" };

function fmtSize(bytes) {
  if (!bytes) return "未知";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(2) + " MB";
}

function fmtDimension(w, h) {
  return w + " × " + h + " px";
}

Page({
  data: {
    originalPath: "",
    originalWidth: 0,
    originalHeight: 0,
    originalSize: 0,
    originalSizeText: "",
    originalDimText: "",

    targetWidth: "",
    targetHeight: "",
    lockRatio: true,
    outputFormat: "png",

    processing: false,
    saving: false,
    hasResult: false,

    resultPath: "",
    resultSize: 0,
    resultSizeText: "",
    resultDimText: "",
  },

  onLoad: function () {
    if (!ensureLoggedIn({ from: "img-size", redirect: "/pages/img-size/img-size" })) return;
    track("page_view", { page: "img-size" });
  },

  selectImage: function () {
    var self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: function (res) {
        var path = res.tempFiles[0].tempFilePath;
        wx.getImageInfo({
          src: path,
          success: function (info) {
            wx.getFileSystemManager().stat({
              path: path,
              success: function (statRes) {
                self.setData({
                  originalPath: path,
                  originalWidth: info.width,
                  originalHeight: info.height,
                  originalSize: statRes.stats.size,
                  originalSizeText: fmtSize(statRes.stats.size),
                  originalDimText: fmtDimension(info.width, info.height),
                  targetWidth: String(info.width),
                  targetHeight: String(info.height),
                  hasResult: false,
                  resultPath: "",
                });
              },
              fail: function () {
                self.setData({
                  originalPath: path,
                  originalWidth: info.width,
                  originalHeight: info.height,
                  originalSize: 0,
                  originalSizeText: "未知",
                  originalDimText: fmtDimension(info.width, info.height),
                  targetWidth: String(info.width),
                  targetHeight: String(info.height),
                  hasResult: false,
                  resultPath: "",
                });
              },
            });
          },
        });
      },
    });
  },

  onWidthInput: function (e) {
    var val = e.detail.value || "";
    var w = parseInt(val, 10);
    var data = { targetWidth: val };
    if (this.data.lockRatio && w > 0 && this.data.originalWidth > 0) {
      var ratio = this.data.originalHeight / this.data.originalWidth;
      data.targetHeight = String(Math.round(w * ratio));
    }
    this.setData(data);
  },

  onHeightInput: function (e) {
    var val = e.detail.value || "";
    var h = parseInt(val, 10);
    var data = { targetHeight: val };
    if (this.data.lockRatio && h > 0 && this.data.originalHeight > 0) {
      var ratio = this.data.originalWidth / this.data.originalHeight;
      data.targetWidth = String(Math.round(h * ratio));
    }
    this.setData(data);
  },

  toggleLockRatio: function () {
    var lock = !this.data.lockRatio;
    var data = { lockRatio: lock };
    if (lock && this.data.targetWidth && this.data.originalWidth > 0) {
      var w = parseInt(this.data.targetWidth, 10);
      if (w > 0) {
        var ratio = this.data.originalHeight / this.data.originalWidth;
        data.targetHeight = String(Math.round(w * ratio));
      }
    }
    this.setData(data);
  },

  onFormatChange: function (e) {
    this.setData({ outputFormat: e.detail.value });
  },

  setPreset: function (e) {
    var w = parseInt(e.currentTarget.dataset.w, 10);
    var h = parseInt(e.currentTarget.dataset.h, 10);
    this.setData({ targetWidth: String(w), targetHeight: String(h), lockRatio: false });
  },

  processImage: function () {
    var self = this;
    var tw = parseInt(this.data.targetWidth, 10);
    var th = parseInt(this.data.targetHeight, 10);
    if (!this.data.originalPath) return;
    if (!tw || tw <= 0 || !th || th <= 0) {
      wx.showToast({ title: "请输入有效尺寸", icon: "none" });
      return;
    }
    if (tw > 4096 || th > 4096) {
      wx.showToast({ title: "尺寸不能超过 4096", icon: "none" });
      return;
    }

    this.setData({ processing: true, hasResult: false });

    var format = this.data.outputFormat;
    var canvasId = "resize-canvas";

    var query = wx.createSelectorQuery();
    query.select("#" + canvasId)
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) {
          self.setData({ processing: false });
          wx.showToast({ title: "Canvas 初始化失败", icon: "none" });
          return;
        }

        var canvas = res[0].node;
        canvas.width = tw;
        canvas.height = th;
        var ctx = canvas.getContext("2d");

        var img = canvas.createImage();
        img.onload = function () {
          ctx.clearRect(0, 0, tw, th);

          if (format === "jpg" || format === "jpeg") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, tw, th);
          }

          ctx.drawImage(img, 0, 0, tw, th);

          var mimeType = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
          var quality = (format === "png") ? 1 : 0.92;

          wx.canvasToTempFilePath({
            canvas: canvas,
            fileType: (format === "webp") ? "png" : format === "png" ? "png" : "jpg",
            quality: quality,
            destWidth: tw,
            destHeight: th,
            success: function (saveRes) {
              var resultPath = saveRes.tempFilePath;
              wx.getFileSystemManager().stat({
                path: resultPath,
                success: function (statRes) {
                  self.setData({
                    processing: false,
                    hasResult: true,
                    resultPath: resultPath,
                    resultSize: statRes.stats.size,
                    resultSizeText: fmtSize(statRes.stats.size),
                    resultDimText: fmtDimension(tw, th),
                  });
                },
                fail: function () {
                  self.setData({
                    processing: false,
                    hasResult: true,
                    resultPath: resultPath,
                    resultSize: 0,
                    resultSizeText: "未知",
                    resultDimText: fmtDimension(tw, th),
                  });
                },
              });
            },
            fail: function (err) {
              self.setData({ processing: false });
              wx.showToast({ title: "生成失败，请重试", icon: "none" });
              console.error("canvasToTempFilePath fail", err);
            },
          });
        };

        img.onerror = function () {
          self.setData({ processing: false });
          wx.showToast({ title: "图片加载失败", icon: "none" });
        };

        img.src = self.data.originalPath;
      });
  },

  saveImage: function () {
    if (!this.data.resultPath) return;
    var self = this;
    this.setData({ saving: true });
    wx.saveImageToPhotosAlbum({
      filePath: this.data.resultPath,
      success: function () {
        self.setData({ saving: false });
        wx.showToast({ title: "已保存到相册", icon: "success" });
      },
      fail: function (err) {
        self.setData({ saving: false });
        if (err.errMsg && err.errMsg.indexOf("auth deny") > -1) {
          wx.showModal({
            title: "需要权限",
            content: "请在设置中允许访问相册",
            confirmText: "去设置",
            success: function (r) {
              if (r.confirm) wx.openSetting();
            },
          });
        } else {
          wx.showToast({ title: "保存失败", icon: "none" });
        }
      },
    });
  },

  reset: function () {
    this.setData({
      originalPath: "",
      originalWidth: 0,
      originalHeight: 0,
      originalSize: 0,
      originalSizeText: "",
      originalDimText: "",
      targetWidth: "",
      targetHeight: "",
      lockRatio: true,
      outputFormat: "png",
      processing: false,
      saving: false,
      hasResult: false,
      resultPath: "",
      resultSize: 0,
      resultSizeText: "",
      resultDimText: "",
    });
  },
});
