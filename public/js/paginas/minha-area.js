import { api, sessao } from '../api.js';
import {
  el, cartao, tabela, celula, indicador, etiqueta, etiquetaStatus, moeda, dataBr, competenciaBr,
  vazio, DIAS_SEMANA, hojeISO,
} from '../ui.js';
import { topo, irPara } from '../app.js';

/** Área do aluno: plano, horarios, mensalidades, graduacoes e frequencia. */
export default async function paginaMinhaArea() {
  const dados = await api.obter('/minha-area');
  const { aluno, matricula, turmas, horarios, mensalidades, graduacoes, presencas, frequencia } = dados;

  const emAtraso = mensalidades.filter((m) => m.atrasada);
  const percentual = frequencia.total
    ? Math.round((frequencia.presentes / frequencia.total) * 100)
    : null;

  return el('div', {}, [
    topo(`Ola, ${sessao.usuario.nome.split(' ')[0]}!`, 'Seu plano, seus horários e sua situação na academia'),

    el('div', { classe: 'checkin-agora', estilo: 'cursor:pointer' , onclick: null}, [
      el('button', {
        classe: 'botao-checkin', texto: 'Check-in',
        aoClicar: () => irPara('checkin'),
      }),
      el('div', {}, [
        el('h3', { texto: 'Chegou para treinar?', estilo: 'margin:0 0 .3rem' }),
        el('p', { classe: 'dica', estilo: 'margin:0' },
          ['Confirme sua presença na aula de hoje. Cada check-in entra no seu histórico e conta na sua sequência de treinos.']),
      ]),
    ]),

    aluno.status === 'pendente'
      ? el('div', { classe: 'mensagem-erro', texto: 'Seu cadastro esta aguardando a recepção confirmar a matrícula e liberar o plano.' })
      : null,
    emAtraso.length
      ? el('div', { classe: 'mensagem-erro', texto: `Voce tem ${emAtraso.length} mensalidade(s) em atraso. Procure a recepcao.` })
      : null,

    el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, [
      indicador({ rotulo: 'Situação', valor: aluno.status, tipo: aluno.status === 'ativo' ? 'ok' : 'alerta' }),
      indicador({ rotulo: 'Plano', valor: matricula?.plano ?? 'sem plano', detalhe: matricula ? moeda(matricula.valor) : 'fale com a recepção', tipo: 'info' }),
      indicador({ rotulo: 'Turmas', valor: turmas.length, detalhe: `${horarios.length} aula(s) por semana` }),
      indicador({
        rotulo: 'Frequência (30 dias)',
        valor: percentual === null ? '-' : `${percentual}%`,
        detalhe: `${frequencia.presentes ?? 0} presenca(s)`,
        tipo: percentual !== null && percentual >= 60 ? 'ok' : 'alerta',
      }),
    ]),

    el('div', { classe: 'grade col-2' }, [
      cartao('Meus horários', horarios.length
        ? el('div', {}, DIAS_SEMANA.map((dia, indice) => {
          const aulas = horarios.filter((h) => h.dia_semana === indice);
          if (!aulas.length) return null;
          return el('div', { estilo: 'margin-bottom:.6rem' }, [
            el('strong', { texto: dia }),
            ...aulas.map((aula) => el('div', {
              classe: 'aula',
              estilo: `border-left-color:${aula.modalidade_cor || 'var(--marca-1)'}`,
            }, [
              el('div', { classe: 'hora', texto: `${aula.hora_inicio} - ${aula.hora_fim}` }),
              el('div', { classe: 'info', texto: `${aula.modalidade} · ${aula.turma}` }),
            ])),
          ]);
        }).filter(Boolean))
        : vazio('Você ainda não esta em nenhuma turma. Fale com a recepção para escolher os horários.')),

      cartao('Minhas turmas', turmas.length
        ? el('div', {}, turmas.map((turma) => el('div', { estilo: 'padding:.5rem 0;border-bottom:1px solid var(--borda)' }, [
          el('strong', { texto: `${turma.modalidade} · ${turma.nome}` }),
          el('div', { classe: 'dica', texto: [turma.categoria, turma.nivel, turma.mestre && `Mestre: ${turma.mestre}`, turma.local].filter(Boolean).join(' · ') }),
        ])))
        : vazio('Nenhuma turma vinculada.')),
    ]),

    cartao('Minhas mensalidades', mensalidades.length
      ? tabela(['Competência', 'Vencimento', 'Valor', 'Situação', 'Pagamento'],
        mensalidades.map((m) => [
          competenciaBr(m.competencia),
          dataBr(m.vencimento),
          moeda(m.valor),
          celula([m.atrasada ? etiqueta('atrasada', 'erro') : etiquetaStatus(m.status)]),
          m.pago_em ? `${dataBr(m.pago_em)} (${m.forma_pagamento || '-'})` : '-',
        ]))
      : vazio('Nenhuma mensalidade gerada até agora.')),

    el('div', { classe: 'grade col-2' }, [
      cartao('Minhas graduações', graduacoes.length
        ? tabela(['Data', 'Modalidade', 'Faixa'], graduacoes.map((g) => [dataBr(g.data), g.modalidade, g.graduacao]))
        : vazio('Nenhuma graduação registrada ainda.')),

      cartao('Últimas presenças', presencas.length
        ? tabela(['Data', 'Turma', 'Presença'], presencas.map((p) => [
          dataBr(p.data), `${p.modalidade} · ${p.turma}`,
          celula([p.presente ? etiqueta('presente', 'ok') : etiqueta('falta', 'erro')]),
        ]))
        : vazio('Nenhuma chamada registrada.')),
    ]),

    matricula
      ? el('p', { classe: 'dica', texto: `Plano ${matricula.plano} (${matricula.periodicidade}) de ${dataBr(matricula.inicio)} ate ${dataBr(matricula.fim)} · vencimento todo dia ${matricula.dia_vencimento}. Hoje e ${dataBr(hojeISO())}.` })
      : null,
  ]);
}
