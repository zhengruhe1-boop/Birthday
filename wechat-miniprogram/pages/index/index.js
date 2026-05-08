const app = getApp();

Page({
  data: {
    h5Url: ''
  },
  onLoad() {
    const base = app.globalData.h5BaseUrl;
    this.setData({ h5Url: base + '/' });
  }
});
