// test_all.js — 非塔罗工具「功能逻辑 + 计算后按钮」全量回归
// 覆盖：bmi / wealth / wealth-health / relation / expense(首页index) / progress
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
  getLocation: function () {},
  request: function () {},
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

async function runWealthHealth() {
  console.log('\n— 财富健康指数 —')
  var p = fresh('pages/wealth-health/wealth-health.js')
  p.setData({
    birthYear: '1990', annualPreTaxWan: '30', workStartYear: '2012',
    houseValue: '300', houseLoan: '100', cash: '50', invest: '80', other: ''
  })
  p.calculate()
  record(p.data.showResult === true, '有核心输入 showResult=true')
  record(p.data.result && typeof p.data.multiple === 'number', '计算出倍数(multiple)', 'multiple=' + p.data.multiple)
  record(p.data.rank && p.data.rank.label, '得出等级 label', p.data.rank && p.data.rank.label)
  record(p.data.baselineWan !== undefined, '得出基准线(万元)', 'baseline=' + p.data.baselineWan)
  record(p.data.paw && p.data.paw.targetWan > 0, '得出 PAW 目标线', 'target=' + p.data.paw.targetWan)
  record(p.data.result.annualPreTax > 0 && p.data.result.annualTax >= 0, '个税计算 >=0')

  // 口径切换：税后倍数 ≤ 税前倍数（同口径）
  var preTaxInc = p.data.multiple
  p.onTaxMode({ currentTarget: { dataset: { mode: 'afterTax' } } })
  record(p.data.taxMode === 'afterTax', '切换税后口径')
  var afterTaxInc = p.data.multiple
  record(afterTaxInc >= preTaxInc - 1e-9, '税后口径倍数 ≥ 税前口径（税后基准线更小，倍数更高）', 'pre=' + preTaxInc + ' after=' + afterTaxInc)
  p.onFundMode({ currentTarget: { dataset: { mode: 'exc' } } })
  record(p.data.fundMode === 'exc', '切换不含公积金口径')
  p.onTaxMode({ currentTarget: { dataset: { mode: 'preTax' } } })

  // 公积金开关
  p.onIncludeFund({ detail: { value: false } })
  record(p.data.includeFund === false, '关闭计入公积金余额')

  // 专项附加：房贷/租金互斥
  p.onDeductToggle({ currentTarget: { dataset: { key: 'mortgage' } }, detail: { value: true } })
  record(p.data.mortgage === true && p.data.rent === false, '选房贷利息→租金自动取消(互斥)')
  p.onDeductToggle({ currentTarget: { dataset: { key: 'rent' } }, detail: { value: true } })
  record(p.data.rent === true && p.data.mortgage === false, '选租金→房贷自动取消(互斥)')

  // 数量型步进 / 金额型输入
  p.onStep({ currentTarget: { dataset: { key: 'infant', delta: '1' } } })
  record(p.data.infant === '1', '婴幼儿照护步进 +1')
  p.onDeductInput({ currentTarget: { dataset: { key: 'seriousSelfPay' } }, detail: { value: '20000' } })
  record(p.data.seriousSelfPay === '20000', '大病医疗自付金额写入')

  // 数据完整性：DEDUCT_ITEMS 的 id 必须与 data 字段一一对应（防 UI 绑定错位，如 seriousIllness/seriousSelfPay 曾不一致）
  var pIds = fresh('pages/wealth-health/wealth-health.js')
  var deductIds = pIds.data.deductItems.map(function (item) { return item.id })
  var missingIds = deductIds.filter(function (id) { return !(id in pIds.data) })
  record(deductIds.indexOf('seriousSelfPay') >= 0 && missingIds.length === 0,
    'DEDUCT_ITEMS id 与 data 字段一一对应', 'missing=' + missingIds.join(','))

  // ===== 多城市社保/医保比例（直接测 computeFiveOne）=====
  var whCalc = require('./utils/wealth-health.js')
  var CITYSS = require('./data/city-ss.js')
  var CITY_ORDER = Object.keys(CITYSS)
  function cidx(k) { return CITY_ORDER.indexOf(k) }
  var HI = 2000000 // 超高薪，使各项基数全部封顶，便于核对比例
  // 北京：单费率 2% + 大病统筹固定额 3 元/月
  var bj = whCalc.computeFiveOne(HI, 'beijing', '一档', 0.12)
  record(Math.abs(bj.monthly.yi - (CITYSS.beijing.social.医疗.baseMax * 0.02 + 3)) < 1e-6,
    '北京医疗含 +3 元固定额', 'yi=' + bj.monthly.yi)
  // 上海：公积金比例区间 5%-7%，传 0.12 应被 clamp 至 7%
  var sh = whCalc.computeFiveOne(HI, 'shanghai', '一档', 0.12)
  record(Math.abs(sh.monthly.gjj / sh.bases.gjj - 0.07) < 1e-9, '上海公积金比例被 clamp 至 7%', 'rate=' + (sh.monthly.gjj / sh.bases.gjj))
  record(sh.monthly.yi / sh.bases.yi - 0.02 < 1e-9, '上海医疗 2% 单费率', 'rate=' + (sh.monthly.yi / sh.bases.yi))
  // 深圳二档 0.5%
  var sz = whCalc.computeFiveOne(HI, 'shenzhen', '二档', 0.08)
  record(Math.abs(sz.monthly.yi / sz.bases.yi - 0.005) < 1e-9, '深圳二档医疗 0.5%', 'rate=' + (sz.monthly.yi / sz.bases.yi))
  // 珠海一档 1.5%
  var zh = whCalc.computeFiveOne(HI, 'zhuhai', '一档', 0.12)
  record(Math.abs(zh.monthly.yi / zh.bases.yi - 0.015) < 1e-9, '珠海一档医疗 1.5%', 'rate=' + (zh.monthly.yi / zh.bases.yi))
  // 东莞租金专项 1100（普通地级市）
  record(CITYSS.dongguan.rentMonthly === 1100, '东莞租金专项 1100 元/月', 'rent=' + CITYSS.dongguan.rentMonthly)
  record(CITYSS.beijing.rentMonthly === 1500, '北京租金专项 1500 元/月（一线）')

  // ===== 常识性一致性校验 =====
  // 资不抵债 → 净资产为负 → UAW
  var wu = whCalc.compute({ birthYear: '1990', annualPreTaxWan: '30', workStartYear: '2012', assets: { houseValue: '100', houseLoan: '150', cash: '0', invest: '0', other: '0' } })
  record(wu.na.exc < 0, '资不抵债(负债>资产)→净资产为负', 'exc=' + wu.na.exc)
  record(whCalc.rankFor(wu.multiples.preTaxInc).key === 'UAW', '净资产为负→UAW 等级', 'rank=' + whCalc.rankFor(wu.multiples.preTaxInc).key)

  // 资产远超基准 → 倍数≥2 → 已达成 PAW
  var wrich = whCalc.compute({ birthYear: '1980', annualPreTaxWan: '30', workStartYear: '2002', assets: { houseValue: '2000', houseLoan: '0', cash: '2000', invest: '2000', other: '0' } })
  record(wrich.multiples.preTaxInc >= 2, '资产远超基准→倍数≥2（PAW）', 'mult=' + wrich.multiples.preTaxInc)
  var pawRich = whCalc.pawInfo(wrich.baselines.preTax, wrich.na.inc * 10000)
  record(pawRich.reached === true, '资产足够→已达成 PAW 目标线')

  // 个税速算扣除数正确性（直接测 computeTax）
  record(Math.abs(whCalc.computeTax(200000) - 23080) < 1e-6, '个税：20万应纳税所得额 → 23080', 'tax=' + whCalc.computeTax(200000))
  record(Math.abs(whCalc.computeTax(50000) - (50000 * 0.10 - 2520)) < 1e-6, '个税：5万应纳税所得额 → 2480')

  // 税后年收入 ≤ 税前年收入（五险一金+个税只减不增）
  var wsal = whCalc.compute({ birthYear: '1990', annualPreTaxWan: '30', workStartYear: '2012' })
  record(wsal.annualNetSalary <= wsal.annualPreTax + 1e-6, '税后年收入 ≤ 税前年收入', 'net=' + wsal.annualNetSalary + ' pre=' + wsal.annualPreTax)

  // 防御：出生年份晚于工作年份（UI 下拉已拦截，纯函数仍应返回有限值不抛错）
  var wdef = whCalc.compute({ birthYear: '2010', annualPreTaxWan: '30', workStartYear: '2000' })
  record(isFinite(wdef.multiples.preTaxInc), '出生年份晚于工作年份：compute 仍返回有限倍数(不抛错)')

  // 深圳 30 万税前：个人五险一金年合计 = (8%+2%+0.2%+8%)×月薪25000×12
  var wsz = whCalc.computeFiveOne(300000, 'shenzhen', '一档', 0.08)
  var expectFiveOne = (0.08 + 0.02 + 0.002 + 0.08) * 25000 * 12
  record(Math.abs(wsz.yearly.total - expectFiveOne) < 1, '深圳30万：五险一金年合计≈18.2%×基数', 'got=' + wsz.yearly.total + ' exp=' + expectFiveOne)

  // 倍数显示保留三位小数（toFixed(3)）
  var pDec = fresh('pages/wealth-health/wealth-health.js')
  pDec.setData({ birthYear: '1990', annualPreTaxWan: '30', workStartYear: '2012' }); pDec.calculate()
  record(/^\d+\.\d{3}$/.test(String(pDec.data.multipleText)), '倍数 multipleText 保留三位小数', 'multipleText=' + pDec.data.multipleText)
  var pc = fresh('pages/wealth-health/wealth-health.js')
  pc.onCityChange({ detail: { value: cidx('beijing') } })
  record(pc.data.cityKey === 'beijing' && pc.data.hasMedicalTiers === false, '切到北京：无医保档位选择（单费率）')
  record(pc.data.fundMinPct === 5 && pc.data.fundMaxPct === 12, '北京公积金区间 5%-12%')
  record(/租金专项 1500/.test(pc.data.cityRateText), '北京费率摘要含租金 1500')
  var psh = fresh('pages/wealth-health/wealth-health.js')
  psh.onCityChange({ detail: { value: cidx('shanghai') } })
  record(psh.data.fundMinPct === 5 && psh.data.fundMaxPct === 7, '上海公积金区间收窄为 5%-7%')
  record(psh.data.fundRatePct === 7, '上海默认公积金比例 7%')
  var pzh = fresh('pages/wealth-health/wealth-health.js')
  pzh.onCityChange({ detail: { value: cidx('zhuhai') } })
  record(pzh.data.hasMedicalTiers === true && pzh.data.medicalTier === '一档', '切到珠海：有医保档位且默认一档')
  var pdg = fresh('pages/wealth-health/wealth-health.js')
  pdg.onCityChange({ detail: { value: cidx('dongguan') } })
  record(pdg.data.rentMonthly === 1100, '切到东莞：租金专项 1100')

  // ===== 年份下拉选择 + 常识校验（页面级）=====
  var py = fresh('pages/wealth-health/wealth-health.js')
  py.onBirthYearChange({ detail: { value: py.data.birthYearOptions.indexOf('1990') } })
  record(py.data.birthYear === '1990', '年份下拉：选中出生年份=1990')
  record(py.data.workStartYearOptions[py.data.workStartYearOptions.length - 1] === '2006',
    '年份下拉：工作起始最早可选 = 出生年+16(2006，符合工作年龄常识)', 'min=' + py.data.workStartYearOptions[py.data.workStartYearOptions.length - 1])
  // 先选工作年份 2020，再改出生年份为 2010（晚于 2020）→ 工作年份应被清空
  var py2 = fresh('pages/wealth-health/wealth-health.js')
  py2.onWorkStartYearChange({ detail: { value: py2.data.workStartYearOptions.indexOf('2020') } })
  record(py2.data.workStartYear === '2020', '年份下拉：先选中工作年份=2020')
  py2.onBirthYearChange({ detail: { value: py2.data.birthYearOptions.indexOf('2010') } })
  record(py2.data.workStartYear === '', '出生年份晚于工作年份→工作年份被清空重选', 'ws=' + py2.data.workStartYear)
  // 出生年份(2010)晚于工作年份(2005)→清空并弹提示
  var py3 = fresh('pages/wealth-health/wealth-health.js')
  py3.onWorkStartYearChange({ detail: { value: py3.data.workStartYearOptions.indexOf('2005') } })
  var tn0 = toastCalls.length
  py3.onBirthYearChange({ detail: { value: py3.data.birthYearOptions.indexOf('2010') } })
  record(py3.data.workStartYear === '' && toastCalls.length > tn0, '出生年份(2010)晚于工作年份(2005)→清空并提示')

  // 无结果保存拦截
  var p2 = fresh('pages/wealth-health/wealth-health.js')
  assertNoSave(p2, /请先填写/)

  // isSaving 拦截
  var p3 = fresh('pages/wealth-health/wealth-health.js')
  p3.setData({ birthYear: '1990', annualPreTaxWan: '30', workStartYear: '2012' }); p3.calculate(); p3.setData({ isSaving: true })
  exportCalls = 0
  p3.saveResult()
  record(exportCalls === 0, 'isSaving 时保存被拦截')

  // 保存 E2E
  var p4 = fresh('pages/wealth-health/wealth-health.js')
  p4.setData({ birthYear: '1990', annualPreTaxWan: '30', workStartYear: '2012', houseValue: '300', houseLoan: '100', cash: '50', invest: '80' }); p4.calculate()
  await assertSaveOK(p4, 'wealth-health', true)

  // restoreHistory
  var p5 = fresh('pages/wealth-health/wealth-health.js')
  p5.restoreHistory({ input: { birthYear: '1990', annualPreTaxWan: '30', workStartYear: '2012', cityKey: 'shenzhen', medicalTier: '一档', fundRate: 0.08, includeFund: true, sel: {}, assets: { houseValue: '300' } } })
  record(p5.data.showResult === true, 'restoreHistory 还原并出结果')
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

// ============ 基建回归（refactor 新增 API）============
function runInfra() {
  console.log('\n— 基建回归（refactor 新增 API）—')

  var report = require('./utils/report.js')
  record(report.DEFAULT_W === 300 && report.DEFAULT_H === 610, 'report 导出画布常量 DEFAULT_W=300/DEFAULT_H=610', 'W=' + report.DEFAULT_W)
  record(report.getDpr() === 2, 'getDpr 缓存返回 pixelRatio=2（mock getSystemInfoSync）', 'dpr=' + report.getDpr())
  record(report.setTheme('dark') === undefined, 'setTheme 可切换主题缓存（dark 不抛错）')
  record(report.setTheme('light') === undefined, 'setTheme 切回 light 不抛错')

  var whCalc = require('./utils/wealth-health.js')
  record(whCalc.STANDARD_DEDUCTION === 60000, 'wealth-health 导出个税基本减除常量 60000', 'v=' + whCalc.STANDARD_DEDUCTION)

  // saveResultTemplate：无结果时懒计算 summary 不被求值（不抛错）且 isSaving 复位
  var b = fresh('pages/bmi/bmi.js')
  var threwB = false
  try { b.saveResult() } catch (e) { threwB = true }
  record(!threwB && b.data.isSaving === false, 'bmi 无结果 saveResult 不抛错且 isSaving 复位')

  // onInput 防抖：calculate 被触发（测试环境 setTimeout 同步执行）
  var b2 = fresh('pages/bmi/bmi.js')
  var calcCalled = 0
  var origCalc = b2.calculate
  b2.calculate = function () { calcCalled++; origCalc.call(b2) }
  b2.onInput({ detail: { field: 'height', value: '170' } })
  record(calcCalled === 1, 'onInput 防抖后仍触发 calculate', 'calls=' + calcCalled)

  // Canvas 2.0 饼图：drawPie 有数据 / 无数据 / 节点缺失 三种分支均不抛错
  var e1 = fresh('pages/index/index.js')
  var threwPie1 = false
  try { e1.drawPie([{ name: 'x', value: 1, color: '#000' }], 1) } catch (err) { threwPie1 = true }
  record(!threwPie1, 'index.drawPie 有数据分支不抛错（Canvas 2.0）')

  var e2 = fresh('pages/index/index.js')
  var threwPie2 = false
  try { e2.drawPie([], 0) } catch (err) { threwPie2 = true }
  record(!threwPie2, 'index.drawPie 无数据分支不抛错（clearRect 后返回）')

  var origQuery = wx.createSelectorQuery
  wx.createSelectorQuery = function () {
    return { select: function () { return { fields: function () { return { exec: function (cb) { cb([{ node: null }]) } } } } } }
  }
  var e3 = fresh('pages/index/index.js')
  var threwPie3 = false
  try { e3.drawPie([{ name: 'x', value: 1, color: '#000' }], 1) } catch (err) { threwPie3 = true }
  wx.createSelectorQuery = origQuery
  record(!threwPie3, 'drawPie 画布节点缺失不抛错（静默降级）')
}

// ============ 中午吃什么（定位 + 取餐厅 + 按钮点击模拟）============
async function runLunch() {
  console.log('\n— 中午吃什么（老道士算卦·今日吃什么）—')

  // 贴近真实返回的餐厅样本（name/location/address/telephone/detail_info.price/tag）
  function mkPois(n) {
    var base = { lat: 22.5431, lng: 114.0579 }
    var names = ['蜀香源川菜馆', '粤味道茶餐厅', '老街面馆', '海记火锅', '城南烧烤', '樱花日料亭', '首尔炸鸡', '西堤牛排馆', '汉堡王(测试店)', '暹罗泰式料理']
    var tags = ['川菜', '茶餐厅', '面馆', '火锅', '烧烤', '日本料理', '韩国料理', '西餐', '快餐', '东南亚']
    var pois = []
    for (var i = 0; i < n; i++) {
      pois.push({
        name: names[i % 10],
        location: { lat: base.lat + 0.001 * (i + 1), lng: base.lng + 0.001 * (i + 1) },
        address: '测试路' + (i + 1) + '号',
        telephone: '1380000' + (1000 + i),
        detail_info: { tag: '美食;' + tags[i % 10], price: String(40 + i * 10), overall_rating: '4.' + (i % 5) }
      })
    }
    return pois
  }
  function setBaidu(resultsFn) {
    wx.request = function (o) { if (o && o.success) o.success({ data: { status: 0, message: 'ok', results: resultsFn(o) } }) }
  }
  function setLoc(ok, coord) {
    wx.getLocation = function (o) {
      if (ok) { if (o && o.success) o.success({ latitude: coord.lat, longitude: coord.lng }) }
      else { if (o && o.fail) o.fail({ errMsg: 'getLocation:fail auth deny' }) }
    }
  }
  var SZ = { lat: 22.5431, lng: 114.0579 }

  // 场景1：定位成功 → 算卦 → 取餐厅 → 结果页
  setLoc(true, SZ); setBaidu(function () { return mkPois(12) })
  var inst = fresh('pages/lunch/lunch.js')
  inst.onLoad({}); inst.startFortune()
  await new Promise(function (r) { realSetTimeout(r, 40) })
  record(inst.data.screen === 'result', '定位成功→算卦→取餐厅→结果页(result)', 'screen=' + inst.data.screen)
  record(inst.data.gua && inst.data.gua.name, '结果页含卦象', inst.data.gua && inst.data.gua.name)
  record(inst.data.rest && inst.data.rest.name, '结果页含推荐餐厅', inst.data.rest && inst.data.rest.name)
  record(inst.data.huangli && inst.data.huangli.date, '结果页含黄历', inst.data.huangli && inst.data.huangli.date)

  // 未算卦直接保存 → 拦截
  var instNo = fresh('pages/lunch/lunch.js')
  toastCalls.length = 0; exportCalls = 0; saveAlbumCalls = 0
  instNo.saveResult()
  record(exportCalls === 0 && saveAlbumCalls === 0, '未算卦时保存不触发出图/存相册')
  record(toastCalls.some(function (t) { return /请先算一卦/.test(t.title || '') }), '未算卦时保存提示「请先算一卦」')

  // 场景2：定位被拒 → denied
  setLoc(false); setBaidu(function () { return mkPois(12) })
  var instDeny = fresh('pages/lunch/lunch.js')
  instDeny.startFortune()
  record(instDeny.data.screen === 'denied', '定位被拒→denied 屏', 'screen=' + instDeny.data.screen)

  // 场景3：周边无餐厅 → norest
  setLoc(true, SZ); setBaidu(function () { return [] })
  var instNoRest = fresh('pages/lunch/lunch.js')
  instNoRest.startFortune()
  await new Promise(function (r) { realSetTimeout(r, 40) })
  record(instNoRest.data.screen === 'norest', '周边无餐厅→norest 屏', 'screen=' + instNoRest.data.screen)

  // 场景4：调试坐标直传（?lat=&lng=）绕过授权
  setLoc(false); setBaidu(function () { return mkPois(12) })
  var instDbg = fresh('pages/lunch/lunch.js')
  instDbg.onLoad({ lat: '22.5431', lng: '114.0579' }); instDbg.startFortune()
  await new Promise(function (r) { realSetTimeout(r, 40) })
  record(instDbg.data.screen === 'result', '调试坐标(?lat=&lng=)绕过授权→仍出结果', 'screen=' + instDbg.data.screen)

  // 场景5：按钮点击反馈
  toastCalls.length = 0
  inst.confirmChoice()
  record(toastCalls.some(function (t) { return /就选这家/.test(t.title || '') }), '点击「就选这家」→ toast 反馈')

  inst.goWelcome()
  record(inst.data.screen === 'welcome' && inst.data.gua === null, '点击返回→welcome 且清空结果')

  setLoc(true, SZ); setBaidu(function () { return mkPois(12) })
  var inst2 = fresh('pages/lunch/lunch.js')
  inst2.onLoad({}); inst2.startFortune()
  await new Promise(function (r) { realSetTimeout(r, 40) })
  inst2.refortune()
  await new Promise(function (r) { realSetTimeout(r, 40) })
  record(inst2.data.screen === 'result', '点击「再算一卦」→ 重新推演并出结果', 'screen=' + inst2.data.screen)

  navigateCalls.length = 0
  global.getCurrentPages = function () { return [{ route: 'pages/lunch/lunch' }, { route: 'pages/home/home' }] }
  wx.navigateBack = function () { navigateCalls.push({ back: true }) }
  var inst3 = fresh('pages/lunch/lunch.js')
  inst3.goHome()
  record(navigateCalls.some(function (c) { return c.back }), '点击首页→navigateBack 返回首页')

  // 保存 E2E（已算卦）；午餐无输入可还原(input:undefined)，按设计不写历史，仅出海报
  var instSave = fresh('pages/lunch/lunch.js')
  instSave.onLoad({}); instSave.startFortune()
  await new Promise(function (r) { realSetTimeout(r, 40) })
  await assertSaveOK(instSave, 'lunch', false)
}

// ============ 主流程 ============
;(async function () {
  await runBmi()
  await runWealthHealth()
  await runRelation()
  await runExpense()
  await runProgress()
  await runLunch()
  runInfra()
  global.setTimeout = realSetTimeout
  console.log('\n=== test_all 结果: ' + pass + '/' + (pass + fail) + ' 通过 ===\n')
  if (fail) process.exit(1)
})()
