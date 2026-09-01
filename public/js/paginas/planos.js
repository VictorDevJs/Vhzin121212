import { api, sessao } from '../api.js';
import { el, cartao, botao, etiqueta, moeda, abrirFormulario, aviso, confirmar, vazio } from '../ui.js';
import { topo } from '../app.js';

const PERIODICIDADES = [
  { valor: 'mensal', rotulo: 'Mensal' },
  { valor: 'trimestral', rotulo: 'Trimestral' },
  { valor: 'semestral', rotulo: 'Semestral' },
  { valor: 'anual', rotulo: 'Anual' },
];

/** Planos vendidos pela academia. */
export default async function paginaPlanos() {
  const ehDono = sessao.papel === 'dono';
  const modalidades = await api.obter('/modalidades');
  const area = el('div');

  async function carregar() {
    const planos = await api.obter('/planos');
    area.replaceChildren(planos.length
      ? el('div', { classe: 'grade col-3' }, planos.map((plano) => el('article', { classe: 'cartao-plano' }, [
        el('h3', {}, [plano.nome, ' ', plano.ativo ? null : etiqueta('inativo', 'neutra')]),
        el('div', { classe: 'preco' }, [moeda(plano.valor), el('small', { texto: ` / ${plano.periodicidade}` })]),
        el('p', { classe: 'dica', texto: plano.descricao || 'Sem descricao.' }),
        el('div', { classe: 'acoes', estilo: 'margin-bottom:.6rem' }, [
          etiqueta(plano.aulas_semana ? `${plano.aulas_semana}x por semana` : 'treinos livres', 'neutra'),
          etiqueta(`${plano.alunos_ativos} aluno(s)`, 'info'),
        ]),
        el('div', { classe: 'acoes', estilo: 'margin-bottom:.6rem' }, plano.livre
          ? [etiqueta('todas as modalidades', 'ok')]
          : plano.modalidades.map((m) => etiqueta(m.nome, 'info'))),
        ehDono
          ? el('div', { classe: 'acoes' }, [
            botao('Editar', () => formulario(plano), 'botao pequeno secundario'),
            botao('Excluir', () => excluir(plano), 'botao pequeno perigo'),
          ])
          : null,
      ])))
      : vazio('Nenhum plano cadastrado. Crie os planos que a academia vende.'));
  }

  function formulario(plano = null) {
    abrirFormulario({
      titulo: plano ? `Editar ${plano.nome}` : 'Novo plano',
      campos: [
        { nome: 'nome', rotulo: 'Nome do plano', obrigatorio: true, placeholder: 'Passe Livre, Kids Mensal...' },
        { nome: 'descricao', rotulo: 'Descricao', tipo: 'textarea' },
        { nome: 'valor', rotulo: 'Valor (R$)', tipo: 'number', passo: '0.01', obrigatorio: true },
        { nome: 'periodicidade', rotulo: 'Cobranca', tipo: 'select', opcoes: PERIODICIDADES },
        { nome: 'aulas_semana', rotulo: 'Aulas por semana', tipo: 'number', min: 0, valor: 0,
          dica: '0 = treinos livres, sem limite.' },
        { nome: 'modalidades', rotulo: 'Modalidades incluidas', tipo: 'multi',
          opcoes: modalidades.map((m) => ({ valor: m.id, rotulo: m.nome })),
          dica: 'Sem nenhuma marcada, o plano vale para todas as modalidades.' },
        { nome: 'ativo', rotulo: 'Plano disponivel para venda', tipo: 'checkbox', valor: 1 },
      ],
      valores: plano
        ? { ...plano, modalidades: plano.modalidades.map((m) => m.id) }
        : { periodicidade: 'mensal' },
      aoSalvar: async (dados) => {
        if (plano) await api.atualizar(`/planos/${plano.id}`, dados);
        else await api.criar('/planos', dados);
        aviso('Plano salvo.');
        await carregar();
      },
    });
  }

  async function excluir(plano) {
    if (!confirmar(`Excluir o plano ${plano.nome}?`)) return;
    try {
      await api.remover(`/planos/${plano.id}`);
      aviso('Plano removido.');
      await carregar();
    } catch (erro) {
      aviso(erro.message, 'erro');
    }
  }

  await carregar();

  return el('div', {}, [
    topo('Planos', 'Valores, periodicidade e modalidades de cada plano',
      ehDono ? [botao('+ Novo plano', () => formulario())] : []),
    cartao(null, area),
  ]);
}
