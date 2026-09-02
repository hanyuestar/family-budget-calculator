// utils/lunch.js - 「中午吃什么」纯逻辑层（移植自桌面 index.html 老道士算卦·今日吃什么）
// 百度密钥原值复用（与 index.html 顶部一致）；placeSearch 由 JSONP 改为 wx.request(output=json)。
// 仅剔除浏览器专属代码：BMap / bdSearch / loadBaiduMap / document / navigator.geolocation。
// 坐标转换严格两步（WGS84 -> GCJ02 -> BD09），避免一步近似导致 ~1km 偏移（见桌面 README）。

// ===== 百度密钥（集中管理于 config/baidu.js，原值复用 index.html）=====
var baiduKeys = require('../config/baidu.js')
var BAIDU_AK = baiduKeys.BAIDU_AK // 浏览器端 AK（JS API 用，小程序前端未加载 BMap，保留以完整复用参数）
var PLACE_AK = baiduKeys.PLACE_AK // 服务端 AK（Place API 核心检索）

// ===== 坐标转换 =====
function outOfChina(lat, lng) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}
function wgs2gcj(lat, lng) {
  var a = 6378245.0, ee = 0.00669342162296594323
  function tLat(x, y) {
    var ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
    ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3
    ret += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3
    ret += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3
    return ret
  }
  function tLng(x, y) {
    var ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
    ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3
    ret += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3
    ret += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3
    return ret
  }
  if (outOfChina(lat, lng)) return { lat: lat, lng: lng }
  var dLat = tLat(lng - 105, lat - 35), dLng = tLng(lng - 105, lat - 35)
  var radLat = lat / 180 * Math.PI, magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  var sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI)
  dLng = (dLng * 180) / (a / sqrtMagic * Math.cos(radLat) * Math.PI)
  return { lat: lat + dLat, lng: lng + dLng }
}
function gcj2bd(lat, lng) {
  var x = lng, y = lat
  var z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * Math.PI * 3000 / 180)
  var theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * Math.PI * 3000 / 180)
  return { lat: z * Math.sin(theta) + 0.006, lng: z * Math.cos(theta) + 0.0065 }
}
function wgs2bd(lat, lng) {
  var g = wgs2gcj(lat, lng)
  return gcj2bd(g.lat, g.lng)
}
function haversine(lat1, lng1, lat2, lng2) {
  var rlat1 = lat1 * Math.PI / 180, rlat2 = lat2 * Math.PI / 180
  var dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rlat1) * Math.cos(rlat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

// ===== 卦象系统 =====
var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
var WG = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水']
var WZ = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水']
var GUAS = [
  { name: '乾为天', symbol: '☰', wuxing: '金', direction: '西北', qianwen: '天行健，君子以自强不息', jieqian: '乾卦主刚健进取。今日阳气充盈，宜主动出击，不宜优柔寡断。西北方为贵地，往彼处行，或有奇遇。行事当如天之运转，刚健不息，自有贵人相助。', foodHint: '宜食精致料理、西餐，取金气精纯、品味高贵之意', tasteKeys: ['west', 'any'], budgetKey: 'pursuit' },
  { name: '坤为地', symbol: '☷', wuxing: '土', direction: '西南', qianwen: '地势坤，君子以厚德载物', jieqian: '坤卦主柔顺包容。今日宜沉稳内敛，不宜张扬冒进。西南方为福地，宜静不宜动。待人接物当如大地之宽厚，包容万物，自有福报。', foodHint: '宜食家常菜、粤式茶点，取土气敦厚、温润养胃之意', tasteKeys: ['yue', 'any', 'noodle'], budgetKey: 'live' },
  { name: '震为雷', symbol: '☳', wuxing: '木', direction: '正东', qianwen: '洊雷震，君子以恐惧修省', jieqian: '震卦主震动奋发。今日宜打破常规，不宜因循守旧。正东方为吉位，春雷一响万物复苏。当有惊人之举，或遇意外之喜。行事当果断决绝，不可犹豫。', foodHint: '宜食川菜、湘菜等重口味，取木气生发、辛辣振奋之意', tasteKeys: ['chuanxiang', 'any'], budgetKey: 'pursuit' },
  { name: '巽为风', symbol: '☴', wuxing: '木', direction: '东南', qianwen: '随风巽，君子以申命行事', jieqian: '巽卦主柔顺渗入。今日宜循序渐进，不宜急功近利。东南方为顺地，风行草偃，无孔不入。当以柔克刚，潜移默化中达成目标。', foodHint: '宜食日料、韩餐等清淡料理，取木气柔和、清新雅致之意', tasteKeys: ['jp', 'kr', 'any'], budgetKey: 'pursuit' },
  { name: '坎为水', symbol: '☵', wuxing: '水', direction: '正北', qianwen: '水洊至，习坎，君子以常德行', jieqian: '坎卦主险中求进。今日虽有小阻，但水能穿石，贵在坚持。正北方为智地，上善若水，润物无声。当以智慧化解困局，不可硬碰硬。', foodHint: '宜食火锅、汤面等汤水丰盈之物，取水气润泽、以柔克刚之意', tasteKeys: ['hotpot', 'noodle', 'any'], budgetKey: 'pursuit' },
  { name: '离为火', symbol: '☲', wuxing: '火', direction: '正南', qianwen: '明两作，离，大人以继明照于四方', jieqian: '离卦主光明热烈。今日宜热情奔放，不宜冷淡疏离。正南方为明位，日月丽天，普照四方。当展现才华，引人注目，自有伯乐赏识。', foodHint: '宜食烧烤、烤肉等火工料理，取火气旺盛、热烈奔放之意', tasteKeys: ['bbq', 'any', 'chuanxiang'], budgetKey: 'feast' },
  { name: '艮为山', symbol: '☶', wuxing: '土', direction: '东北', qianwen: '兼山艮，君子以思不出其位', jieqian: '艮卦主静止安稳。今日宜守不宜攻，宜静不宜动。东北方为稳地，高山仰止，岿然不动。当安守本分，不可妄动，静待时机成熟。', foodHint: '宜食面食、点心等朴实之物，取土气沉稳、朴实无华之意', tasteKeys: ['noodle', 'any', 'fast'], budgetKey: 'live' },
  { name: '兑为泽', symbol: '☱', wuxing: '金', direction: '正西', qianwen: '丽泽兑，君子以朋友讲习', jieqian: '兑卦主喜悦和乐。今日宜交友聚会，不宜独处自闭。正西方为悦地，泽润万物，和乐融融。当与亲友欢聚，谈笑风生，烦恼自消。', foodHint: '宜食泰式、东南亚等酸辣料理，取金气清肃、酸辣开胃之意', tasteKeys: ['sea', 'any', 'west'], budgetKey: 'pursuit' }
]
var fortuneCount = 0
function getDayGZ(d) {
  var b = new Date(1900, 0, 1), df = Math.floor((d - b) / 86400000)
  return {
    gan: GAN[((df % 10) + 10) % 10],
    zhi: ZHI[((df + 10) % 12 + 12) % 12],
    gi: ((df % 10) + 10) % 10,
    zi: ((df + 10) % 12 + 12) % 12
  }
}
function getYearGZ(d) {
  var y = d.getFullYear()
  return GAN[((y - 4) % 10 + 10) % 10] + ZHI[((y - 4) % 12 + 12) % 12] + '年'
}
function getYiJi(z) {
  var yi = [['祭祀', '祈福', '求嗣', '开光'], ['祭祀', '沐浴', '理发'], ['祭祀', '会亲友', '出行'], ['祭祀', '祈福', '纳财'], ['祭祀', '动土', '安床'], ['祭祀', '祈福', '出行'], ['祭祀', '祈福', '求嗣'], ['祭祀', '祈福', '纳财'], ['祭祀', '会亲友', '出行'], ['祭祀', '祈福', '开光'], ['祭祀', '沐浴', '扫舍'], ['祭祀', '祈福', '安葬']]
  var ji = [['开市', '动土', '安葬'], ['嫁娶', '开市', '入宅'], ['嫁娶', '开市', '交易'], ['动土', '破土', '安葬'], ['嫁娶', '开市', '出行'], ['动土', '安葬', '破土'], ['开市', '交易', '纳财'], ['嫁娶', '开市', '入宅'], ['动土', '破土', '安葬'], ['嫁娶', '开市', '交易'], ['开市', '动土', '入宅'], ['嫁娶', '开市', '出行']]
  return { yi: yi[z].slice(0, 3), ji: ji[z].slice(0, 3) }
}
function calculateGua(lat, lng) {
  var n = new Date(), dz = getDayGZ(n)
  var gi = (dz.gi % 5 + Math.floor(n.getHours() / 2) + (Math.floor(Math.abs(lat) * 100) + Math.floor(Math.abs(lng) * 100)) % 8 + fortuneCount * 3) % 8
  fortuneCount++
  return GUAS[gi]
}

// ===== 餐厅检索与筛选 =====
var GD = { any: 45, chuanxiang: 58, yue: 45, hotpot: 85, bbq: 65, noodle: 18, fast: 20, jp: 70, kr: 75, west: 120, burger: 22, sea: 72 }
var CUISINE_LABEL = { any: '家常百味', chuanxiang: '川湘辣味', yue: '粤式清淡', hotpot: '火锅', bbq: '烧烤', noodle: '面食粉类', fast: '简餐快餐', jp: '日式料理', kr: '韩式料理', west: '西餐', burger: '汉堡披萨', sea: '泰式东南亚' }

function isMega(lat, lng) {
  var cs = [{ lat: 39.9042, lng: 116.4074 }, { lat: 31.2304, lng: 121.4737 }, { lat: 23.1291, lng: 113.2644 }, { lat: 22.5431, lng: 114.0579 }]
  for (var i = 0; i < cs.length; i++) {
    if (Math.sqrt(Math.pow((lat - cs[i].lat) * 111, 2) + Math.pow((lng - cs[i].lng) * 111 * Math.cos(lat * Math.PI / 180), 2)) <= 8000) return true
  }
  return false
}
// 排除非餐饮 POI（共享充电宝/停车场/酒店/超市/银行等 200+ 词）
function isSingle(n) {
  var NO = ['星级', '大酒店', '宴会', '婚宴', '喜宴', '会所', '海鲜城', '放题', '自助餐', '国宴', '宫廷', '官府菜', '商务宴', '鲍鱼', '鱼翅', '燕窝', '会员制', '接待中心', '街电', '怪兽充电', '小电', '来电', '云充吧', '共享充电宝', '充电', '停车场', '停车位', '电梯', '扶梯', '卫生间', '洗手间', 'ATM', '自动取款', '入口', '出口', '大门', '小门', '侧门', '北门', '南门', '东门', '西门', '客服中心', '服务台', '咨询台', '收银台', '收款台', '快递柜', '丰巢', '菜鸟驿站', '快递点', '垃圾桶', '垃圾分类', '清洁间', '设备间', '机房', '消防通道', '安全出口', '紧急出口', '储物柜', '寄存处', '母婴室', '吸烟室', '休息区', '等候区', '排队区', '验票口', '检票口', '安检', '保安室', '门卫', '值班室', '监控室', '配电室', '水泵房', '空调机房', '锅炉房', '换热站', '变电站', '开闭所', '垃圾房', '污物间', '消毒间', '布草间', '员工通道', '员工入口', '卸货区', '收货区', '垃圾站', '污水处理', '化粪池', '隔油池', '排烟道', '通风井', '管道井', '强弱电井', '电缆井', '给水井', '排水井', '燃气井', '热力井', '通讯井', '有线电视', '宽带', '光纤', '网络', '电话', '手机', '电脑', '数码', '家电', '家具', '家居', '建材', '装修', '五金', '水暖', '电工', '照明', '灯具', '窗帘', '地毯', '地板', '瓷砖', '卫浴', '橱柜', '衣柜', '门窗', '楼梯', '吊顶', '涂料', '油漆', '服装', '服饰', '鞋帽', '箱包', '皮具', '皮革', '珠宝', '黄金', '钻石', '手表', '眼镜', '美容', '美发', '美甲', 'SPA', '健身房', '瑜伽', '舞蹈', '培训', '教育', '学校', '幼儿园', '早教', '兴趣班', '书店', '文具', '办公', '打印', '复印', '快递', '物流', '邮政', '银行', '证券', '保险', '营业厅', '网吧', 'KTV', '酒吧', '夜店', '俱乐部', '棋牌室', '彩票', '租车', '二手车', '房产', '中介', '物业', '旅行社', '机票', '火车票', '景点', '景区', '公园', '体育馆', '游泳馆', '图书馆', '博物馆', '展览馆', '电影院', '剧院', '剧场', '音乐厅', '游乐场', '游乐园', '动物园', '植物园', '海洋馆', '超市', '便利店', '水果店', '生鲜', '菜场', '农贸市场', '粮油', '调料', '药店', '药房', '医院', '诊所', '体检', '医疗', '摄影', '摄像', '婚庆', '礼仪', '主持', '演出', '汽车', '4S店', '汽修', '洗车', '加油站', '充电站', '物流园', '仓库', '工业园', '产业园', '科技中心', '研发中心', '商务中心', '写字楼', '办公楼', '大厦', '小区', '住宅', '公寓', '民宿', '旅馆', '宾馆', '酒店']
  for (var i = 0; i < NO.length; i++) if (n.indexOf(NO[i]) >= 0) return false
  if (n.indexOf('酒店') >= 0 && !/(餐|食|饭|面|粉|火锅|烤|快餐|小吃|馆|茶|粥|饺|包|料理|排档|渔|村)/.test(n)) return false
  return true
}
// 排除奶茶/甜品/咖啡/冰淇淋等饮品店
function isDrink(n) {
  var D = ['奶茶', '奶盖', '果茶', '柠檬茶', '喜茶', '奈雪', '蜜雪', '茶百道', '古茗', '沪上阿姨', '一点点', 'CoCo', '都可', '甜品', '蛋糕', '面包', '烘焙', '咖啡', '瑞幸', '星巴克', 'Manner', 'M Stand', '冰淇淋', '雪糕', '糖水', '双皮奶', '龟苓膏']
  for (var i = 0; i < D.length; i++) if (n.indexOf(D[i]) >= 0) return true
  return false
}
function classify(name, addr) {
  var n = name + ' ' + (addr || '')
  if (/川|湘|辣|麻辣|重庆|串串|酸菜鱼|毛血旺|冒菜|钵钵鸡|水煮鱼|剁椒/.test(n)) return 'chuanxiang'
  if (/粤|广式|茶点|早茶|烧腊|肠粉|煲仔|白切|老火汤|潮汕|潮州|汕头/.test(n)) return 'yue'
  if (/火锅|串串香|麻辣烫|冒菜|打边炉|猪肚鸡|椰子鸡|羊蝎子|牛蛙锅/.test(n)) return 'hotpot'
  if (/烧烤|烤肉|烤串|撸串|铁板烧|韩式烤肉|日式烧肉|炭火|串烧/.test(n)) return 'bbq'
  if (/面馆|面食|面条|面店|粉店|粉面|拉面|牛肉面|炸酱面|刀削面|米线|米粉|螺蛳粉|酸辣粉|云吞|馄饨|抄手|担担面|热干面|凉面|拌面|汤面|炒面|油泼面|臊子面|饸饹|重庆小面|兰州拉面|日式拉面/.test(n)) return 'noodle'
  if (/快餐|便当|盒饭|套餐|盖饭|盖浇|炒饭|炒粉|炒面|沙县|隆江|猪脚饭|黄焖鸡|真功夫|老乡鸡|乡村基|大米先生/.test(n)) return 'fast'
  if (/日|寿司|刺身|居酒屋|日式|天妇罗|鳗鱼|亲子丼|牛丼|和牛|怀石|料亭|一兰|一风堂|丸龟|筑地/.test(n)) return 'jp'
  if (/韩|韩式|韩国|石锅|拌饭|泡菜|部队锅|炸鸡|参鸡汤|年糕|紫菜包饭|大长今/.test(n)) return 'kr'
  if (/西餐|牛排|意面|披萨|比萨|三明治|热狗|意大利|法式|鹅肝|松露|惠灵顿|西餐厅|扒房/.test(n)) return 'west'
  if (/汉堡|burger|麦当劳|肯德基|KFC|汉堡王|华莱士|塔斯汀|赛百味|Subway|德克士/.test(n)) return 'burger'
  if (/泰|泰国|越南|东南亚|冬阴|咖喱|叻沙|肉骨茶|海南鸡|娘惹|暹罗|曼谷|河内|西贡/.test(n)) return 'sea'
  return 'any'
}

// placeSearch：小程序用 wx.request 替代 JSONP（output=json）
function placeSearch(query, lat, lng, radius, pageNum) {
  return new Promise(function (resolve) {
    wx.request({
      url: 'https://api.map.baidu.com/place/v2/search',
      data: {
        query: query,
        location: lat + ',' + lng,
        radius: radius,
        output: 'json',
        ak: PLACE_AK,
        page_size: 20,
        page_num: pageNum || 0,
        scope: 2
      },
      success: function (res) { resolve(res && res.data ? res.data : null) },
      fail: function () { resolve(null) }
    })
  })
}

function fetchRests(lat, lng, tk, bk) {
  return new Promise(function (resolve) {
    var bd = wgs2bd(lat, lng)
    var allPois = {}
    var KWS = ['美食', '快餐', '小吃', '川菜', '湘菜', '粤菜', '火锅', '烧烤', '面馆', '日料', '韩餐', '西餐', '汉堡', '东南亚']
    var RADII = [500, 1000, 2000, 3000, 5000]
    function searchRadius(idx) {
      if (idx >= RADII.length) { finish(); return }
      var radius = RADII[idx]
      var promises = KWS.map(function (kw) {
        return placeSearch(kw, bd.lat, bd.lng, radius, 0).then(function (data) {
          if (data && data.results && data.results.length) {
            data.results.forEach(function (p) {
              if (p.name && p.location) {
                var key = p.name + '_' + p.location.lat.toFixed(4) + '_' + p.location.lng.toFixed(4)
                if (!allPois[key]) {
                  var d = haversine(bd.lat, bd.lng, p.location.lat, p.location.lng)
                  allPois[key] = {
                    name: p.name, address: p.address || '', dist: d, telephone: p.telephone || '',
                    tag: p.detail_info && p.detail_info.tag ? p.detail_info.tag : '',
                    price: p.detail_info && p.detail_info.price ? p.detail_info.price : null,
                    rating: p.detail_info && p.detail_info.overall_rating ? p.detail_info.overall_rating : null
                  }
                }
              }
            })
          }
        })
      })
      Promise.all(promises).then(function () {
        var cnt = 0
        for (var k in allPois) {
          var p = allPois[k]
          if (p.dist <= radius && isSingle(p.name) && !isDrink(p.name)) cnt++
        }
        if (cnt >= 8) finish(); else searchRadius(idx + 1)
      })
    }
    function finish() {
      var rests = []
      for (var k in allPois) {
        var p = allPois[k]
        if (!isSingle(p.name) || isDrink(p.name)) continue
        if (p.dist > 5000) continue
        var grp = classify(p.name, p.address)
        var price = p.price || GD[grp] || 45
        rests.push({ name: p.name, grp: grp, price: price, dist: p.dist, address: p.address, phone: p.telephone, rating: p.rating, tag: p.tag })
      }
      rests.sort(function (a, b) { return (a.dist || 99999) - (b.dist || 99999) })
      resolve(rests)
    }
    searchRadius(0)
  })
}

var pickedNames = []
function pickRest(rests, gua) {
  var sorted = rests.slice().sort(function (a, b) { return (a.dist || 99999) - (b.dist || 99999) })
  var layers = [500, 1000, 2000, 3000, 5000]
  for (var li = 0; li < layers.length; li++) {
    var layer = sorted.filter(function (r) { return (r.dist || 99999) <= layers[li] })
    if (layer.length < 3) continue
    var m = layer.filter(function (r) { return gua.tasteKeys.indexOf(r.grp) >= 0 })
    var pool = (m.length >= 3) ? m : layer
    var uniq = pool.filter(function (r) { return pickedNames.indexOf(r.name) < 0 })
    if (uniq.length === 0) { pickedNames = []; uniq = pool }
    var cs = uniq.slice(0, Math.min(10, uniq.length))
    var pick = cs[Math.floor(Math.random() * cs.length)]
    pickedNames.push(pick.name)
    return pick
  }
  var m = sorted.filter(function (r) { return gua.tasteKeys.indexOf(r.grp) >= 0 })
  var pool = (m.length >= 3) ? m : sorted
  var uniq = pool.filter(function (r) { return pickedNames.indexOf(r.name) < 0 })
  if (uniq.length === 0) { pickedNames = []; uniq = pool }
  var cs = uniq.slice(0, Math.min(10, uniq.length))
  var pick = cs[Math.floor(Math.random() * cs.length)]
  pickedNames.push(pick.name)
  return pick
}

// ===== 展示层打包（给页面直接 setData）=====
function formatDist(d) {
  if (d == null) return '距离未知'
  return d < 1000 ? d + '米' : (d / 1000).toFixed(1) + '公里'
}
function packGua(g) {
  return { name: g.name, symbol: g.symbol, wuxing: g.wuxing, direction: g.direction, qianwen: g.qianwen, jieqian: g.jieqian, foodHint: g.foodHint }
}
function packRest(r) {
  if (!r) return null
  return {
    name: r.name, grp: r.grp, grpLabel: CUISINE_LABEL[r.grp] || '家常百味',
    price: r.price, distText: formatDist(r.dist), address: r.address || '', phone: r.phone || '', tag: r.tag || ''
  }
}
function packHuangli() {
  var n = new Date(), dz = getDayGZ(n), yz = getYearGZ(n), wx = WG[dz.gi] + WZ[dz.zi], yj = getYiJi(dz.zi)
  var ds = (n.getMonth() + 1) + '月' + n.getDate() + '日'
  var ws = ['日', '一', '二', '三', '四', '五', '六'][n.getDay()]
  return { date: ds, week: '周' + ws, yearGZ: yz, dayGZ: dz.gan + dz.zhi + '日', wuxing: wx, yi: yj.yi.join(' '), ji: yj.ji.join(' ') }
}

// 编排：算卦 + 检索 + 选店，返回展示就绪对象
function fortune(userLoc) {
  return new Promise(function (resolve) {
    var gua = calculateGua(userLoc.lat, userLoc.lng)
    fetchRests(userLoc.lat, userLoc.lng, gua.tasteKeys, gua.budgetKey).then(function (rests) {
      if (!rests || rests.length === 0) {
        fetchRests(userLoc.lat, userLoc.lng, ['any'], 'pursuit').then(function (r2) {
          if (!r2 || r2.length === 0) {
            resolve({ gua: packGua(gua), rest: null, huangli: packHuangli(), noRest: true })
          } else {
            var rest = pickRest(r2, gua)
            resolve({ gua: packGua(gua), rest: packRest(rest), huangli: packHuangli(), noRest: false })
          }
        })
      } else {
        var rest = pickRest(rests, gua)
        resolve({ gua: packGua(gua), rest: packRest(rest), huangli: packHuangli(), noRest: false })
      }
    })
  })
}

module.exports = {
  BAIDU_AK: BAIDU_AK,
  PLACE_AK: PLACE_AK,
  CUISINE_LABEL: CUISINE_LABEL,
  fortune: fortune,
  // 调试/单测可直连的纯函数
  wgs2bd: wgs2bd,
  calculateGua: calculateGua,
  classify: classify,
  isSingle: isSingle,
  packHuangli: packHuangli
}
