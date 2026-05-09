Page({
  data: {
    type: "agreement",
    title: "用户协议",
  },

  onLoad(opts) {
    const type = opts.type || "agreement";
    const title = type === "privacy" ? "隐私政策" : "用户协议";
    this.setData({ type, title });
    wx.setNavigationBarTitle({ title });
  },
});
