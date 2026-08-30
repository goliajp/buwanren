/* 日子说给人听的写法。
 *
 * 头一版用的是汉字数字（「八月三十 · 周日」）—— 用户 2026-08-30 指出：
 * 那个写法**读起来像农历**，而这个产品正在把玄学味道去掉，
 * 汉字月日恰好把它又请了回来。
 *
 * 现在：屏上是「8月30日 · 周日」，纪念日那种要写全年份的是「2026年8月30日」。
 * 都是现代人写日子的样子，跟系统读的 ISO（2026-08-30）分得开。
 *
 * 抽出来是因为它先在几屏各写了一份，其中两份写成了 ISO ——
 * 同一个产品对同一天几种说法，翻过去翻回来就露馅。
 * 台账类的日期（下单、寄出）另算：那是记录，本来就该是数字。
 */

/** 「8月30日 · 周日」—— 屏上打招呼用的那种 */
export function 今天几号(d: Date): string {
  const 周 = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 · 周${周}`
}

/** 「2026年8月30日」—— 纪念日那种，要说清是哪一年 */
export function 那一天(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ''
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`
}

/** 「8月30日 13:53」—— 之前问过的那一条，要说清是哪天几点 */
export function 那天几点(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mi}`
}
