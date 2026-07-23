// 聚合回归入口：依次运行两套测试，汇总退出码。
// 用 process.execPath 跑子测试，保证与当前 node 版本一致（managed / system 皆可）。
// 任一子测试失败（exit != 0）→ 整体 exit(1)，便于 CI / npm test 判定。
const { spawnSync } = require('child_process')
const path = require('path')

var SUITES = ['test_tarot.js', 'test_all.js']
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
