// test_buttons.js — 按钮/事件绑定完整性 + 未覆盖页面的点击模拟回归
// 目标：① 静态核对每个 .wxml 里绑定的所有事件处理器（bindtap/catchtap/bindchange/bindinput/bindchanging/bind:input…）
//         在对应 .js（Page/Component 方法 + behavior methods）里都存在 —— 防止"按钮点了没反应"；
//       ② 对现有 test_all/test_tarot 未覆盖的页面做点击模拟：
//          首页(goTool/goHistory/toggleTheme/goHome) + 历史页(筛选/收藏/删除/清空/点击还原) +
//          塔罗选牌页(goDraw) + calc-input 组件(sanitize/onInput)。
// 运行：node miniprogram/test_buttons.js（纯 node，注入 wx/getApp/Page/Component/Behavior mock）

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
var store = {}
var toastCalls = []
var navigateCalls = []
var modalQueue = []   // showModal 返回队列（success 参数）
var backCalls = 0
var redirectCalls = []

var wxMock = {
  getSystemInfoSync: function () { return { pixelRatio: 2 } },
  getStorageSync: function (k) { return store[k] },
  setStorageSync: function (k, v) { store[k] = v },
  showToast: function (o) { toastCalls.push(o) },
  showModal: function (o) {
    var conf = modalQueue.shift()
    if (conf && o.success) o.success({ confirm: conf })
  },
  openSetting: function () {},
  navigateTo: function (o) { navigateCalls.push(o) },
  navigateBack: function () { backCalls++ },
  redirectTo: function (o) { redirectCalls.push(o) },
  canvasToTempFilePath: function (o) { if (o && o.success) o.success({ tempFilePath: 'tmp://x' }) },
  saveImageToPhotosAlbum: function (o) { if (o && o.success) o.success() },
  createSelectorQuery: function () {
    return {
      select: function () {
        return {
          fields: function () {
            return { exec: function (cb) { cb([{ node: { width: 0, height: 0, getContext: function () { return {} } } }]) } }
          }
        }
      }
    }
  }
}
global.wx = wxMock

var themeState = 'light'
var appMock = {
  globalData: { theme: themeState, interstitialAd: null },
  showInterstitial: function (cb) { if (cb) cb() },
  toggleTheme: function () {
    themeState = themeState === 'dark' ? 'light' : 'dark'
    this.globalData.theme = themeState
    return themeState
  }
}
global.getApp = function () { return appMock }
global.getCurrentPages = function () { return [{}, {}] }  // 默认 2 个页面（可测 navigateBack 分支）

// 让 setTimeout 同步执行（塔罗 doDraw 的洗牌延时等），保证点击模拟可确定性断言
global.setTimeout = function (fn) { fn() }

// ============ Page / Component / Behavior 捕获 ============
// 注：Behavior 由 calc-page.js 内部调用，需要透传（返回原样）而非捕获
global.Behavior = function (o) { return o }
function captureRegister(fnName) {
  var captured = null
  var orig = global[fnName]
  global[fnName] = function (o) { captured = o }
  return function () { global[fnName] = orig; return captured }
}

// 加载页面/组件定义：返回 { def, api }（def=Page/Component 捕获对象，api=module.exports）
function loadDef(relPath) {
  var captured = null
  var origPage = global.Page, origComp = global.Component
  global.Page = function (o) { captured = o }
  global.Component = function (o) { captured = o }
  var abs = path.join(__dirname, relPath)
  delete require.cache[require.resolve(abs)]
  var api = require(abs)
  global.Page = origPage
  global.Component = origComp
  return { def: captured, api: api }
}

// 合并 behavior methods + Component methods + 自身方法，返回可用处理器集合
function collectHandlers(def) {
  var set = {}
  ;(def.behaviors || []).forEach(function (b) {
    if (b.methods) Object.keys(b.methods).forEach(function (k) { set[k] = true })
  })
  // Component 的方法放在 def.methods 对象里
  if (def && def.methods) Object.keys(def.methods).forEach(function (k) { set[k] = true })
  Object.keys(def || {}).forEach(function (k) {
    if (k !== 'data' && k !== 'behaviors' && k !== 'methods') set[k] = true
  })
  return set
}

// 构造可驱动实例（data + 方法绑定，同 test_all 的 instantiate）
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

// ===================================================================
console.log('\n=== 按钮/事件绑定完整性 + 点击模拟 ===\n')

// ============ A0. 严格模式解析体检 ============
// 微信编译器按严格模式解析每个 JS，重复 function 声明（如 getDpr 曾重复）会直接编译失败；
// Node 测试环境宽松不报错，故在此强制用严格模式解析全部 JS，防复发。
console.log('— A0. 全部 JS 严格模式解析（防重复声明/语法错） —')
;(function () {
  var allJs = []
  function walk(dir) {
    fs.readdirSync(dir).forEach(function (f) {
      var full = path.join(dir, f)
      if (fs.statSync(full).isDirectory()) { if (f !== 'tarot-sources' && f !== 'assets' && f !== 'node_modules') walk(full) }
      else if (f.endsWith('.js')) allJs.push(full)
    })
  }
  walk(__dirname)
  var bad = allJs.filter(function (f) {
    try { new Function('"use strict";' + fs.readFileSync(f, 'utf8')); return false }
    catch (e) { console.log('    ❌ ' + path.relative(__dirname, f) + ' : ' + e.message); return true }
  })
  record(bad.length === 0, '全部 ' + allJs.length + ' 个 JS 严格模式解析通过（无重复声明）', bad.length ? 'bad=' + bad.length : '')
})()

// ============ A. 静态绑定完整性：wxml 处理器 ↔ js 方法 ============
console.log('— A. wxml 事件绑定 ↔ JS 方法 完整性 —')

var wxmlFiles = []
function walk(dir) {
  fs.readdirSync(dir).forEach(function (f) {
    var full = path.join(dir, f)
    var st = fs.statSync(full)
    if (st.isDirectory()) walk(full)
    else if (f.endsWith('.wxml')) wxmlFiles.push(full)
  })
}
walk(__dirname)

wxmlFiles.forEach(function (wxmlPath) {
  var rel = path.relative(__dirname, wxmlPath).replace(/\\/g, '/')
  var jsRel = rel.replace(/\.wxml$/, '.js')
  var jsAbs = path.join(__dirname, jsRel)
  if (!fs.existsSync(jsAbs)) {
    record(false, rel + ' 缺少对应 JS（' + jsRel + '）')
    return
  }

  // 提取所有事件处理器
  var src = fs.readFileSync(wxmlPath, 'utf8')
  var handlers = []
  var re = /(?:bind|catch):?[a-z]+="([A-Za-z_][A-Za-z0-9_]*)"/g
  var m
  while ((m = re.exec(src)) !== null) {
    if (handlers.indexOf(m[1]) < 0) handlers.push(m[1])
  }
  if (!handlers.length) {
    record(true, rel + '（无事件绑定）')
    return
  }

  var def = loadDef(jsRel).def
  var set = collectHandlers(def || {})
  var missing = handlers.filter(function (h) { return !set[h] })
  record(missing.length === 0,
    rel + ' 全部事件处理器存在（' + handlers.length + ' 个：' + handlers.join(', ') + '）',
    missing.length ? '缺失: ' + missing.join(', ') : '')
})

// ============ B. 点击模拟：首页 ============
console.log('\n— B. 首页按钮 —')
var homeDef = loadDef('pages/home/home.js').def
var home = instantiate(homeDef)

test('goTool 跳转目标工具', function () {
  navigateCalls.length = 0
  home.goTool({ currentTarget: { dataset: { path: '/pages/bmi/bmi' } } })
  record(navigateCalls.length === 1 && navigateCalls[0].url === '/pages/bmi/bmi', 'goTool 跳转正确', navigateCalls[0] && navigateCalls[0].url)
})

test('goHistory 跳转历史页', function () {
  navigateCalls.length = 0
  home.goHistory()
  record(navigateCalls.length === 1 && navigateCalls[0].url === '/pages/history/history', 'goHistory 跳转正确', navigateCalls[0] && navigateCalls[0].url)
})

test('toggleTheme 切换主题并更新 isDark', function () {
  themeState = 'light'; appMock.globalData.theme = 'light'
  home.setData({ isDark: false })
  home.toggleTheme()
  record(appMock.globalData.theme === 'dark' && home.data.isDark === true, 'toggleTheme 切到 dark 且 isDark=true', 'theme=' + appMock.globalData.theme)
  themeState = 'dark'
})

test('onShow 刷新历史计数', function () {
  store['tool_history'] = [{ id: 'x', toolId: 'bmi' }]
  home.onShow()
  record(home.data.historyCount === 1, 'onShow 刷新 historyCount=1', 'count=' + home.data.historyCount)
})

// goHome 是工具页（带 calcPage behavior）的按钮，首页本身没有；用 BMI 页测
test('goHome（工具页）多页面栈 → navigateBack', function () {
  var bmiDef = loadDef('pages/bmi/bmi.js').def
  var bmi = instantiate(bmiDef)
  backCalls = 0
  global.getCurrentPages = function () { return [{}, {}] }
  bmi.goHome()
  record(backCalls === 1, 'goHome 页面栈>1 → navigateBack', 'back=' + backCalls)
})

test('goHome（工具页）单页面栈 → redirectTo 首页', function () {
  var bmiDef = loadDef('pages/bmi/bmi.js').def
  var bmi = instantiate(bmiDef)
  redirectCalls.length = 0
  global.getCurrentPages = function () { return [{}] }
  bmi.goHome()
  record(redirectCalls.length === 1 && redirectCalls[0].url === '/pages/home/home', 'goHome 页面栈=1 → redirectTo 首页', (redirectCalls[0] || {}).url)
  global.getCurrentPages = function () { return [{}, {}] }
})

// ============ C. 点击模拟：历史页 ============
console.log('\n— C. 历史页按钮 —')
var histDef = loadDef('pages/history/history.js').def
var hist = instantiate(histDef)

test('onShow 加载历史列表', function () {
  store['tool_history'] = [
    { id: 'h1', toolId: 'bmi', toolName: 'BMI 计算器', toolIcon: '⚖️', input: {}, summary: 'BMI 22.5', ts: Date.now(), star: false },
    { id: 'h2', toolId: 'wealth', toolName: '财富层级测试', toolIcon: '💎', input: {}, summary: '净资产 600万', ts: Date.now(), star: true }
  ]
  hist.onShow()
  record(hist.data.list.length === 2 && !hist.data.isEmpty, 'onShow 加载 2 条历史', 'len=' + hist.data.list.length)
  record(hist.data.list[0].timeText === '刚刚', '时间文本格式化(刚刚)', hist.data.list[0].timeText)
  record(hist.data.toolOptions.length === 2, '筛选标签生成 2 个工具', 'opts=' + hist.data.toolOptions.length)
})

test('onFilter 按工具筛选', function () {
  hist.onFilter({ currentTarget: { dataset: { id: 'bmi' } } })
  record(hist.data.list.length === 1 && hist.data.list[0].toolId === 'bmi', 'onFilter(bmi) 只剩 1 条', 'len=' + hist.data.list.length)
  record(hist.data.filterTool === 'bmi', 'filterTool 已记录')
  hist.onFilter({ currentTarget: { dataset: { id: '' } } })
  record(hist.data.list.length === 2, 'onFilter(全部) 恢复 2 条')
})

test('onStar 切换收藏', function () {
  hist.onStar({ currentTarget: { dataset: { id: 'h1' } } })
  var list = store['tool_history']
  var h1 = list.filter(function (i) { return i.id === 'h1' })[0]
  record(h1.star === true, 'onStar 后 h1.star=true', 'star=' + h1.star)
})

test('onTapItem 点击记录 → 暂存 + 跳转工具页', function () {
  navigateCalls.length = 0
  hist.onTapItem({ currentTarget: { dataset: { id: 'h1' } } })
  record(appMock.globalData._historyRestore && appMock.globalData._historyRestore.id === 'h1', '点击后暂存 _historyRestore')
  record(navigateCalls.length === 1 && navigateCalls[0].url === '/pages/bmi/bmi', 'onTapItem 跳转到 BMI 页', navigateCalls[0] && navigateCalls[0].url)
  appMock.globalData._historyRestore = null
})

test('onRemove 删除单条（modal 确认）', function () {
  modalQueue = [true]
  hist.onRemove({ currentTarget: { dataset: { id: 'h2' } } })
  record(store['tool_history'].length === 1, 'onRemove 确认后删除 h2，剩 1 条', 'len=' + store['tool_history'].length)
})

test('onRemove 取消（modal 拒绝）不删除', function () {
  var before = store['tool_history'].length
  modalQueue = [false]
  hist.onRemove({ currentTarget: { dataset: { id: 'h1' } } })
  record(store['tool_history'].length === before, 'onRemove 取消不删除')
})

test('onClear 清空未收藏（modal 确认）', function () {
  // h1 是未收藏，star 一条以备验证「收藏保留」
  store['tool_history'] = [
    { id: 'keep', toolId: 'bmi', toolName: 'BMI', toolIcon: '⚖️', input: {}, summary: 'x', ts: Date.now(), star: true },
    { id: 'drop', toolId: 'wealth', toolName: '财富', toolIcon: '💎', input: {}, summary: 'y', ts: Date.now(), star: false }
  ]
  modalQueue = [true]
  hist.onClear()
  var list = store['tool_history']
  record(list.length === 1 && list[0].id === 'keep', 'onClear 清空未收藏、保留收藏', 'len=' + list.length)
})

// ============ D. 点击模拟：塔罗选牌页 ============
console.log('\n— D. 塔罗选牌页 —')
var tarotIdxDef = loadDef('subpackages/tarot/pages/index/index.js').def
var tIdx = instantiate(tarotIdxDef)

test('goDraw 跳转对应牌阵', function () {
  navigateCalls.length = 0
  tIdx.goDraw({ currentTarget: { dataset: { id: 'timeline' } } })
  record(navigateCalls.length === 1 && navigateCalls[0].url === '/subpackages/tarot/pages/draw/draw?spread=timeline', 'goDraw(timeline) 跳转正确', navigateCalls[0] && navigateCalls[0].url)
})

test('spreads 数据 3 个牌阵', function () {
  record(tIdx.data.spreads.length === 3 && tIdx.data.spreads[2].count === 4, 'spreads 3 阵 count 正确')
})

// ============ E. calc-input 组件 ============
console.log('\n— E. calc-input 组件 —')
var compDef = loadDef('components/calc-input/calc-input.js').def
function makeComp() {
  var events = []
  var inst = { data: {} }
  if (compDef.properties) {
    Object.keys(compDef.properties).forEach(function (k) {
      inst.data[k] = (compDef.properties[k] && compDef.properties[k].value !== undefined) ? compDef.properties[k].value : ''
    })
  }
  Object.keys(compDef.methods || {}).forEach(function (k) { inst[k] = compDef.methods[k].bind(inst) })
  inst.setData = function (p) { Object.keys(p).forEach(function (k) { inst.data[k] = p[k] }) }
  inst.triggerEvent = function (name, detail) { events.push({ name: name, detail: detail }) }
  inst._events = events
  return inst
}

test('sanitize 小数去重', function () {
  var c = makeComp()
  c.data.integer = false
  record(c.sanitize('12.3.4') === '12.34', 'sanitize("12.3.4")→12.34', c.sanitize('12.3.4'))
  record(c.sanitize('abc12') === '12', 'sanitize 过滤非数字', c.sanitize('abc12'))
})

test('sanitize 整数模式', function () {
  var c = makeComp()
  c.data.integer = true
  record(c.sanitize('12.5abc') === '125', 'integer 模式去小数点', c.sanitize('12.5abc'))
})

test('onInput 触发 input 事件（含字段名）', function () {
  var c = makeComp()
  c.data.field = 'height'
  c.onInput({ detail: { value: '170' } })
  var ev = c._events[0]
  record(ev && ev.name === 'input' && ev.detail.field === 'height' && ev.detail.value === '170', 'onInput 触发 input 事件', ev && JSON.stringify(ev.detail))
})

// ============ F. 工具页剩余按钮抽查（test_all 未覆盖的散点） ============
console.log('\n— F. 工具页按钮抽查 —')
test('relation undo/clear 按钮', function () {
  var relDef = loadDef('pages/relation/relation.js').def
  var r = instantiate(relDef)
  r.setData({ chain: ['父', '母'], chainText: '爸爸 的 妈妈' })
  r.compute()
  r.undo()
  record(r.data.chain.length === 1, 'undo 退一步链长=1', 'len=' + r.data.chain.length)
  r.clear()
  record(r.data.chain.length === 0 && r.data.result === '', 'clear 清空链与结果')
})

test('tarot draw redraw 按钮', function () {
  var drawDef = loadDef('subpackages/tarot/pages/draw/draw.js').def
  var d = instantiate(drawDef)
  d.onLoad({ spread: 'daily' })
  var before = d.data.deck
  d.redraw()
  record(d.data.revealed === true && d.data.deck.length === 1, 'redraw 重新抽 1 张', 'len=' + d.data.deck.length)
})

console.log('\n=== test_buttons 结果: ' + pass + '/' + (pass + fail) + ' 通过 ===\n')
if (fail) process.exit(1)
