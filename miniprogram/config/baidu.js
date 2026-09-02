// config/baidu.js - 百度开放平台密钥（集中管理，避免遗忘）
// 原值复用自桌面 index.html（老道士算卦·今日吃什么），与项目历史一致。
//
// BAIDU_AK：浏览器端 AK（JS API / 地图显示用）。小程序前端未加载 BMap，
//           此处保留以完整复用桌面版参数；若后续接入百度地图组件可直用。
// PLACE_AK：服务端 AK（Place API v2 周边检索核心密钥，utils/lunch.js 的 placeSearch 使用）。
//
// ⚠️ 生产提示：PLACE_AK 属服务端密钥，前端明文存在有泄露/配额被盗用风险，
//    正式上线建议改为云函数代理转发（见桌面 README「方案二」），此处仅用于开发/早期灰度。
//    上线后请在百度开放平台单独管理 AK 配额与限额，并定期轮换。

module.exports = {
  BAIDU_AK: 'zRyVmh1WEqxoArLthTPYIY1OALLvBgQL',
  PLACE_AK: '4M6WO5N949XZjlbV36eZCp1Qv0mOvgVb'
}
