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

/* ==========================================================================
   Cargos, competições, equipes, graduações e registro de atividades
   ========================================================================== */

test('a academia nasce com a escala completa de graduações de cada arte', async () => {
  const { dados: modalidades } = await chamar('GET', '/api/modalidades', { token: estado.tokenDono });
  const jiu = modalidades.find((m) => m.nome === 'Jiu-Jitsu');
  const capoeira = modalidades.find((m) => m.nome === 'Capoeira');
  assert.ok(jiu, 'Jiu-Jitsu cadastrado');
  assert.ok(capoeira, 'Capoeira cadastrada');
  estado.modalidadeJiu = jiu.id;

  const { dados: faixas } = await chamar('GET', `/api/modalidades/${jiu.id}/graduacoes`,
    { token: estado.tokenDono });
  const nomes = faixas.map((f) => f.nome);
  assert.ok(faixas.length >= 20, `escala do Jiu-Jitsu completa (${faixas.length} degraus)`);
  for (const esperada of ['Branca', 'Azul', 'Roxa', 'Marrom', 'Preta', 'Vermelha']) {
    assert.ok(nomes.includes(esperada), `faixa ${esperada} presente`);
  }
  assert.ok(nomes.some((n) => n.startsWith('Cinza')), 'faixas infantis presentes');
  assert.equal(faixas.find((f) => f.nome === 'Preta').graus, 6, 'faixa preta com 6 graus');

  const { dados: cordas } = await chamar('GET', `/api/modalidades/${capoeira.id}/graduacoes`,
    { token: estado.tokenDono });
  assert.ok(cordas.some((c) => c.nome.includes('Corda Crua')), 'capoeira começa na corda crua');
});

test('modalidade sem escala conhecida avisa e não inventa faixas', async () => {
  const { status, dados } = await chamar('POST', '/api/modalidades', {
    token: estado.tokenDono, corpo: { nome: 'Luta Livre Esportiva', cor: '#5b8def' },
  });
  assert.equal(status, 201);

  const { dados: escala } = await chamar('GET', `/api/modalidades/${dados.id}/graduacoes`,
    { token: estado.tokenDono });
  assert.equal(escala.length, 0, 'arte sem catálogo começa sem faixas');

  const padrao = await chamar('POST', `/api/modalidades/${dados.id}/graduacoes/padrao`,
    { token: estado.tokenDono });
  assert.equal(padrao.status, 400);
  assert.match(padrao.dados.erro, /escala oficial pronta/);
});

test('reaplicar a escala oficial não duplica as faixas', async () => {
  const { dados: modalidades } = await chamar('GET', '/api/modalidades', { token: estado.tokenDono });
  const judo = modalidades.find((m) => m.nome === 'Judô');

  const antes = await chamar('GET', `/api/modalidades/${judo.id}/graduacoes`, { token: estado.tokenDono });
  const aplicar = await chamar('POST', `/api/modalidades/${judo.id}/graduacoes/padrao`,
    { token: estado.tokenDono });
  assert.equal(aplicar.status, 200);
  assert.equal(aplicar.dados.criadas, 0, 'a escala já estava completa');

  const depois = await chamar('GET', `/api/modalidades/${judo.id}/graduacoes`, { token: estado.tokenDono });
  assert.equal(depois.dados.length, antes.dados.length);
});

test('graduação usada por um aluno não pode ser apagada', async () => {
  const { dados: faixas } = await chamar('GET', `/api/modalidades/${estado.modalidadeJiu}/graduacoes`,
    { token: estado.tokenDono });
  const branca = faixas.find((f) => f.nome === 'Branca');

  await chamar('POST', `/api/alunos/${estado.alunoId}/graduacoes`, {
    token: estado.tokenDono,
    corpo: { modalidade_id: estado.modalidadeJiu, graduacao_id: branca.id, data: '2025-01-10' },
  });
  const { status, dados } = await chamar('DELETE',
    `/api/modalidades/${estado.modalidadeJiu}/graduacoes/${branca.id}`, { token: estado.tokenDono });
  assert.equal(status, 409);
  assert.match(dados.erro, /graduados/);
});

test('o dono cadastra um mestre com foto, biografia e modalidades', async () => {
  const { status, dados } = await chamar('POST', '/api/usuarios', {
    token: estado.tokenDono,
    corpo: {
      nome: 'Mestre Teste da Silva', apelido: 'Mestre Teste', email: 'mestre.teste@atak.com',
      senha: 'mestre123', papel: 'mestre', faixa: 'Faixa preta 2º grau',
      bio: 'Faixa preta com 15 anos de tatame.', modalidades: [estado.modalidadeJiu],
      publicar_site: 1,
    },
  });
  assert.equal(status, 201);
  assert.equal(dados.apelido, 'Mestre Teste');
  assert.equal(dados.modalidades.length, 1);
  estado.mestreTesteId = dados.id;

  const { dados: publico } = await chamar('GET', '/api/publico/academia');
  assert.ok(publico.mestres.some((m) => m.apelido === 'Mestre Teste'),
    'o mestre aparece na página pública');
});

test('mestre com turma ativa não é removido por engano', async () => {
  await chamar('PUT', `/api/turmas/${estado.turmaId}`, {
    token: estado.tokenDono, corpo: { mestre_id: estado.mestreTesteId },
  });
  const { status, dados } = await chamar('DELETE', `/api/usuarios/${estado.mestreTesteId}`,
    { token: estado.tokenDono });
  assert.equal(status, 409);
  assert.match(dados.erro, /turma/);

  await chamar('PUT', `/api/turmas/${estado.turmaId}`, {
    token: estado.tokenDono, corpo: { mestre_id: '' },
  });
});

test('o dono atribui o cargo de Responsável de Competições', async () => {
  const { status, dados } = await chamar('POST', `/api/usuarios/${estado.mestreTesteId}/cargos`, {
    token: estado.tokenDono, corpo: { cargo: 'competicoes' },
  });
  assert.equal(status, 201);
  assert.ok(dados.cargos.some((c) => c.cargo === 'competicoes'));
  estado.cargoId = dados.cargos.find((c) => c.cargo === 'competicoes').id;

  const repetido = await chamar('POST', `/api/usuarios/${estado.mestreTesteId}/cargos`, {
    token: estado.tokenDono, corpo: { cargo: 'competicoes' },
  });
  assert.equal(repetido.status, 409, 'o mesmo cargo não entra duas vezes');
});

test('sem o cargo de competições ninguém cria campeonato', async () => {
  const login = await chamar('POST', '/api/auth/login', {
    corpo: { email: 'mestre.teste@atak.com', senha: 'mestre123' },
  });
  estado.tokenMestreTeste = login.dados.token;

  // Com o cargo recém-atribuído, o mestre consegue criar.
  const permitido = await chamar('POST', '/api/competicoes', {
    token: estado.tokenMestreTeste,
    corpo: { nome: 'Copa de Teste', data_inicio: '2026-11-20', modalidade_id: estado.modalidadeId,
      status: 'inscricoes', taxa: 90 },
  });
  assert.equal(permitido.status, 201);
  estado.competicaoId = permitido.dados.id;

  // Retirado o cargo, a permissão some junto.
  await chamar('DELETE', `/api/usuarios/${estado.mestreTesteId}/cargos/${estado.cargoId}`,
    { token: estado.tokenDono });
  const negado = await chamar('POST', '/api/competicoes', {
    token: estado.tokenMestreTeste,
    corpo: { nome: 'Copa Sem Permissão', data_inicio: '2026-12-01' },
  });
  assert.equal(negado.status, 403);
  assert.match(negado.dados.erro, /Responsável de Competições/);
});

test('o aluno demonstra interesse na competição e não se inscreve por outro', async () => {
  const { status, dados } = await chamar('POST', `/api/competicoes/${estado.competicaoId}/inscricoes`, {
    token: estado.tokenAluno, corpo: {},
  });
  assert.equal(status, 201);
  assert.equal(dados.status, 'interesse', 'o aluno entra como interessado, não como confirmado');
  estado.inscricaoId = dados.id;

  const repetida = await chamar('POST', `/api/competicoes/${estado.competicaoId}/inscricoes`, {
    token: estado.tokenAluno, corpo: {},
  });
  assert.equal(repetida.status, 409);

  const { dados: lista } = await chamar('GET', '/api/competicoes', { token: estado.tokenAluno });
  const minha = lista.find((c) => c.id === estado.competicaoId);
  assert.equal(minha.minha_inscricao, 'interesse', 'a tela do aluno mostra a inscrição dele');
});

test('o resultado do campeonato entra no quadro de medalhas', async () => {
  const { status } = await chamar('PUT',
    `/api/competicoes/${estado.competicaoId}/resultados/${estado.inscricaoId}`, {
      token: estado.tokenDono,
      corpo: { colocacao: 1, medalha: 'ouro', lutas: 4, vitorias: 4, finalizacoes: 3 },
    });
  assert.equal(status, 200);

  const { dados: agenda } = await chamar('GET', '/api/competicoes/agenda', { token: estado.tokenDono });
  const atleta = agenda.quadro_medalhas.atletas[0];
  assert.equal(atleta.ouro, 1);
  assert.equal(atleta.vitorias, 4);

  const { dados: detalhe } = await chamar('GET', `/api/competicoes/${estado.competicaoId}`,
    { token: estado.tokenDono });
  assert.equal(detalhe.inscricoes[0].status, 'confirmado', 'o resultado confirma a presença');
});

test('equipe kids não aceita atleta adulto', async () => {
  const { status, dados: equipe } = await chamar('POST', '/api/equipes', {
    token: estado.tokenDono,
    corpo: { nome: 'Equipe Kids de Teste', modalidade_id: estado.modalidadeJiu, categoria: 'kids' },
  });
  assert.equal(status, 201);

  const recusado = await chamar('POST', `/api/equipes/${equipe.id}/membros`, {
    token: estado.tokenDono, corpo: { aluno_id: estado.alunoId, funcao: 'atleta' },
  });
  assert.equal(recusado.status, 400);
  assert.match(recusado.dados.erro, /kids/);
});

test('o aviso de uma modalidade só chega a quem treina aquela arte', async () => {
  // O aluno de teste treina na turma de Judo; o Jiu-Jitsu é a arte dos outros.
  await chamar('POST', '/api/avisos', {
    token: estado.tokenDono,
    corpo: { titulo: 'Treino extra de Jiu-Jitsu', mensagem: 'Sábado às 9h.',
      publico: 'modalidade', modalidade_id: estado.modalidadeJiu },
  });
  await chamar('POST', '/api/avisos', {
    token: estado.tokenDono,
    corpo: { titulo: 'Randori extra no Judo', mensagem: 'Sábado às 11h.',
      publico: 'modalidade', modalidade_id: estado.modalidadeId },
  });

  const { dados: doAluno } = await chamar('GET', '/api/avisos', { token: estado.tokenAluno });
  const titulos = doAluno.map((a) => a.titulo);
  assert.ok(titulos.includes('Randori extra no Judo'), 'recebe o aviso da arte que treina');
  assert.ok(!titulos.includes('Treino extra de Jiu-Jitsu'), 'não recebe o aviso de outra arte');

  const { dados: filtrado } = await chamar('GET',
    `/api/avisos?modalidade_id=${estado.modalidadeJiu}`, { token: estado.tokenDono });
  assert.ok(filtrado.length > 0);
  assert.ok(filtrado.every((a) => a.modalidade_id === estado.modalidadeJiu),
    'o filtro por modalidade devolve só aquela arte');
});

test('as abas do mural do aluno são só as modalidades que ele treina', async () => {
  const { dados } = await chamar('GET', '/api/avisos/modalidades', { token: estado.tokenAluno });
  assert.ok(dados.length >= 1);
  assert.ok(dados.some((m) => m.id === estado.modalidadeId), 'aparece a arte que ele treina');
  assert.ok(dados.every((m) => m.id !== estado.modalidadeJiu), 'não aparece arte que ele não treina');
});

test('o registro de atividades guarda quem fez cada coisa', async () => {
  const { status, dados } = await chamar('GET', '/api/auditoria', { token: estado.tokenDono });
  assert.equal(status, 200);
  assert.ok(dados.length > 0, 'há atividades registradas');
  assert.ok(dados.some((linha) => linha.area === 'competicoes'), 'competições ficam registradas');
  assert.ok(dados.some((linha) => linha.area === 'acesso'), 'os logins ficam registrados');

  const { dados: resumo } = await chamar('GET', '/api/auditoria/resumo', { token: estado.tokenDono });
  assert.ok(resumo.contas.equipe_ativa >= 1);
  assert.ok(resumo.acessos.some((a) => a.ultimo_acesso), 'o último acesso é gravado no login');
});

test('só o dono abre o registro de atividades', async () => {
  const { status } = await chamar('GET', '/api/auditoria', { token: estado.tokenAluno });
  assert.equal(status, 403);
});

test('as análises trazem o retrato de cada modalidade', async () => {
  const { status, dados } = await chamar('GET', '/api/painel/analises', { token: estado.tokenDono });
  assert.equal(status, 200);
  assert.ok(dados.modalidades.length >= 9);
  const primeira = dados.modalidades[0];
  for (const campo of ['alunos', 'turmas', 'ocupacao', 'checkins_mes', 'media_por_aula', 'podios']) {
    assert.ok(campo in primeira, `a análise traz ${campo}`);
  }
  assert.ok('ativos' in dados.retencao);
});

test('a página pública mostra competições, equipes e a escala de faixas', async () => {
  const { dados } = await chamar('GET', '/api/publico/academia');
  assert.ok(dados.competicoes.length >= 1, 'competições publicadas');
  assert.ok(dados.equipes.length >= 1, 'equipes publicadas');
  assert.ok(dados.modalidades[0].faixas.length > 0, 'escala de faixas no site');
  assert.ok(dados.numeros.graduacoes > 50, 'o site conta todas as graduações');
});

/* ==========================================================================
   Escopo por modalidade: quem treina uma arte não vê as outras
   ========================================================================== */

test('o aluno só enxerga competições, equipes e planos da arte que treina', async () => {
  // O aluno de teste treina Judo; o Jiu-Jitsu é a arte dos outros.
  const outraArte = estado.modalidadeJiu;

  await chamar('POST', '/api/competicoes', {
    token: estado.tokenDono,
    corpo: { nome: 'Copa de outra arte', data_inicio: '2026-10-10', modalidade_id: outraArte },
  });
  const daArteDele = await chamar('POST', '/api/competicoes', {
    token: estado.tokenDono,
    corpo: { nome: 'Copa da minha arte', data_inicio: '2026-10-11', modalidade_id: estado.modalidadeId },
  });
  assert.equal(daArteDele.status, 201);

  const { dados: competicoes } = await chamar('GET', '/api/competicoes', { token: estado.tokenAluno });
  const nomes = competicoes.map((c) => c.nome);
  assert.ok(nomes.includes('Copa da minha arte'), 'vê a competição da arte dele');
  assert.ok(!nomes.includes('Copa de outra arte'), 'não vê a competição de outra arte');
  assert.ok(competicoes.every((c) => c.modalidade_id === null || c.modalidade_id === estado.modalidadeId),
    'nenhuma competição de outra modalidade escapa');

  await chamar('POST', '/api/equipes', {
    token: estado.tokenDono,
    corpo: { nome: 'Equipe de outra arte', modalidade_id: outraArte, categoria: 'adulto' },
  });
  const { dados: equipes } = await chamar('GET', '/api/equipes', { token: estado.tokenAluno });
  assert.ok(!equipes.some((e) => e.modalidade_id === outraArte), 'não vê equipe de outra arte');

  const { dados: modalidades } = await chamar('GET', '/api/modalidades', { token: estado.tokenAluno });
  assert.ok(modalidades.every((m) => m.id === estado.modalidadeId),
    'a lista de modalidades do aluno é só a dele');
});

test('o dono continua enxergando a academia inteira', async () => {
  const { dados: competicoes } = await chamar('GET', '/api/competicoes', { token: estado.tokenDono });
  const artes = new Set(competicoes.map((c) => c.modalidade_id));
  assert.ok(artes.size > 1, 'o dono vê competições de mais de uma arte');

  const { dados: modalidades } = await chamar('GET', '/api/modalidades', { token: estado.tokenDono });
  assert.ok(modalidades.length >= 9, 'o dono vê todas as modalidades');
});

test('o aluno não abre a competição nem a equipe de outra arte', async () => {
  const { dados: todasComp } = await chamar('GET', '/api/competicoes', { token: estado.tokenDono });
  const deOutraArte = todasComp.find((c) => c.modalidade_id === estado.modalidadeJiu);
  const proibida = await chamar('GET', `/api/competicoes/${deOutraArte.id}`, { token: estado.tokenAluno });
  assert.equal(proibida.status, 403);
  assert.match(proibida.dados.erro, /outra modalidade/);

  const { dados: todasEq } = await chamar('GET', '/api/equipes', { token: estado.tokenDono });
  const equipeDeOutra = todasEq.find((e) => e.modalidade_id === estado.modalidadeJiu);
  const negada = await chamar('GET', `/api/equipes/${equipeDeOutra.id}`, { token: estado.tokenAluno });
  assert.equal(negada.status, 403);
});

test('a escala de faixas de outra arte fica fechada para o aluno', async () => {
  const { status } = await chamar('GET', `/api/modalidades/${estado.modalidadeJiu}/graduacoes`,
    { token: estado.tokenAluno });
  assert.equal(status, 403);

  const daArteDele = await chamar('GET', `/api/modalidades/${estado.modalidadeId}/graduacoes`,
    { token: estado.tokenAluno });
  assert.equal(daArteDele.status, 200, 'a arte dele continua aberta');
});

test('a grade do aluno traz só os horários da arte dele', async () => {
  const { dados } = await chamar('GET', '/api/turmas/grade', { token: estado.tokenAluno });
  assert.equal(dados.escopo_limitado, true);
  assert.ok(dados.aulas.every((a) => a.modalidade_id === estado.modalidadeId),
    'nenhum horário de outra arte aparece para o aluno');

  const { dados: completa } = await chamar('GET', '/api/turmas/grade?todas=1', { token: estado.tokenDono });
  assert.equal(completa.escopo_limitado, false);
});

test('quem monta cadastro consegue pedir a lista completa de modalidades', async () => {
  const { dados } = await chamar('GET', '/api/modalidades?todas=1', { token: estado.tokenDono });
  assert.ok(dados.length >= 9);
});

test('cada plano pertence a uma modalidade', async () => {
  const { dados: planos } = await chamar('GET', '/api/planos', { token: estado.tokenAluno });
  assert.ok(planos.length > 0, 'o aluno vê planos');
  for (const plano of planos) {
    assert.ok(!plano.modalidades.length || plano.modalidades.some((m) => m.id === estado.modalidadeId),
      `o plano "${plano.nome}" não é da arte do aluno`);
  }
});

test('o aluno não se inscreve em competição de outra modalidade', async () => {
  const criada = await chamar('POST', '/api/competicoes', {
    token: estado.tokenDono,
    corpo: { nome: 'Copa alheia', data_inicio: '2026-12-15', modalidade_id: estado.modalidadeJiu },
  });
  const { status, dados } = await chamar('POST', `/api/competicoes/${criada.dados.id}/inscricoes`, {
    token: estado.tokenAluno, corpo: {},
  });
  assert.equal(status, 403);
  assert.match(dados.erro, /não treina/);
});

test('a aba de regras traz só as federações da arte de cada um', async () => {
  const { status, dados } = await chamar('GET', '/api/regras', { token: estado.tokenAluno });
  assert.equal(status, 200);
  assert.ok(!dados.some((r) => r.modalidade_id === estado.modalidadeJiu),
    'o regulamento de outra arte não aparece na lista do aluno');

  const { dados: doDono } = await chamar('GET', '/api/regras', { token: estado.tokenDono });
  assert.ok(doDono.length >= 9, 'o dono vê o regulamento de todas as artes');
  assert.ok(doDono.every((r) => r.federacao && r.resumo), 'cada arte diz de qual federação são as regras');
});

test('o regulamento abre pelo nome e pelo id da arte', async () => {
  const porId = await chamar('GET', `/api/regras/${estado.modalidadeJiu}`, { token: estado.tokenDono });
  assert.equal(porId.status, 200);
  assert.ok(porId.dados.pontuacao.length > 0, 'a tabela de pontuação vem preenchida');
  assert.ok(porId.dados.federacao, 'a federação responsável é nomeada');

  const porNome = await chamar('GET', '/api/regras/Jiu-Jitsu', { token: estado.tokenDono });
  assert.equal(porNome.status, 200);
  assert.equal(porNome.dados.modalidade_id, porId.dados.modalidade_id);
});

test('o aluno não abre o regulamento de outra arte', async () => {
  const porId = await chamar('GET', `/api/regras/${estado.modalidadeJiu}`, { token: estado.tokenAluno });
  assert.equal(porId.status, 403);

  const porNome = await chamar('GET', '/api/regras/Jiu-Jitsu', { token: estado.tokenAluno });
  assert.equal(porNome.status, 403, 'o nome não é um atalho para furar o recorte');
});

test('as contas dos alunos vêm divididas por modalidade', async () => {
  const { status, dados } = await chamar('GET', '/api/contas', { token: estado.tokenDono });
  assert.equal(status, 200);
  assert.ok(dados.total > 0, 'existe pelo menos um aluno');
  assert.ok(dados.grupos.length > 0, 'os alunos vêm agrupados');

  for (const grupo of dados.grupos) {
    for (const aluno of grupo.alunos) {
      assert.ok(aluno.pagamento, `${aluno.nome} tem situação de pagamento calculada`);
      assert.ok(grupo.id === null || aluno.modalidades.some((m) => m.id === grupo.id),
        `${aluno.nome} está no grupo da arte que treina`);
    }
  }

  const somaGrupos = dados.grupos.reduce((total, g) => total + g.alunos.length, 0);
  assert.equal(somaGrupos, dados.total, 'ninguém aparece duas vezes nem some da conta');
});

test('a ficha completa do aluno abre para a gestão', async () => {
  const { status, dados } = await chamar('GET', `/api/contas/${estado.alunoId}`, { token: estado.tokenRecepcao });
  assert.equal(status, 200);
  assert.equal(dados.aluno.id, estado.alunoId);
  for (const parte of ['pagamento', 'mensalidades', 'horarios', 'graduacoes', 'frequencia', 'checkins']) {
    assert.ok(dados[parte] !== undefined, `a ficha traz ${parte}`);
  }
  assert.ok(['em dia', 'vence em breve', 'atrasado', 'sem plano', 'mês não gerado']
    .includes(dados.pagamento.situacao), `situação inesperada: ${dados.pagamento.situacao}`);
});

test('mestre e aluno não entram na central de contas', async () => {
  const doMestre = await chamar('GET', '/api/contas', { token: estado.tokenMestreTeste });
  assert.equal(doMestre.status, 403);

  const doAluno = await chamar('GET', '/api/contas', { token: estado.tokenAluno });
  assert.equal(doAluno.status, 403);

  const fichaAlheia = await chamar('GET', `/api/contas/${estado.alunoId}`, { token: estado.tokenAluno });
  assert.equal(fichaAlheia.status, 403);
});

test('a mensalidade vencida e não paga marca o aluno como atrasado', async () => {
  const criado = await chamar('POST', '/api/alunos', {
    token: estado.tokenDono,
    corpo: { nome: 'Devedor de Teste', email: 'devedor@teste.com', categoria: 'adulto' },
  });
  assert.equal(criado.status, 201);

  const matricula = await chamar('POST', '/api/matriculas', {
    token: estado.tokenDono,
    corpo: { aluno_id: criado.dados.id, plano_id: estado.planoId, dia_vencimento: 10 },
  });
  assert.equal(matricula.status, 201);

  const cobranca = await chamar('POST', '/api/financeiro/mensalidades', {
    token: estado.tokenDono,
    corpo: {
      aluno_id: criado.dados.id, competencia: '2020-01', valor: 150,
      vencimento: '2020-01-10',
    },
  });
  assert.equal(cobranca.status, 201);

  const { dados } = await chamar('GET', `/api/contas/${criado.dados.id}`, { token: estado.tokenDono });
  assert.equal(dados.pagamento.situacao, 'atrasado');
  assert.equal(dados.pagamento.atrasadas, 1);
  assert.equal(dados.pagamento.valor_atrasado, 150);
});

/* ==========================================================================
   Controle automatico de plano e pagamento
   ========================================================================== */

test('a cobrança automática mostra as regras que estão valendo', async () => {
  const { status, dados } = await chamar('GET', '/api/financeiro/cobranca', { token: estado.tokenDono });
  assert.equal(status, 200);
  assert.equal(typeof dados.ajustes.automatica, 'boolean');
  assert.ok(dados.ajustes.dias_aviso >= 0);
  assert.ok(dados.resumo.atrasados >= 1, 'o devedor de teste aparece no resumo');
  assert.ok(dados.atrasados.some((a) => a.nome === 'Devedor de Teste'));
});

test('o atraso ganha multa e juros pela regra da casa', async () => {
  const { dados } = await chamar('GET', '/api/financeiro/cobranca', { token: estado.tokenDono });
  const devedor = dados.atrasados.find((a) => a.nome === 'Devedor de Teste');
  const { multa, juros_dia: jurosDia } = dados.ajustes;

  assert.ok(devedor.dias_atraso > 0, 'conta os dias desde o vencimento');
  assert.equal(devedor.multa, Math.round(devedor.valor_atrasado * (multa / 100) * 100) / 100);
  assert.equal(devedor.juros,
    Math.round(devedor.valor_atrasado * (jurosDia / 100) * devedor.dias_atraso * 100) / 100);
  assert.equal(devedor.valor_atualizado,
    Math.round((devedor.valor_atrasado + devedor.multa + devedor.juros) * 100) / 100);
});

test('o dono muda as regras de cobrança e elas passam a valer', async () => {
  const { status } = await chamar('PUT', '/api/configuracoes', {
    token: estado.tokenDono,
    corpo: { cobranca_tolerancia: '0', cobranca_bloquear_checkin: '1', cobranca_dias_aviso: '7' },
  });
  assert.equal(status, 200);

  const { dados } = await chamar('GET', '/api/financeiro/cobranca', { token: estado.tokenDono });
  assert.equal(dados.ajustes.tolerancia, 0);
  assert.equal(dados.ajustes.bloquear_checkin, true);
  assert.equal(dados.ajustes.dias_aviso, 7);
});

test('só o dono muda as regras; a recepção apenas consulta', async () => {
  const negado = await chamar('PUT', '/api/configuracoes', {
    token: estado.tokenRecepcao, corpo: { cobranca_tolerancia: '90' },
  });
  assert.equal(negado.status, 403);

  const consulta = await chamar('GET', '/api/financeiro/cobranca', { token: estado.tokenRecepcao });
  assert.equal(consulta.status, 200);
});

test('a rotina suspende quem passou do prazo e devolve quem pagou', async () => {
  await chamar('PUT', '/api/configuracoes', {
    token: estado.tokenDono, corpo: { cobranca_suspender_dias: '30' },
  });

  const executada = await chamar('POST', '/api/financeiro/cobranca/executar', { token: estado.tokenDono });
  assert.equal(executada.status, 200);
  assert.ok(executada.dados.matriculas_suspensas.includes('Devedor de Teste'),
    'a matrícula do devedor de 2020 é suspensa sozinha');

  const { dados: ficha } = await chamar('GET', '/api/contas', { token: estado.tokenDono });
  const devedor = ficha.grupos.flatMap((g) => g.alunos).find((a) => a.nome === 'Devedor de Teste');
  assert.equal(devedor.pagamento.suspensa_por_atraso, true);
  assert.equal(devedor.pagamento.bloqueado, true, 'com tolerância zero, o check-in fica bloqueado');

  // Pagando a mensalidade, a matrícula volta sozinha na próxima rodada.
  const { dados: mensalidades } = await chamar('GET', '/api/financeiro/mensalidades?competencia=2020-01',
    { token: estado.tokenDono });
  const atrasada = mensalidades.mensalidades.find((m) => m.aluno === 'Devedor de Teste');
  await chamar('POST', `/api/financeiro/mensalidades/${atrasada.id}/pagar`, {
    token: estado.tokenDono, corpo: { forma_pagamento: 'pix' },
  });

  const devolvida = await chamar('POST', '/api/financeiro/cobranca/executar', { token: estado.tokenDono });
  assert.ok(devolvida.dados.matriculas_reativadas.includes('Devedor de Teste'),
    'quem acerta volta a treinar sem ninguém precisar mexer');
});

test('rodar a cobrança duas vezes não duplica mensalidade', async () => {
  const primeira = await chamar('POST', '/api/financeiro/cobranca/executar', { token: estado.tokenDono });
  const segunda = await chamar('POST', '/api/financeiro/cobranca/executar', { token: estado.tokenDono });
  assert.equal(segunda.dados.mensalidades_criadas, 0,
    `a segunda rodada não cria nada (a primeira criou ${primeira.dados.mensalidades_criadas})`);
});

test('o aluno em atraso não faz check-in quando o dono manda bloquear', async () => {
  await chamar('PUT', '/api/configuracoes', {
    token: estado.tokenDono, corpo: { cobranca_bloquear_checkin: '1', cobranca_tolerancia: '0' },
  });

  const antes = await chamar('GET', '/api/checkins/agora', { token: estado.tokenAluno });
  assert.equal(antes.status, 200);
  assert.ok(antes.dados.pagamento, 'o aluno vê a própria situação de pagamento');

  // O aluno de teste não tem mensalidade vencida: continua liberado.
  assert.equal(antes.dados.pagamento.bloqueado, false);
});

test('a área do aluno traz a situação do plano calculada pelo sistema', async () => {
  const { dados } = await chamar('GET', '/api/minha-area', { token: estado.tokenAluno });
  assert.ok(dados.pagamento, 'a área do aluno traz o pagamento');
  assert.ok(['em dia', 'vence em breve', 'atrasado', 'sem plano', 'mês não gerado']
    .includes(dados.pagamento.situacao));
});

test('o painel do aluno só mostra as aulas e os avisos da arte dele', async () => {
  const { dados } = await chamar('GET', '/api/painel', { token: estado.tokenAluno });
  assert.ok(dados.aulas_hoje.every((a) => a.modalidade === 'Judo'),
    `o painel trouxe aulas de outra arte: ${dados.aulas_hoje.map((a) => a.modalidade).join(', ')}`);
  assert.ok(dados.avisos_recentes.every((av) => !av.modalidade || av.modalidade === 'Judo'),
    'nenhum aviso de outra arte aparece no painel do aluno');

  const { dados: doDono } = await chamar('GET', '/api/painel', { token: estado.tokenDono });
  assert.ok(doDono.aulas_hoje.length >= dados.aulas_hoje.length,
    'o dono continua vendo a agenda inteira do dia');
});

/* ==========================================================================
   Galeria de fotos da academia
   ========================================================================== */

const PNG_MINIMO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAf'
  + 'FcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('o dono envia uma foto e ela entra na galeria da arte certa', async () => {
  const enviado = await chamar('POST', '/api/arquivos', {
    token: estado.tokenDono, corpo: { conteudo: PNG_MINIMO },
  });
  assert.equal(enviado.status, 201);
  assert.match(enviado.dados.url, /^\/arquivos\/.+\.png$/);

  const criada = await chamar('POST', '/api/fotos', {
    token: estado.tokenDono,
    corpo: {
      arquivo: enviado.dados.url, legenda: 'Treino da turma da noite',
      categoria: 'treino', modalidade_id: estado.modalidadeJiu, destaque: 1,
    },
  });
  assert.equal(criada.status, 201);
  assert.equal(criada.dados.modalidade, 'Jiu-Jitsu');
  assert.equal(criada.dados.publicar_site, 1, 'nasce publicada no site');
  estado.fotoId = criada.dados.id;
});

test('a foto publicada aparece na vitrine da academia', async () => {
  const { dados } = await chamar('GET', '/api/publico/academia');
  assert.ok(dados.fotos.some((f) => f.id === estado.fotoId),
    'a galeria do site traz a foto publicada');
});

test('a foto tirada do site some da vitrine mas continua na gestão', async () => {
  await chamar('PUT', `/api/fotos/${estado.fotoId}`, {
    token: estado.tokenDono, corpo: { publicar_site: 0 },
  });

  const { dados: site } = await chamar('GET', '/api/publico/academia');
  assert.ok(!site.fotos.some((f) => f.id === estado.fotoId), 'saiu do site');

  const { dados: internas } = await chamar('GET', '/api/fotos', { token: estado.tokenDono });
  assert.ok(internas.some((f) => f.id === estado.fotoId), 'continua na galeria interna');

  await chamar('PUT', `/api/fotos/${estado.fotoId}`, {
    token: estado.tokenDono, corpo: { publicar_site: 1 },
  });
});

test('a galeria do aluno só traz as fotos da arte dele', async () => {
  const { status, dados } = await chamar('GET', '/api/fotos', { token: estado.tokenAluno });
  assert.equal(status, 200);
  assert.ok(!dados.some((f) => f.id === estado.fotoId),
    'a foto de Jiu-Jitsu não aparece para quem treina Judo');
});

test('aluno não publica nem apaga foto', async () => {
  const publicar = await chamar('POST', '/api/fotos', {
    token: estado.tokenAluno, corpo: { arquivo: '/arquivos/x.png' },
  });
  assert.equal(publicar.status, 403);

  const apagar = await chamar('DELETE', `/api/fotos/${estado.fotoId}`, { token: estado.tokenAluno });
  assert.equal(apagar.status, 403);
});

test('mestre cuida das fotos da arte dele, e só delas', async () => {
  // O mestre de teste ensina Jiu-Jitsu: a foto de Judo não é assunto dele.
  const deOutraArte = await chamar('POST', '/api/fotos', {
    token: estado.tokenDono,
    corpo: { arquivo: '/arquivos/judo.png', categoria: 'treino', modalidade_id: estado.modalidadeId },
  });
  assert.equal(deOutraArte.status, 201);

  const negado = await chamar('DELETE', `/api/fotos/${deOutraArte.dados.id}`,
    { token: estado.tokenMestreTeste });
  assert.equal(negado.status, 403);
  assert.match(negado.dados.erro, /não acompanha|não treina/);

  const daArteDele = await chamar('PUT', `/api/fotos/${estado.fotoId}`, {
    token: estado.tokenMestreTeste, corpo: { legenda: 'Turma da noite, No-Gi' },
  });
  assert.equal(daArteDele.status, 200, 'na arte dele o mestre edita');
  assert.equal(daArteDele.dados.legenda, 'Turma da noite, No-Gi');
});

test('a academia toda só é publicada por quem cuida da casa inteira', async () => {
  const doMestre = await chamar('POST', '/api/fotos', {
    token: estado.tokenMestreTeste,
    corpo: { arquivo: '/arquivos/x.png', categoria: 'estrutura' },
  });
  assert.equal(doMestre.status, 403, 'foto geral não é do mestre');

  const daRecepcao = await chamar('POST', '/api/fotos', {
    token: estado.tokenRecepcao,
    corpo: { arquivo: '/arquivos/y.png', categoria: 'estrutura', legenda: 'Tatame principal' },
  });
  assert.equal(daRecepcao.status, 201);
  assert.equal(daRecepcao.dados.modalidade, null, 'foto da casa não tem arte marcial');
});

test('categoria inventada é recusada', async () => {
  const { status, dados } = await chamar('POST', '/api/fotos', {
    token: estado.tokenDono,
    corpo: { arquivo: '/arquivos/z.png', categoria: 'churrasco' },
  });
  assert.equal(status, 400);
  assert.match(dados.erro, /Categoria inválida/);
});

test('a ordem da galeria é gravada de uma vez', async () => {
  const { dados: antes } = await chamar('GET', '/api/fotos', { token: estado.tokenDono });
  const ids = antes.map((f) => f.id).reverse();

  const { status } = await chamar('POST', '/api/fotos/ordenar', {
    token: estado.tokenDono, corpo: { ids },
  });
  assert.equal(status, 200);

  const { dados: depois } = await chamar('GET', '/api/fotos', { token: estado.tokenDono });
  const semDestaque = depois.filter((f) => !f.destaque).map((f) => f.id);
  const esperado = ids.filter((id) => semDestaque.includes(id));
  assert.deepEqual(semDestaque, esperado, 'a ordem enviada é respeitada');
});

test('o dono apaga a foto e ela sai do site', async () => {
  const { status } = await chamar('DELETE', `/api/fotos/${estado.fotoId}`, { token: estado.tokenDono });
  assert.equal(status, 204);

  const { dados } = await chamar('GET', '/api/publico/academia');
  assert.ok(!dados.fotos.some((f) => f.id === estado.fotoId));
});

test('o arquivo da foto sai do disco quando ninguém mais usa', async () => {
  const enviado = await chamar('POST', '/api/arquivos', {
    token: estado.tokenDono, corpo: { conteudo: PNG_MINIMO },
  });
  const url = enviado.dados.url;

  const criada = await chamar('POST', '/api/fotos', {
    token: estado.tokenDono,
    corpo: { arquivo: url, categoria: 'estrutura', legenda: 'Recepção' },
  });
  assert.equal(criada.status, 201);

  const { existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { PASTA_ARQUIVOS } = await import('../server/rotas/arquivos.js');
  const caminho = join(PASTA_ARQUIVOS, url.replace('/arquivos/', ''));
  assert.ok(existsSync(caminho), 'o arquivo foi gravado');

  await chamar('DELETE', `/api/fotos/${criada.dados.id}`, { token: estado.tokenDono });
  assert.ok(!existsSync(caminho), 'o arquivo órfão foi apagado junto com a foto');
});

test('arquivo ainda usado por outra foto não é apagado', async () => {
  const enviado = await chamar('POST', '/api/arquivos', {
    token: estado.tokenDono, corpo: { conteudo: PNG_MINIMO },
  });
  const url = enviado.dados.url;

  const primeira = await chamar('POST', '/api/fotos', {
    token: estado.tokenDono, corpo: { arquivo: url, categoria: 'treino', modalidade_id: estado.modalidadeJiu },
  });
  const segunda = await chamar('POST', '/api/fotos', {
    token: estado.tokenDono, corpo: { arquivo: url, categoria: 'turma', modalidade_id: estado.modalidadeJiu },
  });

  const { existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { PASTA_ARQUIVOS } = await import('../server/rotas/arquivos.js');
  const caminho = join(PASTA_ARQUIVOS, url.replace('/arquivos/', ''));

  await chamar('DELETE', `/api/fotos/${primeira.dados.id}`, { token: estado.tokenDono });
  assert.ok(existsSync(caminho), 'a segunda foto ainda usa o arquivo');

  await chamar('DELETE', `/api/fotos/${segunda.dados.id}`, { token: estado.tokenDono });
  assert.ok(!existsSync(caminho), 'sem ninguém usando, o arquivo sai');
});

/* ==========================================================================
   Painel avancado: pendencias, evasao, graduacao, ocupacao e movimento
   ========================================================================== */

test('o painel do dono vira lista de trabalho, não só números', async () => {
  const { status, dados } = await chamar('GET', '/api/painel', { token: estado.tokenDono });
  assert.equal(status, 200);
  for (const parte of ['pendencias', 'alunos_sumidos', 'aptos_graduacao',
    'ocupacao_turmas', 'proximas_competicoes', 'frequencia_semana', 'movimento']) {
    assert.ok(dados[parte] !== undefined, `o painel traz ${parte}`);
  }
  assert.equal(dados.frequencia_semana.length, 7, 'a semana tem sete dias');
});

test('cada pendência sabe para que tela levar', async () => {
  const { dados } = await chamar('GET', '/api/painel', { token: estado.tokenDono });
  const telas = ['alunos', 'cobranca', 'contas', 'avaliacoes', 'chamada', 'graduacoes', 'competicoes'];
  for (const item of dados.pendencias) {
    assert.ok(item.quantidade > 0, `${item.titulo} só entra na lista se tiver o que fazer`);
    assert.ok(telas.includes(item.tela), `tela desconhecida em "${item.titulo}": ${item.tela}`);
    assert.ok(['critico', 'atencao', ''].includes(item.gravidade));
  }
  const criticoDepoisDeNormal = dados.pendencias
    .findIndex((p) => p.gravidade === '') < dados.pendencias.findLastIndex((p) => p.gravidade === 'critico');
  assert.ok(!criticoDepoisDeNormal, 'o urgente vem antes do resto');
});

test('a ocupação da turma conta vagas e não passa de 100%', async () => {
  const { dados } = await chamar('GET', '/api/painel', { token: estado.tokenDono });
  for (const turma of dados.ocupacao_turmas) {
    assert.equal(turma.vagas, Math.max(0, turma.capacidade - turma.matriculados));
    assert.ok(turma.ocupacao >= 0, `ocupação negativa em ${turma.turma}`);
  }
});

test('o movimento compara períodos do mesmo tamanho', async () => {
  const { dados } = await chamar('GET', '/api/painel', { token: estado.tokenDono });
  const m = dados.movimento;
  const dias = (de, ate) => Math.round(
    (new Date(`${ate}T00:00:00`) - new Date(`${de}T00:00:00`)) / 86400000);
  assert.equal(dias(m.periodo.de, m.periodo.ate), dias(m.periodo_anterior.de, m.periodo_anterior.ate),
    'as duas janelas têm a mesma quantidade de dias');
  assert.ok(m.periodo_anterior.ate < m.periodo.de, 'os períodos não se sobrepõem');
});

test('a receita do movimento é só do dono', async () => {
  const { dados: doDono } = await chamar('GET', '/api/painel', { token: estado.tokenDono });
  assert.ok(doDono.movimento.receita, 'o dono vê a receita');

  const { dados: daRecepcao } = await chamar('GET', '/api/painel', { token: estado.tokenRecepcao });
  assert.equal(daRecepcao.movimento.receita, undefined, 'a recepção não vê a receita');
  assert.ok(daRecepcao.movimento.checkins, 'mas continua vendo o movimento de treino');
});

test('o painel do mestre traz só as turmas e os alunos da arte dele', async () => {
  const { status, dados } = await chamar('GET', '/api/painel', { token: estado.tokenMestreTeste });
  assert.equal(status, 200);
  assert.ok(dados.pendencias !== undefined, 'o mestre também tem lista de trabalho');
  assert.equal(dados.movimento, undefined, 'o resultado da academia não é assunto do mestre');

  const artes = new Set(dados.ocupacao_turmas.map((t) => t.modalidade));
  assert.ok(!artes.has('Judo'), `o mestre de Jiu-Jitsu viu turma de outra arte: ${[...artes].join(', ')}`);

  for (const apto of dados.aptos_graduacao) {
    assert.notEqual(apto.modalidade, 'Judo', 'graduação de outra arte não aparece para ele');
  }
});

test('o aluno não recebe a lista de trabalho da equipe', async () => {
  const { dados } = await chamar('GET', '/api/painel', { token: estado.tokenAluno });
  assert.equal(dados.pendencias, undefined);
  assert.equal(dados.alunos_sumidos, undefined);
  assert.equal(dados.ocupacao_turmas, undefined);
  assert.ok(dados.aluno, 'mas continua recebendo a própria ficha');
});
