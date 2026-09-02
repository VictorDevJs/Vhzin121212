import { api, sessao } from '../api.js';
import {
  el, cartao, tabela, celula, indicador, etiqueta, etiquetaCor, etiquetaStatus, moeda, dataBr,
  competenciaBr, vazio, DIAS_SEMANA, hojeISO,
} from '../ui.js';
import { icone } from '../icones.js';
import { topo, irPara } from '../app.js';

const COR_MEDALHA = { ouro: '#f5b301', prata: '#b9bec6', bronze: '#b06d3a', participacao: '#6b7280' };

/** Área do aluno: plano, horarios, mensalidades, graduacoes e frequencia. */
export default async function paginaMinhaArea() {
  const dados = await api.obter('/minha-area');
  const {
    aluno, matricula, turmas, horarios, mensalidades, graduacoes, presencas, frequencia,
    proxima_faixa: proximaFaixa, competicoes, equipes,
  } = dados;

  const emAtraso = mensalidades.filter((m) => m.atrasada);
  const percentual = frequencia.total
    ? Math.round((frequencia.presentes / frequencia.total) * 100)
    : null;

  return el('div', {}, [
    topo(`Olá, ${sessao.usuario.nome.split(' ')[0]}!`, 'Seu plano, seus horários e sua situação na academia'),

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
      ? el('div', { classe: 'mensagem-erro', texto: `Você tem ${emAtraso.length} mensalidade(s) em atraso. Procure a recepcao.` })
      : null,

    el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, [
      indicador({ rotulo: 'Situação', valor: aluno.status, tipo: aluno.status === 'ativo' ? 'ok' : 'alerta' }),
      indicador({ rotulo: 'Plano', valor: matricula?.plano ?? 'sem plano', detalhe: matricula ? moeda(matricula.valor) : 'fale com a recepção', tipo: 'info' }),
      indicador({ rotulo: 'Turmas', valor: turmas.length, detalhe: `${horarios.length} aula(s) por semana` }),
      indicador({
        rotulo: 'Frequência (30 dias)',
        valor: percentual === null ? '-' : `${percentual}%`,
        detalhe: `${frequencia.presentes ?? 0} presença(s)`,
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

    cartao('Minha faixa em cada arte marcial', proximaFaixa.length
      ? el('div', {}, [
        el('p', { classe: 'explicacao' }, [
          icone('faixa', 16),
          'Esta é a sua graduação atual e o próximo degrau da escala. Fale com o seu mestre para saber '
          + 'o que falta para o próximo exame.',
        ]),
        el('ol', { classe: 'escala' }, proximaFaixa.map((faixa) => el('li', { classe: 'degrau' }, [
          el('span', { classe: 'ordem-degrau' }, [
            el('span', { classe: 'ponto', estilo: `background:${faixa.modalidade_cor};display:inline-block;width:9px;height:9px;border-radius:50%` }),
          ]),
          el('span', {
            classe: 'faixa-visual', 'aria-hidden': 'true',
            estilo: `--cor-faixa:${faixa.cor_atual || '#888'};--cor-ponta:${faixa.ponta_atual || faixa.cor_atual || '#888'}`,
          }, [
            el('span', { classe: 'ponta-faixa' }),
            ...Array.from({ length: Math.min(faixa.grau || 0, 6) }, () => el('span', { classe: 'grau-faixa' })),
          ]),
          el('div', { classe: 'dados-degrau' }, [
            el('strong', { texto: `${faixa.modalidade} — faixa ${faixa.faixa_atual}` }),
            el('span', { classe: 'dica', texto: faixa.proxima
              ? `Próximo degrau: ${faixa.proxima}${faixa.tempo_minimo ? ` · ${faixa.tempo_minimo} meses de permanência sugeridos` : ''}`
              : 'Você já está no degrau mais alto desta arte.' }),
            el('div', { classe: 'acoes' }, [
              faixa.grau ? etiqueta(`${faixa.grau}º grau`, 'ok') : null,
              faixa.desde ? etiqueta(`desde ${dataBr(faixa.desde)}`, 'neutra') : null,
            ].filter(Boolean)),
          ]),
        ]))),
      ])
      : vazio('Sua primeira graduação aparece aqui assim que o mestre registrar o exame.')),

    (equipes.length || competicoes.length)
      ? cartao('Minha vida de competidor', el('div', {}, [
        equipes.length
          ? el('div', { classe: 'acoes', estilo: 'margin-bottom:.9rem' }, equipes.map((equipe) => el('span', {
            classe: 'etiqueta bom',
          }, [
            icone('escudo', 13),
            ` ${equipe.nome} · ${equipe.funcao === 'capitao' ? 'capitão' : equipe.funcao}`
            + `${equipe.tecnico ? ` · técnico ${equipe.tecnico}` : ''}`,
          ])))
          : el('p', { classe: 'dica', texto: 'Você ainda não faz parte de nenhuma equipe de competição. Fale com o seu mestre.' }),

        competicoes.length
          ? tabela(
            ['Competição', 'Arte', 'Data', 'Categoria', 'Situação', 'Resultado'],
            competicoes.map((c) => [
              c.competicao,
              c.modalidade ? celula([etiquetaCor(c.modalidade, c.modalidade_cor)]) : '-',
              dataBr(c.data_inicio),
              c.categoria_peso || '-',
              celula([etiqueta(c.inscricao, c.inscricao === 'confirmado' ? 'ok' : 'info')]),
              celula([c.medalha
                ? el('span', { classe: 'etiqueta neutra' }, [
                  el('span', { classe: 'ponto', estilo: `background:${COR_MEDALHA[c.medalha]}` }),
                  `${c.medalha}${c.colocacao ? ` · ${c.colocacao}º` : ''}`
                  + `${c.lutas ? ` · ${c.vitorias}/${c.lutas} vitórias` : ''}`,
                ])
                : el('span', { classe: 'dica', texto: c.status === 'realizada' ? 'sem resultado lançado' : 'ainda vai acontecer' })]),
            ]),
          )
          : el('p', { classe: 'dica', texto: 'Nenhuma competição na sua ficha ainda. Veja a aba Competições e diga que quer competir.' }),
      ]))
      : null,

    el('div', { classe: 'grade col-2' }, [
      cartao('Histórico de graduações', graduacoes.length
        ? tabela(['Data', 'Modalidade', 'Faixa', 'Grau'], graduacoes.map((g) => [
          dataBr(g.data),
          celula([etiquetaCor(g.modalidade, g.modalidade_cor)]),
          g.graduacao,
          g.grau ? `${g.grau}º` : '-',
        ]))
        : vazio('Nenhuma graduação registrada ainda.')),

      cartao('Últimas presenças', presencas.length
        ? tabela(['Data', 'Turma', 'Presença'], presencas.map((p) => [
          dataBr(p.data), `${p.modalidade} · ${p.turma}`,
          celula([p.presente ? etiqueta('presente', 'ok') : etiqueta('falta', 'erro')]),
        ]))
        : vazio('Nenhuma chamada registrada.')),
    ]),

    matricula
      ? el('p', { classe: 'dica', texto: `Plano ${matricula.plano} (${matricula.periodicidade}) de ${dataBr(matricula.inicio)} até ${dataBr(matricula.fim)} · vencimento todo dia ${matricula.dia_vencimento}. Hoje e ${dataBr(hojeISO())}.` })
      : null,
  ]);
}
