import { todos, um, executar, transacao } from './db.js';
import { hoje, competenciaAtual } from './util.js';

/**
 * Controle automático de plano e pagamento.
 *
 * Um lugar só decide se o aluno está em dia. A conta é sempre a mesma:
 * mensalidade pendente com vencimento passado é atraso; dentro da
 * tolerância o aluno continua treinando; passado o prazo de suspensão a
 * matrícula é suspensa sozinha e volta sozinha quando ele acerta.
 */

/** Ajustes que o dono controla na tela da academia, com os padrões da casa. */
export const AJUSTES_PADRAO = {
  cobranca_automatica: '1',       // gera a mensalidade do mês sem ninguém pedir
  cobranca_dias_aviso: '5',       // quantos dias antes o "vence em breve" acende
  cobranca_tolerancia: '5',       // dias de atraso tolerados antes de barrar
  cobranca_bloquear_checkin: '0', // barrar o check-in do aluno atrasado
  cobranca_suspender_dias: '45',  // dias de atraso até suspender a matrícula
  cobranca_multa: '2',            // multa em % sobre o valor atrasado
  cobranca_juros_dia: '0.033',    // juros ao dia em % (1% ao mês)
};

export const CHAVES_COBRANCA = Object.keys(AJUSTES_PADRAO);

/** Lê os ajustes já convertidos em número e booleano. */
export function ajustesDeCobranca() {
  const salvos = Object.fromEntries(
    todos('SELECT chave, valor FROM configuracoes').map((c) => [c.chave, c.valor]),
  );
  const ler = (chave) => {
    const valor = salvos[chave] ?? AJUSTES_PADRAO[chave];
    return valor === '' || valor === null || valor === undefined ? AJUSTES_PADRAO[chave] : valor;
  };
  return {
    automatica: ler('cobranca_automatica') === '1',
    dias_aviso: Math.max(0, Number(ler('cobranca_dias_aviso')) || 0),
    tolerancia: Math.max(0, Number(ler('cobranca_tolerancia')) || 0),
    bloquear_checkin: ler('cobranca_bloquear_checkin') === '1',
    suspender_dias: Math.max(0, Number(ler('cobranca_suspender_dias')) || 0),
    multa: Math.max(0, Number(ler('cobranca_multa')) || 0),
    juros_dia: Math.max(0, Number(ler('cobranca_juros_dia')) || 0),
    ultima_execucao: salvos.cobranca_ultima_execucao || null,
  };
}

function guardar(chave, valor) {
  executar(`INSERT INTO configuracoes (chave, valor) VALUES (:chave, :valor)
            ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor`,
    { chave, valor: String(valor) });
}

function diasEntre(deISO, ateISO) {
  return Math.round((new Date(`${ateISO}T00:00:00`) - new Date(`${deISO}T00:00:00`)) / 86400000);
}

function arredondar(valor) {
  return Math.round(valor * 100) / 100;
}

/**
 * Situação financeira do aluno. Devolve o retrato completo: o que venceu,
 * quanto ficou, multa e juros do atraso e se isso já barra o treino.
 */
export function situacaoDePagamento(alunoId, ajustes = ajustesDeCobranca()) {
  const hojeISO = hoje();

  const resumo = um(`
    SELECT
      SUM(CASE WHEN status = 'pendente' AND vencimento < :hoje THEN 1 ELSE 0 END) AS atrasadas,
      SUM(CASE WHEN status = 'pendente' AND vencimento < :hoje THEN valor ELSE 0 END) AS valor_atrasado,
      SUM(CASE WHEN status = 'pendente' AND vencimento >= :hoje THEN 1 ELSE 0 END) AS a_vencer,
      MIN(CASE WHEN status = 'pendente' THEN vencimento END) AS proximo_vencimento,
      MIN(CASE WHEN status = 'pendente' AND vencimento < :hoje THEN vencimento END) AS vencimento_mais_antigo,
      MAX(CASE WHEN status = 'pago' THEN pago_em END) AS ultimo_pagamento
    FROM mensalidades WHERE aluno_id = :id
  `, { id: alunoId, hoje: hojeISO });

  const matricula = um(`
    SELECT mt.*, p.nome AS plano, p.periodicidade
    FROM matriculas mt JOIN planos p ON p.id = mt.plano_id
    WHERE mt.aluno_id = :id AND mt.status IN ('ativa', 'suspensa')
    ORDER BY CASE mt.status WHEN 'ativa' THEN 0 ELSE 1 END, mt.id DESC LIMIT 1
  `, { id: alunoId });

  const mesAtual = um('SELECT * FROM mensalidades WHERE aluno_id = :id AND competencia = :mes',
    { id: alunoId, mes: competenciaAtual() });

  const atrasadas = resumo?.atrasadas || 0;
  const valorAtrasado = arredondar(resumo?.valor_atrasado || 0);
  const diasAtraso = resumo?.vencimento_mais_antigo
    ? Math.max(0, diasEntre(resumo.vencimento_mais_antigo, hojeISO))
    : 0;
  const diasParaVencer = resumo?.proximo_vencimento
    ? diasEntre(hojeISO, resumo.proximo_vencimento)
    : null;

  const multa = atrasadas ? arredondar(valorAtrasado * (ajustes.multa / 100)) : 0;
  const juros = atrasadas ? arredondar(valorAtrasado * (ajustes.juros_dia / 100) * diasAtraso) : 0;

  let situacao = 'em dia';
  if (!matricula) situacao = 'sem plano';
  else if (atrasadas > 0) situacao = 'atrasado';
  else if (!mesAtual) situacao = 'mês não gerado';
  else if (diasParaVencer !== null && diasParaVencer <= ajustes.dias_aviso) situacao = 'vence em breve';

  const emTolerancia = atrasadas > 0 && diasAtraso <= ajustes.tolerancia;

  return {
    situacao,
    atrasadas,
    valor_atrasado: valorAtrasado,
    dias_atraso: diasAtraso,
    multa,
    juros,
    valor_atualizado: arredondar(valorAtrasado + multa + juros),
    a_vencer: resumo?.a_vencer || 0,
    proximo_vencimento: resumo?.proximo_vencimento || null,
    dias_para_vencer: diasParaVencer,
    ultimo_pagamento: resumo?.ultimo_pagamento || null,
    plano: matricula?.plano || null,
    valor_plano: matricula?.valor ?? null,
    dia_vencimento: matricula?.dia_vencimento ?? null,
    matricula_id: matricula?.id ?? null,
    matricula_status: matricula?.status ?? null,
    suspensa_por_atraso: matricula?.suspensa_motivo === 'inadimplencia',
    mes_atual_pago: mesAtual?.status === 'pago',
    em_tolerancia: emTolerancia,
    tolerancia_ate: resumo?.vencimento_mais_antigo
      ? new Date(new Date(`${resumo.vencimento_mais_antigo}T00:00:00`).getTime()
        + ajustes.tolerancia * 86400000).toLocaleDateString('sv-SE')
      : null,
    // Só barra quem o dono mandou barrar, e só depois da tolerância.
    bloqueado: ajustes.bloquear_checkin && atrasadas > 0 && !emTolerancia,
  };
}

/** Mensalidade do mês para toda matrícula ativa que ainda não tem a dela. */
export function gerarMensalidades(competencia = competenciaAtual()) {
  const matriculas = todos(`SELECT * FROM matriculas WHERE status = 'ativa'`);
  const criadas = [];
  for (const matricula of matriculas) {
    const existe = um('SELECT id FROM mensalidades WHERE aluno_id = :a AND competencia = :c',
      { a: matricula.aluno_id, c: competencia });
    if (existe) continue;
    executar(`
      INSERT INTO mensalidades (matricula_id, aluno_id, competencia, vencimento, valor, status)
      VALUES (:matricula_id, :aluno_id, :competencia, :vencimento, :valor, 'pendente')
    `, {
      matricula_id: matricula.id,
      aluno_id: matricula.aluno_id,
      competencia,
      vencimento: `${competencia}-${String(matricula.dia_vencimento).padStart(2, '0')}`,
      valor: matricula.valor,
    });
    criadas.push(matricula.aluno_id);
  }
  return criadas;
}

/** Suspende quem passou do prazo e devolve quem acertou as contas. */
function ajustarMatriculas(ajustes) {
  const hojeISO = hoje();
  const suspensas = [];
  const reativadas = [];

  if (ajustes.suspender_dias > 0) {
    const limite = new Date(new Date(`${hojeISO}T00:00:00`).getTime() - ajustes.suspender_dias * 86400000)
      .toLocaleDateString('sv-SE');
    const devedores = todos(`
      SELECT DISTINCT mt.id, a.nome
      FROM matriculas mt
      JOIN alunos a ON a.id = mt.aluno_id
      JOIN mensalidades me ON me.aluno_id = mt.aluno_id
      WHERE mt.status = 'ativa' AND me.status = 'pendente' AND me.vencimento < :limite
    `, { limite });
    for (const matricula of devedores) {
      executar(`UPDATE matriculas
                SET status = 'suspensa', suspensa_em = :hoje, suspensa_motivo = 'inadimplencia'
                WHERE id = :id`, { id: matricula.id, hoje: hojeISO });
      suspensas.push(matricula.nome);
    }
  }

  const quitados = todos(`
    SELECT mt.id, a.nome
    FROM matriculas mt
    JOIN alunos a ON a.id = mt.aluno_id
    WHERE mt.status = 'suspensa' AND mt.suspensa_motivo = 'inadimplencia'
      AND NOT EXISTS (
        SELECT 1 FROM mensalidades me
        WHERE me.aluno_id = mt.aluno_id AND me.status = 'pendente' AND me.vencimento < :hoje
      )
  `, { hoje: hojeISO });
  for (const matricula of quitados) {
    executar(`UPDATE matriculas
              SET status = 'ativa', suspensa_em = NULL, suspensa_motivo = NULL
              WHERE id = :id`, { id: matricula.id });
    reativadas.push(matricula.nome);
  }

  return { suspensas, reativadas };
}

/**
 * A rotina inteira: gera as mensalidades do mês, suspende quem passou do
 * prazo e reativa quem pagou. É idempotente — rodar duas vezes no mesmo dia
 * não cria nada em dobro.
 */
export function rodarCobranca({ competencia = competenciaAtual(), automatica = false } = {}) {
  const ajustes = ajustesDeCobranca();
  let criadas = [];
  let movimento = { suspensas: [], reativadas: [] };

  transacao(() => {
    if (!automatica || ajustes.automatica) criadas = gerarMensalidades(competencia);
    movimento = ajustarMatriculas(ajustes);
    guardar('cobranca_ultima_execucao', new Date().toLocaleString('sv-SE'));
    guardar('cobranca_ultimo_dia', hoje());
  });

  const relatorio = {
    competencia,
    mensalidades_criadas: criadas.length,
    matriculas_suspensas: movimento.suspensas,
    matriculas_reativadas: movimento.reativadas,
    executada_em: ajustesDeCobranca().ultima_execucao,
    automatica,
  };

  const mexeu = criadas.length || movimento.suspensas.length || movimento.reativadas.length;
  if (mexeu) {
    try {
      executar(`
        INSERT INTO auditoria (usuario_id, usuario_nome, papel, acao, area, alvo, detalhe)
        VALUES (NULL, 'sistema', 'sistema', 'cobranca', 'financeiro', :alvo, :detalhe)
      `, {
        alvo: competencia,
        detalhe: `${criadas.length} mensalidade(s) gerada(s), `
          + `${movimento.suspensas.length} matrícula(s) suspensa(s), `
          + `${movimento.reativadas.length} reativada(s)`,
      });
    } catch { /* o histórico nunca pode travar a cobrança */ }
  }

  return relatorio;
}

/** Roda a cobrança no máximo uma vez por dia, sem ninguém precisar clicar. */
export function garantirCobrancaDoDia() {
  const ultimo = um(`SELECT valor FROM configuracoes WHERE chave = 'cobranca_ultimo_dia'`);
  if (ultimo?.valor === hoje()) return null;
  return rodarCobranca({ automatica: true });
}
