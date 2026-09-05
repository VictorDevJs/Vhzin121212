import { Router } from 'express';
import { todos, um, executar, transacao } from '../db.js';
import { exigirPapel, EQUIPE } from '../auth.js';
import { rota, ErroApi, exigirCampos, inteiro, texto, data, hoje, booleano, DIAS_SEMANA } from '../util.js';
import { recorteDeModalidade, podeVerModalidade } from '../escopo.js';
import { situacaoDePagamento, ajustesDeCobranca } from '../cobranca.js';

const roteador = Router();

/** Quantas aulas para trás a linha do aluno olha ao contar faltas seguidas. */
const JANELA_FALTAS = 6;

/** A turma é da arte que a pessoa acompanha? */
function exigirTurmaNoEscopo(usuario, turma) {
  if (!podeVerModalidade(usuario, turma.modalidade_id)) {
    throw new ErroApi('Esta turma é de uma modalidade que você não acompanha.', 403);
  }
}

/**
 * Lista de chamada de uma turma em uma data, com o contexto que o mestre
 * precisa na hora de olhar cada nome: há quanto tempo o aluno não aparece,
 * quantas aulas seguidas faltou e se a mensalidade está em ordem.
 */
roteador.get('/', exigirPapel(...EQUIPE), rota((req, res) => {
  const turmaId = inteiro(req.query.turma_id);
  if (!turmaId) throw new ErroApi('Informe a turma (turma_id).');
  const dia = data(req.query.data, hoje());

  const turma = um(`
    SELECT t.*, m.nome AS modalidade, m.cor AS modalidade_cor, u.nome AS mestre
    FROM turmas t
    JOIN modalidades m ON m.id = t.modalidade_id
    LEFT JOIN usuarios u ON u.id = t.mestre_id
    WHERE t.id = :id
  `, { id: turmaId });
  if (!turma) throw new ErroApi('Turma não encontrada.', 404);
  exigirTurmaNoEscopo(req.usuario, turma);

  const alunos = todos(`
    SELECT a.id, a.nome, a.categoria, a.status,
           COALESCE(p.presente, -1) AS presente,
           p.origem, p.observacao,
           (SELECT MAX(c.data) FROM checkins c WHERE c.aluno_id = a.id) AS ultimo_treino,
           (SELECT COUNT(*) FROM presencas px
             WHERE px.aluno_id = a.id AND px.presente = 1
               AND px.data >= date('now','localtime','-30 day')) AS presencas_30d
    FROM aluno_turmas at
    JOIN alunos a ON a.id = at.aluno_id
    LEFT JOIN presencas p ON p.aluno_id = a.id AND p.turma_id = at.turma_id AND p.data = :data
    WHERE at.turma_id = :turma_id
    ORDER BY a.nome
  `, { turma_id: turmaId, data: dia });

  // As últimas aulas da turma, para contar faltas seguidas de cada um.
  const ultimasAulas = todos(`
    SELECT DISTINCT data FROM presencas
    WHERE turma_id = :turma AND data < :data
    ORDER BY data DESC LIMIT :janela
  `, { turma: turmaId, data: dia, janela: JANELA_FALTAS }).map((linha) => linha.data);

  // Uma consulta só para todas as marcações dessas aulas: com 30 alunos e 6
  // aulas, buscar de um em um seriam 180 idas ao banco.
  const marcacoesAnteriores = ultimasAulas.length
    ? todos(`
      SELECT aluno_id, data, presente FROM presencas
      WHERE turma_id = :turma AND data IN (${ultimasAulas.map((_, i) => `:d${i}`).join(', ')})
    `, {
      turma: turmaId,
      ...Object.fromEntries(ultimasAulas.map((d, i) => [`d${i}`, d])),
    })
    : [];
  const porAlunoEData = new Map(marcacoesAnteriores.map((m) => [`${m.aluno_id}|${m.data}`, m.presente]));
  const ajustes = ajustesDeCobranca(); // lido uma vez, vale para a turma inteira

  for (const aluno of alunos) {
    aluno.faltas_seguidas = 0;
    for (const aula of ultimasAulas) {
      // A sequência quebra quando o aluno veio, ou quando não houve marcação.
      if (porAlunoEData.get(`${aluno.id}|${aula}`) !== 0) break;
      aluno.faltas_seguidas += 1;
    }
    aluno.dias_sem_treinar = aluno.ultimo_treino
      ? Math.floor((new Date(`${hoje()}T00:00:00`) - new Date(`${aluno.ultimo_treino}T00:00:00`)) / 86400000)
      : null;
    const pagamento = situacaoDePagamento(aluno.id, ajustes);
    aluno.pagamento = pagamento.situacao;
    aluno.pagamento_bloqueia = pagamento.bloqueado;
  }

  // Os horários dessa turma no dia da semana escolhido.
  const diaSemana = new Date(`${dia}T12:00:00`).getDay();
  const aulas = todos(`
    SELECT hora_inicio, hora_fim, rotulo FROM horarios
    WHERE turma_id = :turma AND dia_semana = :dia AND ativo = 1
    ORDER BY hora_inicio
  `, { turma: turmaId, dia: diaSemana });

  // Últimas chamadas da turma: a curva de presença que o mestre acompanha.
  const historico = todos(`
    SELECT data,
           SUM(CASE WHEN presente = 1 THEN 1 ELSE 0 END) AS presentes,
           SUM(CASE WHEN presente = 0 THEN 1 ELSE 0 END) AS faltas
    FROM presencas WHERE turma_id = :turma
    GROUP BY data ORDER BY data DESC LIMIT 10
  `, { turma: turmaId });

  res.json({
    turma,
    data: dia,
    dia_nome: DIAS_SEMANA[diaSemana],
    aulas,
    alunos,
    historico: historico.reverse(),
    ja_registrada: alunos.some((a) => a.presente !== -1),
  });
}));

/** Salva a chamada inteira de uma vez. */
roteador.post('/', exigirPapel(...EQUIPE), rota((req, res) => {
  exigirCampos(req.body, ['turma_id']);
  const turmaId = inteiro(req.body.turma_id);
  const dia = data(req.body.data, hoje());
  const marcacoes = Array.isArray(req.body.presencas) ? req.body.presencas : [];

  const turma = um('SELECT id, modalidade_id FROM turmas WHERE id = :id', { id: turmaId });
  if (!turma) throw new ErroApi('Turma não encontrada.', 404);
  exigirTurmaNoEscopo(req.usuario, turma);

  let gravadas = 0;
  transacao(() => {
    for (const marcacao of marcacoes) {
      const alunoId = inteiro(marcacao.aluno_id);
      if (!alunoId) continue;

      // Marcação apagada (o mestre desfez): some do banco em vez de virar falta.
      if (marcacao.presente === null || marcacao.presente === undefined || marcacao.presente === '') {
        executar('DELETE FROM presencas WHERE aluno_id = :a AND turma_id = :t AND data = :d',
          { a: alunoId, t: turmaId, d: dia });
        continue;
      }

      executar(`
        INSERT INTO presencas (aluno_id, turma_id, data, presente, origem, observacao, registrado_por)
        VALUES (:aluno_id, :turma_id, :data, :presente, 'chamada', :observacao, :registrado_por)
        ON CONFLICT (aluno_id, turma_id, data)
        DO UPDATE SET presente = excluded.presente,
                      observacao = excluded.observacao,
                      registrado_por = excluded.registrado_por
      `, {
        aluno_id: alunoId,
        turma_id: turmaId,
        data: dia,
        presente: booleano(marcacao.presente, 0),
        observacao: texto(marcacao.observacao),
        registrado_por: req.usuario.id,
      });
      gravadas += 1;
    }
  });
  res.json({ mensagem: `Chamada de ${dia} registrada.`, total: gravadas });
}));

/**
 * As aulas que já aconteceram hoje e ainda não têm chamada.
 * É por onde o mestre começa o dia.
 */
roteador.get('/pendentes', exigirPapel(...EQUIPE), rota((req, res) => {
  const diaSemana = new Date().getDay();
  const filtros = [
    'h.ativo = 1', 't.ativo = 1', 'h.dia_semana = :dia',
    `NOT EXISTS (SELECT 1 FROM presencas p WHERE p.turma_id = t.id AND p.data = date('now','localtime'))`,
  ];
  const recorte = recorteDeModalidade(req.usuario, 't.modalidade_id', { incluirGerais: false });
  if (recorte) filtros.push(recorte);
  if (req.usuario.papel === 'mestre') filtros.push('t.mestre_id = :mestre');

  const aulas = todos(`
    SELECT t.id AS turma_id, t.nome AS turma, h.hora_inicio, h.hora_fim, h.rotulo,
           m.nome AS modalidade, m.cor AS modalidade_cor, u.nome AS mestre,
           (SELECT COUNT(*) FROM aluno_turmas at WHERE at.turma_id = t.id) AS matriculados,
           (SELECT COUNT(*) FROM checkins c
             WHERE c.turma_id = t.id AND c.data = date('now','localtime')) AS ja_fizeram_checkin,
           CASE WHEN time(h.hora_fim) < time('now','localtime') THEN 1 ELSE 0 END AS encerrada
    FROM horarios h
    JOIN turmas t ON t.id = h.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    LEFT JOIN usuarios u ON u.id = t.mestre_id
    WHERE ${filtros.join(' AND ')}
    ORDER BY h.hora_inicio
  `, req.usuario.papel === 'mestre' ? { dia: diaSemana, mestre: req.usuario.id } : { dia: diaSemana });

  res.json({ data: hoje(), dia_nome: DIAS_SEMANA[diaSemana], aulas });
}));

/** Frequencia por turma no periodo. */
roteador.get('/resumo', exigirPapel(...EQUIPE), rota((req, res) => {
  const de = data(req.query.de, `${hoje().slice(0, 7)}-01`);
  const ate = data(req.query.ate, hoje());
  const filtros = ['p.data BETWEEN :de AND :ate'];
  const recorte = recorteDeModalidade(req.usuario, 't.modalidade_id', { incluirGerais: false });
  if (recorte) filtros.push(recorte);

  const porTurma = todos(`
    SELECT t.id, t.nome AS turma, m.nome AS modalidade, m.cor AS modalidade_cor,
           COUNT(DISTINCT p.data) AS aulas,
           SUM(CASE WHEN p.presente = 1 THEN 1 ELSE 0 END) AS presencas,
           SUM(CASE WHEN p.presente = 0 THEN 1 ELSE 0 END) AS faltas
    FROM presencas p
    JOIN turmas t ON t.id = p.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    WHERE ${filtros.join(' AND ')}
    GROUP BY t.id ORDER BY presencas DESC
  `, { de, ate });

  res.json({
    periodo: { de, ate },
    turmas: porTurma.map((t) => ({
      ...t,
      aproveitamento: t.presencas + t.faltas
        ? Math.round((t.presencas / (t.presencas + t.faltas)) * 100)
        : null,
    })),
  });
}));

/** Ranking de frequencia do mes - quem mais apareceu no tatame. */
roteador.get('/ranking', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const de = data(req.query.de, `${hoje().slice(0, 7)}-01`);
  const ate = data(req.query.ate, hoje());
  const filtros = ['p.data BETWEEN :de AND :ate'];
  const recorte = recorteDeModalidade(req.usuario, 't.modalidade_id', { incluirGerais: false });
  if (recorte) filtros.push(recorte);

  const ranking = todos(`
    SELECT a.id, a.nome, a.categoria,
           SUM(CASE WHEN p.presente = 1 THEN 1 ELSE 0 END) AS presencas
    FROM presencas p
    JOIN alunos a ON a.id = p.aluno_id
    JOIN turmas t ON t.id = p.turma_id
    WHERE ${filtros.join(' AND ')}
    GROUP BY a.id HAVING presencas > 0
    ORDER BY presencas DESC, a.nome LIMIT 20
  `, { de, ate });
  res.json({ periodo: { de, ate }, ranking });
}));

export default roteador;
