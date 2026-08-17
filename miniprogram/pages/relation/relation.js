// pages/relation/relation.js - 亲戚关系计算器
// 玩法：从「我」出发，点选关系按钮，拼出关系链，引擎先做路径归约再查表出称呼。
// 五级关系覆盖 + 绕路归约（平辈归约/姻亲归约/亲子互消）+ 年龄选择（堂兄/堂弟 等）
// 增强版：新增姻亲基础、祖辈+子女、五代直系、子女配偶、亲子互消归约

var calcPage = require('../../behaviors/calc-page.js')
var report = require('../../utils/report.js')

// 按钮（UI展示）
var STEP_WORD = {
  '父': '爸爸', '母': '妈妈', '夫': '老公', '妻': '老婆',
  '子': '儿子', '女': '女儿', '兄': '哥哥', '弟': '弟弟',
  '姐': '姐姐', '妹': '妹妹'
}

function ageBoth(older, younger) {
  return { older: older, younger: younger, needAge: true }
}
function s(term) {
  return { term: term, needAge: false }
}
function isPar(k) { return k === '父' || k === '母' }
function isChi(k) { return k === '子' || k === '女' }

// ============ LOOKUP 表 ============
var LOOKUP = {
  // ── L1：直接原子关系 ──
  '父': s('爸爸'),
  '母': s('妈妈'),
  '夫': s('老公（丈夫）'),
  '妻': s('老婆（妻子）'),
  '子': s('儿子'),
  '女': s('女儿'),
  '兄': s('哥哥'),
  '弟': s('弟弟'),
  '姐': s('姐姐'),
  '妹': s('妹妹'),

  // ── L2：直系二代 ──
  '父,父': s('爷爷（祖父）'),
  '父,母': s('奶奶（祖母）'),
  '母,父': s('姥爷/外公（外祖父）'),
  '母,母': s('姥姥/外婆（外祖母）'),

  // ── L2：父母的兄弟姐妹 ──
  '父,兄': s('大伯/伯父'),
  '父,弟': s('叔叔/叔父'),
  '父,姐': s('姑妈/大姑'),
  '父,妹': s('姑姑/小姑'),
  '母,兄': s('舅舅'),
  '母,弟': s('舅舅'),
  '母,姐': s('姨妈/大姨'),
  '母,妹': s('姨妈/小姨'),

  // ── L2：兄弟姐妹的子女（侄/甥） ──
  '兄,子': s('侄子'),
  '兄,女': s('侄女'),
  '弟,子': s('侄子'),
  '弟,女': s('侄女'),
  '姐,子': s('外甥'),
  '姐,女': s('外甥女'),
  '妹,子': s('外甥'),
  '妹,女': s('外甥女'),

  // ── L2（R5）：子女配偶 ──
  '子,妻': s('儿媳'),
  '女,夫': s('女婿'),

  // ── L2（R3）：姻亲基础 ──
  '妻,父': s('岳父'),
  '妻,母': s('岳母'),
  '夫,父': s('公公'),
  '夫,母': s('婆婆'),
  '妻,兄': ageBoth('大舅子', '小舅子'),
  '妻,弟': ageBoth('大舅子', '小舅子'),
  '妻,姐': ageBoth('大姨子', '小姨子'),
  '妻,妹': ageBoth('大姨子', '小姨子'),
  '夫,兄': ageBoth('大伯子', '小叔子'),
  '夫,弟': ageBoth('大伯子', '小叔子'),
  '夫,姐': ageBoth('大姑子', '小姑子'),
  '夫,妹': ageBoth('大姑子', '小姑子'),

  // ── L2：兄弟姐妹的配偶 ──
  '弟,妻': s('弟妹/弟媳'),
  '兄,妻': s('嫂子'),
  '姐,夫': s('姐夫'),
  '妹,夫': s('妹夫'),

  // ── L3：直系三代往上 ──
  '父,父,父': s('曾祖父/太爷爷'),
  '父,父,母': s('曾祖母/太奶奶'),
  '父,母,父': s('外曾祖父'),
  '父,母,母': s('外曾祖母'),
  '母,父,父': s('外曾祖父'),
  '母,父,母': s('外曾祖母'),
  '母,母,父': s('外曾祖父'),
  '母,母,母': s('外曾祖母'),

  // ── L3：直系三代往下 ──
  '子,子': s('孙子'),
  '子,女': s('孙女'),
  '女,子': s('外孙'),
  '女,女': s('外孙女'),
  '子,子,子': s('曾孙'),
  '子,子,女': s('曾孙女'),
  '女,子,子': s('外曾孙'),
  '女,子,女': s('外曾孙女'),

  // ── L3（R2）：祖辈+子女 ──
  '父,父,子': ageBoth('伯父', '叔父'),
  '父,父,女': s('姑母（姑姑）'),
  '父,母,子': s('舅父（舅舅）'),
  '父,母,女': s('姨母（姨妈）'),
  '母,父,子': s('舅父（舅舅）'),
  '母,父,女': s('姨母（姨）'),
  '母,母,子': s('舅父（舅舅）'),
  '母,母,女': s('姨母（姨）'),

  // ── L3（补表）：常见三步/归约链 ──
  '父,子,子': s('孙子'),
  '父,子,女': s('孙女'),
  '母,子,子': s('外孙'),
  '母,子,女': s('外孙女'),
  '父,女,子': s('外孙'),
  '父,女,女': s('外孙女'),
  '母,女,子': s('外孙'),
  '母,女,女': s('外孙女'),
  '兄,妻,子': s('侄子'),
  '兄,妻,女': s('侄女'),
  '弟,妻,子': s('侄子'),
  '弟,妻,女': s('侄女'),
  '姐,夫,子': s('外甥'),
  '姐,夫,女': s('外甥女'),
  '妹,夫,子': s('外甥'),
  '妹,夫,女': s('外甥女'),
  '妹,子,夫': s('外甥女婿'),
  '姐,子,夫': s('外甥女婿'),

  // ── 手足+配偶子/女的父母视角链 ──
  '父,子,子': s('孙子'),
  '父,子,女': s('孙女'),
  '母,子,子': s('外孙'),
  '母,子,女': s('外孙女'),
  '父,女,子': s('外孙'),
  '父,女,女': s('外孙女'),
  '母,女,子': s('外孙'),
  '母,女,女': s('外孙女'),

  // ── 手足+配偶+子女 ──
  '兄,妻,子': s('侄子'),
  '兄,妻,女': s('侄女'),
  '弟,妻,子': s('侄子'),
  '弟,妻,女': s('侄女'),
  '姐,夫,子': s('外甥'),
  '姐,夫,女': s('外甥女'),
  '妹,夫,子': s('外甥'),
  '妹,夫,女': s('外甥女'),
  '妹,子,夫': s('外甥女婿'),
  '姐,子,夫': s('外甥女婿'),

  // ── 常见三步链补表 ──
  '父,子,子': s('孙子'),
  '父,子,女': s('孙女'),
  '母,子,子': s('外孙'),
  '母,子,女': s('外孙女'),
  '父,女,子': s('外孙'),
  '父,女,女': s('外孙女'),
  '母,女,子': s('外孙'),
  '母,女,女': s('外孙女'),

  // ── 手足+配偶+子女 ──
  '兄,妻,子': s('侄子'),
  '兄,妻,女': s('侄女'),
  '弟,妻,子': s('侄子'),
  '弟,妻,女': s('侄女'),
  '姐,夫,子': s('外甥'),
  '姐,夫,女': s('外甥女'),
  '妹,夫,子': s('外甥'),
  '妹,夫,女': s('外甥女'),

  '妹,子,夫': s('外甥女婿'),
  '姐,子,夫': s('外甥女婿'),

  // ── 常见三步链补表（归约后仍需 LOOKUP）──
  '父,子,子': s('孙子'),
  '父,子,女': s('孙女'),
  '母,子,子': s('外孙'),
  '母,子,女': s('外孙女'),
  '父,女,子': s('外孙'),
  '父,女,女': s('外孙女'),
  '母,女,子': s('外孙'),
  '母,女,女': s('外孙女'),
  '子,女,子': s('外孙'),
  '子,女,女': s('外孙女'),
  '女,女,子': s('外曾孙'),
  '女,女,女': s('外曾孙女'),

  // ── 手足+配偶+子女 ──
  '兄,妻,子': s('侄子'),
  '兄,妻,女': s('侄女'),
  '弟,妻,子': s('侄子'),
  '弟,妻,女': s('侄女'),
  '姐,夫,子': s('外甥'),
  '姐,夫,女': s('外甥女'),
  '妹,夫,子': s('外甥'),
  '妹,夫,女': s('外甥女'),
  '妹,子,夫': s('外甥女婿'),
  '姐,子,夫': s('外甥女婿'),

  // ── L3：堂/表（父系兄弟的孩子 = 堂，其余 = 表）──
  '父,兄,子': ageBoth('堂哥', '堂弟'),
  '父,兄,女': ageBoth('堂姐', '堂妹'),
  '父,弟,子': ageBoth('堂哥', '堂弟'),
  '父,弟,女': ageBoth('堂姐', '堂妹'),
  '父,姐,子': ageBoth('表哥', '表弟'),
  '父,姐,女': ageBoth('表姐', '表妹'),
  '父,妹,子': ageBoth('表哥', '表弟'),
  '父,妹,女': ageBoth('表姐', '表妹'),
  '母,兄,子': ageBoth('表哥', '表弟'),
  '母,兄,女': ageBoth('表姐', '表妹'),
  '母,弟,子': ageBoth('表哥', '表弟'),
  '母,弟,女': ageBoth('表姐', '表妹'),
  '母,姐,子': ageBoth('表哥', '表弟'),
  '母,姐,女': ageBoth('表姐', '表妹'),
  '母,妹,子': ageBoth('表哥', '表弟'),
  '母,妹,女': ageBoth('表姐', '表妹'),

  // ── L3：祖辈的兄弟姐妹 ──
  '父,父,兄': s('伯祖父/大爷爷'),
  '父,父,弟': s('叔祖父/幺爷爷'),
  '父,父,姐': s('姑奶奶'),
  '父,父,妹': s('姑奶奶'),
  '父,母,兄': s('舅公/舅爷（奶奶的哥哥）'),
  '父,母,弟': s('舅公/舅爷（奶奶的弟弟）'),
  '父,母,姐': s('姨奶奶/姨婆（奶奶的姐姐）'),
  '父,母,妹': s('姨奶奶/姨婆（奶奶的妹妹）'),
  '母,父,兄': s('伯姥爷/大姥爷（姥爷的哥哥）'),
  '母,父,弟': s('叔姥爷/幺姥爷（姥爷的弟弟）'),
  '母,父,姐': s('姑姥姥（姥爷的姐姐）'),
  '母,父,妹': s('姑姥姥（姥爷的妹妹）'),
  '母,母,兄': s('舅姥爷'),
  '母,母,弟': s('舅姥爷'),
  '母,母,姐': s('姨姥姥'),
  '母,母,妹': s('姨姥姥'),

  // ── L3：兄弟姐妹的孙辈 ──
  '兄,子,子': s('侄孙'),
  '兄,子,女': s('侄孙女'),
  '兄,女,子': s('外甥孙'),
  '兄,女,女': s('外甥孙女'),
  '弟,子,子': s('侄孙'),
  '弟,子,女': s('侄孙女'),
  '弟,女,子': s('外甥孙'),
  '弟,女,女': s('外甥孙女'),
  '姐,子,子': s('外甥孙'),
  '姐,子,女': s('外甥孙女'),
  '姐,女,子': s('外甥孙'),
  '姐,女,女': s('外甥孙女'),
  '妹,子,子': s('外甥孙'),
  '妹,子,女': s('外甥孙女'),
  '妹,女,子': s('外甥孙'),
  '妹,女,女': s('外甥孙女'),

  // ── L3：堂/表伯叔（祖辈兄弟的子女）──
  '父,父,兄,子': s('堂伯/堂叔'),
  '父,父,兄,女': s('堂姑'),
  '父,父,弟,子': s('堂伯/堂叔'),
  '父,父,弟,女': s('堂姑'),
  '父,父,姐,子': s('表伯/表叔（姑奶奶的儿子）'),
  '父,父,姐,女': s('表姑（姑奶奶的女儿）'),
  '父,父,妹,子': s('表伯/表叔（姑奶奶的儿子）'),
  '父,父,妹,女': s('表姑（姑奶奶的女儿）'),
  // 奶奶的兄弟姐妹的子女
  '父,母,兄,子': s('表伯/表叔（舅爷的儿子）'),
  '父,母,兄,女': s('表姑（舅爷的女儿）'),
  '父,母,弟,子': s('表伯/表叔（舅爷的儿子）'),
  '父,母,弟,女': s('表姑（舅爷的女儿）'),
  '父,母,姐,子': s('表伯/表叔（姨婆的儿子）'),
  '父,母,姐,女': s('表姑（姨婆的女儿）'),
  '父,母,妹,子': s('表伯/表叔（姨婆的儿子）'),
  '父,母,妹,女': s('表姑（姨婆的女儿）'),
  // 姥爷的兄弟姐妹的子女
  '母,父,兄,子': s('表伯/表叔（伯姥爷的儿子）'),
  '母,父,兄,女': s('表姑（伯姥爷的女儿）'),
  '母,父,弟,子': s('表伯/表叔（叔姥爷的儿子）'),
  '母,父,弟,女': s('表姑（叔姥爷的女儿）'),
  '母,父,姐,子': s('表舅/表姨（姑姥姥的儿子）'),
  '母,父,姐,女': s('表姨（姑姥姥的女儿）'),
  '母,父,妹,子': s('表舅/表姨（姑姥姥的儿子）'),
  '母,父,妹,女': s('表姨（姑姥姥的女儿）'),
  // ── 表舅/表姨（舅姥爷/姨姥姥的子女）──
  '母,母,兄,子': s('表舅（舅姥爷的儿子）'),
  '母,母,兄,女': s('表姨（舅姥爷的女儿）'),
  '母,母,弟,子': s('表舅（舅姥爷的儿子）'),
  '母,母,弟,女': s('表姨（舅姥爷的女儿）'),
  '母,母,姐,子': s('表舅（姨姥姥的儿子）'),
  '母,母,姐,女': s('表姨（姨姥姥的女儿）'),
  '母,母,妹,子': s('表舅（姨姥姥的儿子）'),
  '母,母,妹,女': s('表姨（姨姥姥的女儿）'),

  // ── L4：堂兄/表兄的子女 ──
  '父,兄,子,子': s('堂侄'),
  '父,兄,子,女': s('堂侄女'),
  '父,弟,子,子': s('堂侄'),
  '父,弟,子,女': s('堂侄女'),
  '父,姐,子,子': s('表侄'),
  '父,姐,子,女': s('表侄女'),
  '父,妹,子,子': s('表侄'),
  '父,妹,子,女': s('表侄女'),
  '母,兄,子,子': s('表侄'),
  '母,兄,子,女': s('表侄女'),
  '母,兄,女,子': s('表外甥'),
  '母,兄,女,女': s('表外甥女'),
  '母,弟,子,子': s('表侄'),
  '母,弟,子,女': s('表侄女'),
  '母,弟,女,子': s('表外甥'),
  '母,弟,女,女': s('表外甥女'),
  '母,姐,子,子': s('表侄'),
  '母,姐,子,女': s('表侄女'),
  '母,姐,女,子': s('表外甥'),
  '母,姐,女,女': s('表外甥女'),
  '母,妹,子,子': s('表侄'),
  '母,妹,子,女': s('表侄女'),
  '母,妹,女,子': s('表外甥'),
  '母,妹,女,女': s('表外甥女'),

  // ── L4：直系第四代 ──
  '父,父,父,父': s('高祖父/太高爷爷'),
  '母,母,母,母': s('外高祖母'),
  '母,母,母,父': s('外高祖父'),
  '子,子,子,子': s('玄孙'),
  '女,女,子,子': s('玄外孙'),

  // ── L4（R4扩展）：五代直系补充 ──
  '女,女,女,女': s('外玄孙女'),

  // ── L4：远堂亲 ──
  '父,父,兄,子,子': ageBoth('族兄/远堂哥', '族弟/远堂弟'),
  '父,父,兄,子,女': ageBoth('族姐/远堂姐', '族妹/远堂妹'),
  '父,父,弟,子,子': ageBoth('族兄/远堂哥', '族弟/远堂弟'),
  '父,父,弟,子,女': ageBoth('族姐/远堂姐', '族妹/远堂妹'),

  // ── L5（R4扩展）：五代直系往下 ──
  '子,子,子,子,子': s('来孙'),
  '子,子,子,女,女': s('来孙女'),
  '女,女,女,女,女': s('外来孙女'),
  '女,女,女,女,子': s('外来孙'),

  // ── L5（R4扩展）：五代直系往上 ──
  '父,父,父,父,母': s('高祖母'),
  '父,父,父,父,父': s('天祖父'),
  '父,父,父,母,母': s('天祖母'),
  '母,母,母,母,母': s('外天祖母'),
  '母,母,母,母,父': s('外天祖父'),

  // ── L3/L4：长辈配偶（伯母、舅妈、姑父等地道称呼）──
  '父,兄,妻': s('伯母'),
  '父,弟,妻': s('婶婶/婶娘'),
  '父,姐,夫': s('姑父/姑丈'),
  '父,妹,夫': s('姑父/姑丈'),
  '母,兄,妻': s('舅妈/舅母'),
  '母,弟,妻': s('舅妈/舅母'),
  '母,姐,夫': s('姨父/姨丈'),
  '母,妹,夫': s('姨父/姨丈'),
  '父,父,兄,妻': s('伯祖母/伯婆'),
  '父,父,弟,妻': s('叔祖母/婶婆'),
  '父,父,姐,夫': s('姑祖父/姑公'),
  '父,父,妹,夫': s('姑祖父/姑公'),
  '父,母,兄,妻': s('舅婆'),
  '父,母,弟,妻': s('舅婆'),
  '父,母,姐,夫': s('姨祖父/姨公'),
  '父,母,妹,夫': s('姨祖父/姨公'),
  '母,父,兄,妻': s('伯姥姥'),
  '母,父,弟,妻': s('叔姥姥'),
  '母,父,姐,夫': s('姑姥爷'),
  '母,父,妹,夫': s('姑姥爷'),
  '母,母,兄,妻': s('舅姥姥'),
  '母,母,弟,妻': s('舅姥姥'),
  '母,母,姐,夫': s('姨姥爷'),
  '母,母,妹,夫': s('姨姥爷'),

  // ── 姻亲深层 ──
  '夫,父,母': s('婆婆的母亲（丈夫的姥姥）'),
  '妻,父,母': s('岳母的母亲（妻子的姥姥）'),
}

// 绕路归约的特殊 2 步映射（R6：保持不变）
var L1_OVERRIDE = {
  '母,夫': s('爸爸'),
  '父,妻': s('妈妈'),
}

// ============ 归约引擎 ============
function isSib(k) { return k === '兄' || k === '弟' || k === '姐' || k === '妹' }

function reduceChain(chain) {
  while (true) {
    if (chain.length < 2) return chain
    var reduced = false
    for (var i = chain.length - 2; i >= 0; i--) {
      var a = chain[i], b = chain[i + 1]
      var pair = a + ',' + b
      var newSeg = null

      // ===== 三步前瞻规则（必须在两步规则之前）=====

      // 3a. 父/母,子/女,父/母 → 后面的父/母
      if (isPar(a) && isChi(b) && i + 2 < chain.length) {
        var dc = chain[i + 2]
        if (dc === '父' || dc === '母') {
          chain.splice(i, 3, dc)
          reduced = true; break
        }
      }

      // 3b. 侄/甥的父母 = 自己的兄弟姐妺
      else if (isSib(a) && isChi(b) && i + 2 < chain.length) {
        var c = chain[i + 2]
        if (c === '父') {
          if (a === '兄' || a === '弟') { chain.splice(i, 3, a) }
          else { chain.splice(i, 3, a, '夫') }
          reduced = true; break
        } else if (c === '母') {
          if (a === '姐' || a === '妹') { chain.splice(i, 3, a) }
          else { chain.splice(i, 3, a, '妻') }
          reduced = true; break
        }
      }

      // 3c. 子女,子女,父/母 → 子女（孙/外孙的父母）
      else if (isChi(a) && isChi(b) && i + 2 < chain.length) {
        var d = chain[i + 2]
        if (d === '父' || d === '母') {
          chain.splice(i, 3, a)
          reduced = true; break
        }
      }

      // ===== 两步规则 =====

      // R1a. 子女+父母 → 消去，但若与前一元素形成三步前瞻则跳过
      //   例：弟,女,母 中 女,母 不能消去（应走 3b → 弟,妻）
      else if (isChi(a) && isPar(b)) {
        if (i > 0) {
          var prev = chain[i - 1]
          // 检查是否形成三步前瞻：前辈+子女+父母 或 手足+子女+父母
          if ((isPar(prev) || isSib(prev)) && isChi(a) && isPar(b)) {
            // 跳过 — 由外层三步前瞻规则在 i-1 处处理
          } else {
            newSeg = ''
          }
        } else {
          newSeg = ''
        }
      }

      // R1b. 父母+子女 仅链长=2（避免 父,父,子 → 父 误归约）
      else if (chain.length === 2 && isPar(a) && isChi(b)) { newSeg = '' }

      // 绕路归约：母,夫 → 父 | 父,妻 → 母
      else if (pair === '母,夫') { newSeg = '父' }
      else if (pair === '父,妻') { newSeg = '母' }

      // 夫妻互消
      else if (pair === '夫,妻' || pair === '妻,夫') { newSeg = '' }

      // 配偶的子女 = 自己的子女
      else if ((a === '夫' || a === '妻') && isChi(b)) { newSeg = b }

      // 兄弟姐妹的父母 = 自己的父母
      else if (isSib(a) && isPar(b)) { newSeg = b }

      // 孩子的兄弟姐妹 = 还是我的孩子
      else if (isChi(a) && (b === '兄' || b === '弟')) { newSeg = '子' }
      else if (isChi(a) && (b === '姐' || b === '妹')) { newSeg = '女' }

      // 兄弟姐妹的兄弟姐妹 = 还是兄弟姐妹
      else if (isSib(a) && isSib(b)) { newSeg = b }

      if (newSeg !== null) {
        if (newSeg === '') { chain.splice(i, 2) }
        else { chain.splice(i, 2, newSeg) }
        reduced = true
        break
      }
    }
    if (!reduced) break
  }
  return chain
}

// ============ 主解析函数 ============
function resolveRelation(chain) {
  if (!chain || !chain.length) return { term: '', ok: true, needAge: false }

  // 路径归约（先归约，再检查长度）
  var reduced = reduceChain(chain.slice())

  // 归约后仍超 5 级 → 不支持
  if (reduced.length > 5) {
    return { term: '', ok: false, needAge: false, notSupported: true }
  }

  // 归约后为空 = 回到了自己
  if (reduced.length === 0) return { term: '自己', ok: true, needAge: false }

  // 归约后 1 步 → 直接查 LOOKUP（不能递归，会死循环）
  if (reduced.length === 1) {
    var key1 = reduced[0]
    if (LOOKUP[key1]) {
      return { term: LOOKUP[key1].term, ok: true, needAge: false }
    }
    return { term: '', ok: false, needAge: false, notSupported: true }
  }

  // 先查原始 2 步链是否在 L1_OVERRIDE
  if (chain.length === 2) {
    var rawKey = chain.join(',')
    if (L1_OVERRIDE[rawKey]) {
      return { term: L1_OVERRIDE[rawKey].term, ok: true, needAge: false }
    }
  }

  // 查表
  var key = reduced.join(',')
  var entry = LOOKUP[key]

  if (entry) {
    if (typeof entry === 'string' || (typeof entry === 'object' && entry.term)) {
      return { term: entry.term || entry, ok: true, needAge: false }
    }
    if (entry.needAge) {
      return { term: null, ok: true, needAge: true, ageOptions: { older: entry.older, younger: entry.younger } }
    }
  }

  // 建议 C：不符合传统亲属逻辑的链（先检查，再派生，防止母+妻、父+夫等被误派生）
  var reason = checkInvalid(reduced)
  if (reason) {
    return { term: '', ok: false, needAge: false, notSupported: true, reason: reason }
  }

  // 配偶派生：若链以妻/夫结尾，从 LOOKUP 查前缀再派生标准称呼
  var lastTok = reduced[reduced.length - 1];
  if ((lastTok === '妻' || lastTok === '夫') && reduced.length >= 2) {
    var derived = tryDeriveSpouse(reduced);
    if (derived) return derived;
  }

  // 建议 A：递归分解（最长已知前缀切开）
  var decomposed = tryDecompose(reduced)
  if (decomposed) {
    return decomposed
  }

  return { term: '', ok: false, needAge: false, notSupported: true }
}

// 检测是否是不符合传统亲属逻辑的同性配偶链（男+夫、女+妻）
// 检查链中任意相邻对，覆盖 夫,夫、夫,夫,夫、兄,弟,夫 等
function checkInvalid(chain) {
  var male = { '父':1, '兄':1, '弟':1, '子':1, '夫':1 }
  var female = { '母':1, '姐':1, '妹':1, '女':1, '妻':1 }
  for (var i = 0; i < chain.length - 1; i++) {
    if (male[chain[i]] && chain[i + 1] === '夫') return '该关系不符合传统亲属称谓'
    if (female[chain[i]] && chain[i + 1] === '妻') return '该关系不符合传统亲属称谓'
  }
  return null
}

// ============ 配偶派生 ============
// 标准称呼 → 其妻子的地道称呼
var SPOUSE_WIFE = {
  '大伯': '伯母', '伯父': '伯母', '叔叔': '婶婶/叔母', '叔父': '婶婶/叔母',
  '姑妈': '姑父', '姑姑': '姑父', '姑母': '姑父',
  '舅舅': '舅妈/舅母',
  '姨妈': '姨父', '大姨': '姨父', '小姨': '姨父',
  '哥哥': '嫂子', '弟弟': '弟妹/弟媳',
  '儿子': '儿媳', '孙子': '孙媳', '曾孙': '曾孙媳', '玄孙': '玄孙媳', '来孙': '来孙媳',
  '外孙': '外孙媳', '外曾孙': '外曾孙媳', '玄外孙': '玄外孙媳', '外玄孙': '外玄孙媳', '外来孙': '外来孙媳',
  '侄子': '侄媳', '外甥': '外甥媳',
  '侄孙': '侄孙媳', '外甥孙': '外甥孙媳',
  '堂侄': '堂侄媳', '表侄': '表侄媳', '表外甥': '表外甥媳',
  '堂哥': '堂嫂', '堂弟': '堂弟妹', '表哥': '表嫂', '表弟': '表弟妹',
  '堂伯': '堂伯母', '堂叔': '堂婶',
  '大伯子': '大伯嫂', '小叔子': '小婶/弟媳',
  '大舅子': '大舅嫂', '小舅子': '小舅媳',
  '祖父': '祖母', '曾祖父': '曾祖母', '高祖父': '高祖母', '天祖父': '天祖母',
  '外祖父': '外祖母', '外曾祖父': '外曾祖母', '外高祖父': '外高祖母', '外天祖父': '外天祖母',
  '伯祖父': '伯祖母', '叔祖父': '叔祖母',
  '伯姥爷': '伯姥姥', '叔姥爷': '叔姥姥',
  '表伯': '表伯母', '表叔': '表婶',
}
var SPOUSE_HUSBAND = {
  '姐姐': '姐夫', '妹妹': '妹夫',
  '女儿': '女婿', '孙女': '孙女婿', '曾孙女': '曾孙女婿',
  '外孙女': '外孙女婿', '外曾孙女': '外曾孙女婿', '外玄孙女': '外玄孙女婿', '外来孙女': '外来孙女婿',
  '侄女': '侄女婿', '外甥女': '外甥女婿',
  '侄孙女': '侄孙女婿', '外甥孙女': '外甥孙女婿',
  '堂侄女': '堂侄女婿', '表侄女': '表侄女婿', '表外甥女': '表外甥女婿',
  '堂姐': '堂姐夫', '堂妹': '堂妹夫', '表姐': '表姐夫', '表妹': '表妹夫',
  '堂姑': '堂姑父',
  '大姑子': '大姑姐夫', '小姑子': '小姑夫',
  '大姨子': '大姨姐夫', '小姨子': '小姨夫',
  '祖母': '祖父', '曾祖母': '曾祖父',
  '外祖母': '外祖父', '外曾祖母': '外曾祖父',
  '姑妈': '姑父', '姑姑': '姑父', '姑母': '姑父',
  '姨妈': '姨父', '大姨': '姨父', '小姨': '姨父',
  '姑奶奶': '姑祖父', '姨奶奶': '姨祖父', '姑姥姥': '姑姥爷', '姨姥姥': '姨姥爷',
  '表姑': '表姑父', '表姨': '表姨父',
}
// 从单个标准称呼派生其配偶
function deriveSingle(termStr, spouseTok) {
  var map = spouseTok === '妻' ? SPOUSE_WIFE : SPOUSE_HUSBAND
  // 尝试逐一备选称呼（term 可能有 / 分隔的多个异名）
  var parts = termStr.split('/').map(function(s){return s.trim()})
  for (var i = 0; i < parts.length; i++) {
    var alt = parts[i].replace(/[（(].*[）)]/g, '').trim()
    if (map[alt]) return map[alt]
  }
  // fallback：通用末字替换规则
  var base = parts[0].replace(/[（(].*[）)]/g, '').trim()
  if (spouseTok === '妻') {
    if (base.endsWith('父')) return base.slice(0,-1)+'母'
    if (base.endsWith('子')) return base.slice(0,-1)+'媳'
    return base+'媳'
  } else {
    if (base.endsWith('母')) return base.slice(0,-1)+'父'
    if (base.endsWith('姑') || base.endsWith('姨')) return base+'父'
    if (base.endsWith('女')) return base+'婿'
    if (base.endsWith('姐')) return base+'夫'
    if (base.endsWith('妹')) return base+'夫'
    return base+'婿'
  }
}
// 归约后链以妻/夫结尾，前缀在 LOOKUP 中 → 派生配偶标准称呼
function tryDeriveSpouse(reduced) {
  var last = reduced[reduced.length - 1]
  var prefix = reduced.slice(0, -1)
  var pk = prefix.join(',')
  var lu = LOOKUP[pk]
  if (!lu) return null
  if (lu.needAge) {
    var o = deriveSingle(lu.older, last)
    var y = deriveSingle(lu.younger, last)
    if (o && y) return { term: null, ok: true, needAge: true, ageOptions: { older: o, younger: y } }
    return null
  }
  var spTerm = deriveSingle(lu.term, last)
  if (spTerm) return { term: spTerm, ok: true, needAge: false }
  return null
}

// 递归分解：整链查不到时，按最长已知前缀切开再递归解析后缀
function tryDecompose(chain) {
  if (!chain || chain.length < 2) return null
  for (var k = chain.length - 1; k >= 1; k--) {
    var prefix = chain.slice(0, k)
    var prefixKey = prefix.join(',')
    var entry = LOOKUP[prefixKey]
    if (!entry || entry.needAge) continue

    var suffix = chain.slice(k)
    if (suffix.length === 0) continue

    var headTerm = entry.term || entry

    // 后缀直接查 LOOKUP
    var suffixKey = suffix.join(',')
    var suffixEntry = LOOKUP[suffixKey]
    if (suffixEntry && !suffixEntry.needAge) {
      return { term: headTerm + '的' + (suffixEntry.term || suffixEntry), ok: true, needAge: false }
    }

    // 递归后缀
    var tail = tryDecompose(suffix)
    if (tail) {
      return { term: headTerm + '的' + tail.term, ok: true, needAge: false }
    }
  }
  return null
}

// ============ 页面 ============
Page({
  behaviors: [calcPage],

  data: {
    STEP_WORD: STEP_WORD,
    chain: [],
    chainText: '',
    result: '',
    needAge: false,
    ageOptions: null,
    notSupported: false,
    notSupportedReason: '',
    isSaving: false,
    share: { ready: false, title: '', path: '/pages/relation/relation' }
  },

  addRel: function (e) {
    var rel = e.currentTarget.dataset.rel
    var chain = this.data.chain.concat([rel])
    this.setData({ chain: chain })
    this.compute()
  },

  undo: function () {
    var chain = this.data.chain.slice(0, -1)
    if (chain.length) {
      this.setData({ chain: chain })
      this.compute()
    } else {
      this.clear()
    }
  },

  clear: function () {
    this.setData({
      chain: [], chainText: '', result: '',
      needAge: false, ageOptions: null, notSupported: false, notSupportedReason: '',
      share: { ready: false, title: '', path: '/pages/relation/relation' }
    })
  },

  pickAge: function (e) {
    var which = e.currentTarget.dataset.which
    var r = resolveRelation(this.data.chain)
    if (r.needAge && r.ageOptions) {
      var term = which === 'older' ? r.ageOptions.older : r.ageOptions.younger
      this.setData({
        result: term, needAge: false, notSupported: false,
        share: { ready: true, title: '我该叫 TA「' + term + '」，来试试你的亲戚关系', path: '/pages/relation/relation' }
      })
    }
  },

  compute: function () {
    var chain = this.data.chain
    var words = chain.map(function (k) { return STEP_WORD[k] })
    var chainText = words.join(' 的 ')

    if (!chain.length) {
      this.setData({
        chainText: '', result: '', needAge: false, ageOptions: null, notSupported: false, notSupportedReason: '',
        share: { ready: false, title: '', path: '/pages/relation/relation' }
      })
      return
    }

    var r = resolveRelation(chain)

    if (r.notSupported) {
      this.setData({ chainText: chainText, result: '', needAge: false, ageOptions: null, notSupported: true, notSupportedReason: r.reason || '', share: { ready: false, title: '', path: '/pages/relation/relation' } })
    } else if (r.needAge) {
      this.setData({ chainText: chainText, result: '', needAge: true, ageOptions: r.ageOptions, notSupported: false, share: { ready: false, title: '', path: '/pages/relation/relation' } })
    } else {
    this.setData({ chainText: chainText, result: r.term, needAge: false, ageOptions: null, notSupported: false, share: { ready: true, title: '我该叫 TA「' + r.term + '」，来试试你的亲戚关系', path: '/pages/relation/relation' } })
    }
  },

  saveResult: function () {
    var d = this.data
    var shouldRecord = !d.notSupported && d.chain.length >= 2
    this.saveResultTemplate({
      toolId: 'relation', toolName: '亲戚关系', icon: '👪',
      input: shouldRecord ? { chain: d.chain } : undefined,
      summary: shouldRecord ? (d.chainText + ' → ' + d.result) : '',
      title: '亲戚关系',
      theme: ['#fa709a', '#fee140'],
      slogan: '亲戚关系，不再叫错',
      footer: '',
      hook: d.notSupported ? '来测测你的亲戚关系' : '我叫 TA「' + d.result + '」，来测测你的亲戚关系',
      guard: function (d) { return d.result || d.notSupported },
      noResultHint: '请先点选关系',
      draw: function (canvas, ctx, W, H, data) {
        ctx.fillStyle = '#999'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        var ct = data.chainText.length > 18 ? data.chainText.slice(0, 18) + '…' : data.chainText
        ctx.fillText(ct, W / 2, 110)

        if (data.notSupported) {
          ctx.fillStyle = '#e67e22'
          ctx.font = 'bold 16px sans-serif'
          ctx.fillText(data.notSupportedReason || '暂不支持该层级查询', W / 2, 170)
          ctx.fillStyle = '#999'
          ctx.font = '11px sans-serif'
          ctx.fillText('资料覆盖五级关系，请联系作者补充', W / 2, 200)
        } else {
          ctx.fillStyle = '#999'
          ctx.font = '13px sans-serif'
          ctx.fillText('你该叫 TA', W / 2, 160)
          ctx.fillStyle = '#e74c3c'
          ctx.font = 'bold 36px sans-serif'
          ctx.fillText(data.result, W / 2, 210)
        }
      }
    })
  },

  restoreHistory: function (record) {
    var inp = record.input
    if (inp.chain && inp.chain.length) {
      this.setData({ chain: inp.chain })
      this.compute()
    }
  }
})

module.exports = { resolveRelation: resolveRelation, reduceChain: reduceChain, LOOKUP: LOOKUP, L1_OVERRIDE: L1_OVERRIDE }
