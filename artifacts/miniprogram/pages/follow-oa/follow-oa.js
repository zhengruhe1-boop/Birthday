Page({
  data: {},

  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  onShareAppMessage() {
    return {
      title: '生日通 — 再也不错过重要纪念日',
      path: '/pages/home/home',
      imageUrl: '/images/logo.jpg',
    };
  },

  onShareTimeline() {
    return {
      title: '生日通 — 再也不错过重要纪念日',
      imageUrl: '/images/logo.jpg',
    };
  },
});
