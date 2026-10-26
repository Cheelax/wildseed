// Additional browser regressions. Run npm run build, then node test/browser.mjs in a Playwright
// environment. It serves dist/ locally under /garden/; WILD_ARTIFACTS chooses an output directory.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { genomeOf } from '../src/genome.mjs';
import { parseGif } from '../.launchpad/checks/round-1/lib/gif.mjs';
import { decodePng } from '../.launchpad/checks/round-1/lib/png.mjs';
const root=resolve('dist'), out=process.env.WILD_ARTIFACTS ?? join(tmpdir(),'wildseed-browser');
mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const server=createServer((req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!path.startsWith('/garden/'))return res.writeHead(404).end();
  let file=resolve(root,path.slice(8)||'index.html');
  if(!file.startsWith(root+'/')||!existsSync(file))return res.writeHead(404).end();
  if(statSync(file).isDirectory())file=join(file,'index.html');
  res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream'}).end(readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`, url=origin+'/garden/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const errors=[],external=[],results=[];
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name);};
const ready=async(page,seed)=>{await page.waitForFunction(s=>window.__wild?.ready&&window.__wild.creature.seed===s,seed,{timeout:60000});};
const current=page=>page.evaluate(()=>window.__wild.creature);
const watch=page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});page.on('request',req=>{if(/^https?:/.test(req.url())&&!req.url().startsWith(origin+'/'))external.push(req.url());});};
const open=async(page,seed)=>{await page.goto(url+'?seed='+encodeURIComponent(seed));await ready(page,genomeOf(seed).seed);};
const fps=page=>page.evaluate(()=>new Promise(resolve=>{let count=0,start=performance.now();function tick(t){count++;if(t-start>=2000)resolve(Math.round(count*1000/(t-start)));else requestAnimationFrame(tick);}requestAnimationFrame(tick);}));
const metrics={};
try {
 const context=await browser.newContext({viewport:{width:1280,height:800},acceptDownloads:true});
 const page=await context.newPage();watch(page);
 await page.addInitScript(()=>{window.__audioNotes=0;const f=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(...a){window.__audioNotes++;return f.apply(this,a);};});
 await check('solo startup and desktop rendering',async()=>{const start=Date.now();await open(page,'moss');metrics.desktopReadyMs=Date.now()-start;await page.waitForTimeout(800);metrics.desktopFps=await fps(page);await page.screenshot({path:join(out,'solo.png'),fullPage:true});});
 await check('cross form, successive eggs and distinct siblings',async()=>{
  await page.fill('#parent-a','Thomas');await page.fill('#parent-b','Auri');await page.click('.cross-submit');await page.waitForTimeout(350);await page.locator('.stage').screenshot({path:join(out,'meeting.png')});await page.waitForTimeout(700);await page.locator('.stage').screenshot({path:join(out,'egg.png')});await ready(page,'auri*thomas');
  const first=await current(page);assert.deepEqual(first,genomeOf(first.seed));
  await page.click('.next-egg');await ready(page,'auri*thomas#2');const second=await current(page);assert.notDeepEqual(first.traits,second.traits);
  await page.click('.next-egg');await ready(page,'auri*thomas#3');assert.ok(page.url().includes('%23'));
 });
 await check('grandchild flow, family tree, provenance and fresh-context link',async()=>{
  await page.click('.breed-child');await page.fill('#parent-b','noé');await page.click('.cross-submit');
  const seed='(auri*thomas#3)*noé';await ready(page,seed);await page.locator('.family-member').first().waitFor();
  const text=await page.locator('[data-testid="family-tree"]').innerText();
  for(const s of [seed,'auri*thomas#3','noé','auri','thomas'])assert.ok(text.includes(genomeOf(s).name));
  await page.click('.inheritance summary');assert.ok(await page.locator('.trait-list > div').count()>15);
  const fresh=await browser.newContext();const other=await fresh.newPage();watch(other);await other.goto(page.url());await ready(other,seed);assert.deepEqual(await current(other),genomeOf(seed));await fresh.close();
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(out,'family.png'),fullPage:true});
 });
 await check('grandchild PNG and GIF decode outside the page',async()=>{
  for(const [id,filename] of [['save-card','family.png.download'],['save-gif','family.gif']]){
   const [download]=await Promise.all([page.waitForEvent('download',{timeout:180000}),page.click(`[data-testid="${id}"]`)]);await download.saveAs(join(out,filename));
  }
  const png=decodePng(readFileSync(join(out,'family.png.download')));assert.equal(png.width,768);assert.equal(png.height,1120);
  const gif=parseGif(readFileSync(join(out,'family.gif')));assert.ok(gif.frames.length>=12);assert.ok(gif.frames.every(f=>f.colors<=64));metrics.gifFrames=gif.frames.length;
 });
 await check('invalid cross preserves current creature',async()=>{
  const before=await current(page);await page.fill('#parent-a','(a*b');await page.click('.cross-submit');assert.deepEqual(await current(page),before);assert.ok(await page.locator('[data-testid="seed-error"]').isVisible());
 });
 await check('five families render, and a long Unicode lineage exports',async()=>{
  for(const seed of ['moss*pebble','東京*кот','fern*willow','a*a','oleg*chaos']) {await open(page,seed);assert.deepEqual(await current(page),genomeOf(seed));}
  const seed=`((${"a".repeat(22)}*${"b".repeat(22)})*(${"c".repeat(22)}*${"d".repeat(22)}))*${"東".repeat(22)}`;
  await open(page,seed);const [dl]=await Promise.all([page.waitForEvent('download',{timeout:120000}),page.click('[data-testid="save-card"]')]);await dl.saveAs(join(out,'long-card.png'));
 });
 await check('drift lower silhouette answers taps',async()=>{
  let drift;for(let i=0;!drift;i++){const g=genomeOf(`drift${i}`);if(g.species==='drift')drift=g;}
  await open(page,drift.seed);await page.locator('[data-testid="scene"]').scrollIntoViewIfNeeded();
  const bounds=await page.locator('[data-testid="scene"]').boundingBox();let reacted=false;
  for(const [x,y] of [[.5,.59],[.5,.56],[.45,.56]]){
   const before=await page.evaluate(()=>window.__audioNotes);await page.mouse.click(bounds.x+bounds.width*x,bounds.y+bounds.height*y);await page.waitForTimeout(80);if(await page.evaluate(()=>window.__audioNotes)>before)reacted=true;
  }
  assert.ok(reacted,'no cry from lower silhouette taps');await page.screenshot({path:join(out,'drift.png'),fullPage:true});
 });
 await context.close();
 await check('mobile crossing, no page overflow, and animation',async()=>{
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});const phone=await mobile.newPage();watch(phone);
  const start=Date.now();await open(phone,'moss');metrics.mobileReadyMs=Date.now()-start;metrics.mobileFps=await fps(phone);
  await phone.fill('#parent-a','moss');await phone.fill('#parent-b','fern');await phone.click('.cross-submit');await ready(phone,'fern*moss');await phone.locator('.family-member').first().waitFor();
  assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=390 && innerWidth===390));await phone.screenshot({path:join(out,'mobile.png'),fullPage:true});await mobile.close();
 });
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);results.push('no uncaught errors or external requests');
 writeFileSync(join(out,'regression.json'),JSON.stringify({results,metrics,errors,external},null,2));console.log(JSON.stringify({results:results.length,metrics,errors,external}));
} finally {await browser.close();server.close();}
