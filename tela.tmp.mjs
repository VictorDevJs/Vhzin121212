import { chromium } from 'playwright';
const base='http://localhost:3376';
const cap='/tmp/claude-0/-home-user-Vhzin121212/05d4ab06-464b-53f0-8a5e-ee64dd5a72ec/scratchpad';
const erros=[];
const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await (await nav.newContext({viewport:{width:1440,height:960}})).newPage();
p.on('pageerror',e=>erros.push('[pageerror] '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('fonts.g')&&!m.text().includes('CONNECTION_RESET'))erros.push('[console] '+m.text())});
await p.goto(base); await p.waitForTimeout(2000);
console.log('título:', await p.title());
console.log('h1:', (await p.locator('.heroi h1').textContent()||'').trim());
console.log('números:', (await p.locator('.numeros').textContent()||'').replace(/\s+/g,' ').trim());
console.log('brasão 3D:', await p.locator('.brasao-3d').count(), '| seções:', await p.locator('.secao').count());
console.log('loja no site:', await p.locator('#loja .produto').count(), 'produtos');
console.log('planos:', await p.locator('#planos .cartao-plano').count());
await p.screenshot({path:`${cap}/N1-site.png`, fullPage:true});
await p.fill('input[name=email]','dono@atak.com'); await p.fill('input[name=senha]','admin123');
await p.click('.painel-acesso button[type=submit]'); await p.waitForSelector('.lateral',{timeout:9000}); await p.waitForTimeout(1800);
await p.screenshot({path:`${cap}/N2-painel.png`, fullPage:true});
for (const t of ['checkin','loja','financeiro','alunos','grade','avaliacoes','certificados','turmas','planos','chamada','avisos','equipe']) {
  await p.goto(`${base}/#/${t}`); await p.waitForTimeout(1500);
  const e = await p.locator('.pagina > .mensagem-erro').count();
  console.log(`  ${t}: ${e? 'ERRO → '+await p.locator('.pagina > .mensagem-erro').textContent() : 'ok'}`);
}
await p.goto(`${base}/#/checkin`); await p.waitForTimeout(1600);
await p.screenshot({path:`${cap}/N3-checkins.png`, fullPage:true});
await p.goto(`${base}/#/loja`); await p.waitForTimeout(1600);
await p.screenshot({path:`${cap}/N4-loja.png`, fullPage:true});
// aluno
await p.evaluate(()=>localStorage.clear()); await p.goto(base); await p.waitForTimeout(1200);
await p.fill('input[name=email]','lucas0@email.com'); await p.fill('input[name=senha]','aluno123');
await p.click('.painel-acesso button[type=submit]'); await p.waitForSelector('.lateral',{timeout:9000}); await p.waitForTimeout(1500);
await p.goto(`${base}/#/checkin`); await p.waitForTimeout(1600);
console.log('aluno · botão de check-in:', await p.locator('.botao-checkin').count(), '| indicadores:', await p.locator('.indicador').count());
await p.screenshot({path:`${cap}/N5-checkin-aluno.png`, fullPage:true});
await p.setViewportSize({width:390,height:844}); await p.waitForTimeout(800);
await p.screenshot({path:`${cap}/N6-mobile.png`});
await nav.close();
console.log('\nERROS:', erros.length); erros.slice(0,12).forEach(e=>console.log(' -',e));
