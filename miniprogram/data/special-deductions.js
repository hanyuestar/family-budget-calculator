// data/special-deductions.js — 个人所得税专项附加扣除项目（月标准，单位：元）
// type 说明：
//   perChild  —— 按子女数量计（每人每月标准额）
//   bool      —— 是否享受（monthly 或 annual 给出标准额）
//   amount    —— 自付金额类（年口径，需按 threshold/cap 计算后 ÷12 转月）
//   elderly   —— 赡养老人（独生固定额 / 非独生分摊额）
// 房贷利息(mortgage) 与 住房租金(rent) 互斥，UI 层保证二选一。
module.exports = [
  { id: 'infant', name: '3岁以下婴幼儿照护', monthly: 2000, type: 'perChild' },
  { id: 'childEdu', name: '子女教育', monthly: 2000, type: 'perChild' },
  { id: 'eduDegree', name: '继续教育（学历）', monthly: 400, type: 'bool' },
  { id: 'eduCert', name: '继续教育（职业资格）', annual: 3600, type: 'bool' },
  { id: 'seriousIllness', name: '大病医疗', threshold: 15000, cap: 80000, type: 'amount' },
  { id: 'mortgage', name: '住房贷款利息（首套）', monthly: 1000, type: 'bool', mutex: 'rent' },
  { id: 'rent', name: '住房租金', type: 'bool', mutex: 'mortgage', byCity: true },
  { id: 'elderly', name: '赡养老人', onlyMonthly: 3000, shareMonthly: 1500, type: 'elderly' },
  { id: 'pension', name: '个人养老金', annual: 12000, type: 'bool' }
]
