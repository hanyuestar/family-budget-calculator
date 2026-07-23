# 国潮塔罗 · MVP 开发说明（分包）

> 状态：已落地、已静态校验，可在微信开发者工具中调试
> 定位：娱乐测试 / 心理投射（合规红线：禁"预测/改运/转运/必"等承诺词）

## 一、这次做了什么
1. **删除过时文件**：`tarot-sources/tarot-assets-manifest.json`、`upload_to_cos.py`（CDN 方案产物）已删除；仅留 `raw/`、`masters/` 源备份（在工程目录外，不上传）。
2. **塔罗做成分包**：22 张国潮塔罗 webp 素材从 `miniprogram/assets/tarot/webp/` **移入分包** `miniprogram/subpackages/tarot/assets/webp/`，主包不背体积。
3. **MVP 开发**：牌阵选择页 + 抽牌/结果页，复用现有 `calc-page` / `report` / `history` 基建。

## 二、分包结构
```
miniprogram/
├── app.json                      # 新增 subPackages（大写 P）注册 tarot
├── config/tools.js               # 首页新增「国潮塔罗」卡片(hot)
└── subpackages/tarot/
    ├── pages/
    │   ├── index/                # 牌阵选择（每日一牌 / 三张时间流 / 关系决策阵）
    │   └── draw/                 # 抽牌 + 结果（洗牌动画 / 正逆位 / 保存 / 分享 / 再抽）
    ├── data/cards.js             # 22 张大阿尔卡纳：正/逆位文案 + 今日一句 + 抽牌逻辑
    └── assets/webp/              # 22 张国潮塔罗图（随分包加载）
```

## 三、体积（已校验）
- **主包 ≈ 328K**（远 < 2MB，启动快）
- **塔罗分包 ≈ 1.7M**（< 2MB 分包限，< 20MB 总包）

## 四、怎么调试
1. 用微信开发者工具打开 `miniprogram/`（appid: `wx7fa128d056963af6`）。
2. 首页点击 🔮「国潮塔罗」卡片（带 🔥）→ 进入牌阵选择。
3. 选任一阵 → 自动洗牌（900ms）→ 开牌，可「再抽一次 / 保存 / 分享 / 首页」。
4. 校验清单：
   - 三个牌阵抽牌数是否正确（1 / 3 / 4）；
   - 同一阵内是否出现重复牌（逻辑已做不重复抽取）；
   - 逆位时牌图是否旋转 180°；
   - 点「保存」能否生成带品牌条的报告图并存入相册；
   - 点「分享」`onShareAppMessage` 是否正常；
   - 历史页是否新增一条「国潮塔罗」记录。

## 五、已通过的静态校验
- JS 语法（`node --check`）：cards.js / index.js / draw.js 全 OK
- JSON 合法性：app.json + 两个页面 json OK
- 资源对齐：22 张 webp 文件名与 `cards.js` slug 全匹配；`assets/qrcode.jpg` 存在
- 抽牌仿真：200 次 4 张抽牌 0 异常，正/逆位、字段完整

## 六、MVP 已知取舍（后续增强项）
1. **保存出图为纯文字报告**（牌名+正逆位+关键词），卡面图暂未绘入 canvas；增强可做图文混排报告。
2. **洗牌动画**为 900ms 延时模拟，未做逐张翻牌 3D 动效。
3. **逆位**仅 CSS 旋转牌图，未另配逆位专用插画。
4. 仅 22 张大阿尔卡纳；小阿尔卡纳（56 张）未做，后续视数据量决定是否扩充。

## 七、广告位
- 分包内 banner：`adunit-banner-tarot-001`（当前为占位 id，上线前替换为真实广告单元）。
