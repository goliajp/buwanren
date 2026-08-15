const rnd = (function (a) { return function () {
  a |= 0; a = (a + 0x6D2B79F5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
} })(88)
// consumption order must match original exactly
const wall = []
for (let k = 0; k < 30; k++) wall.push([(rnd()*1400)|0, (rnd()*380)|0])
const floor = []
for (let k = 0; k < 40; k++) floor.push([(rnd()*1400)|0, 440+((rnd()*1680)|0), 12+((rnd()*14)|0)])
const p14 = []
for (let k = 0; k < 14; k++) p14.push([100+((rnd()*1240)|0), 500+((rnd()*1500)|0)])
const p10 = []
for (let k = 0; k < 10; k++) p10.push([80+((rnd()*1280)|0), 480+((rnd()*1560)|0)])
const j = a => JSON.stringify(a)
require('fs').writeFileSync(process.argv[2], JSON.stringify({wall,floor,p14,p10}))
console.log('WALL', j(wall.slice(0,3)), '...')
console.log('FLOOR', j(floor.slice(0,3)), '...')
console.log('P14', j(p14.slice(0,3)), '...')
console.log('P10', j(p10.slice(0,3)), '...')
