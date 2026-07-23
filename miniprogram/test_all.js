// test_all.js — 非塔罗工具「功能逻辑 + 计算后按钮」全量回归
// 覆盖：bmi / wealth / saving / relation / expense(首页index) / progress
// 每个工具：① 核心计算逻辑正确性 ② 计算后按钮（保存/重置/分享就绪/历史写入/模式切换/年龄/跳转等）是否正常
// 运行：node miniprogram/test_all.js
// 注：塔罗由 test_tarot.js 覆盖，二者一起跑即全量。

var path = require('path')

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
var saveAlbumCalls = 0
var exportCalls = 0

function makeCanvasCtx() {
  return {
    beginPath: function () {}, arc: function () {}, closePath: function () {},
    setFillStyle: function () {}, fill: function () {}, setFontSize: function () {},
    setTextAlign: function () {}, fillText: function () {}, draw: function () {},
    setStrokeStyle: function () {}, moveTo: function () {}, lineTo: function () {},
    stroke: function () {}, save: function () {}, restore: function () {},
    translate: function () {}, rotate: function () {}, scale: function () {},
    clearRect: function () {}, rect: function () {}, fillRect: function () {},
    measureText: function (s) { return { width: ('' + s).length * 7 } }
  }
}

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
  createCanvasContext: function () { return makeCanvasCtx() },
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

var appMock = { globalData: { theme: 'light' }, showInterstitial: function (cb) { if (cb) cb() } }
global.getApp = function () { return appMock }

// ============ 通用 mock：canvas / ctx（Canvas 2.0）============
function makeCtx() {
  return {
    fillStyle: '#000', strokeStyle: '#000', font: '', lineWidth: 1, textAlign: 'left',
    fillRect: function () {}, strokeRect: function () {}, clearRect: function () {},
    beginPath: function () { this._mx = this._my = this._lx = this._ly = 0 },
    moveTo: function (x, y) { this._mx = x; this._my = y },
    lineTo: function (x, y) { this._lx = x; this._ly = y },
    arc: function () {}, closePath: function () {}, fill: function () {},
    stroke: function () {}, save: function () {}, restore: function () {},
    translate: function () {}, rotate: function () {}, scale: function () {},
    drawImage: function () {}, fillText: function () {},
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
        set: function (v) { this._src = v; var self = this; process.nextTick(function () { if (self._fail) { if (self.onerror) self.onerror() } else { if (self.onload) self.onload() } }) },
        get: function () { return this._src }
      })
      return o
    }
  }
}

// ============ 通用：Page / Behavior 收集 ============
global.Page = function (opts) { return opts }
global.Behavior = function (opts) { return opts }

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

// 让 report.exportAndSave 的 setTimeout 同步（覆盖为 fn()）
var realSetTimeout = global.setTimeout
global.setTimeout = function (fn) { fn() }

// 加载页面：捕获 Page(opts) 并返回 { page, api }（api=module.exports，供 relation 引擎直接测）
function loadPage(relPath) {
  var captured = null
  var orig = global.Page
  global.Page = function (o) { captured = o }
  var abs = path.join(__dirname, relPath)
  delete require.cache[require.resolve(abs)]
  var api = require(abs)
  global.Page = orig
  return { page: captured, api: api }
}
function fresh(relPath) { return instantiate(loadPage(relPath).page) }

// ============ 保存按钮 E2E 助手 ============
async function assertSaveOK(inst, expectedToolId, expectHistory) {
  toastCalls.length = 0; exportCalls = 0; saveAlbumCalls = 0; store['tool_history'] = undefined
  inst.saveResult()
  await new Promise(function (r) { process.nextTick(r) })
  await new Promise(function (r) { realSetTimeout(r, 30) })
  record(exportCalls === 1, '保存触发 canvasToTempFilePath（出图）', 'export=' + exportCalls)
  record(saveAlbumCalls === 1, '保存触发 saveImageToPhotosAlbum（存相册）', 'album=' + saveAlbumCalls)
  record(inst.data.isSaving === false, '保存完成 isSaving 复位（按钮不再变灰）')
  record(toastCalls.some(function (t) { return /已保存到相册/.test(t.title || '') }), '保存提示成功')
  var hist = store['tool_history'] || []
  if (expectHistory) {
    record(hist.length >= 1 && hist[0].toolId === expectedToolId, '保存写入历史 toolId=' + expectedToolId, 'got=' + (hist[0] && hist[0].toolId))
  } else {
    record(hist.length === 0, '无结果时不误写历史（toolId=' + expectedToolId + '）')
  }
}

function assertNoSave(inst, expectToast) {
  toastCalls.length = 0; exportCalls = 0; saveAlbumCalls = 0
  inst.saveResult()
  record(exportCalls === 0 && saveAlbumCalls === 0, '无结果时保存不触发出图/存相册')
  record(toastCalls.some(function (t) { return (expectToast || '').test(t.title || '') }), '无结果时保存给出正确提示', (toastCalls[0] || {}).title)
}

// ===================================================================
console.log('\n=== 非塔罗工具全量测试（逻辑 + 按钮）===\n')

async function runBmi() {
  console.log('— BMI 计算器 —')
  var b = fresh('pages/bmi/bmi.js')
  b.setData({ height: '170', weight: '65' }); b.calculate()
  record(b.data.bmiStr === '22.5', 'BMI 计算正确 22.5', b.data.bmiStr)
  record(b.data.cat && b.data.cat.name === '正常', '体型判定=正常', b.data.cat && b.data.cat.name)
  record(b.data.showResult === true, '有输入后 showResult=true')
  record(b.data.share.ready === true && /BMI/.test(b.data.share.title), '分享就绪且标题含 BMI')

  var b2 = fresh('pages/bmi/bmi.js')
  b2.setData({ height: '0', weight: '65' }); b2.calculate()
  record(b2.data.showResult === false && b2.data.bmi === 0, '非法输入不产出结果')

  b.reset()
  record(b.data.showResult === false && b.data.height === '' && b.data.cat === null, 'reset 清空结果与输入')

  var b3 = fresh('pages/bmi/bmi.js')
  assertNoSave(b3, /请先输入身高体重/)

  var b4 = fresh('pages/bmi/bmi.js')
  b4.setData({ height: '170', weight: '65' }); b4.calculate(); b4.setData({ isSaving: true })
  exportCalls = 0; toastCalls.length = 0
  b4.saveResult()
  record(exportCalls === 0, 'isSaving 时再次点击保存被拦截（防重复）')
  record(b4.data.isSaving === true, '拦截时 isSaving 保持 true（未误复位）')

  var b5 = fresh('pages/bmi/bmi.js')
  b5.setData({ height: '170', weight: '65' }); b5.calculate()
  await assertSaveOK(b5, 'bmi', true)
}

async function runWealth() {
  console.log('\n— 财富层级测试 —')
  var w = fresh('pages/wealth/wealth.js')
  w.setData({ property: '300', financial: '200', vehicle: '50', equity: '50' }); w.calculate()
  record(w.data.totalAsset === 600, '总资产=600', w.data.totalAsset)
  record(w.data.netAsset === 600, '净资产=600（无负债）')
  record(w.data.debtRatio === 0, '负债率=0')
  record(w.data.level && w.data.level.name === '富裕层', '层级=富裕层', w.data.level && w.data.level.name)
  record(w.data.showResult === true, '有输入 showResult=true')

  var w2 = fresh('pages/wealth/wealth.js')
  w2.setData({ property: '100', mortgageDebt: '20' }); w2.calculate()
  record(w2.data.totalAsset === 100 && w2.data.totalDebt === 20 && w2.data.netAsset === 80, '资产100/负债20/净80', w2.data.netAsset)
  record(w2.data.level && w2.data.level.name === '小康层', '层级=小康层', w2.data.level && w2.data.level.name)

  w.reset()
  record(w.data.showResult === false && w.data.totalAsset === 0 && w.data.level === null, 'reset 清空')

  var w3 = fresh('pages/wealth/wealth.js')
  assertNoSave(w3, /请先输入资产数据/)

  var w4 = fresh('pages/wealth/wealth.js')
  w4.setData({ property: '300' }); w4.calculate(); w4.setData({ isSaving: true })
  exportCalls = 0
  w4.saveResult()
  record(exportCalls === 0, 'isSaving 时保存被拦截')

  var w5 = fresh('pages/wealth/wealth.js')
  w5.setData({ property: '300', financial: '200', vehicle: '50', equity: '50' }); w5.calculate()
  await assertSaveOK(w5, 'wealth', true)
}

async function runSaving() {
  console.log('\n— 存钱段位 —')
  var s = fresh('pages/saving/saving.js')
  s.setData({ mode: 'forward', income: '10000', expense: '6000' }); s.doCalculate()
  record(s.data.monthSaving === 4000, '月储蓄=4000', s.data.monthSaving)
  record(s.data.savingRateStr === '40.0%', '储蓄率=40.0%', s.data.savingRateStr)
  record(s.data.rank && s.data.rank.name === '钻石', '段位=钻石', s.data.rank && s.data.rank.name)
  record(s.data.wealthAge === 43, '财富年龄=43', s.data.wealthAge)
  record(s.data.showResult === true, '正向有输入 showResult=true')

  s.switchMode({ currentTarget: { dataset: { mode: 'reverse' } } })
  record(s.data.mode === 'reverse', 'switchMode → reverse')
  s.onPickYear({ detail: { value: '4' } })
  record(s.data.goalYearIdx === 4, 'onPickYear 设 goalYearIdx=4（5年）')
  s.setData({ goalAmount: '120000', expense: '3000' }); s.doCalculate()
  record(s.data.monthSaving === 2000, '倒推月需存=2000', s.data.monthSaving)
  record(s.data.rank && s.data.rank.name === '钻石', '倒推段位=钻石', s.data.rank && s.data.rank.name)
  record(/5年/.test(s.data.share.title), '倒推分享标题含年限')

  navigateCalls.length = 0
  s.goExpense()
  record(navigateCalls.some(function (n) { return /pages\/index\/index/.test(n.url) }), 'goExpense 跳转家庭支出页')

  s.reset()
  record(s.data.income === '' && s.data.showResult === false, 'reset 清空输入与结果（mode 作为持久开关保留）')

  var s2 = fresh('pages/saving/saving.js')
  assertNoSave(s2, /请先计算/)

  var s3 = fresh('pages/saving/saving.js')
  s3.setData({ mode: 'forward', income: '10000', expense: '6000' }); s3.doCalculate(); s3.setData({ isSaving: true })
  exportCalls = 0
  s3.saveResult()
  record(exportCalls === 0, 'isSaving 时保存被拦截')

  var s4 = fresh('pages/saving/saving.js')
  s4.setData({ mode: 'forward', income: '10000', expense: '6000' }); s4.doCalculate()
  await assertSaveOK(s4, 'saving', true)

  var s5 = fresh('pages/saving/saving.js')
  s5.setData({ mode: 'reverse', goalAmount: '120000', expense: '3000', goalYearIdx: 4 }); s5.doCalculate()
  await assertSaveOK(s5, 'saving', true)
}

async function runRelation() {
  console.log('\n— 亲戚关系（含引擎单测）—')
  var rel = loadPage('pages/relation/relation.js')
  var api = rel.api
  var r = rel.page

  test('引擎：父,父 → 爷爷', function () {
    var res = api.resolveRelation(['父', '父'])
    record(res.term === '爷爷（祖父）', '父+父=爷爷', res.term)
  })
  test('引擎：父,兄,子 → 需年龄(堂哥/堂弟)', function () {
    var res = api.resolveRelation(['父', '兄', '子'])
    record(res.needAge === true && res.ageOptions.older === '堂哥' && res.ageOptions.younger === '堂弟', '堂哥/堂弟(需年龄)', JSON.stringify(res))
  })
  test('引擎：母,夫 → 爸爸（绕路归约）', function () {
    var res = api.resolveRelation(['母', '夫'])
    record(res.term === '爸爸', '母+夫=爸爸', res.term)
  })
  test('引擎：父,子 → 自己（亲子互消）', function () {
    var res = api.resolveRelation(['父', '子'])
    record(res.term === '自己', '父+子=自己', res.term)
  })
  test('引擎：超5级 → 不支持', function () {
    var res = api.resolveRelation(['父', '父', '父', '父', '父', '父'])
    record(res.notSupported === true, '6级链不支持', JSON.stringify(res))
  })

  var inst = instantiate(r)
  inst.addRel({ currentTarget: { dataset: { rel: '父' } } })
  inst.addRel({ currentTarget: { dataset: { rel: '父' } } })
  record(inst.data.result === '爷爷（祖父）' && inst.data.share.ready === true, 'addRel×2 → 爷爷 + 分享就绪')

  var inst2 = instantiate(r)
  inst2.addRel({ currentTarget: { dataset: { rel: '父' } } })
  inst2.addRel({ currentTarget: { dataset: { rel: '兄' } } })
  inst2.addRel({ currentTarget: { dataset: { rel: '子' } } })
  record(inst2.data.needAge === true, '堂兄链 needAge=true')
  inst2.pickAge({ currentTarget: { dataset: { which: 'older' } } })
  record(inst2.data.result === '堂哥' && inst2.data.needAge === false, 'pickAge(older) → 堂哥')
  inst2.pickAge({ currentTarget: { dataset: { which: 'younger' } } })
  record(inst2.data.result === '堂弟', 'pickAge(younger) → 堂弟')

  inst2.undo()
  record(inst2.data.chain.length === 2, 'undo 退一步')
  inst2.clear()
  record(inst2.data.chain.length === 0 && inst2.data.result === '', 'clear 清空')

  var inst3 = instantiate(r)
  assertNoSave(inst3, /请先点选关系/)

  var inst4 = instantiate(r)
  inst4.addRel({ currentTarget: { dataset: { rel: '父' } } })
  inst4.addRel({ currentTarget: { dataset: { rel: '父' } } })
  await assertSaveOK(inst4, 'relation', true)

  var inst5 = instantiate(r)
  inst5.setData({ chain: ['父', '父', '父', '父', '父', '父'], chainText: '父 的 父 ...', notSupported: true, notSupportedReason: '该关系不符合传统亲属称谓' })
  await assertSaveOK(inst5, 'relation', false)

  var inst6 = instantiate(r)
  inst6.restoreHistory({ input: { chain: ['父', '父'] } })
  record(inst6.data.chain.length === 2 && inst6.data.result === '爷爷（祖父）', 'restoreHistory 还原链并解析')
}

async function runExpense() {
  console.log('\n— 家庭支出计算 —')
  var e = fresh('pages/index/index.js')
  e.setData({ mortgage: '5000', food: '2000' }); e.calculate()
  record(e.data.monthlyFixed === 7000, '月度固定=7000', e.data.monthlyFixed)
  record(e.data.monthlyTotal === 7000, '月度总=7000', e.data.monthlyTotal)
  record(e.data.annualTotal === 84000, '年度总=84000（7000×12）', e.data.annualTotal)
  record(e.data.pieLegend.length === 2, '饼图图例=2项（房贷+餐饮）', e.data.pieLegend.length)
  record(e.data.share.ready === true && /年度支出/.test(e.data.share.title), '分享就绪且含年度支出')
  record(e.data.insuranceColor === '#ccc', '保险占比0 → 灰色', e.data.insuranceColor)

  var e2 = fresh('pages/index/index.js')
  e2.setData({ mortgage: '1000', insurance: '2000' }); e2.calculate()
  record(e2.data.insuranceRatio > 0, '保险占比>0', e2.data.insuranceRatio.toFixed(1) + '%')
  record(['#27ae60', '#e67e22', '#e74c3c'].indexOf(e2.data.insuranceColor) >= 0, '保险>0 时颜色非灰')

  // 注：家庭支出页未提供 reset 方法（页面无重置按钮），故不测 reset
  var e3 = fresh('pages/index/index.js')
  assertNoSave(e3, /请先输入支出数据/)

  var e4 = fresh('pages/index/index.js')
  e4.setData({ mortgage: '5000', food: '2000' }); e4.calculate(); e4.setData({ isSaving: true })
  exportCalls = 0
  e4.saveResult()
  record(exportCalls === 0, 'isSaving 时保存被拦截')

  var e5 = fresh('pages/index/index.js')
  e5.setData({ mortgage: '5000', food: '2000' }); e5.calculate()
  await assertSaveOK(e5, 'expense', true)

  var e6 = fresh('pages/index/index.js')
  e6.restoreHistory({ input: { mortgage: '5000', food: '2000' } })
  record(e6.data.monthlyTotal === 7000, 'restoreHistory 还原并重算')
}

async function runProgress() {
  console.log('\n— 时光进度条 —')
  var p = fresh('pages/progress/progress.js')
  p.onLoad()
  record(p.data.yearProgress > 0 && p.data.yearProgress <= 100, '年度进度在(0,100]', p.data.yearProgress.toFixed(1))
  record(p.data.share.ready === true, '分享默认就绪')

  var now = new Date()
  var by = 1990, bm = 5, bd = 20
  var p2 = fresh('pages/progress/progress.js')
  p2.onInputBirth({ detail: { value: '1990-05-20' } })
  var expAge = now.getFullYear() - by
  if (now.getMonth() + 1 < bm || (now.getMonth() + 1 === bm && now.getDate() < bd)) expAge--
  record(p2.data.showLife === true, '有效生日 → showLife=true')
  record(p2.data.age === expAge, '年龄计算正确=' + expAge, p2.data.age)
  record(p2.data.lifeProgress > 0 && p2.data.lifeProgress <= 100, '人生进度(0,100]', p2.data.lifeProgress.toFixed(1))

  toastCalls.length = 0
  p2.onInputBirth({ detail: { value: '2999-01-01' } })
  record(p2.data.showLife === false, '未来生日 → showLife=false')
  record(toastCalls.some(function (t) { return /出生日期有误/.test(t.title || '') }), '未来生日提示有误')

  var p3 = fresh('pages/progress/progress.js')
  p3.onInputBirth({ detail: { value: '1990-05' } })
  record(p3.data.showLife === false, '不完整日期 → showLife=false')

  p2.reset()
  record(p2.data.showLife === false && p2.data.birth === '', 'reset 清空生日')

  var p4 = fresh('pages/progress/progress.js')
  p4.onLoad()
  await assertSaveOK(p4, 'progress', false)

  var p5 = fresh('pages/progress/progress.js')
  p5.onInputBirth({ detail: { value: '1990-05-20' } })
  await assertSaveOK(p5, 'progress', true)

  var p6 = fresh('pages/progress/progress.js')
  p6.restoreHistory({ input: { birth: '1990-05-20' } })
  record(p6.data.showLife === true && p6.data.age === expAge, 'restoreHistory 还原人生进度')
}

// ============ 主流程 ============
;(async function () {
  await runBmi()
  await runWealth()
  await runSaving()
  await runRelation()
  await runExpense()
  await runProgress()
  global.setTimeout = realSetTimeout
  console.log('\n=== test_all 结果: ' + pass + '/' + (pass + fail) + ' 通过 ===\n')
  if (fail) process.exit(1)
})()
