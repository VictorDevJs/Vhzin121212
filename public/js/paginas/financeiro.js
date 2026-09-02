import { api, sessao, consulta } from '../api.js';
import {
  el, cartao, tabela, celula, botao, indicador, etiqueta, etiquetaStatus, moeda, dataBr, competenciaBr,
  abrirFormulario, aviso, confirmar, vazio, hojeISO, competenciaAtual,
} from '../ui.js';
import { icone } from '../icones.js';
import { barrasHorizontais, evolucao } from '../graficos.js';
import { linkWhatsapp, mensagemCobranca } from '../whatsapp.js';
import { marca } from '../marca.js';
import { topo } from '../app.js';

const FORMAS = ['dinheiro', 'pix', 'debito', 'credito', 'transferencia', 'boleto'];

/** Controle financeiro: mensalidades, entradas, saidas e resultado do mes. */
export default async function paginaFinanceiro() {
  const ehDono = sessao.papel === 'dono';
  const estado = { competencia: competenciaAtual(), statusMensalidade: '', visaoPorTurma: false };

  const areaIndicadores = el('div');
  const areaGrafico = el('div');
  const areaCategorias = el('div');
  const areaMensalidades = el('div');
  const areaLancamentos = el('div');
  const areaModalidades = el('div');
  const alunos = await api.obter('/alunos?status=ativo');

  async function carregarResumo() {
    if (!ehDono) {
      areaIndicadores.replaceChildren(el('p', { classe: 'dica', texto: 'O resultado consolidado da academia fica visível apenas para o dono.' }));
      return;
    }
    const resumo = await api.obter(`/financeiro/resumo${consulta({ competencia: estado.competencia })}`);
    areaIndicadores.replaceChildren(el('div', { classe: 'grade col-4' }, [
      indicador({ rotulo: 'Receitas', valor: moeda(resumo.receitas), detalhe: competenciaBr(resumo.competencia), tipo: 'ok' }),
      indicador({ rotulo: 'Despesas', valor: moeda(resumo.despesas), detalhe: competenciaBr(resumo.competencia), tipo: 'erro' }),
      indicador({
        rotulo: 'Saldo do mês', valor: moeda(resumo.saldo),
        detalhe: resumo.saldo >= 0 ? 'Resultado positivo' : 'Resultado negativo',
        tipo: resumo.saldo >= 0 ? 'ok' : 'erro',
      }),
      indicador({ rotulo: 'A receber', valor: moeda(resumo.a_receber.total), detalhe: `${resumo.a_receber.quantidade} mensalidade(s)`, tipo: 'alerta' }),
      indicador({
        rotulo: 'Inadimplência', valor: moeda(resumo.inadimplencia.total),
        detalhe: `${resumo.inadimplencia.quantidade} em atraso`,
        tipo: resumo.inadimplencia.quantidade ? 'erro' : '',
      }),
    ]));

    areaGrafico.replaceChildren(resumo.evolucao.length
      ? evolucao({
        pontos: resumo.evolucao.map((mes) => ({ x: competenciaBr(mes.competencia), valores: [mes.receitas, mes.despesas] })),
        series: [{ nome: 'Entradas', cor: 'var(--serie-1)' }, { nome: 'Saídas', cor: 'var(--serie-2)' }],
      })
      : vazio('Ainda não ha movimentacao registrada.'));

    areaCategorias.replaceChildren(el('div', { classe: 'grade col-2' }, [
      blocoCategorias('Entradas por categoria', resumo.por_categoria.filter((c) => c.tipo === 'receita'), 'var(--serie-1)'),
      blocoCategorias('Saídas por categoria', resumo.por_categoria.filter((c) => c.tipo === 'despesa'), 'var(--serie-2)'),
    ]));
  }

  function blocoCategorias(titulo, itens, cor) {
    return el('div', {}, [
      el('h4', { texto: titulo }),
      itens.length
        ? barrasHorizontais({
          dados: itens.map((item) => ({ rotulo: item.categoria, valor: item.total, cor, legenda: 'total no mês' })),
          formatar: moeda,
        })
        : vazio('Sem lançamentos neste mês.'),
    ]);
  }

  // ---------- Mensalidades ----------

  async function carregarMensalidades() {
    const { totais, mensalidades } = await api.obter(`/financeiro/mensalidades${consulta({
      competencia: estado.statusMensalidade === 'atrasadas' ? '' : estado.competencia,
      status: ['pendente', 'pago', 'cancelado'].includes(estado.statusMensalidade) ? estado.statusMensalidade : '',
      atrasadas: estado.statusMensalidade === 'atrasadas' ? '1' : '',
    })}`);

    areaMensalidades.replaceChildren(el('div', {}, [
      el('div', { classe: 'grade col-3', estilo: 'margin-bottom:1rem' }, [
        indicador({ rotulo: 'Recebido', valor: moeda(totais.recebido), tipo: 'ok' }),
        indicador({ rotulo: 'Em aberto', valor: moeda(totais.a_receber), tipo: 'alerta' }),
        indicador({ rotulo: 'Atrasado', valor: moeda(totais.atrasado), tipo: totais.atrasado ? 'erro' : '' }),
      ]),
      tabela(
        ['Aluno', 'Competência', 'Vencimento', 'Valor', 'Situação', 'Pagamento', 'Ações'],
        mensalidades.map((mensalidade) => [
          celula([
            el('strong', { texto: mensalidade.aluno }),
            mensalidade.telefone ? el('div', { classe: 'dica', texto: mensalidade.telefone }) : null,
          ]),
          competenciaBr(mensalidade.competencia),
          dataBr(mensalidade.vencimento),
          moeda(mensalidade.valor),
          celula([mensalidade.atrasada ? etiqueta('atrasada', 'erro') : etiquetaStatus(mensalidade.status)]),
          mensalidade.pago_em ? `${dataBr(mensalidade.pago_em)} (${mensalidade.forma_pagamento || '-'})` : '-',
          celula([
            mensalidade.status === 'pendente' ? botao('Receber', () => receber(mensalidade), 'botao pequeno') : null,
            mensalidade.atrasada && linkWhatsapp(mensalidade.telefone)
              ? el('a', {
                classe: 'botao pequeno secundario', target: '_blank', rel: 'noopener', texto: 'Cobrar',
                href: linkWhatsapp(mensalidade.telefone, mensagemCobranca({
                  aluno: mensalidade.aluno,
                  competencia: competenciaBr(mensalidade.competencia),
                  valor: moeda(mensalidade.valor),
                  vencimento: dataBr(mensalidade.vencimento),
                  academia: marca.nome,
                })),
              })
              : null,
            ehDono && mensalidade.status === 'pendente'
              ? botao('Cancelar', async () => {
                if (!confirmar('Cancelar esta mensalidade?')) return;
                await api.remover(`/financeiro/mensalidades/${mensalidade.id}`);
                await atualizarTudo();
              }, 'botao pequeno perigo')
              : null,
          ].filter(Boolean), 'acoes-celula'),
        ]),
        'Nenhuma mensalidade nesse filtro.',
      ),
    ]));
  }

  function receber(mensalidade) {
    abrirFormulario({
      titulo: `Receber de ${mensalidade.aluno}`,
      aviso: 'O pagamento entra automaticamente como receita no caixa da academia.',
      campos: [
        { nome: 'valor', rotulo: 'Valor recebido', tipo: 'number', passo: '0.01', valor: mensalidade.valor, obrigatorio: true },
        { nome: 'forma_pagamento', rotulo: 'Forma de pagamento', tipo: 'select',
          opcoes: FORMAS.map((forma) => ({ valor: forma, rotulo: forma })) },
        { nome: 'pago_em', rotulo: 'Data do pagamento', tipo: 'date', valor: hojeISO() },
      ],
      aoSalvar: async (dados) => {
        await api.criar(`/financeiro/mensalidades/${mensalidade.id}/pagar`, dados);
        aviso('Pagamento registrado.');
        await atualizarTudo();
      },
    });
  }

  function gerarMensalidades() {
    abrirFormulario({
      titulo: 'Gerar mensalidades do mês',
      aviso: 'Cria a cobranca de todos os alunos com matrícula ativa. Quem já tem mensalidade no mês e ignorado.',
      campos: [{ nome: 'competencia', rotulo: 'Competência', tipo: 'month', valor: estado.competencia, obrigatorio: true }],
      textoConfirmar: 'Gerar',
      aoSalvar: async (dados) => {
        const resposta = await api.criar('/financeiro/mensalidades/gerar', dados);
        aviso(resposta.mensagem);
        await atualizarTudo();
      },
    });
  }

  function mensalidadeAvulsa() {
    abrirFormulario({
      titulo: 'Nova mensalidade avulsa',
      campos: [
        { nome: 'aluno_id', rotulo: 'Aluno', tipo: 'select', obrigatorio: true,
          opcoes: alunos.map((a) => ({ valor: a.id, rotulo: a.nome })) },
        { nome: 'competencia', rotulo: 'Competência', tipo: 'month', valor: estado.competencia, obrigatorio: true },
        { nome: 'vencimento', rotulo: 'Vencimento', tipo: 'date', valor: `${estado.competencia}-10` },
        { nome: 'valor', rotulo: 'Valor', tipo: 'number', passo: '0.01', obrigatorio: true },
        { nome: 'observacao', rotulo: 'Observação' },
      ],
      aoSalvar: async (dados) => {
        await api.criar('/financeiro/mensalidades', dados);
        aviso('Mensalidade criada.');
        await atualizarTudo();
      },
    });
  }

  // ---------- Lançamentos ----------

  async function carregarLancamentos() {
    const { totais, lancamentos } = await api.obter(`/financeiro/lancamentos${consulta({
      de: `${estado.competencia}-01`, até: `${estado.competencia}-31`,
    })}`);

    areaLancamentos.replaceChildren(el('div', {}, [
      el('div', { classe: 'grade col-3', estilo: 'margin-bottom:1rem' }, [
        indicador({ rotulo: 'Entradas', valor: moeda(totais.receitas), tipo: 'ok' }),
        ehDono ? indicador({ rotulo: 'Saídas', valor: moeda(totais.despesas), tipo: 'erro' }) : null,
        ehDono ? indicador({ rotulo: 'Saldo', valor: moeda(totais.saldo), tipo: totais.saldo >= 0 ? 'ok' : 'erro' }) : null,
      ].filter(Boolean)),
      tabela(
        ['Data', 'Tipo', 'Categoria', 'Descrição', 'Aluno', 'Forma', 'Valor', ''],
        lancamentos.map((lancamento) => [
          dataBr(lancamento.data),
          celula([etiqueta(lancamento.tipo, lancamento.tipo === 'receita' ? 'ok' : 'erro')]),
          lancamento.categoria,
          lancamento.descricao,
          lancamento.aluno || '-',
          lancamento.forma_pagamento || '-',
          moeda(lancamento.valor),
          celula([ehDono
            ? botao('Estornar', async () => {
              if (!confirmar('Remover este lançamento? Se for um pagamento de mensalidade, ela volta para pendente.')) return;
              await api.remover(`/financeiro/lancamentos/${lancamento.id}`);
              aviso('Lançamento estornado.');
              await atualizarTudo();
            }, 'botao pequeno perigo')
            : null]),
        ]),
        'Nenhuma movimentacao neste mês.',
      ),
    ]));
  }

  function novoLancamento(tipo) {
    const categorias = tipo === 'receita'
      ? ['mensalidade', 'matricula', 'exame de faixa', 'produtos', 'evento', 'aula avulsa', 'outros']
      : ['aluguel', 'salarios', 'agua/luz/internet', 'equipamentos', 'manutencao', 'marketing', 'impostos', 'outros'];

    abrirFormulario({
      titulo: tipo === 'receita' ? 'Nova entrada' : 'Nova saída',
      campos: [
        { nome: 'categoria', rotulo: 'Categoria', tipo: 'select', opcoes: categorias.map((c) => ({ valor: c, rotulo: c })) },
        { nome: 'descricao', rotulo: 'Descrição', obrigatorio: true },
        { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'number', passo: '0.01', obrigatorio: true },
        { nome: 'data', rotulo: 'Data', tipo: 'date', valor: hojeISO() },
        { nome: 'forma_pagamento', rotulo: 'Forma', tipo: 'select', opcoes: FORMAS.map((f) => ({ valor: f, rotulo: f })) },
        ...(tipo === 'receita'
          ? [{ nome: 'aluno_id', rotulo: 'Aluno (opcional)', tipo: 'select',
            opcoes: [{ valor: '', rotulo: '-' }, ...alunos.map((a) => ({ valor: a.id, rotulo: a.nome }))] }]
          : []),
      ],
      aoSalvar: async (dados) => {
        await api.criar('/financeiro/lancamentos', { ...dados, tipo });
        aviso('Lançamento registrado.');
        await atualizarTudo();
      },
    });
  }

  /**
   * Monitoramento das mensalidades por arte marcial e por turma.
   * Quem treina duas modalidades tem a mensalidade rateada entre elas,
   * entao a soma das linhas fecha com o total do mes.
   */
  async function carregarPorModalidade() {
    const dados = await api.obter(`/financeiro/por-modalidade${consulta({ competencia: estado.competencia })}`);
    const linhas = estado.visaoPorTurma ? dados.turmas : dados.modalidades;

    areaModalidades.replaceChildren(el('div', {}, [
      el('div', { classe: 'filtros' }, [
        el('div', { classe: 'campo' }, [
          el('label', { texto: 'Ver por' }),
          el('select', {
            aoMudar: (evento) => { estado.visaoPorTurma = evento.target.value === 'turma'; carregarPorModalidade(); },
          }, [
            el('option', { value: 'modalidade', texto: 'Arte marcial', selected: !estado.visaoPorTurma }),
            el('option', { value: 'turma', texto: 'Turma', selected: estado.visaoPorTurma }),
          ]),
        ]),
        el('span', { classe: 'dica', texto: 'Aluno em mais de uma modalidade tem o valor rateado entre elas.' }),
      ]),
      linhas.length
        ? el('div', {}, [
          barrasHorizontais({
            dados: linhas.map((linha) => ({
              rotulo: estado.visaoPorTurma ? linha.turma : linha.modalidade,
              valor: linha.previsto,
              cor: linha.cor || undefined,
              legenda: 'previsto no mês',
            })),
            formatar: moeda,
          }),
          tabela(
            [estado.visaoPorTurma ? 'Turma' : 'Arte marcial', 'Alunos', 'Previsto', 'Recebido', 'Em aberto', 'Atrasado', 'Inadimplentes'],
            linhas.map((linha) => [
              celula([
                el('strong', { texto: estado.visaoPorTurma ? linha.turma : linha.modalidade }),
                estado.visaoPorTurma ? el('div', { classe: 'dica', texto: linha.modalidade }) : null,
              ]),
              String(linha.alunos),
              moeda(linha.previsto),
              moeda(linha.recebido),
              moeda(linha.em_aberto),
              celula([linha.atrasado ? etiqueta(moeda(linha.atrasado), 'critico') : etiqueta('em dia', 'bom')]),
              String(linha.inadimplentes),
            ]),
          ),
        ])
        : vazio('Sem mensalidades neste mês para dividir entre as modalidades.'),
      dados.sem_turma
        ? el('p', { classe: 'dica', texto: `${dados.sem_turma.alunos} aluno(s) sem turma definida somam ${moeda(dados.sem_turma.previsto)} e ficam fora da divisao acima.` })
        : null,
    ]));
  }

  async function atualizarTudo() {
    await Promise.all([carregarResumo(), carregarMensalidades(), carregarLancamentos(), carregarPorModalidade()]);
  }

  const seletorCompetencia = el('input', {
    type: 'month', value: estado.competencia,
    aoMudar: (evento) => { estado.competencia = evento.target.value || competenciaAtual(); atualizarTudo(); },
  });

  const seletorStatus = el('select', {
    aoMudar: (evento) => { estado.statusMensalidade = evento.target.value; carregarMensalidades(); },
  }, [
    el('option', { value: '', texto: 'Todas do mês' }),
    el('option', { value: 'pendente', texto: 'Em aberto' }),
    el('option', { value: 'pago', texto: 'Pagas' }),
    el('option', { value: 'atrasadas', texto: 'Atrasadas (todos os meses)' }),
  ]);

  await atualizarTudo();

  return el('div', {}, [
    topo('Financeiro', 'Mensalidades, entradas, saídas e resultado da academia', [
      botao('Gerar mensalidades', gerarMensalidades, 'botao secundario'),
      botao('+ Entrada', () => novoLancamento('receita'), 'botao secundario'),
      ehDono ? botao('+ Saída', () => novoLancamento('despesa'), 'botao secundario') : null,
    ].filter(Boolean)),
    el('p', { classe: 'explicacao' }, [
      icone('dinheiro', 16),
      'Todo dinheiro que entra e sai passa por aqui: mensalidades, vendas da loja e despesas. A receita de cada arte marcial é rateada quando o aluno treina mais de uma modalidade.',
    ]),
    el('div', { classe: 'filtros' }, [
      el('div', { classe: 'campo' }, [el('label', { texto: 'Mês de referência' }), seletorCompetencia]),
    ]),
    areaIndicadores,
    ehDono ? cartao('Entradas e saídas dos últimos meses', areaGrafico) : null,
    ehDono ? cartao('Para onde o dinheiro vai', areaCategorias) : null,
    cartao('Mensalidades por arte marcial', areaModalidades),
    cartao('Mensalidades', [
      el('div', { classe: 'filtros' }, [
        el('div', { classe: 'campo' }, [el('label', { texto: 'Filtrar' }), seletorStatus]),
        botao('+ Mensalidade avulsa', mensalidadeAvulsa, 'botao secundario pequeno'),
      ]),
      areaMensalidades,
    ]),
    cartao('Movimentações do mês', areaLancamentos),
  ]);
}
