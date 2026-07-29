// data/city-ss.js — 城市社保 / 公积金缴费参数（2026 公开口径，已接入 7 城）
// 单位：比例用小数；基数上下限、固定额、租金专项均用「元/月」。
// 数据来源：各地人社局 / 医保局 / 住房公积金管理中心 2026 年度公布口径（含 2026.7 调整）。
// 注意：社保年度多在 7 月调整上下限；若与最新政策不符，以当地官方公布为准。本工具为娱乐向测算。
//
// 数据模型（关键字段说明）：
//   social.养老      { personal, min, max }                      个人比例 + 缴费基数上下限
//   social.医疗      { personal, baseMin, baseMax, fixed?, tiers? }
//                     - personal：数值 = 单费率城市；对象 = 多档位城市（如深圳/珠海）
//                     - fixed：医疗固定额（如北京大病统筹 +3 元/月）
//   social.失业      { personal, min, max }
//   housingFund      { min, max, defaultRate, fundMin, fundMax } fundMin/fundMax = 比例区间（上海 5%-7% 其余 5%-12%）
//   rentMonthly      住房租金专项附加扣除档（一线/省会 1500；普通地级市 1100）

module.exports = {
  // ===== 深圳（基准，单费率之外另有医保档位）=====
  shenzhen: {
    name: '深圳', year: 2026,
    social: {
      养老: { personal: 0.08, min: 4775, max: 27549 },
      医疗: {
        // 深圳：一档 / 二档，个人比例不同
        personal: { '一档': 0.02, '二档': 0.005 },
        baseMin: 6727, baseMax: 33633, fixed: 0
      },
      失业: { personal: 0.002, min: 2520, max: 43659 }
    },
    housingFund: { min: 2360, max: 43860, defaultRate: 0.08, fundMin: 0.05, fundMax: 0.12 },
    rentMonthly: 1500
  },

  // ===== 北京 =====
  beijing: {
    name: '北京', year: 2026,
    social: {
      养老: { personal: 0.08, min: 7162, max: 35811 },
      医疗: {
        // 北京：单费率 2% + 大病统筹固定额 3 元/月
        personal: 0.02,
        baseMin: 7162, baseMax: 35811, fixed: 3
      },
      失业: { personal: 0.005, min: 7162, max: 35811 }
    },
    housingFund: { min: 2420, max: 35811, defaultRate: 0.12, fundMin: 0.05, fundMax: 0.12 },
    rentMonthly: 1500
  },

  // ===== 上海 =====
  shanghai: {
    name: '上海', year: 2026,
    social: {
      养老: { personal: 0.08, min: 7460, max: 37302 },
      医疗: {
        // 上海：单费率 2%（2026.2 前单位阶段降费，个人比例不变）
        personal: 0.02,
        baseMin: 7460, baseMax: 37302, fixed: 0
      },
      失业: { personal: 0.005, min: 7460, max: 37302 }
    },
    // 上海公积金比例区间收窄为 5%-7%（其余城市 5%-12%）
    housingFund: { min: 2690, max: 37302, defaultRate: 0.07, fundMin: 0.05, fundMax: 0.07 },
    rentMonthly: 1500
  },

  // ===== 广州 =====
  guangzhou: {
    name: '广州', year: 2026,
    social: {
      养老: { personal: 0.08, min: 5510, max: 27549 },
      医疗: {
        // 广州：单费率 2%（2026.1 起单位费率由 4.5% 恢复 6%，个人 2% 不变）
        personal: 0.02,
        baseMin: 6234, baseMax: 31170, fixed: 0
      },
      失业: { personal: 0.002, min: 2500, max: 42933 }
    },
    housingFund: { min: 2500, max: 41697, defaultRate: 0.12, fundMin: 0.05, fundMax: 0.12 },
    rentMonthly: 1500
  },

  // ===== 东莞 =====
  dongguan: {
    name: '东莞', year: 2026,
    social: {
      养老: { personal: 0.08, min: 4775, max: 27549 },
      医疗: {
        // 东莞：单费率 0.5%（单建统筹职工医保，个人 0.5%）
        personal: 0.005,
        baseMin: 4775, baseMax: 27549, fixed: 0
      },
      失业: { personal: 0.002, min: 2080, max: 27702 }
    },
    housingFund: { min: 2080, max: 27391, defaultRate: 0.08, fundMin: 0.05, fundMax: 0.12 },
    rentMonthly: 1100
  },

  // ===== 中山 =====
  zhongshan: {
    name: '中山', year: 2026,
    social: {
      养老: { personal: 0.08, min: 4775, max: 27549 },
      医疗: {
        // 中山：单费率 2%（统账结合职工医保，个人 2%）
        personal: 0.02,
        baseMin: 4250, baseMax: 21250, fixed: 0
      },
      失业: { personal: 0.002, min: 2080, max: 26298 }
    },
    housingFund: { min: 2080, max: 29430, defaultRate: 0.08, fundMin: 0.05, fundMax: 0.12 },
    rentMonthly: 1100
  },

  // ===== 珠海 =====
  zhuhai: {
    name: '珠海', year: 2026,
    social: {
      养老: { personal: 0.08, min: 4775, max: 27549 },
      医疗: {
        // 珠海：一档(统账结合) 1.5% / 二档(单建统筹) 0%（个人均不缴单位部分另计）
        personal: { '一档': 0.015, '二档': 0 },
        baseMin: 4775, baseMax: 27549, fixed: 0
      },
      失业: { personal: 0.002, min: 2080, max: 36279 }
    },
    housingFund: { min: 2080, max: 36279, defaultRate: 0.08, fundMin: 0.05, fundMax: 0.12 },
    rentMonthly: 1100
  }
}
