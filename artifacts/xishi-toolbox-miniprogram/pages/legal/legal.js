const { loadLegalContent } = require("../../utils/legal-content");

Page({
  data: {
    type: "terms",
    title: "用户协议",
    content: "",
    loading: true,
    error: false,
  },

  onLoad(query) {
    const type = query.type === "privacy" ? "privacy" : "terms";
    const title = type === "privacy" ? "隐私政策" : "用户协议";
    this.setData({ type, title });
    wx.setNavigationBarTitle({ title });
    this.loadContent(type);
  },

  async loadContent(type) {
    this.setData({ loading: true, error: false });
    try {
      const content = await loadLegalContent(type);
      this.setData({ content, loading: false });
    } catch {
      this.setData({ content: "", loading: false, error: true });
    }
  },

  retry() {
    this.loadContent(this.data.type);
  },
});
