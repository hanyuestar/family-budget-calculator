// pages/wealth-health/wealth-health.js - 财富健康指数计算页
// 替换原「存钱段位」工具。公式来自 Stanley & Danko《The Millionaire Next Door》。
var format = require('../../utils/format.js')
var report = require('../../utils/report.js')
var calcPage = require('../../behaviors/calc-page.js')
var wh = require('../../utils/wealth-health.js')
var CITY = require('../../data/city-ss.js')

// 城市下拉（已接入 7 城）
var CITY_KEYS = Object.keys(CITY)
var CITY_NAMES = CITY_KEYS.map(function (k) { return CITY[k].name })

// ---- 常量 ----
var MIN_WORKING_AGE = 16              // 法定最低工作年龄
var BIRTH_YEAR_START = 1940           // 出生年份下拉起始年
var WORK_YEAR_START = 1960            // 工作起始年份下拉默认起始年

// 年份下拉选项（ descending），与「下拉选择+校验」需求配套
var CUR_YEAR = new Date().getFullYear()
function buildYearOptions(start, end) {
  var arr = []
  for (var y = end; y >= start; y--) arr.push(String(y))
  return arr
}
// 在选项数组里找值对应的 index（找不到默认 0），供 restoreHistory 还原
function idxInOptions(options, val) {
  if (!options || !options.length) return -1
  var i = options.indexOf(String(val))
  return i < 0 ? 0 : i
}
var BIRTH_YEAR_OPTS = buildYearOptions(BIRTH_YEAR_START, CUR_YEAR)
var WORK_YEAR_DEFAULT_OPTS = buildYearOptions(WORK_YEAR_START, CUR_YEAR)

// 由城市生成页面所需的派生字段（档位、公积金区间、比例摘要、租金档等）
function buildCityPatch(cityKey) {
  var idx = CITY_KEYS.indexOf(cityKey)
  if (idx < 0) idx = 0
  var city = CITY[cityKey] || CITY.shenzhen
  var yiNode = city.social.医疗
  var tiers = (typeof yiNode.personal === 'object') ? Object.keys(yiNode.personal) : []
  var fMinPct = Math.round((city.housingFund.fundMin != null ? city.housingFund.fundMin : 0.05) * 100)
  var fMaxPct = Math.round((city.housingFund.fundMax != null ? city.housingFund.fundMax : 0.12) * 100)
  var defRate = city.housingFund.defaultRate != null ? city.housingFund.defaultRate : 0.08
  var medText = (typeof yiNode.personal === 'object')
    ? ('医保 ' + tiers.map(function (t) { return t + ' ' + (yiNode.personal[t] * 100) + '%' }).join(' / '))
    : ('医保 ' + (yiNode.personal * 100) + '%' + (yiNode.fixed ? (' +' + yiNode.fixed + '元') : ''))
  var rateText = '养老 ' + (city.social.养老.personal * 100) + '% · ' + medText +
    ' · 失业 ' + (city.social.失业.personal * 100) + '% · 公积金 ' + fMinPct + '%-' + fMaxPct + '% · 租金专项 ' + city.rentMonthly + '元/月'
  return {
    cityKey: CITY_KEYS[idx], cityIndex: idx,
    medicalTiers: tiers, hasMedicalTiers: tiers.length > 0,
    medicalTier: tiers.length ? tiers[0] : '',
    fundMinPct: fMinPct, fundMaxPct: fMaxPct,
    fundRate: defRate, fundRatePct: Math.round(defRate * 100),
    cityRateText: rateText,
    rentMonthly: city.rentMonthly
  }
}

var DEDUCT_ITEMS = [
  { id: 'infant', name: '3岁以下婴幼儿照护', type: 'perChild', note: '每孩 2000 元/月' },
  { id: 'childEdu', name: '子女教育', type: 'perChild', note: '每孩 2000 元/月' },
  { id: 'eduDegree', name: '继续教育（学历）', type: 'bool', note: '400 元/月' },
  { id: 'eduCert', name: '继续教育（职业资格）', type: 'bool', note: '3600 元/年' },
  { id: 'seriousSelfPay', name: '大病医疗', type: 'amount', note: '自付超1.5万部分可扣（年上限8万）' },
  { id: 'mortgage', name: '住房贷款利息（首套）', type: 'bool', note: '1000 元/月（与租金互斥）' },
  { id: 'rent', name: '住房租金', type: 'bool', note: '按所在城市标准（与房贷利息互斥）' },
  { id: 'elderlyOnly', name: '赡养老人（独生）', type: 'bool', note: '3000 元/月' },
  { id: 'elderlyShare', name: '赡养老人（非独生分摊）', type: 'amount', note: '与独生互斥，最多 1500 元/月' },
  { id: 'pension', name: '个人养老金', type: 'bool', note: '12000 元/年' }
]

// 页面默认数据：data 初始值 与 reset() 共用同一份，避免两者漂移 / 新增字段漏 reset
function defaultWealthHealthData() {
  return {
    // 基础信息
    birthYear: '', annualPreTaxWan: '', workStartYear: '',
    birthYearOptions: BIRTH_YEAR_OPTS, birthYearIndex: -1,
    workStartYearOptions: WORK_YEAR_DEFAULT_OPTS, workStartYearIndex: -1,
    cityKey: 'shenzhen', cityIndex: 0, cityNames: CITY_NAMES,
    medicalTier: '一档', medicalTiers: ['一档', '二档'], hasMedicalTiers: true,
    fundRate: 0.08, fundRatePct: 8, fundMinPct: 5, fundMaxPct: 12,
    cityRateText: '养老 8% · 医保 一档 2% / 二档 0.5% · 失业 0.2% · 公积金 5%-12% · 租金专项 1500元/月',
    rentMonthly: 1500,
    includeFund: true, fundOverride: '',

    // 专项附加扣除（扁平字段，calculate 时组装成 sel）
    infant: '', childEdu: '', eduDegree: false, eduCert: false,
    seriousSelfPay: '', mortgage: false, rent: false,
    elderlyOnly: false, elderlyShare: '', pension: false,
    deductItems: DEDUCT_ITEMS,

    // 资产（万元，扁平）
    houseValue: '', houseLoan: '', cash: '', invest: '', other: '',

    // 口径切换
    taxMode: 'preTax', // preTax | afterTax
    fundMode: 'inc',    // inc | exc

    // 结果
    result: null, multiple: 0, activeKey: 'preTaxInc',
    rank: null, paw: null, progress: 0,
    showResult: false, isSaving: false,

    share: { ready: false, title: '', path: '/pages/wealth-health/wealth-health' }
  }
}

Page({
  behaviors: [calcPage],

  data: defaultWealthHealthData(),

  // 组装计算输入
  buildInput: function () {
    var d = this.data
    return {
      birthYear: d.birthYear,
      annualPreTaxWan: d.annualPreTaxWan,
      cityKey: d.cityKey,
      medicalTier: d.medicalTier,
      fundRate: d.fundRate,
      workStartYear: d.workStartYear,
      includeFund: d.includeFund,
      fundOverride: d.fundOverride,
      sel: {
        infant: d.infant, childEdu: d.childEdu,
        eduDegree: d.eduDegree, eduCert: d.eduCert,
        seriousSelfPay: d.seriousSelfPay,
        mortgage: d.mortgage, rent: d.rent,
        elderlyOnly: d.elderlyOnly, elderlyShare: d.elderlyShare,
        pension: d.pension
      },
      assets: {
        houseValue: d.houseValue, houseLoan: d.houseLoan,
        cash: d.cash, invest: d.invest, other: d.other
      }
    }
  },

  hasInput: function () {
    var d = this.data
    return !!(d.birthYear && d.annualPreTaxWan)
  },

  calculate: function () {
    var d = this.data
    var input = this.buildInput()
    var r = wh.compute(input)

    var activeKey = d.taxMode + (d.fundMode === 'inc' ? 'Inc' : 'Exc')
    var multiple = r.multiples[activeKey]
    if (!isFinite(multiple)) multiple = 0
    var multipleText = multiple.toFixed(3) // 倍率保留三位小数，避免过长
    var rank = wh.rankFor(multiple)

    var netAssetWan = d.fundMode === 'inc' ? r.na.inc : r.na.exc
    var baselineWan = r.baselines[d.taxMode] / 10000
    var paw = wh.pawInfo(r.baselines[d.taxMode], netAssetWan * 10000)

    var prog = Math.min(multiple, 2) / 2

    this.setData({
      result: r,
      multiple: multiple,
      multipleText: multipleText,
      activeKey: activeKey,
      rank: rank,
      paw: paw,
      netAssetWan: netAssetWan,
      baselineWan: baselineWan,
      progress: prog,
      showResult: this.hasInput(),
      share: {
        ready: this.hasInput(),
        title: '我的财富健康倍数是 ' + multipleText + '，测测你的',
        path: '/pages/wealth-health/wealth-health'
      }
    })
  },

  reset: function () {
    this.setData(defaultWealthHealthData())
  },

  // ---- 自定义输入控件 ----
  applyCity: function (idx) {
    var key = CITY_KEYS[idx] || 'shenzhen'
    return buildCityPatch(key)
  },
  onCityChange: function (e) {
    var idx = Number(e.detail.value)
    this.setData(this.applyCity(idx))
    this.calculate()
  },
  // 出生年份下拉：选后重算「工作起始年份」可选范围（工作年龄≥16），
  // 若已选工作年份早于出生年份则清空并提示（出生年份不能晚于工作年份）。
  onBirthYearChange: function (e) {
    var idx = Number(e.detail.value)
    var opts = this.data.birthYearOptions
    if (!opts || !opts.length) return
    var year = opts[idx]
    var wsStart = Math.min(Number(year) + MIN_WORKING_AGE, CUR_YEAR)
    var wsOpts = buildYearOptions(wsStart, CUR_YEAR)
    var up = { birthYear: year, birthYearIndex: idx, workStartYearOptions: wsOpts }
    if (this.data.workStartYear) {
      var ws = Number(this.data.workStartYear)
      if (ws < Number(year)) {
        up.workStartYear = ''; up.workStartYearIndex = -1
        wx.showToast({ title: '出生年份不能晚于工作年份', icon: 'none' })
      } else if (wsOpts.indexOf(this.data.workStartYear) < 0) {
        // 原工作年份已不在新可选范围（工作年龄需≥16），清空重选
        up.workStartYear = ''; up.workStartYearIndex = -1
      }
    }
    this.setData(up)
    this.calculate()
  },
  // 工作起始年份下拉：双保险校验（选项起点已保证 age≥16 且 workStartYear≥birthYear）
  onWorkStartYearChange: function (e) {
    var idx = Number(e.detail.value)
    var opts = this.data.workStartYearOptions
    if (!opts || !opts.length) return
    var year = opts[idx]
    if (this.data.birthYear && Number(year) < Number(this.data.birthYear)) {
      wx.showToast({ title: '出生年份不能晚于工作年份', icon: 'none' })
      return
    }
    this.setData({ workStartYear: year, workStartYearIndex: idx })
    this.calculate()
  },
  onMedicalChange: function (e) {
    this.setData({ medicalTier: this.data.medicalTiers[Number(e.detail.value)] })
    this.calculate()
  },
  onFundRate: function (e) {
    var pct = Number(e.detail.value)
    this.setData({ fundRatePct: pct, fundRate: pct / 100 })
    this.calculate()
  },
  onIncludeFund: function (e) {
    this.setData({ includeFund: e.detail.value })
    this.calculate()
  },
  onDeductToggle: function (e) {
    var key = e.currentTarget.dataset.key
    var val = e.detail.value
    var up = {}
    up[key] = val
    // 互斥处理
    if (key === 'mortgage' && val) up.rent = false
    if (key === 'rent' && val) up.mortgage = false
    if (key === 'elderlyOnly' && val) up.elderlyShare = ''
    if (key === 'elderlyShare' && val !== '') up.elderlyOnly = false
    this.setData(up)
    this.calculate()
  },
  onTaxMode: function (e) {
    this.setData({ taxMode: e.currentTarget.dataset.mode })
    this.calculate()
  },
  onFundMode: function (e) {
    this.setData({ fundMode: e.currentTarget.dataset.mode })
    this.calculate()
  },
  // 专项附加「数量型」步进（每孩数量）
  onStep: function (e) {
    var key = e.currentTarget.dataset.key
    var delta = Number(e.currentTarget.dataset.delta)
    var cur = parseInt(this.data[key] || '0', 10)
    cur = Math.max(0, cur + delta)
    var up = {}; up[key] = String(cur)
    this.setData(up)
    this.calculate()
  },
  // 专项附加「金额型」直接输入（大病自付 / 赡养分摊）
  onDeductInput: function (e) {
    var key = e.currentTarget.dataset.key
    var up = {}; up[key] = e.detail.value
    this.setData(up)
    this.calculate()
  },

  saveResult: function () {
    var d = this.data
    var input = this.buildInput()
    var summary = '财富健康倍数 ' + d.multipleText + ' | ' + (d.rank ? d.rank.label : '未知')
    var modeLabel = (d.taxMode === 'preTax' ? '税前' : '税后') + (d.fundMode === 'inc' ? '·含公积金' : '·不含公积金')

    this.saveResultTemplate({
      toolId: 'wealth-health', toolName: '财富健康指数', icon: '📈',
      input: input,
      summary: summary,
      title: '财富健康指数报告',
      theme: ['#16a085', '#1abc9c'],
      slogan: '看清你的财富积累效率',
      footer: '数据仅供参考 · 娱乐向测算',
      hook: '我的财富健康倍数是 ' + d.multipleText + '，' + (d.rank ? d.rank.label : '') + '，来测测你',
      guard: function (d) { return d.showResult },
      noResultHint: '请先填写信息并计算',
      draw: function (canvas, ctx, W, H, data) {
        // 倍数
        ctx.fillStyle = '#888'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('你的财富健康倍数为', W / 2, 115)
        ctx.fillStyle = '#1abc9c'; ctx.font = 'bold 40px sans-serif'
        ctx.fillText((data.multipleText || data.multiple.toFixed(3)) + ' 倍', W / 2, 162)

        // 等级徽章
        if (data.rank) {
          report.drawBadge(ctx, { x: W / 2 - 88, y: 182, w: 176, h: 38, r: 19, bg: data.rank.color, text: data.rank.label, fontSize: 15 })
        }

        report.drawDivider(ctx, 30, 245, W - 30)

        // 口径 + 三行数据
        ctx.fillStyle = '#999'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('口径：' + modeLabel, W / 2, 270)

        function row(y, label, value) {
          ctx.fillStyle = '#999'; ctx.font = '13px sans-serif'; ctx.textAlign = 'left'
          ctx.fillText(label, 30, y)
          ctx.fillStyle = '#333'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'right'
          ctx.fillText(value, W - 30, y)
        }
        row(305, '预期净资产基准线', format.formatWan(data.baselineWan) + '万')
        row(340, '实际净资产', format.formatWan(data.netAssetWan) + '万')
        row(375, 'PAW 目标线(×2)', format.formatWan(data.paw.targetWan) + '万')

        if (data.rank) {
          ctx.fillStyle = '#666'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'
          var t = data.rank.text
          if (t.length > 22) { ctx.fillText(t.substring(0, 22), W / 2, 408); ctx.fillText(t.substring(22), W / 2, 428) }
          else ctx.fillText(t, W / 2, 418)
        }
      }
    })
  },

  restoreHistory: function (record) {
    var inp = record.input || {}
    var sel = inp.sel || {}
    var a = inp.assets || {}
    var cp = this.applyCity(Math.max(0, CITY_KEYS.indexOf(inp.cityKey || 'shenzhen')))
    var byOpts = BIRTH_YEAR_OPTS
    var wsOpts = buildYearOptions(inp.birthYear ? Math.min(Number(inp.birthYear) + MIN_WORKING_AGE, CUR_YEAR) : WORK_YEAR_START, CUR_YEAR)
    var up = {
      birthYearOptions: byOpts, birthYearIndex: idxInOptions(byOpts, inp.birthYear),
      workStartYearOptions: wsOpts, workStartYearIndex: idxInOptions(wsOpts, inp.workStartYear),
      birthYear: inp.birthYear || '', annualPreTaxWan: inp.annualPreTaxWan || '', workStartYear: inp.workStartYear || '',
      cityKey: cp.cityKey, cityIndex: cp.cityIndex,
      medicalTiers: cp.medicalTiers, hasMedicalTiers: cp.hasMedicalTiers, medicalTier: cp.medicalTier,
      fundMinPct: cp.fundMinPct, fundMaxPct: cp.fundMaxPct,
      fundRate: Number(inp.fundRate) || cp.fundRate, fundRatePct: Math.round((Number(inp.fundRate) || cp.fundRate) * 100),
      cityRateText: cp.cityRateText, rentMonthly: cp.rentMonthly,
      includeFund: inp.includeFund !== false,
      fundOverride: inp.fundOverride || '',
      infant: sel.infant || '', childEdu: sel.childEdu || '', eduDegree: !!sel.eduDegree, eduCert: !!sel.eduCert,
      seriousSelfPay: sel.seriousSelfPay || '', mortgage: !!sel.mortgage, rent: !!sel.rent,
      elderlyOnly: !!sel.elderlyOnly, elderlyShare: sel.elderlyShare || '', pension: !!sel.pension,
      houseValue: a.houseValue || '', houseLoan: a.houseLoan || '', cash: a.cash || '', invest: a.invest || '', other: a.other || ''
    }
    this.setData(up)
    this.calculate()
  }
})
