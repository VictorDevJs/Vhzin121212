import { todos, um } from './db.js';
import { hoje } from './util.js';
import { recorteDeModalidade } from './escopo.js';
import { ajustesDeCobranca } from './cobranca.js';

/**
 * O que o painel precisa saber além dos números.
 *
 * Um painel que só mostra totais não ajuda ninguém a trabalhar. Este módulo
 * responde às perguntas que a academia faz todo dia: quem sumiu, quem já pode
 * graduar, qual turma está lotada, o que vence hoje e o que precisa de decisão.
 *
 * Tudo passa pelo recorte de modalidade: o mestre de Judô vê o Judô dele.
 */

/** Dias sem aparecer que já acendem o alerta de evasão. */
const DIAS_SUMIDO = 14;

function comRecorte(usuario, coluna, filtros) {
  const recorte = recorteDeModalidade(usuario, coluna, { incluirGerais: false });
  return recorte ? [...filtros, recorte] : filtros;
}

/**
 * Alunos que treinavam e pararam de aparecer. Ordenados pelo maior sumiço,
 * porque quem some há mais tempo é quem está mais perto de cancelar.
 */
export function alunosSumidos(usuario, limite = 12) {
  const filtros = comRecorte(usuario, 't.modalidade_id', [`a.status = 'ativo'`]);
  return todos(`
    SELECT a.id, a.nome, a.telefone, a.categoria,
           MAX(c.data) AS ultimo_treino,
           CAST(julianday('now','localtime') - julianday(MAX(c.data)) AS INTEGER) AS dias_sem_treinar,
           (SELECT m.nome FROM aluno_turmas at2
              JOIN turmas t2 ON t2.id = at2.turma_id
              JOIN modalidades m ON m.id = t2.modalidade_id
             WHERE at2.aluno_id = a.id ORDER BY m.ordem LIMIT 1) AS modalidade
    FROM alunos a
    JOIN aluno_turmas at ON at.aluno_id = a.id
    JOIN turmas t ON t.id = at.turma_id
    LEFT JOIN checkins c ON c.aluno_id = a.id
    WHERE ${filtros.join(' AND ')}
    GROUP BY a.id
    HAVING ultimo_treino IS NOT NULL AND dias_sem_treinar >= :dias
    ORDER BY dias_sem_treinar DESC, a.nome
    LIMIT :limite
  `, { dias: DIAS_SUMIDO, limite });
}

/**
 * Quem já cumpriu o tempo mínimo na faixa atual.
 * É a fila do próximo exame — a pergunta que todo mestre faz.
 */
export function aptosParaGraduacao(usuario, limite = 12) {
  const filtros = comRecorte(usuario, 'ag.modalidade_id', [`a.status = 'ativo'`, 'g.tempo_minimo > 0']);
  return todos(`
    SELECT a.id, a.nome, a.categoria,
           m.nome AS modalidade, m.cor AS modalidade_cor,
           g.nome AS graduacao, g.cor AS graduacao_cor, ag.grau,
           ag.data AS desde,
           CAST(julianday('now','localtime') - julianday(ag.data) AS INTEGER) AS dias_na_faixa,
           g.tempo_minimo AS meses_minimos,
           (SELECT g2.nome FROM graduacoes g2
             WHERE g2.modalidade_id = g.modalidade_id AND g2.ordem > g.ordem
               AND g2.faixa_etaria IN (a.categoria, 'ambos')
             ORDER BY g2.ordem LIMIT 1) AS proxima_faixa
    FROM aluno_graduacoes ag
    JOIN alunos a ON a.id = ag.aluno_id
    JOIN graduacoes g ON g.id = ag.graduacao_id
    JOIN modalidades m ON m.id = ag.modalidade_id
    WHERE ${filtros.join(' AND ')}
      AND ag.data = (SELECT MAX(x.data) FROM aluno_graduacoes x
                      WHERE x.aluno_id = a.id AND x.modalidade_id = ag.modalidade_id)
      AND julianday('now','localtime') - julianday(ag.data) >= g.tempo_minimo * 30
    ORDER BY dias_na_faixa DESC, a.nome
    LIMIT :limite
  `, { limite });
}

/** Turmas cheias, vazias e no ponto — para remanejar horário com dado na mão. */
export function ocupacaoDasTurmas(usuario) {
  const filtros = comRecorte(usuario, 't.modalidade_id', ['t.ativo = 1']);
  return todos(`
    SELECT t.id, t.nome AS turma, t.capacidade, t.categoria,
           m.nome AS modalidade, m.cor AS modalidade_cor,
           u.nome AS mestre,
           (SELECT COUNT(*) FROM aluno_turmas at WHERE at.turma_id = t.id) AS matriculados,
           (SELECT COUNT(*) FROM horarios h WHERE h.turma_id = t.id AND h.ativo = 1) AS aulas_semana
    FROM turmas t
    JOIN modalidades m ON m.id = t.modalidade_id
    LEFT JOIN usuarios u ON u.id = t.mestre_id
    WHERE ${filtros.join(' AND ')}
    ORDER BY (matriculados * 1.0 / MAX(t.capacidade, 1)) DESC, m.ordem, t.nome
  `).map((linha) => ({
    ...linha,
    ocupacao: linha.capacidade ? Math.round((linha.matriculados / linha.capacidade) * 100) : 0,
    vagas: Math.max(0, linha.capacidade - linha.matriculados),
  }));
}

/** Campeonatos à frente, com o prazo de inscrição contado em dias. */
export function proximasCompeticoes(usuario, limite = 5) {
  const recorte = recorteDeModalidade(usuario, 'c.modalidade_id');
  const filtros = [`c.data_inicio >= date('now','localtime')`, `c.status != 'cancelada'`];
  if (recorte) filtros.push(recorte);
  return todos(`
    SELECT c.id, c.nome, c.data_inicio, c.inscricao_ate, c.nivel, c.status, c.cidade,
           m.nome AS modalidade, m.cor AS modalidade_cor,
           (SELECT COUNT(*) FROM competicao_inscricoes ci
             WHERE ci.competicao_id = c.id AND ci.status != 'cancelada') AS inscritos,
           CAST(julianday(c.data_inicio) - julianday('now','localtime') AS INTEGER) AS dias_para_comecar,
           CASE WHEN c.inscricao_ate IS NULL THEN NULL
                ELSE CAST(julianday(c.inscricao_ate) - julianday('now','localtime') AS INTEGER)
           END AS dias_para_fechar
    FROM competicoes c
    LEFT JOIN modalidades m ON m.id = c.modalidade_id
    WHERE ${filtros.join(' AND ')}
    ORDER BY c.data_inicio
    LIMIT :limite
  `, { limite });
}

/** Check-ins dia a dia da última semana — o pulso da academia. */
export function frequenciaDaSemana(usuario) {
  const filtros = comRecorte(usuario, 't.modalidade_id', [`c.data >= date('now','localtime','-6 days')`]);
  const porDia = todos(`
    SELECT c.data, COUNT(*) AS checkins, COUNT(DISTINCT c.aluno_id) AS alunos
    FROM checkins c
    JOIN turmas t ON t.id = c.turma_id
    WHERE ${filtros.join(' AND ')}
    GROUP BY c.data
  `);
  const mapa = Object.fromEntries(porDia.map((d) => [d.data, d]));

  const dias = [];
  for (let i = 6; i >= 0; i -= 1) {
    const data = new Date();
    data.setDate(data.getDate() - i);
    const iso = data.toLocaleDateString('sv-SE');
    dias.push({
      data: iso,
      dia: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][data.getDay()],
      checkins: mapa[iso]?.checkins || 0,
      alunos: mapa[iso]?.alunos || 0,
    });
  }
  return dias;
}

/**
 * A lista de pendências: o que precisa de decisão hoje, já com o caminho
 * para resolver. Cada item sabe para que tela levar.
 */
export function pendencias(usuario) {
  const papel = usuario.papel;
  const gestao = papel === 'dono' || papel === 'recepcao';
  const lista = [];
  const ajustes = ajustesDeCobranca();

  const add = (item) => { if (item.quantidade > 0) lista.push(item); };

  if (gestao) {
    const pendentes = um(`SELECT COUNT(*) AS total FROM alunos WHERE status = 'pendente'`).total;
    add({
      chave: 'matriculas', titulo: 'Matrícula esperando confirmação',
      detalhe: 'O aluno se cadastrou e ainda não foi liberado para treinar',
      quantidade: pendentes, gravidade: 'atencao', tela: 'alunos',
    });

    const atrasadas = um(`
      SELECT COUNT(*) AS total, COALESCE(SUM(valor), 0) AS valor FROM mensalidades
      WHERE status = 'pendente' AND vencimento < date('now','localtime')
    `);
    add({
      chave: 'atrasadas', titulo: 'Mensalidade em atraso',
      detalhe: `${moedaSimples(atrasadas.valor)} para cobrar`,
      quantidade: atrasadas.total, gravidade: 'critico', tela: 'cobranca',
    });

    const vencendo = um(`
      SELECT COUNT(*) AS total FROM mensalidades
      WHERE status = 'pendente'
        AND vencimento >= date('now','localtime')
        AND vencimento <= date('now','localtime','+' || :dias || ' days')
    `, { dias: ajustes.dias_aviso }).total;
    add({
      chave: 'vencendo', titulo: `Mensalidade vencendo em ${ajustes.dias_aviso} dias`,
      detalhe: 'Dá tempo de avisar antes de virar atraso',
      quantidade: vencendo, gravidade: 'atencao', tela: 'cobranca',
    });

    const semPlano = um(`
      SELECT COUNT(*) AS total FROM alunos a
      WHERE a.status = 'ativo'
        AND NOT EXISTS (SELECT 1 FROM matriculas mt WHERE mt.aluno_id = a.id AND mt.status = 'ativa')
    `).total;
    add({
      chave: 'sem_plano', titulo: 'Aluno ativo sem plano',
      detalhe: 'Treina mas não tem matrícula, então não gera mensalidade',
      quantidade: semPlano, gravidade: 'atencao', tela: 'contas',
    });

    const avaliacoes = um(`SELECT COUNT(*) AS total FROM avaliacoes WHERE status = 'pendente'`).total;
    add({
      chave: 'avaliacoes', titulo: 'Avaliação esperando aprovação',
      detalhe: 'Só aparece no site depois que você aprova',
      quantidade: avaliacoes, gravidade: '', tela: 'avaliacoes',
    });
  }

  // Chamada não feita nas aulas que já terminaram hoje.
  const filtrosChamada = comRecorte(usuario, 't.modalidade_id', [
    'h.ativo = 1', 't.ativo = 1',
    `h.dia_semana = CAST(strftime('%w','now','localtime') AS INTEGER)`,
    `time(h.hora_fim) < time('now','localtime')`,
  ]);
  if (papel === 'mestre') filtrosChamada.push('t.mestre_id = :mestre');
  const semChamada = um(`
    SELECT COUNT(*) AS total FROM horarios h
    JOIN turmas t ON t.id = h.turma_id
    WHERE ${filtrosChamada.join(' AND ')}
      AND NOT EXISTS (
        SELECT 1 FROM presencas p
        WHERE p.turma_id = t.id AND p.data = date('now','localtime')
      )
  `, papel === 'mestre' ? { mestre: usuario.id } : {}).total;
  add({
    chave: 'chamada', titulo: 'Aula de hoje sem chamada',
    detalhe: 'A aula já terminou e ninguém registrou a presença',
    quantidade: semChamada, gravidade: 'atencao', tela: 'chamada',
  });

  const sumidos = alunosSumidos(usuario, 100).length;
  add({
    chave: 'sumidos', titulo: `Aluno sem treinar há mais de ${DIAS_SUMIDO} dias`,
    detalhe: 'Uma mensagem agora costuma segurar a matrícula',
    quantidade: sumidos, gravidade: 'critico', tela: 'contas',
  });

  const aptos = aptosParaGraduacao(usuario, 100).length;
  add({
    chave: 'graduacao', titulo: 'Aluno no tempo de graduar',
    detalhe: 'Já cumpriu o tempo mínimo na faixa atual',
    quantidade: aptos, gravidade: '', tela: 'graduacoes',
  });

  const inscricoesFechando = proximasCompeticoes(usuario, 50)
    .filter((c) => c.dias_para_fechar !== null && c.dias_para_fechar >= 0 && c.dias_para_fechar <= 7).length;
  add({
    chave: 'inscricoes', titulo: 'Inscrição de campeonato fechando',
    detalhe: 'Menos de uma semana para inscrever os atletas',
    quantidade: inscricoesFechando, gravidade: 'atencao', tela: 'competicoes',
  });

  const aniversariantesHoje = um(`
    SELECT COUNT(*) AS total FROM alunos
    WHERE status = 'ativo' AND data_nascimento IS NOT NULL
      AND strftime('%m-%d', data_nascimento) = strftime('%m-%d', 'now', 'localtime')
  `).total;
  add({
    chave: 'aniversario', titulo: 'Aniversariante hoje',
    detalhe: 'Um parabéns da academia vale mais do que parece',
    quantidade: aniversariantesHoje, gravidade: '', tela: 'alunos',
  });

  const ordem = { critico: 0, atencao: 1, '': 2 };
  return lista.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade] || b.quantidade - a.quantidade);
}

function moedaSimples(valor) {
  return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;
}

/**
 * Cresceu ou caiu? Janela de 30 dias contra os 30 anteriores.
 *
 * Comparar "o que já correu deste mês" com o mês passado inteiro dizia que a
 * academia tinha caído 84%. Comparar pelo mesmo dia do mês também engana,
 * porque 1 a 3 de agosto caiu no fim de semana, quando quase não tem aula.
 * A janela móvel de 30 dias resolve os dois: mesma quantidade de dias e
 * praticamente a mesma composição de dias da semana.
 */
export function movimentoDoMes() {
  const conta = (de, ate) => um(`
    SELECT
      (SELECT COUNT(*) FROM matriculas
        WHERE date(criado_em) >= :de AND date(criado_em) < :ate) AS matriculas,
      (SELECT COUNT(*) FROM checkins WHERE data >= :de AND data < :ate) AS checkins,
      (SELECT COUNT(DISTINCT aluno_id) FROM checkins WHERE data >= :de AND data < :ate) AS alunos_treinando,
      (SELECT COALESCE(SUM(valor), 0) FROM lancamentos
        WHERE tipo = 'receita' AND data >= :de AND data < :ate) AS receita
  `, { de, ate });

  const dia = (atras) => {
    const data = new Date();
    data.setDate(data.getDate() - atras);
    return data.toLocaleDateString('sv-SE');
  };
  const amanha = dia(-1);

  const atual = conta(dia(29), amanha);
  const passado = conta(dia(59), dia(29));
  const variacao = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);

  return {
    periodo: { de: dia(29), ate: hoje() },
    periodo_anterior: { de: dia(59), ate: dia(30) },
    matriculas: { atual: atual.matriculas, anterior: passado.matriculas, variacao: variacao(atual.matriculas, passado.matriculas) },
    checkins: { atual: atual.checkins, anterior: passado.checkins, variacao: variacao(atual.checkins, passado.checkins) },
    alunos_treinando: {
      atual: atual.alunos_treinando, anterior: passado.alunos_treinando,
      variacao: variacao(atual.alunos_treinando, passado.alunos_treinando),
    },
    receita: { atual: atual.receita, anterior: passado.receita, variacao: variacao(atual.receita, passado.receita) },
  };
}

export { DIAS_SUMIDO };
