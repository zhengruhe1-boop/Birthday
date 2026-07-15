const DEFAULT_TITLE = '生日通.让您不再错过每个重要日子';
const DEFAULT_PATH = '/pages/home/home';
const DEFAULT_IMAGE = '/images/logo.jpg';

function getPublicShare() {
  const app = getApp();
  const cfg = app && app.globalData.publicConfig;
  return (cfg && cfg.share) || {};
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return DEFAULT_IMAGE;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
  if (imageUrl.startsWith('/api/')) {
    const app = getApp();
    const base = ((app && app.globalData.apiBase) || '').replace(/\/$/, '');
    return base ? base + imageUrl : DEFAULT_IMAGE;
  }
  return imageUrl;
}

function getShareAppMessage(overrides) {
  const share = getPublicShare();
  const opts = overrides || {};
  const result = {
    title: opts.title || share.title || DEFAULT_TITLE,
    path: opts.path || share.path || DEFAULT_PATH,
  };
  const imageUrl = resolveImageUrl(opts.imageUrl || share.imageUrl);
  if (imageUrl) result.imageUrl = imageUrl;
  return result;
}

function getShareTimeline(overrides) {
  const share = getShareAppMessage(overrides);
  return {
    title: share.title,
    imageUrl: share.imageUrl,
  };
}

module.exports = {
  getShareAppMessage,
  getShareTimeline,
};
