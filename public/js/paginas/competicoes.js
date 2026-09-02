import { api, sessao, consulta } from '../api.js';
import {
  el, cartao, botao, etiqueta, etiquetaCor, tabela, celula, indicador, dataBr, moeda,
  abrirFormulario, abrirModal, aviso, confirmar, vazio, opcoesDe,
} from '../ui.js';
import { icone } from '../icones.js';
import { topo } from '../app.js';

const TIPOS = [
  { valor: 'campeonato', rotulo: 'Campeonato' },
  { valor: 'seletiva', rotulo: 'Seletiva' },
  { valor: 'festival', rotulo: 'Festival' },
  { valor: 'interno', rotulo: 'Torneio interno' },
  { valor: 'amistoso', rotulo: 'Amistoso / desafio' },
  { valor: 'graduacao', rotulo: 'Exame de graduação' },
];

const NIVEIS = [
  { valor: 'interno', rotulo: 'Interno da academia' },
  { valor: 'municipal', rotulo: 'Municipal' },
  { valor: 'estadual', rotulo: 'Estadual' },
  { valor: 'nacional', rotulo: 'Nacional' },
  { valor: 'internacional', rotulo: 'Internacional' },
];

const SITUACOES = [
  { valor: 'agendada', rotulo: 'Agendada' },
  { valor: 'inscricoes', rotulo: 'Inscrições abertas' },
  { valor: 'encerrada', rotulo: 'Inscrições encerradas' },
  { valor: 'realizada', rotulo: 'Já realizada' },
  { valor: 'cancelada', rotulo: 'Cancelada' },
];

const SITUACOES_INSCRICAO = [
  { valor: 'interesse', rotulo: 'Demonstrou interesse' },
  { valor: 'inscrito', rotulo: 'Inscrito' },
  { valor: 'confirmado', rotulo: 'Confirmado' },
  { valor: 'desistiu', rotulo: 'Desistiu' },
];

const MEDALHAS = [
  { valor: '', rotulo: 'Sem medalha' },
  { valor: 'ouro', rotulo: 'Ouro' },
  { valor: 'prata', rotulo: 'Prata' },
  { valor: 'bronze', rotulo: 'Bronze' },
  { valor: 'participacao', rotulo: 'Participação' },
];

const COR_SITUACAO = {
  agendada: 'info', inscricoes: 'ok', encerrada: 'alerta', realizada: 'neutra', cancelada: 'erro',
};

const COR_MEDALHA = { ouro: '#f5b301', prata: '#b9bec6', bronze: '#b06d3a', participacao: '#6b7280' };

/**
 * Calendário de competições da academia: campeonatos, seletivas e torneios
 * internos, com inscrição dos atletas e quadro de medalhas por modalidade.
 */
export default async function paginaCompeticoes() {
  const ehAluno = sessao.papel === 'aluno';
  const podeGerir = sessao.papel === 'dono' || sessao.papel === 'competicoes'
    || (sessao.usuario?.cargos || []).some((c) => c.cargo === 'competicoes');

  const [modalidades, agenda, mestres, alunos, categoriasPeso, equipes] = await Promise.all([
    api.obter('/modalidades'),
    api.obter('/competicoes/agenda'),
    ehAluno ? Promise.resolve([]) : api.obter('/usuarios/mestres'),
    podeGerir ? api.obter('/alunos?status=ativo') : Promise.resolve([]),
    api.obter('/competicoes/categorias-peso'),
    api.obter('/equipes?ativo=1'),
  ]);

  const filtro = { modalidade_id: '', status: '', periodo: 'futuras' };
  const area = el('div');
  const areaIndicadores = el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' });

  async function carregar() {
    const lista = await api.obter(`/competicoes${consulta(filtro)}`);
    area.replaceChildren(lista.length
      ? el('div', { classe: 'grade col-2' }, lista.map(cartaoCompeticao))
      : vazio('Nenhuma competição neste filtro. Troque o período ou a modalidade.'));
    desenharIndicadores();
  }

  function desenharIndicadores() {
    const proximas = agenda.proximas || [];
    const quadro = agenda.quadro_medalhas?.por_modalidade || [];
    const soma = (chave) => quadro.reduce((total, linha) => total + (linha[chave] || 0), 0);
    areaIndicadores.replaceChildren(
      indicador({ rotulo: 'Próximas competições', valor: String(proximas.length),
        detalhe: proximas[0] ? `A mais próxima: ${dataBr(proximas[0].data_inicio)}` : 'Nada marcado ainda' }),
      indicador({ rotulo: 'Medalhas de ouro', valor: String(soma('ouro')), tipo: 'destaque',
        detalhe: 'Somando todos os campeonatos' }),
      indicador({ rotulo: 'Prata e bronze', valor: `${soma('prata')} · ${soma('bronze')}`,
        detalhe: 'Pódios da equipe Atak' }),
      indicador({ rotulo: 'Atletas no pódio', valor: String((agenda.quadro_medalhas?.atletas || []).length),
        detalhe: 'Alunos com resultado registrado' }),
    );
  }

  function cartaoCompeticao(item) {
    const passada = item.status === 'realizada';
    return el('article', { classe: 'cartao competicao tilt' }, [
      el('div', { classe: 'acoes', estilo: 'margin-bottom:.6rem' }, [
        item.modalidade ? etiquetaCor(item.modalidade, item.modalidade_cor) : etiqueta('Geral', 'neutra'),
        etiqueta(SITUACOES.find((s) => s.valor === item.status)?.rotulo || item.status,
          COR_SITUACAO[item.status] || 'neutra'),
        etiqueta(NIVEIS.find((n) => n.valor === item.nivel)?.rotulo || item.nivel, 'neutra'),
      ]),
      el('h3', { texto: item.nome }),
      el('p', { classe: 'legenda', texto: item.organizador || 'Organização própria' }),

      el('dl', { classe: 'ficha' }, [
        linhaFicha('Data', dataBr(item.data_inicio) + (item.data_fim ? ` a ${dataBr(item.data_fim)}` : '')),
        linhaFicha('Local', [item.local, item.cidade].filter(Boolean).join(' · ') || 'A definir'),
        item.inscricao_ate ? linhaFicha('Inscrição até', dataBr(item.inscricao_ate)) : null,
        linhaFicha('Taxa', item.taxa > 0 ? moeda(item.taxa) : 'Sem taxa'),
        linhaFicha('Responsável', item.responsavel || 'A definir'),
        linhaFicha('Atletas', `${item.inscritos} inscrito(s) · ${item.confirmados} confirmado(s)`),
        passada ? linhaFicha('Pódios', `${item.podios} medalha(s) da Atak`) : null,
      ].filter(Boolean)),

      item.descricao ? el('p', { texto: item.descricao }) : null,

      el('div', { classe: 'acoes' }, [
        botao('Ver detalhes', () => abrirDetalhe(item.id), 'botao pequeno secundario'),
        ehAluno && !passada ? botaoDoAluno(item) : null,
        podeGerir ? botao('Editar', () => formulario(item), 'botao pequeno secundario') : null,
        podeGerir ? botao('Excluir', async () => {
          if (!confirmar(`Excluir a competição "${item.nome}" e todas as inscrições dela?`)) return;
          await api.remover(`/competicoes/${item.id}`);
          aviso('Competição removida.');
          await carregar();
        }, 'botao pequeno perigo') : null,
      ].filter(Boolean)),
    ]);
  }

  function botaoDoAluno(item) {
    if (item.minha_inscricao) {
      return el('span', { classe: 'etiqueta bom' }, [
        icone('chamada', 14), ` Você está ${item.minha_inscricao === 'interesse' ? 'na lista' : item.minha_inscricao}`,
      ]);
    }
    return botao('Quero competir', async () => {
      try {
        await api.criar(`/competicoes/${item.id}/inscricoes`, {});
        aviso('Interesse registrado! O responsável de competições vai confirmar com você.');
        await carregar();
      } catch (erro) {
        aviso(erro.message, 'erro');
      }
    }, 'botao pequeno');
  }

  function linhaFicha(rotulo, valor) {
    return el('div', { classe: 'linha-ficha' }, [
      el('dt', { texto: rotulo }),
      el('dd', { texto: valor }),
    ]);
  }

  /* ------------------------------------------------------- detalhe */

  async function abrirDetalhe(id) {
    const competicao = await api.obter(`/competicoes/${id}`);
    const corpo = el('div');

    function desenhar() {
      const inscricoes = competicao.inscricoes || [];
      corpo.replaceChildren(
        el('div', { classe: 'grade col-3', estilo: 'margin-bottom:1rem' }, [
          indicador({ rotulo: 'Inscritos', valor: String(inscricoes.filter((i) => i.status !== 'desistiu').length) }),
          indicador({ rotulo: 'Confirmados', valor: String(inscricoes.filter((i) => i.status === 'confirmado').length) }),
          indicador({ rotulo: 'Medalhas', valor: String(inscricoes.filter((i) => i.medalha && i.medalha !== 'participacao').length), tipo: 'destaque' }),
        ]),
        competicao.regulamento
          ? el('p', { classe: 'dica', texto: `Regulamento: ${competicao.regulamento}` })
          : null,
        tabela(
          ['Atleta', 'Equipe', 'Graduação', 'Categoria', 'Situação', 'Taxa', 'Resultado', 'Ações'],
          inscricoes.map((inscricao) => [
            inscricao.aluno,
            inscricao.equipe || '-',
            inscricao.graduacao
              ? celula([etiquetaCor(inscricao.graduacao, inscricao.graduacao_cor)])
              : '-',
            inscricao.categoria_peso || '-',
            celula([etiqueta(
              SITUACOES_INSCRICAO.find((s) => s.valor === inscricao.status)?.rotulo || inscricao.status,
              inscricao.status === 'confirmado' ? 'ok' : inscricao.status === 'desistiu' ? 'erro' : 'info',
            )]),
            celula([inscricao.taxa_paga ? etiqueta('paga', 'ok') : etiqueta('em aberto', 'alerta')]),
            celula([medalhaDe(inscricao)]),
            celula(podeGerir ? [
              botao('Inscrição', () => formularioInscricao(competicao, inscricao), 'botao pequeno secundario'),
              botao('Resultado', () => formularioResultado(competicao, inscricao), 'botao pequeno secundario'),
            ] : [], 'acoes-celula'),
          ]),
          'Nenhum atleta inscrito ainda.',
        ),
        podeGerir
          ? el('div', { classe: 'acoes', estilo: 'margin-top:.9rem' }, [
            botao('+ Inscrever atleta', () => formularioInscricao(competicao)),
          ])
          : null,
      );
    }

    async function recarregarDetalhe() {
      const novo = await api.obter(`/competicoes/${competicao.id}`);
      competicao.inscricoes = novo.inscricoes;
      desenhar();
      await carregar();
    }

    function formularioInscricao(comp, inscricao = null) {
      const pesos = categoriasPeso[comp.modalidade] || [];
      abrirFormulario({
        titulo: inscricao ? `Inscrição de ${inscricao.aluno}` : `Inscrever atleta em ${comp.nome}`,
        aviso: pesos.length ? `Categorias de ${comp.modalidade}: ${pesos.join(', ')}.` : null,
        campos: [
          inscricao ? null : { nome: 'aluno_id', rotulo: 'Atleta', tipo: 'select', obrigatorio: true,
            opcoes: opcoesDe(alunos) },
          { nome: 'equipe_id', rotulo: 'Equipe', tipo: 'select',
            opcoes: [{ valor: '', rotulo: 'Sem equipe' }, ...opcoesDe(equipes)] },
          { nome: 'categoria_peso', rotulo: 'Categoria de peso', tipo: 'select',
            opcoes: [{ valor: '', rotulo: 'A definir' }, ...pesos.map((p) => ({ valor: p, rotulo: p }))] },
          { nome: 'peso', rotulo: 'Peso do atleta (kg)', tipo: 'number', passo: '0.1' },
          { nome: 'categoria_idade', rotulo: 'Categoria de idade', placeholder: 'Juvenil, adulto, master 1...' },
          { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: SITUACOES_INSCRICAO },
          { nome: 'taxa_paga', rotulo: 'Taxa de inscrição paga', tipo: 'checkbox' },
          { nome: 'observacao', rotulo: 'Observação', tipo: 'textarea' },
        ].filter(Boolean),
        valores: inscricao || { status: 'inscrito' },
        aoSalvar: async (dados) => {
          if (inscricao) await api.atualizar(`/competicoes/${comp.id}/inscricoes/${inscricao.id}`, dados);
          else await api.criar(`/competicoes/${comp.id}/inscricoes`, dados);
          aviso('Inscrição salva.');
          await recarregarDetalhe();
        },
      });
    }

    function formularioResultado(comp, inscricao) {
      abrirFormulario({
        titulo: `Resultado de ${inscricao.aluno}`,
        aviso: 'Lançar o resultado confirma a presença do atleta na competição.',
        campos: [
          { nome: 'colocacao', rotulo: 'Colocação', tipo: 'number', min: 1, placeholder: '1, 2, 3...' },
          { nome: 'medalha', rotulo: 'Medalha', tipo: 'select', opcoes: MEDALHAS },
          { nome: 'lutas', rotulo: 'Lutas disputadas', tipo: 'number', min: 0 },
          { nome: 'vitorias', rotulo: 'Vitórias', tipo: 'number', min: 0 },
          { nome: 'finalizacoes', rotulo: 'Finalizações / nocautes', tipo: 'number', min: 0 },
          { nome: 'observacao', rotulo: 'Como foi a campanha', tipo: 'textarea' },
        ],
        valores: {
          colocacao: inscricao.colocacao ?? '',
          medalha: inscricao.medalha ?? '',
          lutas: inscricao.lutas ?? 0,
          vitorias: inscricao.vitorias ?? 0,
          finalizacoes: inscricao.finalizacoes ?? 0,
          observacao: inscricao.resultado_observacao ?? '',
        },
        aoSalvar: async (dados) => {
          await api.atualizar(`/competicoes/${comp.id}/resultados/${inscricao.id}`, dados);
          aviso('Resultado registrado.');
          agenda.quadro_medalhas = (await api.obter('/competicoes/agenda')).quadro_medalhas;
          await recarregarDetalhe();
        },
      });
    }

    desenhar();
    abrirModal({ titulo: competicao.nome, conteudo: corpo, largura: '900px' });
  }

  function medalhaDe(inscricao) {
    if (!inscricao.medalha) return el('span', { classe: 'dica', texto: '-' });
    return el('span', { classe: 'etiqueta neutra' }, [
      el('span', { classe: 'ponto', estilo: `background:${COR_MEDALHA[inscricao.medalha]}` }),
      `${inscricao.medalha}${inscricao.colocacao ? ` · ${inscricao.colocacao}º` : ''}`,
    ]);
  }

  /* -------------------------------------------------- cadastro */

  function formulario(item = null) {
    abrirFormulario({
      titulo: item ? `Editar ${item.nome}` : 'Nova competição',
      aviso: 'Tudo que você marcar para publicar no site aparece na página pública da academia.',
      campos: [
        { nome: 'nome', rotulo: 'Nome da competição', obrigatorio: true,
          placeholder: 'Copa Rio de Jiu-Jitsu' },
        { nome: 'modalidade_id', rotulo: 'Modalidade', tipo: 'select',
          opcoes: [{ valor: '', rotulo: 'Todas as modalidades' }, ...opcoesDe(modalidades)] },
        { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: TIPOS },
        { nome: 'nivel', rotulo: 'Nível', tipo: 'select', opcoes: NIVEIS },
        { nome: 'organizador', rotulo: 'Quem organiza', placeholder: 'Federação, liga ou a própria Atak' },
        { nome: 'data_inicio', rotulo: 'Data de início', tipo: 'date', obrigatorio: true },
        { nome: 'data_fim', rotulo: 'Data de encerramento', tipo: 'date' },
        { nome: 'inscricao_ate', rotulo: 'Inscrições até', tipo: 'date' },
        { nome: 'local', rotulo: 'Local / ginásio' },
        { nome: 'cidade', rotulo: 'Cidade' },
        { nome: 'endereco', rotulo: 'Endereço completo' },
        { nome: 'taxa', rotulo: 'Taxa de inscrição (R$)', tipo: 'number', passo: '0.01' },
        { nome: 'vagas', rotulo: 'Limite de atletas (0 = sem limite)', tipo: 'number', min: 0 },
        { nome: 'responsavel_id', rotulo: 'Responsável pela competição', tipo: 'select',
          opcoes: [{ valor: '', rotulo: 'Eu mesmo' }, ...opcoesDe(mestres)] },
        { nome: 'status', rotulo: 'Situação', tipo: 'select', opcoes: SITUACOES },
        { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea' },
        { nome: 'regulamento', rotulo: 'Regras e observações', tipo: 'textarea' },
        { nome: 'link', rotulo: 'Link da inscrição oficial' },
        { nome: 'publicar_site', rotulo: 'Mostrar na página pública', tipo: 'checkbox', valor: 1 },
      ],
      valores: item || { tipo: 'campeonato', nivel: 'estadual', status: 'agendada', publicar_site: 1, taxa: 0 },
      aoSalvar: async (dados) => {
        if (item) await api.atualizar(`/competicoes/${item.id}`, dados);
        else await api.criar('/competicoes', dados);
        aviso('Competição salva.');
        agenda.proximas = (await api.obter('/competicoes/agenda')).proximas;
        await carregar();
      },
    });
  }

  /* ------------------------------------------- quadro de medalhas */

  function quadroDeMedalhas() {
    const quadro = agenda.quadro_medalhas || { por_modalidade: [], atletas: [] };
    if (!quadro.atletas.length) return vazio('Assim que você lançar o resultado de um campeonato, o quadro aparece aqui.');

    return el('div', { classe: 'grade col-2' }, [
      cartao('Medalhas por modalidade', tabela(
        ['Modalidade', 'Ouro', 'Prata', 'Bronze', 'Participações'],
        quadro.por_modalidade.map((linha) => [
          celula([etiquetaCor(linha.modalidade || 'Geral', linha.cor)]),
          String(linha.ouro), String(linha.prata), String(linha.bronze), String(linha.participacoes),
        ]),
        'Nenhum resultado lançado.',
      )),
      cartao('Atletas que subiram no pódio', tabela(
        ['Atleta', 'Ouro', 'Prata', 'Bronze', 'Aproveitamento'],
        quadro.atletas.map((atleta) => [
          atleta.nome,
          String(atleta.ouro), String(atleta.prata), String(atleta.bronze),
          atleta.lutas ? `${Math.round((atleta.vitorias / atleta.lutas) * 100)}% (${atleta.vitorias}/${atleta.lutas})` : '-',
        ]),
        'Nenhum atleta com resultado.',
      )),
    ]);
  }

  await carregar();

  return el('div', {}, [
    topo('Competições',
      'Calendário de campeonatos, seletivas e torneios internos, com inscrição dos atletas e quadro de medalhas',
      podeGerir ? [botao('+ Nova competição', () => formulario())] : []),

    el('p', { classe: 'explicacao' }, [
      icone('trofeu', 16),
      ehAluno
        ? 'Aqui ficam todos os campeonatos que a Atak vai disputar. Clique em "Quero competir" e o responsável de competições fala com você para acertar categoria e peso.'
        : 'Cada competição guarda a lista de atletas, a categoria de peso, a taxa paga e o resultado. O que você marcar como público aparece no site da academia.',
    ]),

    areaIndicadores,

    el('div', { classe: 'filtros' }, [
      seletor('Modalidade', [{ valor: '', rotulo: 'Todas' }, ...opcoesDe(modalidades)],
        (valor) => { filtro.modalidade_id = valor; carregar(); }),
      seletor('Período', [
        { valor: 'futuras', rotulo: 'Próximas' },
        { valor: 'passadas', rotulo: 'Já realizadas' },
        { valor: '', rotulo: 'Todas' },
      ], (valor) => { filtro.periodo = valor; carregar(); }, 'futuras'),
      seletor('Situação', [{ valor: '', rotulo: 'Todas' }, ...SITUACOES],
        (valor) => { filtro.status = valor; carregar(); }),
    ]),

    area,
    cartao('Quadro de medalhas da Atak', quadroDeMedalhas()),
  ]);
}

function seletor(rotulo, opcoes, aoMudar, valorInicial = '') {
  return el('div', { classe: 'campo' }, [
    el('label', { texto: rotulo }),
    el('select', { aoMudar: (evento) => aoMudar(evento.target.value) },
      opcoes.map((opcao) => el('option', {
        value: opcao.valor, texto: opcao.rotulo, selected: String(opcao.valor) === String(valorInicial),
      }))),
  ]);
}
