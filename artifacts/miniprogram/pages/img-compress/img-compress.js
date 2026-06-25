Page({
  data: {
    originalPath: '',
    compressedPath: '',
    originalSize: 0,
    compressedSize: 0,
    quality: 80,
    compressing: false,
    saving: false,
    hasResult: false,
  },

  selectImage() {
    const self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const path = res.tempFiles[0].tempFilePath;
        wx.getFileSystemManager().stat({
          path,
          success(statRes) {
            self.setData({
              originalPath: path,
              originalSize: statRes.stats.size,
              compressedPath: '',
              compressedSize: 0,
              hasResult: false,
            });
          },
          fail() {
            self.setData({
              originalPath: path,
              originalSize: 0,
              compressedPath: '',
              compressedSize: 0,
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
    const { quality, originalPath } = this.data;
    this.setData({ compressing: true, hasResult: false });
    wx.compressImage({
      src: originalPath,
      quality,
      success(res) {
        const compressedPath = res.tempFilePath;
        wx.getFileSystemManager().stat({
          path: compressedPath,
          success(statRes) {
            self.setData({
              compressedPath,
              compressedSize: statRes.stats.size,
              hasResult: true,
              compressing: false,
            });
          },
          fail() {
            self.setData({
              compressedPath,
              compressedSize: 0,
              hasResult: true,
              compressing: false,
            });
          },
        });
      },
      fail(err) {
        self.setData({ compressing: false });
        wx.showToast({ title: '压缩失败，请重试', icon: 'none' });
        console.error('compressImage fail', err);
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
        wx.showToast({ title: '已保存到相册', icon: 'success' });
      },
      fail(err) {
        self.setData({ saving: false });
        if (err.errMsg && err.errMsg.indexOf('auth deny') > -1) {
          wx.showModal({
            title: '需要权限',
            content: '请在设置中允许访问相册',
            confirmText: '去设置',
            success(r) {
              if (r.confirm) wx.openSetting();
            },
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      },
    });
  },

  reset() {
    this.setData({
      originalPath: '',
      compressedPath: '',
      originalSize: 0,
      compressedSize: 0,
      quality: 80,
      hasResult: false,
    });
  },

  _fmtSize(bytes) {
    if (!bytes) return '未知';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  },

  get fmtOriginalSize() {
    return this._fmtSize(this.data.originalSize);
  },
  get fmtCompressedSize() {
    return this._fmtSize(this.data.compressedSize);
  },
  get savedPercent() {
    if (!this.data.originalSize || !this.data.compressedSize) return 0;
    return Math.max(0, Math.round((1 - this.data.compressedSize / this.data.originalSize) * 100));
  },
});
