import { api, sessao } from '../api.js';
import {
  el, cartao, tabela, celula, botao, etiqueta, indicador, moeda, dataBr, dataHoraBr,
  abrirFormulario, aviso, vazio, esqueleto, competenciaBr,
} from '../ui.js';
import { linkWhatsapp } from '../whatsapp.js';
import { icone } from '../icones.js';
import { topo, irPara } from '../app.js';

/**
 * Cobrança automática: o controle de quem está com o plano em dia.
 *
 * A regra roda sozinha uma vez por dia — gera a mensalidade do mês, suspende
 * quem passou do prazo e devolve a matrícula de quem acertou. Esta tela mostra
 * o resultado disso e deixa o dono ajustar cada prazo.
 */
export default async function paginaCobranca() {
  const ehDono = sessao.papel === 'dono';
  const area = el('div', {}, [esqueleto(4, 120)]);

  async function carregar() {
    const dados = await api.obter('/financeiro/cobranca');
    area.replaceChildren(
      painelResumo(dados),
      cartao('Como a cobrança está configurada', regras(dados.ajustes), acoes(dados.ajustes)),
      cartao(`Em atraso (${dados.atrasados.length})`, listaDeAtrasados(dados.atrasados)),
      cartao(`Vence nos próximos ${dados.ajustes.dias_aviso} dias (${dados.a_vencer.length})`,
        listaAVencer(dados.a_vencer)),
      dados.sem_plano.length
        ? cartao(`Sem plano ativo (${dados.sem_plano.length})`, listaSemPlano(dados.sem_plano))
        : null,
    );
  }

  function painelResumo({ resumo, competencia }) {
    return el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, [
      indicador({ rotulo: 'Plano em dia', valor: String(resumo.em_dia),
        detalhe: `Competência ${competenciaBr(competencia)}`, tipo: 'bom' }),
      indicador({ rotulo: 'Vencendo', valor: String(resumo.vence_em_breve),
        detalhe: 'Dá tempo de avisar antes', tipo: resumo.vence_em_breve ? 'atencao' : '' }),
      indicador({ rotulo: 'Em atraso', valor: String(resumo.atrasados),
        detalhe: resumo.valor_atualizado
          ? `${moeda(resumo.valor_atualizado)} com multa e juros`
          : 'Nada em atraso',
        tipo: resumo.atrasados ? 'critico' : 'bom' }),
      indicador({ rotulo: 'Matrículas suspensas', valor: String(resumo.suspensos),
        detalhe: resumo.bloqueados
          ? `${resumo.bloqueados} sem liberação de check-in`
          : 'Suspensão automática por atraso',
        tipo: resumo.suspensos ? 'atencao' : '' }),
    ]);
  }

  function regras(ajustes) {
    const linhas = [
      ['Mensalidade do mês', ajustes.automatica
        ? 'Gerada sozinha para toda matrícula ativa'
        : 'Só é gerada quando alguém pede'],
      ['Aviso de vencimento', `${ajustes.dias_aviso} dia(s) antes do vencimento`],
      ['Tolerância de atraso', `${ajustes.tolerancia} dia(s) depois do vencimento`],
      ['Check-in do atrasado', ajustes.bloquear_checkin
        ? 'Bloqueado depois da tolerância'
        : 'Liberado — o aluno treina e a recepção cobra'],
      ['Suspensão da matrícula', ajustes.suspender_dias
        ? `Depois de ${ajustes.suspender_dias} dia(s) de atraso`
        : 'Nunca suspende sozinha'],
      ['Multa e juros', `${ajustes.multa}% de multa + ${ajustes.juros_dia}% ao dia`],
      ['Última execução', ajustes.ultima_execucao
        ? `${dataHoraBr(ajustes.ultima_execucao)} — automática, uma vez por dia`
        : 'ainda não rodou'],
    ];
    return el('dl', { classe: 'lista-regras' }, linhas.flatMap(([rotulo, valor]) => [
      el('dt', { texto: rotulo }),
      el('dd', { texto: valor }),
    ]));
  }

  function acoes(ajustes) {
    return el('div', { classe: 'acoes' }, [
      botao('Rodar agora', async () => {
        const r = await api.criar('/financeiro/cobranca/executar', {});
        aviso(r.mensagem);
        await carregar();
      }, 'botao pequeno secundario'),
      ehDono ? botao('Ajustar regras', () => editarRegras(ajustes), 'botao pequeno') : null,
    ].filter(Boolean));
  }

  function editarRegras(ajustes) {
    abrirFormulario({
      titulo: 'Regras de cobrança',
      aviso: 'Valem para todos os planos. A rotina roda uma vez por dia, sozinha.',
      campos: [
        { nome: 'cobranca_automatica', rotulo: 'Gerar a mensalidade do mês automaticamente',
          tipo: 'select', opcoes: [{ valor: '1', rotulo: 'Sim' }, { valor: '0', rotulo: 'Não' }] },
        { nome: 'cobranca_dias_aviso', rotulo: 'Avisar quantos dias antes do vencimento', tipo: 'number' },
        { nome: 'cobranca_tolerancia', rotulo: 'Dias de tolerância depois do vencimento', tipo: 'number' },
        { nome: 'cobranca_bloquear_checkin', rotulo: 'Bloquear o check-in de quem está atrasado',
          tipo: 'select', opcoes: [{ valor: '0', rotulo: 'Não' }, { valor: '1', rotulo: 'Sim' }] },
        { nome: 'cobranca_suspender_dias', rotulo: 'Suspender a matrícula após quantos dias de atraso',
          tipo: 'number' },
        { nome: 'cobranca_multa', rotulo: 'Multa por atraso (%)', tipo: 'number', passo: '0.01' },
        { nome: 'cobranca_juros_dia', rotulo: 'Juros por dia (%)', tipo: 'number', passo: '0.001' },
      ],
      valores: {
        cobranca_automatica: ajustes.automatica ? '1' : '0',
        cobranca_dias_aviso: ajustes.dias_aviso,
        cobranca_tolerancia: ajustes.tolerancia,
        cobranca_bloquear_checkin: ajustes.bloquear_checkin ? '1' : '0',
        cobranca_suspender_dias: ajustes.suspender_dias,
        cobranca_multa: ajustes.multa,
        cobranca_juros_dia: ajustes.juros_dia,
      },
      aoSalvar: async (dados) => {
        await api.atualizar('/configuracoes', dados);
        aviso('Regras de cobrança atualizadas.');
        await carregar();
      },
    });
  }

  function listaDeAtrasados(lista) {
    if (!lista.length) return vazio('Ninguém em atraso. A academia está em dia.');
    return el('div', { classe: 'tabela-texto' }, [tabela(
      ['Aluno', 'Arte', 'Atraso', 'Valor', 'Multa e juros', 'Total', 'Matrícula', 'Ações'],
      lista.map((a) => [
        celula([
          el('strong', { texto: a.nome }),
          el('div', { classe: 'dica', texto: a.telefone || 'sem telefone' }),
        ]),
        a.modalidade || '—',
        celula([
          el('strong', { texto: `${a.dias_atraso} dia(s)` }),
          el('div', { classe: 'dica', texto: `venceu em ${dataBr(a.proximo_vencimento)}` }),
        ]),
        moeda(a.valor_atrasado),
        moeda(a.multa + a.juros),
        celula([el('strong', { texto: moeda(a.valor_atualizado) })]),
        celula([a.suspensa_por_atraso
          ? etiqueta('suspensa', 'erro')
          : etiqueta(a.em_tolerancia ? 'na tolerância' : 'ativa', a.em_tolerancia ? 'alerta' : 'ok')]),
        celula([cobrar(a), botao('Ficha', () => irPara('contas'), 'botao pequeno secundario')]
          .filter(Boolean), 'acoes-celula'),
      ]),
    )]);
  }

  function listaAVencer(lista) {
    if (!lista.length) return vazio('Nenhuma mensalidade vencendo nos próximos dias.');
    return el('div', { classe: 'tabela-texto' }, [tabela(
      ['Aluno', 'Arte', 'Vence em', 'Valor do plano'],
      lista.map((a) => [
        a.nome,
        a.modalidade || '—',
        `${dataBr(a.proximo_vencimento)} · ${a.dias_para_vencer} dia(s)`,
        moeda(a.valor_plano || 0),
      ]),
    )]);
  }

  function listaSemPlano(lista) {
    return el('div', { classe: 'tabela-texto' }, [tabela(
      ['Aluno', 'Arte', 'Situação'],
      lista.map((a) => [a.nome, a.modalidade || '—', 'sem matrícula ativa']),
    )]);
  }

  function cobrar(a) {
    const link = linkWhatsapp(a.telefone,
      `Olá, ${a.nome.split(' ')[0]}! Aqui é da Atak. Sua mensalidade venceu em `
      + `${dataBr(a.proximo_vencimento)} e está ${a.dias_atraso} dia(s) em atraso. `
      + `Com multa e juros dá ${moeda(a.valor_atualizado)}. Podemos acertar?`);
    if (!link) return null;
    return el('a', { classe: 'botao pequeno', href: link, target: '_blank', rel: 'noopener' },
      [icone('zap', 14), ' Cobrar']);
  }

  await carregar();

  return el('div', {}, [
    topo('Cobrança automática', 'Quem está em dia, quem atrasou e o que o sistema já fez sozinho'),
    el('p', { classe: 'explicacao' }, [
      icone('cartao', 16),
      'Uma vez por dia o sistema gera a mensalidade do mês de cada matrícula ativa, marca quem passou do '
      + 'vencimento, suspende quem passou do prazo e devolve a matrícula assim que o aluno acerta. '
      + 'Ninguém precisa lembrar de rodar nada.',
    ]),
    area,
  ]);
}
