// 聚合回归入口：依次运行各套测试，汇总退出码。
// 用 process.execPath 跑子测试，保证与当前 node 版本一致（managed / system 皆可）。
// 任一子测试失败（exit != 0）→ 整体 exit(1)，便于 CI / npm test 判定。
const { spawnSync } = require('child_process')
const path = require('path')

// test_tarot：塔罗全量（数据/页面/出图/保存链路）
// test_all：6 个非塔罗工具全量（逻辑/按钮 E2E/常识校验/基建回归）
// test_buttons：按钮/事件绑定完整性 + 未覆盖页面点击模拟（首页/历史页/塔罗选牌页/calc-input）
var SUITES = ['test_tarot.js', 'test_all.js', 'test_buttons.js']
var node = process.execPath
var failedAny = false

SUITES.forEach(function (suite) {
  var file = path.join(__dirname, suite)
  console.log('\n' + '########## 运行 ' + suite + ' ##########')
  var r = spawnSync(node, [file], { stdio: 'inherit' })
  var code = (r.status === null) ? 1 : r.status
  if (code !== 0) {
    failedAny = true
    console.log('!!! ' + suite + ' 失败 (退出码 ' + code + ')')
  } else {
    console.log('✓ ' + suite + ' 通过')
  }
})

console.log('\n========== 全量回归: ' + (failedAny ? '有失败 ❌' : '全部通过 ✅') + ' ==========')
process.exit(failedAny ? 1 : 0)
