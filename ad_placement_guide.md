# 广告位预埋记录

## 日期：最后更新 2026-07-29（财富健康指数替换存钱段位，对齐实际代码）

## 广告策略

不打扰用户操作的前提下，最大化广告曝光：
- **Banner 横幅广告**：每个工具页底部常驻，不打断用户操作
- **插屏广告**：仅在返回首页时弹出，每 5 分钟最多 1 次，不频繁骚扰
- **不接入激励视频**：计算工具类不适合，会打断计算流程

## 广告位分布（共 8 个：7 Banner + 1 插屏）

| 页面 | 广告位 | 类型 | 位置 | 占位ID |
|------|--------|------|------|--------|
| 首页 | Banner | 固定底部 | 页面最底部 | adunit-banner-home-002 |
| 支出计算 | Banner | 固定底部 | 页面最底部 | adunit-banner-index-001 |
| 财富层级 | Banner | 固定底部 | 页面最底部 | adunit-banner-wealth-001 |
| 财富健康指数 | Banner | 固定底部 | 页面最底部 | adunit-banner-wealthhealth-001 |
| BMI | Banner | 固定底部 | 页面最底部 | adunit-banner-bmi-001 |
| 时光进度条 | Banner | 固定底部 | 页面最底部 | adunit-banner-progress-001 |
| 亲戚关系 | Banner | 固定底部 | 页面最底部 | adunit-banner-relation-001 |
| 全局 | 插屏 | 返回首页时 | `app.js` 管理 | adunit-xxxxxxxxxxxxxxxx |

> 注：早期方案预留的 `adunit-banner-home-001`（内容区横幅）未采用，实际首页仅保留底部固定 Banner `home-002`。

## 改动文件

- `app.js` — 全局插屏广告管理器 + 频率控制（5 分钟间隔），`done` 内 `offClose` 自清理避免监听泄漏
- `app.wxss` — `.ad-banner-wrap` / `.page-bottom-spacer` 样式
- `pages/home/home.wxml` — 底部固定 Banner `home-002`
- `pages/index/index.wxml` — 底部固定 Banner `index-001`
- `pages/wealth/wealth.wxml` — 底部固定 Banner `wealth-001`
- `pages/wealth-health/wealth-health.wxml` — 底部固定 Banner `wealthhealth-001`
- `pages/bmi/bmi.wxml` — 底部固定 Banner `bmi-001`
- `pages/progress/progress.wxml` — 底部固定 Banner `progress-001`
- `pages/relation/relation.wxml` — 底部固定 Banner `relation-001`
- 各工具页 `goHome`（来自 `behaviors/calc-page.js`）调用 `app.showInterstitial` 触发插屏

## 上线后替换步骤

1. 开通流量主后，在后台创建 7 个 Banner 广告位 + 1 个插屏广告位
2. 获取每个广告位的真实 `adUnitId`
3. 全文搜索替换：
   - `adunit-banner-home-002` → 首页 Banner 真实 ID
   - `adunit-banner-index-001` → 支出页 Banner 真实 ID
   - `adunit-banner-wealth-001` → 财富页 Banner 真实 ID
   - `adunit-banner-wealthhealth-001` → 财富健康指数 Banner 真实 ID
   - `adunit-banner-bmi-001` → BMI Banner 真实 ID
   - `adunit-banner-progress-001` → 时光进度条 Banner 真实 ID
   - `adunit-banner-relation-001` → 亲戚关系 Banner 真实 ID
   - `adunit-xxxxxxxxxxxxxxxx` → 插屏广告真实 ID
4. 重新上传代码 → 提交审核 → 发布
