import { api, sessao } from '../api.js';
import {
  el, cartao, indicador, botao, etiqueta, tabela, celula, vazio, aviso, esqueleto, dataBr,
} from '../ui.js';
import { barrasHorizontais, evolucao } from '../graficos.js';
import { topo } from '../app.js';

/**
 * Check-in do treino.
 * O aluno confirma presença na janela da aula; a academia acompanha
 * quantos apareceram em cada horário.
 */
export default async function paginaCheckin() {
  return sessao.papel === 'aluno' ? telaDoAluno() : telaDaAcademia();
}

/* ------------------------------------------------------------- aluno */

async function telaDoAluno() {
  const area = el('div');

  async function carregar() {
    area.replaceChildren(esqueleto(2, 120));
    const dados = await api.obter('/checkins/agora');
    desenhar(dados);
  }

  function desenhar(dados) {
    const { aulas, totais } = dados;
    const abertas = aulas.filter((a) => a.aberto && !a.ja_confirmado);
    const confirmadas = aulas.filter((a) => a.ja_confirmado);

    area.replaceChildren(el('div', {}, [
      aulas.length ? null : el('div', { classe: 'mensagem-ok' }, [
        el('span', { texto: '🗓️' }),
        'Você não tem aula marcada para hoje. Aproveite para descansar — ou fale com a recepção para entrar em outra turma.',
      ]),

      ...aulas.map((aula) => cartaoAula(aula)),

      el('div', { classe: 'grade col-4', estilo: 'margin-top:1rem' }, [
        indicador({ rotulo: 'Treinos no total', valor: String(totais.total), tipo: 'destaque' }),
        indicador({ rotulo: 'Treinos no mês', valor: String(totais.mes), tipo: 'bom' }),
        indicador({ rotulo: 'Nos últimos 7 dias', valor: String(totais.semana) }),
        indicador({
          rotulo: 'Semanas seguidas', valor: String(totais.sequencia),
          detalhe: totais.sequencia > 1 ? 'Sequência mantida!' : 'Treine esta semana para começar uma sequência',
          tipo: totais.sequencia > 1 ? 'bom' : '',
        }),
      ]),

      cartao('Sua semana', el('div', {}, [
        el('div', { classe: 'acoes', estilo: 'gap:.6rem' }, totais.dias.map((dia) => el('div', {
          estilo: 'text-align:center;min-width:44px',
        }, [
          el('div', { classe: 'dica', texto: dia.dia }),
          el('div', {
            estilo: `height:38px;border-radius:10px;margin-top:4px;border:1px solid var(--borda);`
              + (dia.treinou
                ? 'background:var(--marca-gradiente);box-shadow:0 0 14px rgba(245,179,1,.35)'
                : 'background:var(--superficie-2)'),
            title: dia.treinou ? `Treinou em ${dataBr(dia.data)}` : `Sem treino em ${dataBr(dia.data)}`,
          }),
        ]))),
        el('p', { classe: 'dica', estilo: 'margin-top:.8rem' },
          [`${confirmadas.length} de ${aulas.length} aula(s) de hoje confirmada(s).`
            + (abertas.length ? ' Ainda dá tempo de confirmar as que estão abertas.' : '')]),
      ])),

      cartao('Seus últimos treinos', totais.ultimos.length
        ? tabela(['Data', 'Hora', 'Modalidade', 'Turma'], totais.ultimos.map((t) => [
          dataBr(t.data), t.hora,
          celula([etiqueta(t.modalidade, 'marca')]),
          t.turma,
        ]))
        : vazio('Seu primeiro check-in aparece aqui.', '🥋')),
    ]));
  }

  function cartaoAula(aula) {
    const podeConfirmar = aula.aberto && !aula.ja_confirmado;
    const rotulo = aula.ja_confirmado ? 'Presença confirmada'
      : aula.aberto ? 'Fazer check-in'
        : aula.encerrado ? 'Check-in encerrado' : `Abre às ${aula.abre_as}`;

    return el('div', { classe: 'checkin-agora' }, [
      el('button', {
        classe: `botao-checkin ${aula.ja_confirmado ? 'feito' : ''}`,
        disabled: !podeConfirmar,
        texto: aula.ja_confirmado ? '✓ Presente' : aula.aberto ? 'Estou aqui' : 'Fechado',
        aoClicar: () => confirmar(aula),
      }),
      el('div', {}, [
        el('div', { classe: 'acoes', estilo: 'margin-bottom:.4rem' }, [
          etiqueta(aula.modalidade, 'marca'),
          etiqueta(`${aula.hora_inicio} às ${aula.hora_fim}`, 'neutra'),
          aula.ja_confirmado ? etiqueta(`confirmado às ${aula.confirmado_as}`, 'bom') : null,
        ]),
        el('h3', { texto: aula.turma, estilo: 'margin:0 0 .25rem' }),
        el('p', { classe: 'dica', estilo: 'margin:0' }, [
          [aula.mestre, aula.local, `${aula.confirmados} confirmado(s) nesta aula`]
            .filter(Boolean).join(' · '),
        ]),
        el('p', { classe: 'dica', estilo: 'margin:.4rem 0 0' }, [rotulo]),
      ]),
    ]);
  }

  async function confirmar(aula) {
    try {
      const resposta = await api.criar('/checkins', { horario_id: aula.horario_id });
      aviso(resposta.mensagem);
      desenhar({ aulas: resposta.aulas, totais: resposta.totais });
    } catch (erro) {
      aviso(erro.message, 'erro');
      await carregar();
    }
  }

  await carregar();

  return el('div', {}, [
    topo('Check-in do treino', 'Chegou na academia? Confirme sua presença e registre o treino no seu histórico.'),
    area,
  ]);
}

/* ---------------------------------------------------------- academia */

async function telaDaAcademia() {
  const dados = await api.obter('/checkins/resumo');
  const { totais, aulas_hoje: aulasHoje, por_turma: porTurma, por_modalidade: porModalidade, por_dia: porDia, ranking } = dados;

  const totalMatriculados = aulasHoje.reduce((soma, a) => soma + a.matriculados, 0);
  const confirmadosHoje = aulasHoje.reduce((soma, a) => soma + a.confirmados, 0);
  const adesao = totalMatriculados ? Math.round((confirmadosHoje / totalMatriculados) * 100) : 0;

  return el('div', {}, [
    topo('Check-ins', 'Quem está realmente aparecendo para treinar, aula por aula'),

    el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, [
      indicador({
        rotulo: 'Check-ins hoje', valor: String(totais.hoje),
        detalhe: `${adesao}% dos alunos com aula hoje`, tipo: 'destaque',
      }),
      indicador({ rotulo: 'Média por aula', valor: String(totais.media_por_aula), detalhe: 'Últimos 30 dias', tipo: 'bom' }),
      indicador({ rotulo: 'Alunos treinando', valor: String(totais.alunos), detalhe: 'Pessoas diferentes em 30 dias' }),
      indicador({ rotulo: 'Check-ins no período', valor: String(totais.checkins), detalhe: `${totais.dias} dia(s) com treino` }),
    ]),

    cartao('Aulas de hoje', aulasHoje.length
      ? tabela(['Horário', 'Turma', 'Mestre', 'Confirmados', 'Ocupação'], aulasHoje.map((aula) => [
        celula([el('strong', { texto: `${aula.hora_inicio} – ${aula.hora_fim}` })]),
        celula([
          el('strong', { texto: aula.turma }),
          el('div', { classe: 'dica', texto: aula.modalidade }),
        ]),
        aula.mestre || '—',
        celula([etiqueta(`${aula.confirmados} de ${aula.matriculados}`,
          aula.confirmados >= aula.matriculados * 0.6 ? 'bom' : aula.confirmados ? 'atencao' : 'neutra')]),
        celula([el('div', { classe: 'barra', estilo: 'width:120px' }, [
          el('span', {
            estilo: `width:${Math.min(100, (aula.confirmados / Math.max(1, aula.capacidade)) * 100)}%;`
              + `background:${aula.modalidade_cor || 'var(--marca-1)'}`,
          }),
        ])]),
      ]))
      : vazio('Nenhuma aula marcada para hoje.', '🗓️')),

    el('div', { classe: 'grade col-2' }, [
      cartao('Check-ins por modalidade', porModalidade.length
        ? barrasHorizontais({
          dados: porModalidade.map((m) => ({ rotulo: m.modalidade, valor: m.checkins, cor: m.cor, legenda: 'check-ins' })),
          formatar: (v) => String(v),
        })
        : vazio('Ainda não há check-ins registrados.', '📊')),

      cartao('Quem mais treinou', ranking.length
        ? tabela(['#', 'Aluno', 'Treinos'], ranking.slice(0, 10).map((linha, i) => [
          celula([i < 3 ? etiqueta(['1º', '2º', '3º'][i], 'marca') : String(i + 1)]),
          linha.nome,
          String(linha.checkins),
        ]))
        : vazio('O ranking aparece depois dos primeiros check-ins.', '🏆')),
    ]),

    cartao('Movimento dia a dia', porDia.length > 1
      ? evolucao({
        pontos: porDia.map((d) => ({ x: dataBr(d.data).slice(0, 5), valores: [d.checkins] })),
        series: [{ nome: 'Check-ins', cor: 'var(--serie-1)' }],
        formatar: (v) => String(Math.round(v)),
      })
      : vazio('O gráfico aparece quando houver check-in em mais de um dia.', '📈')),

    cartao('Detalhe por turma', porTurma.length
      ? tabela(['Turma', 'Modalidade', 'Check-ins', 'Alunos diferentes', 'Dias com aula', 'Média por aula'],
        porTurma.map((linha) => [
          linha.turma, linha.modalidade, String(linha.checkins), String(linha.alunos), String(linha.dias),
          String(linha.dias ? (linha.checkins / linha.dias).toFixed(1) : '0'),
        ]))
      : vazio('Sem dados no período.', '📋')),
  ]);
}
