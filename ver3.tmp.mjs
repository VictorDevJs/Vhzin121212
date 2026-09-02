import { chromium } from 'playwright';
const BASE = 'http://localhost:3399';
const SCRATCH = process.env.SCRATCH;
const CONTAS = {
  dono: ['dono@atak.com', 'admin123'], mestre: ['ricardo@atak.com', 'mestre123'],
  recepcao: ['recepcao@atak.com', 'recepcao123'], aluno: ['lucas0@email.com', 'aluno123'],
};
const TELAS = ['painel', 'analises', 'checkin', 'grade', 'chamada', 'avisos', 'avaliacoes',
  'competicoes', 'competidores', 'alunos', 'turmas', 'graduacoes', 'certificados',
  'planos', 'loja', 'financeiro', 'equipe', 'seguranca', 'minha-area'];
const IGNORAR = /fonts\.googleapis|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|favicon/;
const erros = [];
const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

for (const [papel, [email, senha]] of Object.entries(CONTAS)) {
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 950 } });
  const pagina = await contexto.newPage();
  pagina.on('console', (m) => { if (m.type() === 'error' && !IGNORAR.test(m.text())) erros.push(`[${papel}] ${m.text()}`); });
  pagina.on('pageerror', (e) => erros.push(`[${papel}] pageerror: ${e.message}`));
  await pagina.goto(BASE, { waitUntil: 'domcontentloaded' });
  await pagina.evaluate(async ([e, s]) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, senha: s }) });
    localStorage.setItem('academia.token', (await r.json()).token);
  }, [email, senha]);
  await pagina.goto(`${BASE}/#/painel`, { waitUntil: 'domcontentloaded' });
  await pagina.reload({ waitUntil: 'networkidle' });
  await pagina.waitForSelector('.lateral .item-menu');
  let ok = 0;
  for (const tela of TELAS) {
    await pagina.evaluate((t) => { window.location.hash = `#/${t}`; }, tela);
    await pagina.waitForTimeout(700);
    const e = await pagina.evaluate(() => ({
      hash: decodeURIComponent(location.hash),
      erro: [...document.querySelectorAll('.pagina .mensagem-erro')].filter((n) => n.offsetParent).map((n) => n.textContent).join(' | '),
      esqueleto: !!document.querySelector('.pagina .esqueleto'),
      explicacao: !!document.querySelector('.pagina .explicacao'),
    }));
    if (e.hash !== `#/${tela}`) continue;
    if (e.erro) { erros.push(`[${papel}/${tela}] ${e.erro}`); continue; }
    if (e.esqueleto) { erros.push(`[${papel}/${tela}] travou`); continue; }
    if (!e.explicacao) erros.push(`[${papel}/${tela}] sem explicação`);
    ok += 1;
  }
  console.log(`${papel.padEnd(9)} ${ok} telas ok`);
  await contexto.close();
}

for (const tema of ['light', 'dark']) {
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 950 }, colorScheme: tema });
  const pagina = await contexto.newPage();
  pagina.on('pageerror', (e) => erros.push(`[site/${tema}] pageerror: ${e.message}`));
  pagina.on('console', (m) => { if (m.type() === 'error' && !IGNORAR.test(m.text())) erros.push(`[site/${tema}] ${m.text()}`); });
  await pagina.goto(BASE, { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(700);
  const s = await pagina.evaluate(() => ({
    secoes: [...document.querySelectorAll('.secao')].map((x) => x.id),
    faixa: document.querySelectorAll('.dado-faixa').length,
    contraste: getComputedStyle(document.querySelector('.heroi h1')).color,
    fundoTopo: getComputedStyle(document.querySelector('.heroi')).backgroundColor,
  }));
  console.log(`site ${tema}: ${s.secoes.length} seções · faixa ${s.faixa} · título ${s.contraste} sobre ${s.fundoTopo}`);
  await pagina.locator('.site-topo .botao', { hasText: 'Entrar' }).click();
  await pagina.waitForTimeout(400);
  if (!(await pagina.locator('.fundo-modal .acesso-janela').count())) erros.push(`[site/${tema}] janela de acesso não abriu`);
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(200);
  await pagina.screenshot({ path: `${SCRATCH}/V-site-${tema}.png` });
  await contexto.close();
}

await navegador.close();
console.log(erros.length ? `\nPROBLEMAS (${erros.length}):\n${erros.join('\n')}` : '\nTudo certo.');
