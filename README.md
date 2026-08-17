# 聚合计算 · 微信小程序

> 多场景刚需计算工具聚合平台 —— 一个微信小程序，把日常用得上的「算一算」都收进首页卡片里。
> 纯前端实现，无后端、无账号、无云同步；结果可一键保存为图片并分享。

- **仓库**：`family-budget-calculator`
- **小程序显示名**：`聚合计算`（由 `miniprogram/config/tools.js` 的 `appName` 统一定义）
- **版本**：`1.3.0`
- **形态**：微信小程序（含「国潮塔罗」独立分包）

---

## 目录

1. [项目简介](#1-项目简介)
2. [功能一览](#2-功能一览)
3. [产品特性](#3-产品特性)
4. [如何使用](#4-如何使用)
5. [本地开发环境](#5-本地开发环境)
6. [项目架构与目录结构](#6-项目架构与目录结构)
7. [公共基础设施](#7-公共基础设施)
8. [如何新增一个计算工具](#8-如何新增一个计算工具)
9. [测试](#9-测试)
10. [广告与变现](#10-广告与变现)
11. [部署与发布到 GitHub](#11-部署与发布到-github)
12. [常见问题（FAQ）](#12-常见问题faq)
13. [许可证与贡献](#13-许可证与贡献)

---

## 1. 项目简介

「聚合计算」把分散在各处的计算器聚合成一个微信小程序：从家庭收支、财富层级、财富健康指数，到 BMI、亲戚关系称呼、时光进度条，再到娱乐向的国潮塔罗。

设计原则：

- **注册表驱动**：首页卡片的唯一数据源是 `miniprogram/config/tools.js`，新增一个工具 ≈ 1 行配置 + 1 套页面。
- **通用基建复用**：输入行、保存出图、历史存储、分享、暗色主题都由公共模块统一承载，各工具页只写自己的计算与绘制逻辑。
- **纯前端**：所有计算在本地完成，数据不上传，不依赖任何服务端。

---

## 2. 功能一览

| 图标 | 工具 | 简介 | 入口路径 |
|------|------|------|----------|
| 🔮 | **国潮塔罗** | 抽一张牌，照见今天的状态与提醒；22 张大阿尔卡纳国潮卡面，3 种牌阵 | `subpackages/tarot/pages/index` |
| 💎 | **财富层级测试** | 输入资产与负债（单位：万元），测算净资产、负债率与 7 级财富等级 | `pages/wealth/wealth` |
| 📈 | **财富健康指数** | 用财富公式（含五险一金、个税、城市社保口径）测算净资产积累效率 | `pages/wealth-health/wealth-health` |
| 👪 | **亲戚关系** | 从「我」出发拼关系链，一键查出该叫 TA 什么（覆盖祖辈旁系、堂表亲属） | `pages/relation/relation` |
| 🧮 | **家庭支出计算** | 15 项支出明细（月度/年度/育儿），环形饼图一目了然 | `pages/index/index` |
| ⚖️ | **BMI 计算器** | 身高体重一键算，给出中国标准分类与健康体重区间 | `pages/bmi/bmi` |
| 📊 | **时光进度条** | 今年/本月/今日进度自动算，填入生日可得「人生进度」 | `pages/progress/progress` |

> 说明：早期版本中的「存钱段位」工具已于 2026-07-29 下线，由「财富健康指数」取代其首页位。

---

## 3. 产品特性

- **暗色主题**：首页 🌙 一键切换，偏好持久化（`wx.setStorageSync`），7 个页面 + 出图 Canvas 全量适配。
- **历史中心**：`utils/history.js` 本地 FIFO 保存最近 100 条，收藏上限 30；历史页支持筛选 / ⭐收藏 / 删除 / 清空。点击历史记录可自动回填输入并重算。
- **保存为图片 + 分享**：计算结果可渲染为带「品牌条 + 小程序码」的高清长图，长按识别即可回到小程序；支持转发给微信好友。
- **广告变现**：首页与各个工具页底部接入 Banner 广告，返回首页时展示插屏广告（流量主能力）。
- **零输入即算**：如「时光进度条」按当前日期自动计算，无需任何输入。

---

## 4. 如何使用

### 终端用户

「聚合计算」是微信小程序。正式发布后，在微信内搜索「**聚合计算**」即可打开使用；也可通过分享的图片/链接进入对应工具。

> 仓库本身为私有，源码用于开发与协作，不直接面向终端用户分发。

### 开发者 / 协作者

克隆仓库后，用 **微信开发者工具** 导入 `miniprogram/` 目录即可运行（详见下一节）。

---

## 5. 本地开发环境

### 前置条件

- **微信开发者工具**（稳定版即可）
- 一个微信小程序 **AppID**（可用「测试号」快速体验，或填入你自己的 AppID）
- Node.js（仅用于跑回归测试，小程序本身不需要构建）

### 导入与运行

1. 打开微信开发者工具 → 「导入项目」。
2. 目录选择本仓库的 `miniprogram/` 文件夹。
3. 填入 AppID（或选择「测试号」）。
4. 编译后即可在模拟器预览；真机扫码调试请用「真机调试」。

> 提示：模拟器无相册权限，因此「保存为图片」在模拟器会提示失败，属正常现象；**真机授权相册后可正常使用**。

---

## 6. 项目架构与目录结构

```
family-budget-calculator/
├── miniprogram/                  # 微信小程序工程（真正可运行的部分）
│   ├── app.js / app.json / app.wxss
│   ├── pages/                    # 主包页面
│   │   ├── home/                 #   首页（工具选择 + 主题切换 + 历史入口）
│   │   ├── history/              #   历史中心
│   │   ├── index/                #   家庭支出计算
│   │   ├── wealth/               #   财富层级测试
│   │   ├── wealth-health/        #   财富健康指数
│   │   ├── bmi/                  #   BMI 计算器
│   │   ├── progress/             #   时光进度条
│   │   └── relation/             #   亲戚关系
│   ├── subpackages/
│   │   └── tarot/                # 国潮塔罗分包（独立体积，首屏更轻）
│   │       ├── pages/            #   牌阵选择 + 抽牌结果
│   │       ├── data/cards.js     #   22 张大阿尔卡纳 + 3 牌阵 + 抽牌函数
│   │       └── assets/jpg/       #   卡面图（400×400 jpg，22 张）
│   ├── components/calc-input/    # 通用输入行组件
│   ├── behaviors/calc-page.js    # 通用页面行为（返回/分享/暗色/历史恢复/saveResultTemplate 保存模板）
│   ├── utils/
│   │   ├── report.js             # 报告出图（Canvas 2.0：header/品牌条/footer/导出）
│   │   ├── history.js            # 本地历史存储
│   │   ├── format.js             # 金额格式化
│   │   ├── wealth-health.js      # 财富健康指数纯函数计算
│   │   └── ...
│   ├── data/                     # 城市社保、专项扣除等数据模型
│   ├── config/tools.js           # ★ 中央工具注册表（首页唯一数据源）
│   └── test_*.js                 # 纯 Node 回归测试（无需微信 IDE）
├── 测试脚本复用指南.md            # 测试脚本作用/跑法/扩展方法（改功能必读）
├── 聚合计算_PRD.html              # 产品 PRD
├── ad_placement_guide.md          # 广告位预埋清单（上线换真实 ID）
├── 塔罗文案_大阿尔卡纳.md          # 塔罗文案源稿
├── package.json                  # 提供 npm test
└── .gitignore
```

---

## 7. 公共基础设施

| 模块 | 路径 | 作用 |
|------|------|------|
| 中央工具注册表 | `config/tools.js` | `appName` + `tools` 数组，首页列表唯一数据源 |
| 通用报告生成 | `utils/report.js` | `drawHeader / drawBrandStrip / drawFooter / exportAndSave`，Canvas 2.0 + 暗色适配 |
| 通用输入组件 | `components/calc-input/` | 封装输入行，支持 `symbol`(¥) / `unit`(万元) |
| 通用页面行为 | `behaviors/calc-page.js` | `goHome`(带插屏) + `onShareAppMessage` + 暗色同步 + 历史恢复 + `saveResultTemplate`(统一保存模板) + `saveImage`(Canvas 出图脚手架) |
| 金额格式化 | `utils/format.js` | `formatMoney`(千分位) / `formatWan`(1 位小数) |
| 历史存储 | `utils/history.js` | `add / getAll / getByTool / star / remove / clear`，FIFO 100 + 收藏 30 |

---

## 8. 如何新增一个计算工具

以「在首页新增一个计算器」为例：

1. **注册页面路径**：在 `miniprogram/app.json` 的 `pages` 数组追加 `"pages/xxx/xxx"`（若在分包则在对应 `subPackages` 内）。
2. **登记首页卡片**：在 `miniprogram/config/tools.js` 的 `tools` 数组加一项：
   ```js
   {
     id: 'xxx',
     icon: '🧩',
     name: '新工具',
     desc: '一句话描述',
     path: '/pages/xxx/xxx',
     hot: true            // 可选：标记热门
   }
   ```
3. **新建页面四件套** `pages/xxx/xxx.{js,wxml,wxss,json}`：
   - `.js`：`behaviors: [require('../../behaviors/calc-page.js')]`，`data` 含 `share`；输入用 `<calc-input>`，计算完写 `share`；**保存统一调 `this.saveResultTemplate(opts)`**（只需传 `toolId/toolName/icon/input/summary/title/theme/slogan/footer/hook/guard/noResultHint/draw`，isSaving 守卫与历史写入自动处理，`draw(canvas,ctx,W,H,data)` 写自己的海报绘制）；实现 `restoreHistory` 以支持历史回填。
   - `.json`：`usingComponents: { "calc-input": "/components/calc-input/calc-input" }`
   - 保存模板细节与完整测试写法见根目录 `测试脚本复用指南.md`。
4. （可选）复用全局样式 `.card` / `.btn*` / `.input-row` / `.ad-banner-wrap`。

首页网格会按工具数量自适应列数（≤4 工具 2 列，5~8 工具 3 列，更多则 4 列），无需额外配置。

---

## 9. 测试

回归测试是**纯 Node** 脚本，注入了 `wx / getApp / Page / Behavior` 的轻量 mock，**不依赖微信开发者工具**，可在任意终端直接跑。

```bash
npm test            # 聚合运行 test_tarot.js + test_all.js + test_buttons.js，任一失败则整体失败
```

- `test_tarot.js`：**55** 条断言 —— 塔罗数据层（22 牌 / 3 阵 / 抽牌）+ 页面层（选型/抽牌/分享/历史）+ 集成出图层（卡面兜底/逆位旋转/长图不重叠）+ 保存链路回归。
- `test_all.js`：**139** 条断言 —— 6 个非塔罗工具的「核心计算逻辑 + 计算后按钮」全量回归（含财富健康指数的城市社保口径、个税累进、常识性校验、refactor 基建回归：主题/DPR 缓存、onInput 防抖、Canvas 2.0 饼图、DEDUCT_ITEMS 字段一致性等）。
- `test_buttons.js`：**39** 条断言 —— 全页面按钮/事件绑定完整性（每个 wxml 的事件处理器都能在 JS 中找到）+ 未覆盖页面点击模拟（首页跳转/主题切换、历史页筛选/收藏/删除/清空/点击还原、塔罗选牌跳转、calc-input 输入净化）+ 全部 JS 严格模式解析（防重复声明，微信编译器会因 `function` 重名直接编译失败）。
- 合计 **233** 条断言；随功能增加断言数会同步增长。

也可单独运行：

```bash
npm run test:tarot   # 仅塔罗
npm run test:all     # 仅非塔罗
```

> 建议：每次提交前先跑 `npm test`，确保全量回归通过。

---

## 10. 广告与变现

- 首页与各个工具页底部接入微信流量主 **Banner** 广告。
- 返回首页时展示 **插屏** 广告。
- 广告位 `adUnitId` 在对应页面的 `.wxml` 中配置，正式发布前需替换为你在微信流量主后台申请的单元 ID。

---

## 11. 部署与发布到 GitHub

### 仓库信息

| 项 | 值 |
|---|---|
| 远程仓库 | `https://github.com/hanyuestar/family-budget-calculator.git` |
| 可见性 | 私有（private） |
| 默认分支 | `main` |

### 提交身份（避免 GH007）

使用 GitHub 官方的 **noreply** 地址提交，既能计入贡献、又不暴露真实邮箱：

```bash
git config user.name  "hanyuestar"
git config user.email "170588330+hanyuestar@users.noreply.github.com"
```

> 切勿用真实私有邮箱（如 QQ 邮箱）作为提交邮箱，否则可能被 GitHub 的 GH007 策略拦截。

### 推送

本机可直连 GitHub（无需经本地代理隧道）。推送时 **PAT 仅内联、不写入 `.git/config`**：

```bash
git -c credential.helper= -c http.proxy= \
  push https://hanyuestar:<PAT>@github.com/hanyuestar/family-budget-calculator.git main
```

要点：

- PAT 用 `https://hanyuestar:<PAT>@...` 内联；推送完成后 `remote.origin.url` 仍保持无 token 的干净形式。
- Fine-grained PAT 须**显式授权本仓库**（权限 `Contents: Read and write`）。
- 若远程存在 GitHub 自动生成的占位 README 导致分叉，不要使用 `git rebase --root`，应在远程 base 上重建线性提交后再推。

### 不纳入版本库的内容

已在根 `.gitignore` 排除：`tarot-sources/`（卡面源图，约 69MB）、`.workbuddy/`（项目隐私记忆）。旧版本备份 7z 已于 2026-08-17 清理（源码由 git 历史管理）。

---

## 12. 常见问题（FAQ）

**Q：模拟器里点「保存」提示失败？**
A：模拟器无相册权限，属正常现象；真机授权相册后可正常保存为图片。

**Q：首页加了一个工具但卡片不显示？**
A：检查两处字段名——`config/tools.js` 用 `path`（不是 `url`），且 `home.wxml` 绑定 `data-path`、`home.js` 读 `dataset.path`，三者任一写成 `url` 会导致 `wx.navigateTo` 静默失败。

**Q：为什么没有后端 / 账号系统？**
A：当前形态为纯前端计算 + 本地 `wx.setStorageSync` 历史，数据不出端，部署与维护成本最低。

**Q：塔罗卡面图为什么放在分包的 `assets/jpg/`？**
A：早期用 webp 在部分 Android 真机无法解码，已统一转 400×400 jpg；置于分包可控制主包体积，首屏加载更快。

---

## 13. 许可证与贡献

- 仓库当前为**私有**，仅供作者与授权协作者开发与维护。
- 如需贡献（新增工具、修 bug、补测试），请先跑通 `npm test`，并确保提交邮箱使用上文的 noreply 地址。
- 产品名、文案、卡面素材等版权归作者所有；商用或二次分发请先联系作者。

---

> 文档维护：本 README 为项目对外指引的统一入口；测试脚本的复用方法见根目录 `测试脚本复用指南.md`，项目长期记忆（架构/测试约定/Git 部署约束）见 `.workbuddy/memory/MEMORY.md`。
