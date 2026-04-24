Page({
  data: {},

  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  onShareAppMessage() {
    return {
      title: "生日通.让您不再错过每个重要日子",
      path: "/pages/home/home",
      imageUrl: "/images/logo.jpg",
    };
  },

  onShareTimeline() {
    return {
      title: "生日通.让您不再错过每个重要日子",
      imageUrl: "/images/logo.jpg",
    };
  },
});
