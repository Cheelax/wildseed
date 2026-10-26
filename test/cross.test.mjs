import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genomeOf } from '../src/genome.mjs';
import { cross, traitLeaves } from '../src/cross.mjs';
import { parseLineage } from '../src/lineage.mjs';
import { readFileSync } from 'node:fs';
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

test('nested Unicode parents canonicalize before ordering, and #1 disappears', () => {
  for (const [input, expected] of [
    ['Noe × ( THOMAS * AURI # 1 ) #2', '(auri*thomas)*noe#2'],
    ['noe\u0301 * Big   Blue', 'big blue*noé'],
    ['(z*a#2)*(d*c)', '(a*z#2)*(c*d)'], ['東京 * КОТ', 'кот*東京']
  ]) assert.equal(parseLineage(input).seed, expected);
});
test('unnecessary parentheses, ambiguous crosses and malformed clutch numbers fail', () => {
  for (const bad of ['(a)', '(a)*b', '(a*b)', '((a*b))*c', 'a*b*c', 'a*b#01', 'a*b#0', 'a*b#100', 'a#2', 'a*b#2#3', 'a*(b*c', '*', 'a*🐸', 'a*b#2 3']) assert.throws(() => genomeOf(bad), undefined, bad);
});
test('six generations allowed; seven refused; canonical length counts code points', () => {
  let s = 'a';
  for (let i = 0; i < 6; i++) s = i ? `(${s})*a` : 'a*a';
  assert.ok(genomeOf(s).parents);
  assert.throws(() => genomeOf(`(${s})*a`));
  const long = `((${"a".repeat(22)}*${"b".repeat(22)})*(${"c".repeat(22)}*${"d".repeat(22)}))*${"e".repeat(22)}`;
  assert.equal(genomeOf(long).seed.length, 120);
  assert.throws(() => genomeOf(long + 'e'));
  assert.throws(() => genomeOf('('.repeat(10000) + 'a*b' + ')'.repeat(10000)));
});
test('crossing frozen parents is symmetric and identical to recursively hatching their lineage', () => {
  for (const seeds of [['thomas','auri'], ['a*b#2','noé'], ['a*b','c*d'], ['moss','moss']]) {
    const [a,b] = seeds.map(s => freeze(genomeOf(s)));
    for (const n of [1,2,99]) {
      const g = cross(a,b,n);
      assert.deepEqual(g, cross(b,a,n));
      assert.deepEqual(g, genomeOf(g.seed));
    }
    for (const n of [0,100,1.5,NaN,'2']) assert.throws(() => cross(a,b,n));
  }
});
test('all 466 recorded original genomes remain byte-for-byte identical', () => {
  const originals = readFileSync(new URL('../.launchpad/checks/round-2/round-1-genomes.jsonl', import.meta.url),'utf8').trim().split('\n').map(JSON.parse);
  for (const g of originals) assert.equal(JSON.stringify(genomeOf(g.seed)), JSON.stringify(g));
});
test('10,000 independent families obey inheritance, provenance, rarity, mutation and color distributions', () => {
  let mutations = 0, leaves = 0, common = 0, rare = 0, near = 0, colorCases = 0, mixed = 0, eligible = 0;
  const families = Array.from({length:10000}, (_,i) => { const a = genomeOf(`cedar${i}`), b = genomeOf(`river${i}`); return {a,b,c:cross(a,b)}; });
  const distance = (p,q) => p.reduce((sum,h,i) => sum + Math.hypot(...[1,3,5].map(k => parseInt(h.slice(k,k+2),16)-parseInt(q[i].slice(k,k+2),16))),0)/p.length;
  for (let i=0;i<families.length;i++) {
    const {a,b,c} = families[i], av=traitLeaves(a.traits), bv=traitLeaves(b.traits), cv=traitLeaves(c.traits);
    let fromA=0,fromB=0,diff=0;
    for (const [path,v] of Object.entries(cv)) {
      leaves++;
      if (c.mutations.includes(path)) { mutations++; assert.equal(c.origins[path],'mutation'); continue; }
      const parents=[av[path],bv[path]].filter(x=>x!==undefined);
      if (typeof v==='number') { const nums=parents.filter(x=>typeof x==='number'); assert.ok(v>=Math.min(...nums)&&v<=Math.max(...nums),path); }
      else assert.ok(parents.includes(v),path);
      const o = c.origins[path];
      if (o===0) assert.equal(v,av[path]);
      if (o===1) assert.equal(v,bv[path]);
      if (o==='both') { assert.equal(v,av[path]); assert.equal(v,bv[path]); }
      if (av[path]!==undefined&&bv[path]!==undefined&&av[path]!==bv[path]) {
        diff++; if(v===av[path])fromA++; else if(v===bv[path])fromB++; else if(typeof v==='number'){fromA++;fromB++;}
      }
    }
    if(diff>=4){eligible++;if(fromA&&fromB)mixed++;}
    const total=Object.values(c.stats).reduce((s,x)=>s+x,0);
    assert.ok(total>=160&&total<=280);
    assert.ok(Object.values(c.stats).every(v=>Number.isInteger(v)&&v>=10&&v<=100));
    if(!a.rare&&!b.rare){common++;if(c.rare)rare++;else{
      colorCases++; const stranger=families[(i+1)%families.length];
      if(Math.min(distance(c.palette,a.palette),distance(c.palette,b.palette))<Math.min(distance(c.palette,stranger.a.palette),distance(c.palette,stranger.b.palette)))near++;
    }}
  }
  const metrics={mutationRate:mutations/leaves,rareRate:rare/common,mixedShare:mixed/eligible,colorShare:near/colorCases};
  console.log(JSON.stringify(metrics));
  assert.ok(metrics.mutationRate>=1/80&&metrics.mutationRate<=1/30);
  assert.ok(metrics.rareRate>=1/100&&metrics.rareRate<=1/40);
  assert.ok(metrics.mixedShare>=.7);
  assert.ok(metrics.colorShare>=.8);
});
test('first four eggs differ for 500 couples, including self-crosses', () => {
  let unique=0;
  for(let i=0;i<500;i++) {
    const a=genomeOf(`fern${i}`),b=genomeOf(`breeze${i}`);
    unique+=new Set([1,2,3,4].map(n=>JSON.stringify(cross(a,b,n).traits))).size;
  }
  assert.ok(unique>=1900);
  assert.equal(cross(genomeOf('a'),genomeOf('a')).parents.length,2);
});
