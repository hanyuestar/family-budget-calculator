// utils/format.js - 金额格式化工具

/**
 * 数字转千分位字符串
 * @param {number} num - 要格式化的数字
 * @returns {string} 千分位格式字符串，如 12345 → "12,345"
 */
function formatMoney(num) {
  if (num === null || num === undefined || isNaN(num)) return '0'
  // 处理小数部分
  var parts = String(num).split('.')
  var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  if (parts.length > 1) {
    return intPart + '.' + parts[1]
  }
  return intPart
}

/**
 * 保留1位小数
 * @param {number} num - 要格式化的数字
 * @returns {string} 保留1位小数的字符串，如 123.456 → "123.5"
 */
function formatWan(num) {
  if (num === null || num === undefined || isNaN(num)) return '0.0'
  return Number(num).toFixed(1)
}

module.exports = {
  formatMoney: formatMoney,
  formatWan: formatWan
}
