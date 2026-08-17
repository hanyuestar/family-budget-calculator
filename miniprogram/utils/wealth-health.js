// utils/wealth-health.js — 财富健康指数 纯计算（无 wx 依赖，可单测）
// 金额单位：内部一律用「元」；对外展示再转万元。
//
// 公式来源：Stanley & Danko《The Millionaire Next Door》财富积累公式
//   预期净资产基准线 = 年龄 × 年收入 ÷ 10
//   财富健康倍数     = 实际净资产 ÷ 预期净资产基准线
// 提供税前 / 税后两套口径，净资产含 / 不含公积金两种口径。

var CITY = require('../data/city-ss.js')

// ---- 常量（专项附加扣除 / 个税相关，单位：元）----
var STANDARD_DEDUCTION = 60000          // 个税基本减除费用（年）
var DEDUCT_INFANT_MONTHLY = 2000        // 婴幼儿照护（每孩/月）
var DEDUCT_CHILD_EDU_MONTHLY = 2000     // 子女教育（每孩/月）
var DEDUCT_EDU_DEGREE_MONTHLY = 400     // 继续教育-学历（/月）
var DEDUCT_EDU_CERT_YEARLY = 3600       // 继续教育-职业资格（/年）
var DEDUCT_SERIOUS_DEDUCT = 15000       // 大病医疗自付起扣线（年）
var DEDUCT_SERIOUS_CAP = 80000          // 大病医疗年扣上限
var DEDUCT_MORTGAGE_MONTHLY = 1000      // 首套房贷利息（/月）
var DEDUCT_ELDERLY_ONLY_MONTHLY = 3000  // 赡养老人-独生（/月）
var DEDUCT_ELDERLY_SHARE_MONTHLY = 1500 // 赡养老人-分摊上限（/月）
var DEDUCT_PENSION_YEARLY = 12000       // 个人养老金（/年）

// 个税累进税率表（年度，速算扣除数法）
var TAX_BRACKETS = [
  { max: 36000, rate: 0.03, quick: 0 },
  { max: 144000, rate: 0.10, quick: 2520 },
  { max: 300000, rate: 0.20, quick: 16920 },
  { max: 420000, rate: 0.25, quick: 31920 },
  { max: 660000, rate: 0.30, quick: 52920 },
  { max: 960000, rate: 0.35, quick: 85920 },
  { max: Infinity, rate: 0.45, quick: 181920 }
]

function clamp(v, min, max) {
  if (v < min) return min
  if (v > max) return max
  return v
}

function getYear() {
  return new Date().getFullYear()
}

// 五险一金（逐险种按各自基数上下限 clamp）
// medicalTier：仅多档位城市（深圳/珠海）区分档位；单费率城市忽略
// fundRate：公积金比例，按城市区间 [fundMin, fundMax] clamp（上海 5%-7%，其余 5%-12%）
function computeFiveOne(annualPreTax, cityKey, medicalTier, fundRate) {
  var city = CITY[cityKey] || CITY.shenzhen
  var monthly = annualPreTax / 12
  var s = city.social
  var yangBase = clamp(monthly, s.养老.min, s.养老.max)
  var yiNode = s.医疗
  var yiBase = clamp(monthly, yiNode.baseMin, yiNode.baseMax)
  var shiBase = clamp(monthly, s.失业.min, s.失业.max)
  var gjjBase = clamp(monthly, city.housingFund.min, city.housingFund.max)

  var yang = yangBase * s.养老.personal

  // 医疗比例：对象(档位)取对应档，数值(单费率)直接取
  var yiRate
  if (typeof yiNode.personal === 'object') {
    yiRate = yiNode.personal[medicalTier]
    if (yiRate == null) yiRate = yiNode.personal[Object.keys(yiNode.personal)[0]]
  } else {
    yiRate = yiNode.personal
  }
  var yi = yiBase * yiRate + (yiNode.fixed || 0) // 医疗固定额（如北京 +3 元/月）

  var shi = shiBase * s.失业.personal

  // 公积金比例 clamp 到城市区间
  var fMin = city.housingFund.fundMin != null ? city.housingFund.fundMin : 0.05
  var fMax = city.housingFund.fundMax != null ? city.housingFund.fundMax : 0.12
  var fr = clamp(Number(fundRate) || 0.08, fMin, fMax)
  var gjj = gjjBase * fr

  return {
    monthly: { yang: yang, yi: yi, shi: shi, gjj: gjj, total: yang + yi + shi + gjj },
    yearly: { yang: yang * 12, yi: yi * 12, shi: shi * 12, gjj: gjj * 12, total: (yang + yi + shi + gjj) * 12 },
    bases: { yang: yangBase, yi: yiBase, shi: shiBase, gjj: gjjBase }
  }
}

// 专项附加扣除（月合计，单位：元）
// sel: { infant, childEdu, eduDegree, eduCert, seriousSelfPay, mortgage, rent, elderlyOnly, elderlyShare, pension }
function computeSpecialMonthly(sel, cityKey) {
  sel = sel || {}
  var total = 0
  total += (Number(sel.infant) || 0) * DEDUCT_INFANT_MONTHLY
  total += (Number(sel.childEdu) || 0) * DEDUCT_CHILD_EDU_MONTHLY
  if (sel.eduDegree) total += DEDUCT_EDU_DEGREE_MONTHLY
  if (sel.eduCert) total += DEDUCT_EDU_CERT_YEARLY / 12
  if (sel.seriousSelfPay && Number(sel.seriousSelfPay) > 0) {
    // 大病医疗：自付超起扣线部分可扣，年上限封顶，再 ÷12 转月
    var d = Math.min(DEDUCT_SERIOUS_CAP, Math.max(0, Number(sel.seriousSelfPay) - DEDUCT_SERIOUS_DEDUCT)) / 12
    total += d
  }
  // 房贷 / 租金 互斥：房贷优先
  if (sel.mortgage) {
    total += DEDUCT_MORTGAGE_MONTHLY
  } else if (sel.rent) {
    var city = CITY[cityKey] || CITY.shenzhen
    total += city.rentMonthly
  }
  if (sel.elderlyOnly) {
    total += DEDUCT_ELDERLY_ONLY_MONTHLY
  } else if (sel.elderlyShare && Number(sel.elderlyShare) > 0) {
    total += Math.min(DEDUCT_ELDERLY_SHARE_MONTHLY, Number(sel.elderlyShare))
  }
  if (sel.pension) total += DEDUCT_PENSION_YEARLY / 12
  return total
}

// 个税（年度应纳税所得额 → 税额），累进 + 速算扣除数
function computeTax(annualTaxable) {
  if (!(annualTaxable > 0)) return 0
  for (var i = 0; i < TAX_BRACKETS.length; i++) {
    var b = TAX_BRACKETS[i]
    if (annualTaxable <= b.max) return annualTaxable * b.rate - b.quick
  }
  return 0
}

// 公积金余额估算（万元）：个人 + 单位 全年合计 × 工作年限
function estimateFundWan(gjjMonthly, workYears) {
  if (!(workYears > 0)) return 0
  return gjjMonthly * 2 * 12 * workYears / 10000
}

// 净资产（万元）
// includeFund=false 时基金余额不计；override 有值则用用户填写值，否则估算
function computeNetAsset(assets, includeFund, fundOverride, gjjMonthly, workYears) {
  assets = assets || {}
  var houseNet = (Number(assets.houseValue) || 0) - (Number(assets.houseLoan) || 0)
  var base = houseNet + (Number(assets.cash) || 0) + (Number(assets.invest) || 0) + (Number(assets.other) || 0)
  var fund = 0
  if (includeFund) {
    if (fundOverride !== '' && fundOverride != null && !isNaN(Number(fundOverride)) && Number(fundOverride) > 0) {
      fund = Number(fundOverride)
    } else {
      fund = estimateFundWan(gjjMonthly, workYears)
    }
  }
  return { base: base, fund: fund, inc: base + fund, exc: base }
}

// 等级评定
function rankFor(multiple) {
  if (multiple >= 2) return { key: 'PAW', stars: 3, label: 'PAW · 超优财富积累者', color: '#27ae60', text: '非常轻松，财富已为你工作' }
  if (multiple >= 1) return { key: 'AAW+', stars: 2, label: 'AAW · 平均偏上财富积累者', color: '#d4ac0d', text: '超过同龄平均水平，继续加油' }
  if (multiple >= 0.5) return { key: 'AAW-', stars: 1, label: 'AAW · 平均偏下财富积累者', color: '#e67e22', text: '在同龄人中处于下游，需要提高储蓄率' }
  return { key: 'UAW', stars: 0, label: 'UAW · 低效财富积累者', color: '#e74c3c', text: '净资产严重偏低，你的收入大部分被消费了' }
}

// PAW 目标线信息
function pawInfo(baselineYuan, netAssetYuan) {
  var target = baselineYuan * 2
  var gap = target - netAssetYuan
  if (gap > 0) {
    return { reached: false, targetWan: target / 10000, gapWan: gap / 10000, pct: target > 0 ? gap / target * 100 : 0 }
  }
  return { reached: true, targetWan: target / 10000, exceedWan: (-gap) / 10000, pct: target > 0 ? (-gap) / target * 100 : 0 }
}

// 主计算
function compute(input) {
  input = input || {}
  var year = getYear()
  var birthYear = Number(input.birthYear) || year
  var age = year - birthYear
  if (age < 0) age = 0

  var annualPreTax = (Number(input.annualPreTaxWan) || 0) * 10000
  var fi = computeFiveOne(annualPreTax, input.cityKey, input.medicalTier, Number(input.fundRate) || 0.08)
  var gjjMonthly = fi.monthly.gjj

  var specialMonthly = computeSpecialMonthly(input.sel, input.cityKey)
  var annualSpecial = specialMonthly * 12
  var annualFiveOne = fi.yearly.total
  var annualTaxable = annualPreTax - annualFiveOne - annualSpecial - STANDARD_DEDUCTION
  var tax = computeTax(annualTaxable)
  var annualNetSalary = annualPreTax - annualFiveOne - tax
  var monthlyNetSalary = annualNetSalary / 12

  var workStartYear = Number(input.workStartYear) || year
  var workYears = year - workStartYear
  if (workYears < 0) workYears = 0

  var na = computeNetAsset(input.assets, input.includeFund, input.fundOverride, gjjMonthly, workYears)

  var preTaxBaseline = age * annualPreTax / 10
  var afterTaxBaseline = age * annualNetSalary / 10
  var netExcY = na.exc * 10000
  var netIncY = na.inc * 10000

  return {
    year: year,
    age: age,
    annualPreTax: annualPreTax,
    annualFiveOne: annualFiveOne,
    annualSpecial: annualSpecial,
    annualTax: tax,
    annualNetSalary: annualNetSalary,
    monthlyNetSalary: monthlyNetSalary,
    specialMonthly: specialMonthly,
    fiveOneMonthly: fi.monthly.total,
    fiveOneDetail: fi.monthly,
    na: na,
    fundEstimateWan: estimateFundWan(gjjMonthly, workYears),
    workYears: workYears,
    baselines: { preTax: preTaxBaseline, afterTax: afterTaxBaseline },
    multiples: {
      preTaxExc: preTaxBaseline > 0 ? netExcY / preTaxBaseline : 0,
      preTaxInc: preTaxBaseline > 0 ? netIncY / preTaxBaseline : 0,
      afterTaxExc: afterTaxBaseline > 0 ? netExcY / afterTaxBaseline : 0,
      afterTaxInc: afterTaxBaseline > 0 ? netIncY / afterTaxBaseline : 0
    }
  }
}

module.exports = {
  STANDARD_DEDUCTION: STANDARD_DEDUCTION,
  TAX_BRACKETS: TAX_BRACKETS,
  clamp: clamp,
  getYear: getYear,
  computeFiveOne: computeFiveOne,
  computeSpecialMonthly: computeSpecialMonthly,
  computeTax: computeTax,
  estimateFundWan: estimateFundWan,
  computeNetAsset: computeNetAsset,
  rankFor: rankFor,
  pawInfo: pawInfo,
  compute: compute
}
