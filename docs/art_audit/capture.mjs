import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const baseURL = 'http://127.0.0.1:5187/';
const output = 'docs/art_audit/shots';
await mkdir(output, { recursive: true });
const report = { startedAt: new Date().toISOString(), baseURL, browser: 'Playwright bundled headless Chromium', desktop: {width:1440,height:1000}, mobile: {width:390,height:844}, methodology: 'Actual local Vite source. Controlled states use existing engine exports and an in-memory response hook on loadActive; no source files edited. Network is isolated, preferences muted, normal motion enabled. Leaderboard rows are synthetic demonstration data. Game over is reached through an unmodified, replayable practice run.', shots: [], errors: [], blockedExternal: [], transientEvidence: [] };
const supplement = process.argv.includes('--supplement');
if (supplement) Object.assign(report, JSON.parse(await readFile('docs/art_audit/capture-report.json','utf8')));
const browser = await chromium.launch({ headless: true });
let fixtures;

async function open(mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? report.mobile : report.desktop, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: 'no-preference', locale: 'en-US' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push(error.stack || error.message));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('squeekspire:v1:profile', JSON.stringify('guest1042'));
    localStorage.setItem('squeekspire:v2:preferences', JSON.stringify({ volume: 0, animationSpeed: 'normal', reduceEffects: false, language: 'en' }));
    const fixture = sessionStorage.getItem('art-audit-fixture');
    if (fixture) window.__artAuditFixture = JSON.parse(fixture);
  });
  await page.route('https://**/*', route => { report.blockedExternal.push(route.request().url()); return route.abort(); });
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/score') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({accepted:true})});
    const mode = url.searchParams.get('runMode') || 'daily';
    const seed = Number(url.searchParams.get('seed') || 0);
    const entries = Array.from({length:6},(_,i)=>({ id:`audit-${i}`, profile:i===2?'guest1042':`guest${6218+i*121}`, day:new Date().toISOString().slice(0,10), mode, scoreVersion:2, score:37120-i*3740, bestHit:1000-i*100, floor:24-i*2, won:i<3, hibernation:false, streak:7-i, seed }));
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({entries})});
  });
  await page.route('**/src/game/storage.ts*', async route => {
    const response = await route.fetch();
    let body = await response.text();
    assert(body.includes('export function loadActive(mode) {'), 'Vite loadActive signature changed');
    body = body.replace('export function loadActive(mode) {', 'export function loadActive(mode) { if (window.__artAuditFixture) return mode === "practice" ? structuredClone(window.__artAuditFixture) : null;');
    await route.fulfill({response,body});
  });
  await page.goto(baseURL);
  await page.locator('.hero-title').waitFor();
  return {context,page};
}

async function shot(page, name, state, {fullPage = true, settle = 180, fixture = true} = {}) {
  if (settle) await page.waitForTimeout(settle);
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.evaluate(() => ({ viewport:{width:innerWidth,height:innerHeight}, document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}, horizontalOverflow:document.documentElement.scrollWidth>innerWidth, svgCount:document.querySelectorAll('svg').length, cardCount:document.querySelectorAll('.card').length, title:document.title, effects:document.documentElement.dataset.effects, animations:[...document.getAnimations()].map(a=>({name:a.animationName||'',time:a.currentTime,duration:a.effect?.getTiming().duration})), hand:document.querySelector('.hand')?{clientWidth:document.querySelector('.hand').clientWidth,scrollWidth:document.querySelector('.hand').scrollWidth}:null, cards:[...document.querySelectorAll('.hand .card')].map(c=>({id:c.dataset.id,box:(()=>{const b=c.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom}})(),descriptionFont:getComputedStyle(c.querySelector('.card-description')).fontSize})), intentCount:document.querySelectorAll('.intent').length, revealedIntentCount:document.querySelectorAll('.queued-intent').length }));
  await page.screenshot({path:`${output}/${name}.png`,fullPage,animations:'allow'});
  const item = { file:`shots/${name}.png`,state,fixture,fullPage,...metrics };
  report.shots.push(item);
  console.log(`${name}: ${state}; overflow=${metrics.horizontalOverflow}`);
  await writeFile('docs/art_audit/capture-report.json',JSON.stringify(report,null,2));
}

async function boot(page, state) {
  await page.evaluate(s=>sessionStorage.setItem('art-audit-fixture',JSON.stringify(s)),state);
  await page.reload();
  await page.locator('[data-action="resume"]').click();
  await page.mouse.move(0,0);
  await page.waitForTimeout(160);
}

async function makeFixtures(page) {
  return page.evaluate(async () => {
    const {fallbackDay,getGameDay} = await import('/src/game/data.ts');
    const {generateMap} = await import('/src/game/map.ts');
    const {createRun,act} = await import('/src/game/engine.ts');
    const {ENEMIES,CARDS} = await import('/src/game/catalog.ts');
    const day = {...fallbackDay(getGameDay()),difficulty:1,hibernation:false,spinning:false,peakRpm:225};
    const map = generateMap(day);
    const room = (kind,enemyId='dust-mite',jackpot=false) => {
      const route=structuredClone(map); route[0]={...route[0],kind,enemyId,jackpot};
      return act(createRun(day,route,'practice'),{type:'enter',nodeId:0});
    };
    const battle=room('battle');
    battle.hp=57; battle.combat.energy=3;
    const cards=['wheel-kick','cheek-pouch','sleep-cam','seed-snack','lfg'].map((id,i)=>({id,uid:`audit-card-${i}`,level:0,mergeLevel:0}));
    battle.combat.hand=cards;
    battle.deck=[...structuredClone(cards),...battle.combat.draw];
    battle.combat.enemies=['dust-mite','seed-thief'].map((id,i)=>{
      const e=ENEMIES[id]; return {...structuredClone(battle.combat.enemies[0]),id,uid:`audit-enemy-${i}`,name:e.name,hp:e.hp,maxHp:e.hp,intent:{type:e.pattern[0],damage:e.attack,times:1,label:e.pattern[0]==='block'?'Gain 8 Block':`Attack ${e.attack}`}};
    });
    const intents=structuredClone(battle);intents.relics.push('live-camera');
    const shop=room('shop');shop.gold=135;
    shop.shop.offers=[{kind:'card',id:'3am-dash',price:42,sold:false},{kind:'card',id:'full-moon-run',price:78,sold:false},{kind:'card',id:'touch-grass',price:180,sold:false},{kind:'relic',id:'diamond-hands',price:152,sold:false},{kind:'relic',id:'live-camera',price:90,sold:false}];
    const rest=room('rest');rest.hp=39;
    const event=room('event');event.hp=48;
    const reward=structuredClone(battle); reward.phase='reward'; reward.reward={cards:['3am-dash','bedding-fort','full-moon-run']};reward.combat.enemies.forEach(e=>e.hp=0);
    const treasure=room('treasure');
    const route=createRun(day,map,'practice');route.floor=4;route.currentNode=3;route.reachable=map[3].connections;route.log=[{type:'enter',nodeId:0},{type:'enter',nodeId:1},{type:'enter',nodeId:2},{type:'enter',nodeId:3}];
    const boss=room('boss','squeektoshi',true);boss.relics.push('live-camera');
    const collection=createRun(day,map,'practice');
    return {battle,intents,shop,rest,event,reward,treasure,map:route,boss,collection,cardIds:Object.keys(CARDS),day:day.day,seed:day.seed};
  });
}

try {
  if (!supplement) {
  const {page,context}=await open();
  fixtures=await makeFixtures(page);
  await writeFile('docs/art_audit/capture-fixtures.json',JSON.stringify(fixtures,null,2));
  await shot(page,'01_title_desktop','Title / clean guest session',{fixture:false});
  await page.locator('[data-action="start"]').click();
  await shot(page,'02_mode_select_desktop','Mode selection',{fixture:false});
  await page.locator('[data-action="mode"][data-mode="practice"]').click();
  await shot(page,'03_character_select_desktop','Character selection',{fixture:false});
  await boot(page,fixtures.map);
  await shot(page,'04_map_desktop','Route map with available choices');
  await boot(page,fixtures.battle);
  await shot(page,'05_combat_desktop','Combat idle / two enemies');
  await page.locator('.hand [data-id="wheel-kick"]').hover();
  await shot(page,'06_card_hover_desktop','Desktop card hover / Wheel Kick');
  await page.locator('.hand [data-id="wheel-kick"]').click();
  await shot(page,'07_card_target_desktop','Selected attack / target prompt');
  await page.locator('.enemy-card').first().click();
  await shot(page,'08_card_play_impact_desktop','Card play mid-animation / lunge + HP feedback',{settle:60,fullPage:false});
  report.transientEvidence.push(await page.evaluate(()=>({kind:'attack',acting:document.querySelectorAll('.acting-attack').length,hitFlash:document.querySelectorAll('.hit-flash').length,floats:[...document.querySelectorAll('.damage-float')].map(x=>x.textContent),ghost:document.querySelectorAll('.card-play-effect').length})));
  await page.waitForTimeout(1100);
  await page.locator('.hand [data-id="cheek-pouch"]').click();
  await shot(page,'09_block_feedback_desktop','Block card action / shield bubble',{settle:80,fullPage:false});
  await boot(page,fixtures.intents);
  await shot(page,'10_enemy_intents_desktop','Current + revealed future enemy intent queues');
  await boot(page,fixtures.battle);
  await page.locator('[data-action="end-turn"]').click();
  await shot(page,'11_enemy_attack_desktop','Enemy turn action / player damage',{settle:90,fullPage:false});
  await boot(page,fixtures.boss);
  await shot(page,'12_boss_zoomies_desktop','Boss / golden Zoomies room');
  await boot(page,fixtures.reward);
  await shot(page,'13_reward_desktop','Post-combat three-card reward');
  await boot(page,fixtures.shop);
  await shot(page,'14_shop_desktop','Shop cards, relics, affordability and removal');
  await boot(page,fixtures.rest);
  await shot(page,'15_rest_desktop','Rest / before-and-after upgrade');
  await boot(page,fixtures.event);
  await shot(page,'16_event_desktop','Event encounter');
  await boot(page,fixtures.treasure);
  await shot(page,'17_treasure_relic_reward_desktop','Treasure / acquired relic reward');
  await page.locator('.top-relic').last().click();
  await shot(page,'18_relic_detail_desktop','Owned relic detail modal');
  await page.locator('[data-action="close"]').click();
  await page.locator('[data-action="collection"]').click();
  await shot(page,'19_card_codex_desktop','Card codex / frame and art variety');
  await page.locator('[data-action="close"]').click();
  await page.locator('[data-action="help"]').click();
  await shot(page,'20_guide_desktop','Guide opening page / illustration');
  await page.locator('[data-action="close"]').click();
  await page.locator('[data-action="settings"]').click();
  await shot(page,'21_settings_desktop','Settings / animation controls');
  await page.locator('[data-action="close"]').click();
  await page.locator('[data-action="more"]').click();
  await page.locator('.leaderboard-row').first().waitFor();
  await shot(page,'22_leaderboard_desktop','Leaderboard modal / synthetic populated rows');
  await context.close();

  const natural=await open();
  await natural.page.locator('[data-action="start"]').click();
  await natural.page.locator('[data-action="mode"][data-mode="practice"]').click();
  await natural.page.locator('[data-action="begin"]').click();
  for(let i=0;i<40;i++) {
    if(await natural.page.locator('.run-result').count()) break;
    await natural.page.locator('[data-action="end-turn"]').click();
    await natural.page.waitForTimeout(1150);
  }
  await natural.page.locator('.run-result').waitFor();
  await shot(natural.page,'23_game_over_desktop','Game over / real practice loss from menu-started run',{fixture:false});
  await natural.page.setViewportSize(report.mobile);
  await shot(natural.page,'36_game_over_mobile_390','Game over at 390 CSS px / real practice loss',{fixture:false});
  await natural.context.close();

  const mobile=await open(true);
  await shot(mobile.page,'24_title_mobile_390','Title at 390 CSS px',{fixture:false});
  await mobile.page.locator('[data-action="start"]').click();
  await shot(mobile.page,'25_mode_select_mobile_390','Mode selection at 390 CSS px',{fixture:false});
  await mobile.page.locator('[data-action="mode"][data-mode="practice"]').click();
  await shot(mobile.page,'26_character_select_mobile_390','Character selection at 390 CSS px',{fixture:false});
  await boot(mobile.page,fixtures.map);
  await shot(mobile.page,'27_map_mobile_390','Route map at 390 CSS px');
  await boot(mobile.page,fixtures.battle);
  await shot(mobile.page,'28_combat_mobile_390','Combat at 390 CSS px / initial hand');
  await mobile.page.locator('.hand [data-id="wheel-kick"]').tap();
  await shot(mobile.page,'29_card_preview_mobile_390','Touch card inspect modal');
  await mobile.page.locator('[data-action="preview-play"]').click();
  await shot(mobile.page,'30_card_play_mobile_390','Touch card play mid-animation',{settle:60,fullPage:false});
  await boot(mobile.page,fixtures.intents);
  await shot(mobile.page,'31_enemy_intents_mobile_390','Revealed enemy intents at 390 CSS px');
  await boot(mobile.page,fixtures.reward);
  await shot(mobile.page,'32_reward_mobile_390','Card reward at 390 CSS px');
  await boot(mobile.page,fixtures.shop);
  await shot(mobile.page,'33_shop_mobile_390','Shop at 390 CSS px');
  await boot(mobile.page,fixtures.rest);
  await shot(mobile.page,'34_rest_mobile_390','Rest at 390 CSS px');
  await mobile.page.locator('.top-relic').first().tap();
  await shot(mobile.page,'35_relic_detail_mobile_390','Relic detail at 390 CSS px');
  await mobile.page.locator('[data-action="close"]').click();
  await mobile.page.locator('[data-action="more"]').click();
  await mobile.page.locator('.leaderboard-row').first().waitFor();
  await shot(mobile.page,'37_leaderboard_mobile_390','Leaderboard at 390 CSS px / synthetic rows');
  await boot(mobile.page,fixtures.event);
  await shot(mobile.page,'38_event_mobile_390','Event at 390 CSS px');
  await boot(mobile.page,fixtures.boss);
  await shot(mobile.page,'39_boss_zoomies_mobile_390','Boss / golden room at 390 CSS px');
  await mobile.context.close();
  } else {
    report.shots = report.shots.filter(shot => Number(shot.file.split('/').pop().slice(0,2)) < 40);
    fixtures = JSON.parse(await readFile('docs/art_audit/capture-fixtures.json','utf8'));
    const {page,context} = await open();
    const swarm = await page.evaluate(async day => {
      const {generateMap}=await import('/src/game/map.ts');
      const {createRun,act}=await import('/src/game/engine.ts');
      const map=generateMap(day);map[0]={...map[0],kind:'battle',enemyId:'sybil-swarm',jackpot:false};
      const run=act(createRun(day,map,'practice'),{type:'enter',nodeId:0});
      return run;
    },fixtures.battle.day);
    await boot(page,swarm);
    await shot(page,'40_sybil_swarm_desktop','Actual five-target Sybil encounter / sprite multiplicity');
    await boot(page,fixtures.battle);
    await page.locator('.hand [data-id="wheel-kick"]').hover();
    await page.waitForTimeout(250);
    report.hoverDiagnostics=await page.locator('.hand [data-id="wheel-kick"]').evaluate(card=>{
      const hand=card.closest('.hand'), h=hand.getBoundingClientRect(),c=card.getBoundingClientRect();
      return {hand:{top:h.top,bottom:h.bottom,overflowX:getComputedStyle(hand).overflowX,overflowY:getComputedStyle(hand).overflowY},card:{top:c.top,bottom:c.bottom,transform:getComputedStyle(card).transform},clippedTopPixels:Math.max(0,h.top-c.top),costTop:card.querySelector('.card-cost').getBoundingClientRect().top,nameTop:card.querySelector('.card-name').getBoundingClientRect().top};
    });
    await page.evaluate(()=>{window.__auditOldFill=document.querySelector('.enemy-card .health-fill');window.__auditOldWheel=document.querySelector('.arena-wheel');});
    await page.locator('.hand [data-id="wheel-kick"]').click();
    await page.locator('.enemy-card').first().click();
    report.domReplacementDiagnostics=await page.evaluate(()=>({healthElementReplaced:window.__auditOldFill!==document.querySelector('.enemy-card .health-fill'),ambientWheelReplaced:window.__auditOldWheel!==document.querySelector('.arena-wheel'),cardPlayGhost:document.querySelectorAll('.card-play-effect').length}));
    report.transientEvidence = [await page.evaluate(()=>({kind:'attack',acting:document.querySelectorAll('.acting-attack').length,hitFlash:document.querySelectorAll('.hit-flash').length,floats:[...document.querySelectorAll('.damage-float')].map(x=>x.textContent),ghost:document.querySelectorAll('.card-play-effect').length}))];
    const burst=structuredClone(fixtures.battle);burst.combat.squeeks=90;burst.combat.addMult=25;
    await boot(page,burst);
    await page.locator('.hand [data-id="wheel-kick"]').click();
    await page.locator('.enemy-card').first().click();
    assert.equal(await page.locator('.squeek-burst').count(),1,'Capture the real big-combo effect');
    await shot(page,'41_combo_burst_desktop','Big-combo SQUEEK burst and stage shake',{settle:90,fullPage:false});
    await boot(page,fixtures.battle);
    await page.locator('[data-action="collection"]').click();
    await page.locator('[data-action="collection-tab"][data-tab="relics"]').click();
    await shot(page,'42_relic_codex_desktop','Relic codex / icon language');
    await page.locator('[data-action="collection-tab"][data-tab="enemies"]').click();
    await shot(page,'43_enemy_codex_desktop','Enemy codex / actor language');
    await context.close();
    const mobile=await open(true);
    await boot(mobile.page,fixtures.battle);
    report.mobileCombatDiagnostics = await mobile.page.evaluate(() => Object.fromEntries(['.intent strong','.enemy-hp','.enemy-status','.enemy-name','.block-label','.hand .card-description','.end-turn','.battle-controls'].map(selector => {
      const el=document.querySelector(selector),box=el.getBoundingClientRect(),style=getComputedStyle(el);
      return [selector,{fontSize:style.fontSize,lineHeight:style.lineHeight,top:box.top,bottom:box.bottom,visibleWithinViewport:box.top>=0&&box.bottom<=innerHeight}];
    })));
    await shot(mobile.page,'44_combat_mobile_390_viewport','Combat initial 390x844 viewport / no scrolling',{fullPage:false});
    const s=structuredClone(swarm);s.relics.push('live-camera');
    await boot(mobile.page,s);
    await shot(mobile.page,'45_sybil_intents_mobile_390','Five-target swarm + Live Camera at 390 CSS px');
    await shot(mobile.page,'46_sybil_intents_mobile_390_viewport','Five-target swarm + Live Camera / initial 390x844 viewport',{fullPage:false});
    await boot(mobile.page,fixtures.rest);
    await shot(mobile.page,'47_rest_mobile_390_viewport','Rest initial 390x844 viewport / sticky footer',{fullPage:false});
    await boot(mobile.page,fixtures.shop);
    await shot(mobile.page,'48_shop_mobile_390_viewport','Shop initial 390x844 viewport / sticky footer',{fullPage:false});
    await mobile.context.close();
  }
  report.passed=true;
} catch(error) {
  report.passed=false;report.failure=error.stack||String(error);process.exitCode=1;console.error(report.failure);
} finally {
  report.finishedAt=new Date().toISOString();
  report.blockedExternal=[...new Set(report.blockedExternal)];
  await writeFile('docs/art_audit/capture-report.json',JSON.stringify(report,null,2));
  await browser.close();
  console.log(`Saved ${report.shots.length} screenshots; passed=${report.passed}`);
}
