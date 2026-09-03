import { Router } from 'express';
import { todos, um, executar, transacao } from '../db.js';
import { exigirPapel, EQUIPE } from '../auth.js';
import { rota, ErroApi, inteiro, data, hoje, DIAS_SEMANA } from '../util.js';
import { situacaoDePagamento } from '../cobranca.js';

const roteador = Router();

/** Minutos de tolerância antes do início e depois do fim da aula. */
const ANTES = 30;
const DEPOIS = 15;

function minutos(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

function agoraEmMinutos() {
  const agora = new Date();
  return agora.getHours() * 60 + agora.getMinutes();
}

function horaAtual() {
  return new Date().toTimeString().slice(0, 5);
}

function alunoDoUsuario(usuario) {
  const aluno = um('SELECT * FROM alunos WHERE usuario_id = :id', { id: usuario.id });
  if (!aluno) throw new ErroApi('Cadastro de aluno não encontrado. Fale com a recepção.', 404);
  return aluno;
}

/** Aulas de hoje das turmas do aluno, com a janela de check-in de cada uma. */
function aulasDeHojeDoAluno(alunoId) {
  const diaSemana = new Date().getDay();
  const aulas = todos(`
    SELECT h.id AS horario_id, h.hora_inicio, h.hora_fim, h.dia_semana,
           t.id AS turma_id, t.nome AS turma, t.local, t.capacidade,
           m.nome AS modalidade, m.cor AS modalidade_cor,
           u.nome AS mestre
    FROM aluno_turmas at
    JOIN horarios h ON h.turma_id = at.turma_id
    JOIN turmas t ON t.id = at.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    LEFT JOIN usuarios u ON u.id = t.mestre_id
    WHERE at.aluno_id = :aluno AND h.dia_semana = :dia AND h.ativo = 1 AND t.ativo = 1
    ORDER BY h.hora_inicio
  `, { aluno: alunoId, dia: diaSemana });

  const agora = agoraEmMinutos();
  const hojeISO = hoje();
  return aulas.map((aula) => {
    const abre = minutos(aula.hora_inicio) - ANTES;
    const fecha = minutos(aula.hora_fim) + DEPOIS;
    const feito = um(
      'SELECT id, hora FROM checkins WHERE aluno_id = :a AND turma_id = :t AND data = :d',
      { a: alunoId, t: aula.turma_id, d: hojeISO },
    );
    return {
      ...aula,
      dia_nome: DIAS_SEMANA[aula.dia_semana],
      abre_as: `${String(Math.floor(abre / 60)).padStart(2, '0')}:${String(abre % 60).padStart(2, '0')}`,
      aberto: agora >= abre && agora <= fecha,
      encerrado: agora > fecha,
      ja_confirmado: !!feito,
      confirmado_as: feito?.hora ?? null,
      confirmados: um('SELECT COUNT(*) AS total FROM checkins WHERE turma_id = :t AND data = :d',
        { t: aula.turma_id, d: hojeISO }).total,
    };
  });
}

/** Totais do aluno: treinos no total, no mês e sequência de semanas seguidas. */
function totaisDoAluno(alunoId) {
  const total = um('SELECT COUNT(*) AS total FROM checkins WHERE aluno_id = :a', { a: alunoId }).total;
  const mes = um(`SELECT COUNT(*) AS total FROM checkins
                  WHERE aluno_id = :a AND substr(data, 1, 7) = strftime('%Y-%m', 'now', 'localtime')`,
    { a: alunoId }).total;
  const semana = um(`SELECT COUNT(*) AS total FROM checkins
                     WHERE aluno_id = :a AND data >= date('now','localtime','-6 days')`, { a: alunoId }).total;

  // Sequência: semanas consecutivas com pelo menos um treino.
  const semanas = todos(`
    SELECT DISTINCT strftime('%Y-%W', data) AS semana FROM checkins
    WHERE aluno_id = :a ORDER BY semana DESC LIMIT 30
  `, { a: alunoId }).map((linha) => linha.semana);

  let sequencia = 0;
  const semanaAtual = new Date().toLocaleDateString('sv-SE');
  void semanaAtual;
  for (let i = 0; i < semanas.length; i += 1) {
    if (i === 0) { sequencia = 1; continue; }
    const [anoA, numA] = semanas[i - 1].split('-').map(Number);
    const [anoB, numB] = semanas[i].split('-').map(Number);
    const consecutiva = (anoA === anoB && numA - numB === 1) || (anoA - anoB === 1 && numB >= 51 && numA === 0);
    if (consecutiva) sequencia += 1;
    else break;
  }

  const ultimos = todos(`
    SELECT c.data, c.hora, t.nome AS turma, m.nome AS modalidade, m.cor AS modalidade_cor
    FROM checkins c
    JOIN turmas t ON t.id = c.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    WHERE c.aluno_id = :a ORDER BY c.data DESC, c.hora DESC LIMIT 20
  `, { a: alunoId });

  // Últimos 7 dias, para o desenho da sequência
  const dias = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toLocaleDateString('sv-SE');
    dias.push({
      data: iso,
      dia: DIAS_SEMANA[d.getDay()].slice(0, 3),
      treinou: !!um('SELECT 1 AS ok FROM checkins WHERE aluno_id = :a AND data = :d', { a: alunoId, d: iso }),
    });
  }

  return { total, mes, semana, sequencia, ultimos, dias };
}

/** Painel do aluno: o que está aberto agora e os números dele. */
roteador.get('/agora', exigirPapel('aluno'), rota((req, res) => {
  const aluno = alunoDoUsuario(req.usuario);
  res.json({
    aluno: { id: aluno.id, nome: aluno.nome, status: aluno.status },
    aulas: aulasDeHojeDoAluno(aluno.id),
    totais: totaisDoAluno(aluno.id),
    pagamento: situacaoDePagamento(aluno.id),
    hora: horaAtual(),
  });
}));

/** O aluno confirma que está no treino. */
roteador.post('/', exigirPapel('aluno'), rota((req, res) => {
  const aluno = alunoDoUsuario(req.usuario);
  if (aluno.status !== 'ativo') {
    throw new ErroApi('Sua matrícula ainda não está ativa. Fale com a recepção para liberar o check-in.', 403);
  }

  const pagamento = situacaoDePagamento(aluno.id);
  if (pagamento.bloqueado) {
    throw new ErroApi(
      `Sua mensalidade está ${pagamento.dias_atraso} dia(s) em atraso. `
      + 'Passe na recepção para liberar o treino.', 403);
  }

  const horarioId = inteiro(req.body?.horario_id);
  const aula = aulasDeHojeDoAluno(aluno.id).find((a) => a.horario_id === horarioId);
  if (!aula) throw new ErroApi('Esta aula não está na sua grade de hoje.', 404);
  if (aula.ja_confirmado) throw new ErroApi('Você já confirmou presença nesta aula hoje.', 409);
  if (!aula.aberto) {
    throw new ErroApi(aula.encerrado
      ? 'O check-in desta aula já encerrou. Fale com o mestre para registrar a presença.'
      : `O check-in abre às ${aula.abre_as}.`, 409);
  }

  const hojeISO = hoje();
  transacao(() => {
    executar(`
      INSERT INTO checkins (aluno_id, turma_id, horario_id, data, hora, origem)
      VALUES (:aluno, :turma, :horario, :data, :hora, 'aluno')
    `, { aluno: aluno.id, turma: aula.turma_id, horario: horarioId, data: hojeISO, hora: horaAtual() });

    // O check-in também alimenta a chamada, para o mestre não precisar repetir o trabalho.
    executar(`
      INSERT INTO presencas (aluno_id, turma_id, data, presente, registrado_por)
      VALUES (:aluno, :turma, :data, 1, :usuario)
      ON CONFLICT (aluno_id, turma_id, data) DO UPDATE SET presente = 1
    `, { aluno: aluno.id, turma: aula.turma_id, data: hojeISO, usuario: req.usuario.id });
  });

  res.status(201).json({
    mensagem: `Check-in confirmado em ${aula.modalidade}. Bom treino!`,
    totais: totaisDoAluno(aluno.id),
    aulas: aulasDeHojeDoAluno(aluno.id),
    pagamento: situacaoDePagamento(aluno.id),
  });
}));

/** Histórico do próprio aluno. */
roteador.get('/meus', exigirPapel('aluno'), rota((req, res) => {
  const aluno = alunoDoUsuario(req.usuario);
  res.json(totaisDoAluno(aluno.id));
}));

/**
 * Visão da academia: quantos confirmaram por aula, por turma e por dia.
 * É o retrato de quem realmente está aparecendo para treinar.
 */
roteador.get('/resumo', exigirPapel(...EQUIPE), rota((req, res) => {
  const de = data(req.query.de, new Date(Date.now() - 29 * 864e5).toLocaleDateString('sv-SE'));
  const ate = data(req.query.ate, hoje());
  const hojeISO = hoje();
  const diaSemana = new Date().getDay();

  const aulasHoje = todos(`
    SELECT h.id AS horario_id, h.hora_inicio, h.hora_fim,
           t.id AS turma_id, t.nome AS turma, t.capacidade,
           m.nome AS modalidade, m.cor AS modalidade_cor, u.nome AS mestre,
           (SELECT COUNT(*) FROM aluno_turmas at WHERE at.turma_id = t.id) AS matriculados,
           (SELECT COUNT(*) FROM checkins c WHERE c.turma_id = t.id AND c.data = :hoje) AS confirmados
    FROM horarios h
    JOIN turmas t ON t.id = h.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    LEFT JOIN usuarios u ON u.id = t.mestre_id
    WHERE h.dia_semana = :dia AND h.ativo = 1 AND t.ativo = 1
    ORDER BY h.hora_inicio
  `, { hoje: hojeISO, dia: diaSemana });

  const porTurma = todos(`
    SELECT t.id, t.nome AS turma, m.nome AS modalidade, m.cor,
           COUNT(*) AS checkins,
           COUNT(DISTINCT c.aluno_id) AS alunos,
           COUNT(DISTINCT c.data) AS dias
    FROM checkins c
    JOIN turmas t ON t.id = c.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    WHERE c.data BETWEEN :de AND :ate
    GROUP BY t.id ORDER BY checkins DESC
  `, { de, ate });

  const porModalidade = todos(`
    SELECT m.nome AS modalidade, m.cor, COUNT(*) AS checkins
    FROM checkins c
    JOIN turmas t ON t.id = c.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    WHERE c.data BETWEEN :de AND :ate
    GROUP BY m.id ORDER BY checkins DESC
  `, { de, ate });

  const porDia = todos(`
    SELECT data, COUNT(*) AS checkins FROM checkins
    WHERE data BETWEEN :de AND :ate GROUP BY data ORDER BY data
  `, { de, ate });

  const ranking = todos(`
    SELECT a.id, a.nome, a.categoria, COUNT(*) AS checkins
    FROM checkins c JOIN alunos a ON a.id = c.aluno_id
    WHERE c.data BETWEEN :de AND :ate
    GROUP BY a.id ORDER BY checkins DESC, a.nome LIMIT 15
  `, { de, ate });

  const totais = um(`
    SELECT COUNT(*) AS checkins, COUNT(DISTINCT aluno_id) AS alunos, COUNT(DISTINCT data) AS dias
    FROM checkins WHERE data BETWEEN :de AND :ate
  `, { de, ate });

  const hojeTotal = um('SELECT COUNT(*) AS total FROM checkins WHERE data = :d', { d: hojeISO }).total;
  const totalAulas = porTurma.reduce((soma, linha) => soma + linha.dias, 0);

  res.json({
    periodo: { de, ate },
    totais: {
      ...totais,
      hoje: hojeTotal,
      media_por_aula: totalAulas ? Number((totais.checkins / totalAulas).toFixed(1)) : 0,
    },
    aulas_hoje: aulasHoje,
    por_turma: porTurma,
    por_modalidade: porModalidade,
    por_dia: porDia,
    ranking,
  });
}));

/** Quem confirmou presença em uma aula. */
roteador.get('/aula', exigirPapel(...EQUIPE), rota((req, res) => {
  const turmaId = inteiro(req.query.turma_id);
  if (!turmaId) throw new ErroApi('Informe a turma.');
  const dia = data(req.query.data, hoje());
  res.json(todos(`
    SELECT c.hora, c.origem, a.id AS aluno_id, a.nome, a.categoria
    FROM checkins c JOIN alunos a ON a.id = c.aluno_id
    WHERE c.turma_id = :t AND c.data = :d ORDER BY c.hora
  `, { t: turmaId, d: dia }));
}));

export default roteador;
