import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_ARQUIVO = ':memory:';
process.env.DONO_EMAIL = 'dono@teste.com';
process.env.DONO_SENHA = 'admin123';

const { criarApp } = await import('../server/index.js');

const servidor = criarApp().listen(0);
const base = `http://localhost:${servidor.address().port}`;
test.after(() => servidor.close());

async function chamar(metodo, caminho, { token, corpo } = {}) {
  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await resposta.json().catch(() => null);
  return { status: resposta.status, dados };
}

const estado = {};

test('login do dono criado na primeira execucao', async () => {
  const { status, dados } = await chamar('POST', '/api/auth/login', {
    corpo: { email: 'dono@teste.com', senha: 'admin123' },
  });
  assert.equal(status, 200);
  assert.equal(dados.usuario.papel, 'dono');
  assert.ok(dados.token);
  estado.tokenDono = dados.token;
});

test('login recusa senha errada', async () => {
  const { status } = await chamar('POST', '/api/auth/login', {
    corpo: { email: 'dono@teste.com', senha: 'errada' },
  });
  assert.equal(status, 401);
});

test('rota protegida exige token', async () => {
  const { status } = await chamar('GET', '/api/alunos');
  assert.equal(status, 401);
});

test('pagina publica da academia funciona sem login', async () => {
  const { status, dados } = await chamar('GET', '/api/publico/academia');
  assert.equal(status, 200);
  assert.ok(dados.modalidades.length >= 6, 'modalidades iniciais criadas');
  assert.ok(dados.grade.length > 0, 'grade de horarios inicial');
  assert.ok(dados.planos.length > 0, 'planos iniciais');
});

test('aluno se cadastra sozinho e entra como pendente', async () => {
  const { status, dados } = await chamar('POST', '/api/auth/registrar', {
    corpo: { nome: 'Aluno Teste', email: 'aluno@teste.com', senha: 'aluno123', data_nascimento: '2000-05-10' },
  });
  assert.equal(status, 201);
  assert.equal(dados.usuario.aluno.status, 'pendente');
  assert.equal(dados.usuario.aluno.categoria, 'adulto');
  estado.tokenAluno = dados.token;
  estado.alunoId = dados.usuario.aluno.id;
});

test('cadastro nao aceita e-mail repetido', async () => {
  const { status } = await chamar('POST', '/api/auth/registrar', {
    corpo: { nome: 'Outro', email: 'aluno@teste.com', senha: 'aluno123' },
  });
  assert.equal(status, 409);
});

test('dono cadastra modalidade, turma e horario', async () => {
  const modalidade = await chamar('POST', '/api/modalidades', {
    token: estado.tokenDono, corpo: { nome: 'Judo', descricao: 'Quedas e imobilizacoes', cor: '#4a3aa7' },
  });
  assert.equal(modalidade.status, 201);
  estado.modalidadeId = modalidade.dados.id;

  const turma = await chamar('POST', '/api/turmas', {
    token: estado.tokenDono,
    corpo: {
      nome: 'Judo Noite', modalidade_id: estado.modalidadeId, categoria: 'adulto', capacidade: 2,
      horarios: [{ dia_semana: 2, hora_inicio: '19:00', hora_fim: '20:00' }],
    },
  });
  assert.equal(turma.status, 201);
  assert.equal(turma.dados.horarios.length, 1);
  estado.turmaId = turma.dados.id;

  const horario = await chamar('POST', `/api/turmas/${estado.turmaId}/horarios`, {
    token: estado.tokenDono, corpo: { dia_semana: 4, hora_inicio: '19:00', hora_fim: '20:00' },
  });
  assert.equal(horario.status, 201);
});

test('horario invalido e recusado', async () => {
  const { status } = await chamar('POST', `/api/turmas/${estado.turmaId}/horarios`, {
    token: estado.tokenDono, corpo: { dia_semana: 5, hora_inicio: '20:00', hora_fim: '19:00' },
  });
  assert.equal(status, 400);
});

test('aluno nao pode criar turma', async () => {
  const { status } = await chamar('POST', '/api/turmas', {
    token: estado.tokenAluno, corpo: { nome: 'Turma do aluno', modalidade_id: estado.modalidadeId },
  });
  assert.equal(status, 403);
});

test('dono cria plano e matricula o aluno', async () => {
  const plano = await chamar('POST', '/api/planos', {
    token: estado.tokenDono,
    corpo: { nome: 'Plano Teste', valor: 200, periodicidade: 'mensal', modalidades: [estado.modalidadeId] },
  });
  assert.equal(plano.status, 201);
  assert.equal(plano.dados.modalidades.length, 1);
  estado.planoId = plano.dados.id;

  const matricula = await chamar('POST', '/api/matriculas', {
    token: estado.tokenDono, corpo: { aluno_id: estado.alunoId, plano_id: estado.planoId, dia_vencimento: 10 },
  });
  assert.equal(matricula.status, 201);
  assert.equal(matricula.dados.status, 'ativa');

  const aluno = await chamar('GET', `/api/alunos/${estado.alunoId}`, { token: estado.tokenDono });
  assert.equal(aluno.dados.status, 'ativo', 'matricula ativa o aluno');
  assert.equal(aluno.dados.mensalidades.length, 1, 'primeira mensalidade gerada');
  estado.mensalidadeId = aluno.dados.mensalidades[0].id;
});

test('pagamento da mensalidade vira receita no financeiro', async () => {
  const pagamento = await chamar('POST', `/api/financeiro/mensalidades/${estado.mensalidadeId}/pagar`, {
    token: estado.tokenDono, corpo: { forma_pagamento: 'pix' },
  });
  assert.equal(pagamento.status, 200);
  assert.equal(pagamento.dados.status, 'pago');

  const resumo = await chamar('GET', '/api/financeiro/resumo', { token: estado.tokenDono });
  assert.equal(resumo.status, 200);
  assert.equal(resumo.dados.receitas, 200);

  const repetido = await chamar('POST', `/api/financeiro/mensalidades/${estado.mensalidadeId}/pagar`, {
    token: estado.tokenDono, corpo: {},
  });
  assert.equal(repetido.status, 409, 'nao deixa pagar duas vezes');
});

test('geracao de mensalidades do mes nao duplica', async () => {
  const primeira = await chamar('POST', '/api/financeiro/mensalidades/gerar', {
    token: estado.tokenDono, corpo: {},
  });
  assert.equal(primeira.status, 200);
  const segunda = await chamar('POST', '/api/financeiro/mensalidades/gerar', {
    token: estado.tokenDono, corpo: {},
  });
  assert.equal(segunda.dados.criadas, 0);
});

test('despesa e restrita ao dono', async () => {
  const equipe = await chamar('POST', '/api/usuarios', {
    token: estado.tokenDono,
    corpo: { nome: 'Recepcao Teste', email: 'recepcao@teste.com', senha: 'recep123', papel: 'recepcao' },
  });
  assert.equal(equipe.status, 201);
  const login = await chamar('POST', '/api/auth/login', {
    corpo: { email: 'recepcao@teste.com', senha: 'recep123' },
  });
  estado.tokenRecepcao = login.dados.token;

  const despesa = await chamar('POST', '/api/financeiro/lancamentos', {
    token: estado.tokenRecepcao,
    corpo: { tipo: 'despesa', categoria: 'aluguel', descricao: 'Aluguel', valor: 1000 },
  });
  assert.equal(despesa.status, 403);

  const receita = await chamar('POST', '/api/financeiro/lancamentos', {
    token: estado.tokenRecepcao,
    corpo: { tipo: 'receita', categoria: 'produtos', descricao: 'Camiseta', valor: 80 },
  });
  assert.equal(receita.status, 201);

  const resumo = await chamar('GET', '/api/financeiro/resumo', { token: estado.tokenRecepcao });
  assert.equal(resumo.status, 403, 'resumo consolidado e so do dono');
});

test('capacidade da turma e respeitada', async () => {
  await chamar('POST', `/api/turmas/${estado.turmaId}/alunos`, {
    token: estado.tokenDono, corpo: { aluno_id: estado.alunoId },
  });
  const outros = [];
  for (const nome of ['Aluno 2', 'Aluno 3']) {
    const criado = await chamar('POST', '/api/alunos', { token: estado.tokenDono, corpo: { nome } });
    outros.push(criado.dados.id);
  }
  const segundo = await chamar('POST', `/api/turmas/${estado.turmaId}/alunos`, {
    token: estado.tokenDono, corpo: { aluno_id: outros[0] },
  });
  assert.equal(segundo.status, 201);
  const terceiro = await chamar('POST', `/api/turmas/${estado.turmaId}/alunos`, {
    token: estado.tokenDono, corpo: { aluno_id: outros[1] },
  });
  assert.equal(terceiro.status, 409, 'turma com 2 vagas nao aceita o terceiro');
});

test('chamada salva e atualiza a presenca', async () => {
  const salvar = await chamar('POST', '/api/presencas', {
    token: estado.tokenDono,
    corpo: { turma_id: estado.turmaId, data: '2026-03-10', presencas: [{ aluno_id: estado.alunoId, presente: 1 }] },
  });
  assert.equal(salvar.status, 200);

  const lista = await chamar('GET', `/api/presencas?turma_id=${estado.turmaId}&data=2026-03-10`, {
    token: estado.tokenDono,
  });
  const marcado = lista.dados.alunos.find((a) => a.id === estado.alunoId);
  assert.equal(marcado.presente, 1);

  await chamar('POST', '/api/presencas', {
    token: estado.tokenDono,
    corpo: { turma_id: estado.turmaId, data: '2026-03-10', presencas: [{ aluno_id: estado.alunoId, presente: 0 }] },
  });
  const relista = await chamar('GET', `/api/presencas?turma_id=${estado.turmaId}&data=2026-03-10`, {
    token: estado.tokenDono,
  });
  assert.equal(relista.dados.alunos.find((a) => a.id === estado.alunoId).presente, 0);
});

test('aviso por turma so aparece para quem esta na turma', async () => {
  const aviso = await chamar('POST', '/api/avisos', {
    token: estado.tokenDono,
    corpo: { titulo: 'Treino extra de Judo', mensagem: 'Sabado as 10h', tipo: 'evento', publico: 'turma', turma_id: estado.turmaId },
  });
  assert.equal(aviso.status, 201);

  const doAluno = await chamar('GET', '/api/avisos', { token: estado.tokenAluno });
  assert.ok(doAluno.dados.some((a) => a.titulo === 'Treino extra de Judo'));

  const outro = await chamar('POST', '/api/auth/registrar', {
    corpo: { nome: 'Fora da turma', email: 'fora@teste.com', senha: 'aluno123' },
  });
  const deFora = await chamar('GET', '/api/avisos', { token: outro.dados.token });
  assert.ok(!deFora.dados.some((a) => a.titulo === 'Treino extra de Judo'));
});

test('area do aluno mostra plano, horarios e mensalidades', async () => {
  const { status, dados } = await chamar('GET', '/api/minha-area', { token: estado.tokenAluno });
  assert.equal(status, 200);
  assert.equal(dados.matricula.plano, 'Plano Teste');
  assert.ok(dados.horarios.length >= 1);
  assert.ok(dados.mensalidades.length >= 1);
});

test('grade de horarios lista as aulas da semana', async () => {
  const { status, dados } = await chamar('GET', '/api/turmas/grade', { token: estado.tokenAluno });
  assert.equal(status, 200);
  assert.equal(dados.dias.length, 7);
  assert.ok(dados.aulas.length > 0);
});

test('painel do dono traz numeros da academia', async () => {
  const { status, dados } = await chamar('GET', '/api/painel', { token: estado.tokenDono });
  assert.equal(status, 200);
  assert.ok(dados.alunos.total >= 1);
  assert.ok(dados.financeiro.receitas >= 200);
  assert.ok(Array.isArray(dados.por_modalidade));
});

test('sistema mantem ao menos um dono ativo', async () => {
  const donos = await chamar('GET', '/api/usuarios?papel=dono', { token: estado.tokenDono });
  const dono = donos.dados[0];
  const { status } = await chamar('PUT', `/api/usuarios/${dono.id}`, {
    token: estado.tokenDono, corpo: { ativo: 0 },
  });
  assert.equal(status, 409);
});

/* ---------------------------------------------------------------------------
   Avaliacoes, certificados e monitoramento por arte marcial
   --------------------------------------------------------------------------- */

test('visitante avalia pelo site e a nota so aparece depois de aprovada', async () => {
  const enviada = await chamar('POST', '/api/publico/avaliacoes', {
    corpo: { autor_nome: 'Vizinho Curioso', nota: 5, comentario: 'Fiz aula experimental e adorei.' },
  });
  assert.equal(enviada.status, 201);

  const antes = await chamar('GET', '/api/publico/academia');
  assert.equal(antes.dados.avaliacoes.length, 0, 'pendente nao aparece na vitrine');

  const naFila = await chamar('GET', '/api/avaliacoes?status=pendente', { token: estado.tokenDono });
  const pendente = naFila.dados.avaliacoes.find((a) => a.autor_nome === 'Vizinho Curioso');
  assert.ok(pendente, 'avaliacao entra na fila de moderacao');

  const aprovada = await chamar('PUT', `/api/avaliacoes/${pendente.id}`, {
    token: estado.tokenDono, corpo: { status: 'aprovada', resposta: 'Obrigado! Te esperamos no tatame.' },
  });
  assert.equal(aprovada.dados.status, 'aprovada');

  const depois = await chamar('GET', '/api/publico/academia');
  assert.equal(depois.dados.avaliacoes.length, 1);
  assert.equal(depois.dados.resumo_avaliacoes.media, 5);
});

test('nota fora de 1 a 5 e recusada', async () => {
  const zero = await chamar('POST', '/api/publico/avaliacoes', { corpo: { autor_nome: 'Teste', nota: 0 } });
  assert.equal(zero.status, 400);
  const seis = await chamar('POST', '/api/publico/avaliacoes', { corpo: { autor_nome: 'Teste', nota: 6 } });
  assert.equal(seis.status, 400);
});

test('aluno avalia e acompanha a propria avaliacao', async () => {
  const enviada = await chamar('POST', '/api/avaliacoes', {
    token: estado.tokenAluno, corpo: { nota: 4, comentario: 'Turma da noite muito boa.' },
  });
  assert.equal(enviada.status, 201);

  const minhas = await chamar('GET', '/api/avaliacoes/minhas', { token: estado.tokenAluno });
  assert.equal(minhas.dados.length, 1);
  assert.equal(minhas.dados[0].status, 'pendente');
  assert.equal(minhas.dados[0].origem, 'aluno');
});

test('somente o dono publica certificados', async () => {
  const recepcao = await chamar('POST', '/api/certificados', {
    token: estado.tokenRecepcao,
    corpo: { titulo: 'Faixa preta', pessoa_nome: 'Alguem' },
  });
  assert.equal(recepcao.status, 403);

  const criado = await chamar('POST', '/api/certificados', {
    token: estado.tokenDono,
    corpo: {
      titulo: 'Faixa preta de Jiu-Jitsu', pessoa_nome: 'Mestre Teste', tipo: 'mestre',
      entidade: 'CBJJ', registro: 'CBJJ-0001', publicar_site: 1,
    },
  });
  assert.equal(criado.status, 201);

  const naVitrine = await chamar('GET', '/api/publico/academia');
  assert.ok(naVitrine.dados.certificados.some((c) => c.registro === 'CBJJ-0001'));

  const escondido = await chamar('PUT', `/api/certificados/${criado.dados.id}`, {
    token: estado.tokenDono, corpo: { publicar_site: 0 },
  });
  assert.equal(escondido.dados.publicar_site, 0);
  const semEle = await chamar('GET', '/api/publico/academia');
  assert.ok(!semEle.dados.certificados.some((c) => c.registro === 'CBJJ-0001'), 'sai do site quando desmarcado');
});

test('upload aceita imagem e recusa formato estranho', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const ok = await chamar('POST', '/api/arquivos', { token: estado.tokenDono, corpo: { conteudo: png } });
  assert.equal(ok.status, 201);
  assert.match(ok.dados.url, /^\/arquivos\/[\w-]+\.png$/);

  const ruim = await chamar('POST', '/api/arquivos', {
    token: estado.tokenDono, corpo: { conteudo: 'data:application/x-msdownload;base64,QQ==' },
  });
  assert.equal(ruim.status, 400);
});

test('mensalidades divididas por arte marcial fecham com o total do mes', async () => {
  const dados = await chamar('GET', '/api/financeiro/por-modalidade', { token: estado.tokenDono });
  assert.equal(dados.status, 200);
  const somaFatias = dados.dados.modalidades.reduce((soma, linha) => soma + linha.previsto, 0);
  const semTurma = dados.dados.sem_turma?.previsto ?? 0;
  assert.equal(
    Number((somaFatias + semTurma).toFixed(2)),
    Number(dados.dados.total_previsto.toFixed(2)),
    'o rateio nao pode inventar nem perder dinheiro',
  );
});

/* ---------------------------------------------------------------------------
   Check-in do treino e loja
   --------------------------------------------------------------------------- */

test('check-in exige que a aula esteja na grade do aluno', async () => {
  const fora = await chamar('POST', '/api/checkins', {
    token: estado.tokenAluno, corpo: { horario_id: 999999 },
  });
  assert.equal(fora.status, 404);
});

test('aluno vê as aulas de hoje e os próprios números de treino', async () => {
  const { status, dados } = await chamar('GET', '/api/checkins/agora', { token: estado.tokenAluno });
  assert.equal(status, 200);
  assert.ok(Array.isArray(dados.aulas));
  assert.equal(typeof dados.totais.total, 'number');
  assert.equal(dados.totais.dias.length, 7, 'a semana do aluno tem sete dias');
});

test('resumo de check-ins mostra as aulas do dia para a academia', async () => {
  const { status, dados } = await chamar('GET', '/api/checkins/resumo', { token: estado.tokenDono });
  assert.equal(status, 200);
  assert.ok(Array.isArray(dados.aulas_hoje));
  assert.equal(typeof dados.totais.media_por_aula, 'number');
});

test('aluno não enxerga o resumo da academia', async () => {
  const { status } = await chamar('GET', '/api/checkins/resumo', { token: estado.tokenAluno });
  assert.equal(status, 403);
});

test('somente o dono cadastra produto na loja', async () => {
  const recusado = await chamar('POST', '/api/loja/produtos', {
    token: estado.tokenRecepcao, corpo: { nome: 'Kimono', preco: 100 },
  });
  assert.equal(recusado.status, 403);

  const criado = await chamar('POST', '/api/loja/produtos', {
    token: estado.tokenDono,
    corpo: { nome: 'Kimono de teste', preco: 400, categoria: 'kimono', estoque: 2, tamanhos: 'A2, A3' },
  });
  assert.equal(criado.status, 201);
  estado.produtoId = criado.dados.id;
});

test('venda baixa o estoque e vira receita no caixa', async () => {
  const antes = await chamar('GET', '/api/financeiro/resumo', { token: estado.tokenDono });

  const venda = await chamar('POST', '/api/loja/vendas', {
    token: estado.tokenRecepcao,
    corpo: { cliente_nome: 'Cliente do teste', forma_pagamento: 'pix',
      itens: [{ produto_id: estado.produtoId, quantidade: 2 }] },
  });
  assert.equal(venda.status, 201);
  assert.equal(venda.dados.total, 800);

  const catalogo = await chamar('GET', '/api/loja/produtos', { token: estado.tokenDono });
  const produto = catalogo.dados.produtos.find((p) => p.id === estado.produtoId);
  assert.equal(produto.estoque, 0, 'o estoque foi baixado');

  const depois = await chamar('GET', '/api/financeiro/resumo', { token: estado.tokenDono });
  assert.equal(depois.dados.receitas - antes.dados.receitas, 800, 'a venda entrou como receita');
});

test('venda sem estoque é recusada', async () => {
  const { status, dados } = await chamar('POST', '/api/loja/vendas', {
    token: estado.tokenDono,
    corpo: { itens: [{ produto_id: estado.produtoId, quantidade: 1 }] },
  });
  assert.equal(status, 409);
  assert.match(dados.erro, /[Ee]stoque/);
});

test('a loja da página pública mostra só o que está publicado', async () => {
  const antes = await chamar('GET', '/api/publico/academia');
  const quantidade = antes.dados.produtos.length;

  await chamar('PUT', `/api/loja/produtos/${estado.produtoId}`, {
    token: estado.tokenDono, corpo: { publicar_site: 0 },
  });
  const depois = await chamar('GET', '/api/publico/academia');
  assert.equal(depois.dados.produtos.length, quantidade - 1);
});
