// test_tarot.js — 国潮塔罗功能全量测试
// 三层覆盖：
//   1) 数据层（纯 node，cards.js 零外部依赖）
//   2) 页面层（index.js / draw.js，注入 wx / getApp / Page / Behavior mock）
//   3) 基建集成（calc-page.saveImage → report 出图 → history 写入）
//   4) 保存链路回归：① 所有工具页 draw 签名须为 (canvas,ctx,W,H,data)（5参），
//      防"签名错配导致 canvas 当 ctx → fillText 抛错 → 保存按钮永久变灰"复发；
//      ② 直接模拟 draw 抛错，验证 calc-page 兜底能复位 isSaving 并提示失败。
// 运行：node miniprogram/test_tarot.js

var path = require('path')
var fs = require('fs')

var pass = 0, fail = 0
function record(ok, label, detail) {
  if (ok) { pass++; console.log('  ✅ ' + label) }
  else { fail++; console.log('  ❌ ' + label + (detail ? ' | ' + detail : '')) }
}
function test(name, fn) {
  try { fn() }
  catch (e) { fail++; console.log('  ❌ ' + name + ' | threw: ' + e.message) }
}

// ============ 通用 mock：wx / getApp ============
var store = {}                       // 模拟 wx 本地存储
var toastCalls = []                  // 记录 showToast 参数
var navigateCalls = []               // 记录 navigateTo 参数
var saveAlbumCalls = 0               // saveImageToPhotosAlbum 调用次数
var exportCalls = 0                  // canvasToTempFilePath 调用次数

var wxMock = {
  getSystemInfoSync: function () { return { pixelRatio: 2 } },
  getStorageSync: function (k) { return store[k] },
  setStorageSync: function (k, v) { store[k] = v },
  showToast: function (o) { toastCalls.push(o) },
  showModal: function () {},
  openSetting: function () {},
  navigateTo: function (o) { navigateCalls.push(o) },
  navigateBack: function () {},
  redirectTo: function () {},
  canvasToTempFilePath: function (o) { exportCalls++; if (o && o.success) o.success({ tempFilePath: 'tmp://x' }) },
  saveImageToPhotosAlbum: function (o) { saveAlbumCalls++; if (o && o.success) o.success() },
  createSelectorQuery: function () {
    return {
      select: function () {
        return {
          fields: function () {
            return {
              exec: function (cb) { cb([{ node: makeCanvas() }]) }
            }
          }
        }
      }
    }
  }
}
global.wx = wxMock

var appMock = {
  globalData: { theme: 'light' },
  showInterstitial: function (cb) { if (cb) cb() }
}
global.getApp = function () { return appMock }

// ============ 通用 mock：canvas / ctx ============
var drawImageCalls = []
var rotateCalls = []
var fillTextCalls = []
var fillRectCalls = []
var strokeCalls = []   // 记录每条水平线：{ y, style }

function makeCtx() {
  return {
    fillStyle: '#000', strokeStyle: '#000', font: '', lineWidth: 1, textAlign: 'left',
    fillRect: function () { fillRectCalls.push(1) },
    strokeRect: function () {},
    clearRect: function () {},
    beginPath: function () { this._mx = this._my = this._lx = this._ly = 0 },
    moveTo: function (x, y) { this._mx = x; this._my = y },
    lineTo: function (x, y) { this._lx = x; this._ly = y },
    arc: function () {}, closePath: function () {}, fill: function () {},
    stroke: function () { if (Math.abs(this._my - this._ly) < 1e-6) strokeCalls.push({ y: this._my, style: this.strokeStyle }) },
    save: function () {}, restore: function () {},
    translate: function () {}, rotate: function (r) { rotateCalls.push(r) },
    scale: function () {},
    drawImage: function (img, x, y, w, h) { drawImageCalls.push({ x: x, y: y, w: w, h: h, img: img }) },
    fillText: function (t, x, y) { fillTextCalls.push({ t: t, x: x, y: y }) },
    measureText: function (s) { return { width: ('' + s).length * 7 } },
    createLinearGradient: function () { return { addColorStop: function () {} } }
  }
}
function makeCanvas() {
  var ctx = makeCtx()
  return {
    width: 0, height: 0,
    getContext: function () { return ctx },
    createImage: function () {
      var o = { onload: null, onerror: null, _src: '', _fail: false }
      Object.defineProperty(o, 'src', {
        set: function (v) {
          this._src = v
          var self = this
          process.nextTick(function () { if (self._fail) { if (self.onerror) self.onerror() } else { if (self.onload) self.onload() } })
        },
        get: function () { return this._src }
      })
      return o
    }
  }
}

// ============ 通用 mock：Page / Behavior 收集 ============
global.__pages = []
global.Page = function (opts) { global.__pages.push(opts) }
global.Behavior = function (opts) { return opts }   // 透传，便于合并

// 合并 behavior + page 构造可驱动的实例
function instantiate(opts) {
  var inst = {}
  inst.data = {}
  ;(opts.behaviors || []).forEach(function (b) {
    if (b.data) Object.keys(b.data).forEach(function (k) { inst.data[k] = b.data[k] })
    if (b.methods) Object.keys(b.methods).forEach(function (k) { inst[k] = b.methods[k].bind(inst) })
  })
  if (opts.data) Object.keys(opts.data).forEach(function (k) { inst.data[k] = opts.data[k] })
  Object.keys(opts).forEach(function (k) {
    if (k === 'behaviors' || k === 'data') return
    if (typeof opts[k] === 'function') inst[k] = opts[k].bind(inst)
  })
  inst.setData = function (patch) { Object.keys(patch).forEach(function (k) { inst.data[k] = patch[k] }) }
  return inst
}

// 让 doDraw 的 setTimeout(900) 同步执行，便于确定性断言
var realSetTimeout = global.setTimeout
global.setTimeout = function (fn) { fn() }

// ============ 加载被测模块 ============
var cards = require('./subpackages/tarot/data/cards.js')
require('./subpackages/tarot/pages/index/index.js')   // 收集 index page
require('./subpackages/tarot/pages/draw/draw.js')      // 收集 draw page

var TAROT_ROOT = path.join(__dirname, 'subpackages/tarot')
function findPage(name) {
  return global.__pages.filter(function (p) {
    return (p.data && p.data.share && p.data.share.path && p.data.share.path.indexOf(name) >= 0) ||
      (p.onLoad && p.data && p.data.spreadId)
  })
}
// index 与 draw 顺序按其 require 顺序：先 index 后 draw
var indexOpts = global.__pages[0]
var drawOpts = global.__pages[1]

console.log('\n=== 国潮塔罗全量测试 ===\n')

// =================================================================
console.log('— 数据层：22 张大阿尔卡纳 —')
test('22 张牌且 idx 连续 0..21', function () {
  var idxs = cards.CARDS.map(function (c) { return c.idx })
  var ok = cards.CARDS.length === 22 && idxs.every(function (v, i) { return v === i })
  record(ok, '22 张牌且 idx 连续 0..21', 'len=' + cards.CARDS.length)
})
test('每张含 cn/en/slug/today 且非空', function () {
  var bad = cards.CARDS.filter(function (c) {
    return !c.cn || !c.en || !c.slug || !c.today
  })
  record(bad.length === 0, '每张含 cn/en/slug/today 且非空', 'bad=' + bad.length)
})
test('每张 up/rev 含 3 个关键词 + 解读文本', function () {
  var bad = cards.CARDS.filter(function (c) {
    return !c.up || c.up.kw.length !== 3 || !c.up.text ||
      !c.rev || c.rev.kw.length !== 3 || !c.rev.text
  })
  record(bad.length === 0, '每张 up/rev 含 3 关键词+解读', 'bad=' + bad.length)
})
test('每张 img 路径前缀/格式正确', function () {
  var re = /^\/subpackages\/tarot\/assets\/jpg\/major-\d{2}-[a-z]+\.jpg$/
  var bad = cards.CARDS.filter(function (c) { return !re.test(c.img) })
  record(bad.length === 0, '每张 img 路径前缀/格式正确', 'bad=' + bad.length)
})
test('每张 img 对应 jpg 文件真实存在', function () {
  var bad = cards.CARDS.filter(function (c) {
    var f = path.join(TAROT_ROOT, c.img.replace('/subpackages/tarot/', ''))
    return !fs.existsSync(f)
  })
  record(bad.length === 0, '每张 img 对应 jpg 文件真实存在', 'missing=' + bad.length)
})

// =================================================================
console.log('\n— 数据层：3 个牌阵 —')
test('SPREADS 存在 3 个阵', function () {
  var keys = Object.keys(cards.SPREADS)
  record(keys.length === 3, 'SPREADS 存在 3 个阵', keys.join(','))
})
test('daily 阵 count=1 且 positions=["今日"]', function () {
  var s = cards.SPREADS.daily
  record(s.count === 1 && s.positions.length === 1 && s.positions[0] === '今日', 'daily 阵 count=1')
})
test('timeline 阵 count=3 且 3 个位置', function () {
  var s = cards.SPREADS.timeline
  record(s.count === 3 && s.positions.length === 3, 'timeline 阵 count=3')
})
test('relation 阵 count=4 且 4 个位置', function () {
  var s = cards.SPREADS.relation
  record(s.count === 4 && s.positions.length === 4, 'relation 阵 count=4')
})
test('各阵 positions.length === count', function () {
  var ok = Object.keys(cards.SPREADS).every(function (k) {
    return cards.SPREADS[k].positions.length === cards.SPREADS[k].count
  })
  record(ok, '各阵 positions.length === count')
})

// =================================================================
console.log('\n— 数据层：抽牌逻辑 drawCards —')
test('抽 n 张不重复（idx 唯一）', function () {
  var ok = true
  for (var i = 0; i < 300; i++) {
    var d = cards.drawCards(4)
    var ids = d.map(function (c) { return c.idx })
    var uniq = ids.every(function (x, j) { return ids.indexOf(x) === j })
    if (d.length !== 4 || !uniq) { ok = false; break }
  }
  record(ok, '抽 4 张 300 次均不重复')
})
test('reversed 为布尔、orientation 与 reversed 一致', function () {
  var ok = true
  for (var i = 0; i < 300; i++) {
    var d = cards.drawCards(4)
    d.forEach(function (c) {
      if (typeof c.reversed !== 'boolean') ok = false
      if ((c.reversed && c.orientation !== '逆位') || (!c.reversed && c.orientation !== '正位')) ok = false
      if (!c.kw || !c.text) ok = false
    })
  }
  record(ok, 'reversed 布尔 + orientation 对应')
})
test('逆/正位文案正确映射（up↔正位 rev↔逆位）', function () {
  // 构造确定输入
  var r = cards.drawCards(22)
  var ok = r.every(function (c) {
    var src = cards.CARDS[c.idx]
    return c.reversed ? c.text === src.rev.text : c.text === src.up.text
  })
  record(ok, '逆/正位文案正确映射')
})
test('抽 1 张=每日一牌场景', function () {
  var d = cards.drawCards(1)
  record(d.length === 1 && d[0].position === undefined || d.length === 1, '抽 1 张有效')
})
test('字段完整：idx/slug/cn/en/img/kw/text/today', function () {
  var d = cards.drawCards(3)
  var need = ['idx', 'slug', 'cn', 'en', 'img', 'reversed', 'orientation', 'kw', 'text', 'today']
  var ok = d.every(function (c) { return need.every(function (k) { return c[k] !== undefined }) })
  record(ok, '抽牌结果字段完整')
})

// =================================================================
console.log('\n— 页面层：牌阵选择 index —')
var indexPage = instantiate(indexOpts)
test('onLoad 设置 isDark', function () {
  indexPage.onLoad({})
  record(indexPage.data.isDark === false, 'index.onLoad 设置 isDark=false')
})
test('goDraw(timeline) 跳转至对应牌阵', function () {
  navigateCalls.length = 0
  indexPage.goDraw({ currentTarget: { dataset: { id: 'timeline' } } })
  var url = navigateCalls[0] && navigateCalls[0].url
  record(url === '/subpackages/tarot/pages/draw/draw?spread=timeline', 'goDraw(timeline) 跳转正确', url)
})
test('goDraw(daily) 跳转正确', function () {
  navigateCalls.length = 0
  indexPage.goDraw({ currentTarget: { dataset: { id: 'daily' } } })
  record(navigateCalls[0].url.indexOf('spread=daily') >= 0, 'goDraw(daily) 跳转正确')
})
test('spreads 数据含 3 项且 count 正确', function () {
  var sp = indexPage.data.spreads
  record(sp.length === 3 && sp[0].count === 1 && sp[1].count === 3 && sp[2].count === 4, 'index spreads 3 项 count 正确')
})

// =================================================================
console.log('\n— 页面层：抽牌 draw —')
function freshDraw() { return instantiate(drawOpts) }

test('onLoad(timeline) 解析牌阵', function () {
  var p = freshDraw(); p.onLoad({ spread: 'timeline' })
  record(p.data.spreadId === 'timeline' && p.data.spreadName === '圣三角牌阵' && p.data.positions.length === 3, 'onLoad(timeline) 解析正确')
})
test('onLoad(relation) 解析牌阵 4 张', function () {
  var p = freshDraw(); p.onLoad({ spread: 'relation' })
  record(p.data.spreadId === 'relation' && p.data.positions.length === 4, 'onLoad(relation) 解析正确')
})
test('onLoad 缺省 spread → daily', function () {
  var p = freshDraw(); p.onLoad({})
  record(p.data.spreadId === 'daily', 'onLoad 缺省回退 daily')
})
test('onLoad 未知 spread → 回退 daily', function () {
  var p = freshDraw(); p.onLoad({ spread: 'xyz' })
  record(p.data.spreadId === 'daily', 'onLoad 未知回退 daily')
})
test('onLoad 触发抽牌：deck 长度=positions 且 revealed=true', function () {
  var p = freshDraw(); p.onLoad({ spread: 'timeline' })
  record(p.data.deck.length === 3 && p.data.revealed === true && p.data.drawing === false, 'onLoad 自动抽 3 张并开牌')
})
test('doDraw 守卫：drawing 中重复调用不重抽', function () {
  var p = freshDraw(); p.onLoad({ spread: 'daily' })
  var before = p.data.deck
  p.setData({ drawing: true })
  p.doDraw()
  record(p.data.deck === before, 'drawing 中 doDraw 被忽略（guard 生效）')
})
test('分享信息 _updateShare 正确', function () {
  var p = freshDraw(); p.onLoad({ spread: 'timeline' })
  var s = p.data.share
  record(s.ready === true && s.title.indexOf('圣三角牌阵') >= 0 && s.path.indexOf('spread=timeline') >= 0, '_updateShare 生成标题/路径')
})
test('历史写入 _saveHistory', function () {
  store['tool_history'] = []
  var p = freshDraw(); p.onLoad({ spread: 'daily' })
  var list = store['tool_history'] || []
  var ok = list.length === 1 && list[0].toolId === 'tarot' && list[0].toolName === '国潮塔罗' && list[0].toolIcon === '🔮'
  var summaryOk = list[0] && /正|逆/.test(list[0].summary)
  record(ok && summaryOk, '_saveHistory 写入 tarot 记录', list[0] && list[0].summary)
})
test('redraw 再次开牌无异常', function () {
  var p = freshDraw(); p.onLoad({ spread: 'relation' })
  var ok = true
  try { p.redraw() } catch (e) { ok = false }
  record(ok && p.data.revealed === true && p.data.deck.length === 4, 'redraw 重新抽 4 张')
})
test('onShareAppMessage 已开牌返回真实分享', function () {
  var p = freshDraw(); p.onLoad({ spread: 'daily' })
  var r = p.onShareAppMessage()
  record(r.title && r.path.indexOf('draw?spread=daily') >= 0, 'onShareAppMessage 返回牌阵分享')
})

// =================================================================
console.log('\n— 集成层：保存出图 saveResult（含卡面）—')
async function runSaveTests() {
  // 守卫：revealed=false 时不应触发出图
  toastCalls.length = 0; exportCalls = 0
  var p0 = freshDraw(); p0.onLoad({ spread: 'daily' })
  p0.setData({ revealed: false, deck: [] })
  p0.saveResult()
  record(toastCalls.some(function (t) { return /请先抽牌/.test(t.title || '') }) && exportCalls === 0, '未开牌时 saveResult 提醒且不发图')

  // 正常出图：revealed=true
  drawImageCalls.length = 0; rotateCalls.length = 0; fillTextCalls.length = 0; strokeCalls.length = 0
  exportCalls = 0; saveAlbumCalls = 0; toastCalls.length = 0
  var p = freshDraw(); p.onLoad({ spread: 'relation' })
  // 确定性设置朝向：第 0 张逆位（走 rotate 分支），其余正位（保证 uprightCount>=1，消除随机 flake）
  function setOri(c, rev) {
    c.reversed = rev
    c.orientation = rev ? '逆位' : '正位'
    var o = rev ? cards.CARDS[c.idx].rev : cards.CARDS[c.idx].up
    c.kw = o.kw; c.text = o.text
  }
  p.data.deck.forEach(function (c, i) { setOri(c, i === 0) })
  var revCount = p.data.deck.filter(function (c) { return c.reversed }).length

  await new Promise(function (res) { process.nextTick(res) })
  await new Promise(function (res) { realSetTimeout(res, 15) })

  p.saveResult()
  await new Promise(function (res) { process.nextTick(res) })
  await new Promise(function (res) { realSetTimeout(res, 30) })

  record(exportCalls === 1, 'saveResult 触发一次 canvasToTempFilePath', 'exportCalls=' + exportCalls)
  record(saveAlbumCalls === 1, 'saveResult 触发一次 saveImageToPhotosAlbum', 'saveAlbumCalls=' + saveAlbumCalls)
  record(toastCalls.some(function (t) { return /已保存到相册/.test(t.title || '') }), '出图成功 toast「已保存到相册」')
  record(p.data.isSaving === false, '出图完成后 isSaving 复位 false')
  record(drawImageCalls.length >= p.data.deck.length, '每张牌卡面均被绘制(drawImage)', 'drawImages=' + drawImageCalls.length + ' deck=' + p.data.deck.length)
  // 每张正位卡面图的 y 应为 TOP + index*UNIT（TOP=110,UNIT=200），避开顶部 banner（高80）；逆位牌经旋转 transform，drawImage y 为负值不比较
  var UNIT = 200, TOPv = 110
  var uprightOk = p.data.deck.every(function (c, i) {
    if (c.reversed) return true
    return drawImageCalls.some(function (d) { return d.y === TOPv + i * UNIT })
  })
  var uprightCount = p.data.deck.filter(function (c) { return !c.reversed }).length
  record(uprightOk && uprightCount >= 1, '正位卡面图 y=TOP+index*UNIT 不压 banner', 'uprightCount=' + uprightCount)
  // 所有位置标签（过去/现在/未来/现状/阻碍/建议/结果/今日）y 应 > 80，不与 banner 重叠
  var POS = ['过去', '现在', '未来', '现状', '阻碍', '建议', '结果', '今日']
  var posLabels = fillTextCalls.filter(function (f) { return POS.indexOf(f.t) >= 0 })
  var minPosY = posLabels.length ? Math.min.apply(null, posLabels.map(function (f) { return f.y })) : -1
  record(posLabels.length >= 1 && minPosY > 80, '位置标签 y>80 不与 banner 重叠', 'minPosY=' + minPosY)
  // 逆位牌触发 rotate(PI)，正位牌直接 drawImage（不 rotate）
  var rotated = rotateCalls.filter(function (r) { return Math.abs(r - Math.PI) < 1e-6 }).length
  record(rotated === revCount && revCount >= 1, '逆位牌走 rotate(PI) 分支(' + rotated + '/' + revCount + ')')
  // 回归防护：移除的浅灰分隔线（#eeeeee，白底呈白线）不得再出现，避免压住解读第3行
  var whiteLines = strokeCalls.filter(function (s) { return s.style === '#eeeeee' })
  record(whiteLines.length === 0, '无浅灰分隔线(白线已移除，不压字)', 'whiteLines=' + whiteLines.length)

  // isSaving 守卫：连续调用第二次应被忽略
  exportCalls = 0
  p.setData({ isSaving: true })
  p.saveResult()
  record(exportCalls === 0, 'isSaving=true 时重复 saveResult 被忽略')

  console.log('\n=== 集成层出图测试完成 ===')
}

// =================================================================
console.log('\n— 集成层：出图卡面加载失败兜底 —')
async function runFailTests() {
  // 临时让 createImage 失败
  var failMode = { on: false }
  var p = freshDraw(); p.onLoad({ spread: 'daily' })
  // 覆写该实例需要的 canvas createImage 行为：通过重写 draw 拿到的 canvas mock
  // 这里的 canvas 由 wx.createSelectorQuery 提供，统一改 makeCanvas 的 createImage 不易，
  // 直接验证：draw 在 im 为 null 时走 fillRect 占位分支，不抛错。
  // 做法：monkey-patch wx.createSelectorQuery 返回的 canvas.createImage 为必失败
  var origQuery = wxMock.createSelectorQuery
  wxMock.createSelectorQuery = function () {
    return {
      select: function () {
        return {
          fields: function () {
            return {
              exec: function (cb) {
                var canvas = makeCanvas()
                var origCreate = canvas.createImage
                canvas.createImage = function () {
                  var o = { onload: null, onerror: null, _src: '' }
                  Object.defineProperty(o, 'src', {
                    set: function (v) { this._src = v; var self = this; process.nextTick(function () { if (self.onerror) self.onerror() }) },
                    get: function () { return this._src }
                  })
                  return o
                }
                cb([{ node: canvas }])
              }
            }
          }
        }
      }
    }
  }
  toastCalls.length = 0; exportCalls = 0; saveAlbumCalls = 0
  p.saveResult()
  await new Promise(function (res) { process.nextTick(res) })
  await new Promise(function (res) { realSetTimeout(res, 30) })
  record(exportCalls === 1 && saveAlbumCalls === 1, '卡面加载失败仍完成出图（兜底不崩）', 'export=' + exportCalls)
  record(toastCalls.some(function (t) { return /已保存到相册/.test(t.title || '') }), '兜底路径仍提示保存成功')
  wxMock.createSelectorQuery = origQuery
}

// ============ 其他工具保存链路回归（saveImage 签名修复）============
// 捕获方式加载某页 Page 定义，避免依赖全局 __pages 顺序
function loadOtherPage(relPath) {
  var captured = null
  var orig = global.Page
  global.Page = function (o) { captured = o }
  var abs = path.join(__dirname, relPath)
  delete require.cache[require.resolve(abs)]
  require(abs)
  global.Page = orig
  return captured
}

var OTHER_PAGES = [
  { path: 'pages/bmi/bmi.js',          prep: function (i) { i.setData({ height: '170', weight: '65' }); i.calculate() } },
  { path: 'pages/wealth/wealth.js',     prep: function (i) { i.setData({ showResult: true }) } },
  { path: 'pages/wealth-health/wealth-health.js', prep: function (i) { i.setData({ birthYear: '1990', annualPreTaxWan: '30', workStartYear: '2012', houseValue: '300', cash: '50' }); i.calculate() } },
  { path: 'pages/progress/progress.js', prep: function (i) {} },
  { path: 'pages/index/index.js',       prep: function (i) { i.setData({ annualTotal: 1, monthlyTotalStr: '0', annualTotalStr: '0', insuranceRatioStr: '0' }) } },
  { path: 'pages/relation/relation.js', prep: function (i) { i.setData({ result: '表哥', notSupported: false, chain: ['我', '父', '兄'], chainText: '我父兄' }) } }
]

function checkSignatures() {
  console.log('\n— 其他工具 saveImage draw 签名回归（应为 (canvas,ctx,W,H,data) 共5参）—')
  OTHER_PAGES.forEach(function (spec) {
    var opts = loadOtherPage(spec.path)
    if (!opts || !opts.saveResult) { record(false, spec.path + ' 未找到 saveResult'); return }
    var inst = instantiate(opts)
    if (spec.prep) spec.prep(inst)
    var captured = null
    inst.saveImage = function (o) { captured = o }
    try { inst.saveResult() }
    catch (e) { record(false, spec.path + ' saveResult 抛错', e.message); return }
    if (!captured || !captured.draw) { record(false, spec.path + ' 未捕获 draw（saveResult 未调用 saveImage）'); return }
    record(captured.draw.length === 5, spec.path + ' draw 签名正确（5参）', 'length=' + captured.draw.length)
  })
}

async function runBmiE2E() {
  console.log('\n— 端到端：bmi 走真实 saveImage → report 出图 —')
  toastCalls.length = 0; exportCalls = 0; saveAlbumCalls = 0
  var opts = loadOtherPage('pages/bmi/bmi.js')
  var inst = instantiate(opts)
  inst.setData({ height: '170', weight: '65' })
  inst.calculate()
  inst.saveResult()
  // 等 QR 图 onload（process.nextTick）触发 doExport → canvasToTempFilePath → saveImageToPhotosAlbum
  await new Promise(function (res) { process.nextTick(res) })
  await new Promise(function (res) { realSetTimeout(res, 30) })
  record(exportCalls === 1, 'bmi 触发一次 canvasToTempFilePath', 'export=' + exportCalls)
  record(saveAlbumCalls === 1, 'bmi 触发一次 saveImageToPhotosAlbum', 'album=' + saveAlbumCalls)
  record(inst.data.isSaving === false, 'bmi 出图完成 isSaving 复位 false')
  record(toastCalls.some(function (t) { return /已保存到相册/.test(t.title || '') }), 'bmi 提示保存成功')
}

// ============ 基建兜底：draw 抛错症状不复发 ============
// 复现旧 bug：draw 旧签名把 canvas 当 ctx → canvas.fillText 抛错，
// 异常逃出 saveImage 回调 → isSaving 永久 true → 保存按钮变灰无反应。
// 验证 saveImage 的 try/catch 兜底能复位按钮状态并提示失败。
async function runSaveImageGuard() {
  console.log('\n— 基建兜底：draw 抛错时 isSaving 复位（防"保存按钮永久变灰"复发）—')
  var behaviorDef = require('./behaviors/calc-page.js')
  var inst = instantiate({ behaviors: [behaviorDef], data: { isSaving: true } })
  toastCalls.length = 0; exportCalls = 0; saveAlbumCalls = 0
  inst.saveImage({
    title: '测试', theme: 'light',
    draw: function () { throw new Error('simulated draw crash (old signature bug)') }
  })
  record(inst.data.isSaving === false, 'draw 抛错后 isSaving 复位 false（按钮不再永久变灰）', 'isSaving=' + inst.data.isSaving)
  record(toastCalls.some(function (t) { return /保存失败，请重试/.test(t.title || '') }), 'draw 抛错提示"保存失败，请重试"')
  record(exportCalls === 0, 'draw 抛错未触发出图（走兜底分支）', 'export=' + exportCalls)
}

// ============ 启动异步测试 ============
;(async function () {
  await runSaveTests()
  await runFailTests()
  checkSignatures()
  await runBmiE2E()
  await runSaveImageGuard()
  global.setTimeout = realSetTimeout
  console.log('\n=== 结果: ' + pass + '/' + (pass + fail) + ' 通过 ===\n')
  if (fail) process.exit(1)
})()
