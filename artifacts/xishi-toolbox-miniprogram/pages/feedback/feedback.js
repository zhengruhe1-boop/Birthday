const api = require("../../utils/api");
const { isLoggedIn } = require("../../utils/auth");

const MAX_IMAGES = 3;

Page({
  data: {
    content: "",
    contact: "",
    images: [],
    submitting: false,
  },

  onShow() {
    if (!isLoggedIn()) {
      wx.showToast({ title: "请先登录", icon: "none" });
      setTimeout(() => wx.navigateTo({ url: "/pages/login/login?from=feedback" }), 500);
    }
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value || "" });
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value || "" });
  },

  chooseImages() {
    const remain = MAX_IMAGES - this.data.images.length;
    if (remain <= 0) return;

    wx.chooseMedia({
      count: remain,
      mediaType: ["image"],
      sizeType: ["compressed"],
      success: (res) => {
        const picked = (res.tempFiles || []).map((file) => ({
          path: file.tempFilePath,
          url: "",
        }));
        this.setData({
          images: this.data.images.concat(picked).slice(0, MAX_IMAGES),
        });
      },
    });
  },

  removeImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(index)) return;
    const images = this.data.images.slice();
    images.splice(index, 1);
    this.setData({ images });
  },

  previewImage(e) {
    const index = Number(e.currentTarget.dataset.index);
    const urls = this.data.images.map((item) => item.path);
    if (!urls.length || !Number.isFinite(index)) return;
    wx.previewImage({ current: urls[index], urls });
  },

  async uploadImages() {
    const images = [];
    for (const item of this.data.images) {
      if (item.url) {
        images.push(item.url);
        continue;
      }
      const res = await api.upload("api/upload", item.path, "image");
      if (!res || !res.url) throw new Error("图片上传失败");
      images.push(res.url);
    }
    return images;
  },

  async handleSubmit() {
    const content = (this.data.content || "").trim();
    if (!content && !this.data.images.length) {
      wx.showToast({ title: "请填写内容或上传图片", icon: "none" });
      return;
    }

    this.setData({ submitting: true });
    try {
      const images = await this.uploadImages();
      await api.post("api/feedback", {
        content,
        contact: (this.data.contact || "").trim(),
        images,
      });
      wx.showToast({ title: "提交成功", icon: "success" });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (err) {
      const msg = (err && err.message) ? err.message : "提交失败";
      wx.showToast({ title: msg.slice(0, 20), icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
