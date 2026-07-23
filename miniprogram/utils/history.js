// utils/history.js - 本地历史记录存储层
// 所有工具页计算完成后自动调用 add() 留痕，首页预览 + 历史页查改。
var KEY = 'tool_history'
var MAX = 100       // 普通记录上限（超限 FIFO 淘汰）
var MAX_S = 30      // 收藏记录上限

function all() {
  try { return wx.getStorageSync(KEY) || [] }
  catch (_) { return [] }
}

function save(list) {
  wx.setStorageSync(KEY, list)
}

// 生成简单 ID
function uid() {
  return 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
}

/**
 * 添加一条历史
 * @param {string} toolId   - 对应 config.tools[].id
 * @param {string} toolName - 工具名
 * @param {string} toolIcon - 工具 icon
 * @param {object} input    - 输入快照（回显用，不存计算结果）
 * @param {string} summary  - 结果摘要（卡片上显示的一行文字）
 */
function add(toolId, toolName, toolIcon, input, summary) {
  var list = all()
  list.unshift({
    id: uid(),
    toolId: toolId,
    toolName: toolName,
    toolIcon: toolIcon,
    input: input,
    summary: summary,
    ts: Date.now(),
    star: false
  })
  // FIFO 淘汰
  while (list.length > MAX) list.pop()
  // 收藏数不超过 MAX_S
  var starred = 0
  for (var i = 0; i < list.length; i++) {
    if (list[i].star) starred++
  }
  while (starred > MAX_S) {
    for (var j = list.length - 1; j >= 0; j--) {
      if (list[j].star) { list.splice(j, 1); starred--; break }
    }
  }
  save(list)
}

// 获取全部（收藏置顶，其余按时间倒序）
function getAll() {
  var list = all()
  var stars = [], normal = []
  for (var i = 0; i < list.length; i++) {
    if (list[i].star) stars.push(list[i]); else normal.push(list[i])
  }
  return stars.concat(normal)
}

// 按工具筛选
function getByTool(toolId) {
  var list = getAll()
  return list.filter(function (item) { return item.toolId === toolId })
}

// 获取最新 N 条（首页预览用）
function getLatest(n) {
  n = n || 3
  var list = all()
  var result = []
  for (var i = 0; i < list.length && result.length < n; i++) {
    result.push(list[i])
  }
  return result
}

// 切换收藏
function star(id) {
  var list = all()
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      list[i].star = !list[i].star
      break
    }
  }
  save(list)
}

// 删除单条
function remove(id) {
  var list = all()
  list = list.filter(function (item) { return item.id !== id })
  save(list)
}

// 清除非收藏
function clear() {
  var list = all()
  list = list.filter(function (item) { return item.star })
  save(list)
}

module.exports = { add: add, getAll: getAll, getByTool: getByTool, getLatest: getLatest, star: star, remove: remove, clear: clear }
