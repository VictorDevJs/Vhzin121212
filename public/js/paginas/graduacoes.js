import { api, sessao } from '../api.js';
import {
  el, cartao, botao, etiqueta, indicador, abrirFormulario, aviso, confirmar, vazio,
} from '../ui.js';
import { icone } from '../icones.js';
import { topo } from '../app.js';

const ETARIAS = [
  { valor: 'ambos', rotulo: 'Kids e adulto' },
  { valor: 'kids', rotulo: 'Somente kids' },
  { valor: 'adulto', rotulo: 'Somente adulto' },
];

const COR_ETARIA = { kids: 'info', adulto: 'neutra', ambos: 'ok' };

/**
 * Escala de graduações de cada arte marcial: as faixas do Jiu-Jitsu, o prajied
 * do Muay Thai, os kyus do Karatê, as cordas da Capoeira e os níveis técnicos
 * do Boxe e do MMA. O dono e os mestres editam degrau por degrau.
 */
export default async function paginaGraduacoes() {
  const podeEditar = sessao.ehUm('dono', 'mestre')
    || (sessao.usuario?.cargos || []).some((c) => c.cargo === 'graduacao');

  const modalidades = (await api.obter('/modalidades')).filter((m) => m.ativo);
  const catalogo = await api.obter('/modalidades/catalogo-graduacoes').catch(() => []);

  let selecionada = modalidades[0] || null;
  const abas = el('nav', { classe: 'abas-modalidade', 'aria-label': 'Escolher arte marcial' });
  const area = el('div');

  function desenharAbas() {
    abas.replaceChildren(...modalidades.map((modalidade) => el('button', {
      classe: `aba-modalidade ${selecionada?.id === modalidade.id ? 'ativa' : ''}`,
      type: 'button',
      estilo: `--cor-aba:${modalidade.cor}`,
      'aria-pressed': selecionada?.id === modalidade.id ? 'true' : 'false',
      aoClicar: () => { selecionada = modalidade; desenharAbas(); carregar(); },
    }, [
      el('span', { classe: 'ponto-aba' }),
      modalidade.nome,
      el('span', { classe: 'contador-aba', texto: String(modalidade.total_graduacoes) }),
    ])));
  }

  async function carregar() {
    if (!selecionada) {
      area.replaceChildren(vazio('Cadastre uma modalidade para montar a escala de faixas.'));
      return;
    }
    const escala = await api.obter(`/modalidades/${selecionada.id}/graduacoes`);
    const referencia = catalogo.find((c) => c.modalidade === selecionada.nome);

    area.replaceChildren(
      el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, [
        indicador({ rotulo: 'Degraus na escala', valor: String(escala.length),
          detalhe: referencia ? referencia.federacao : 'Escala própria da academia', tipo: 'destaque' }),
        indicador({ rotulo: 'Faixas infantis', valor: String(escala.filter((g) => g.faixa_etaria !== 'adulto').length),
          detalhe: 'Disponíveis para a turma kids' }),
        indicador({ rotulo: 'Alunos graduados', valor: String(escala.reduce((s, g) => s + g.alunos, 0)),
          detalhe: 'Com graduação registrada nesta arte' }),
        indicador({ rotulo: 'Graus possíveis', valor: String(escala.reduce((s, g) => s + g.graus, 0)),
          detalhe: 'Somando as pontas de todas as faixas' }),
      ]),

      referencia
        ? el('p', { classe: 'explicacao' }, [icone('livro', 16), referencia.resumo || referencia.federacao])
        : null,

      escala.length
        ? el('ol', { classe: 'escala' }, escala.map((grau, indice) => degrau(grau, indice)))
        : vazio('Esta modalidade ainda não tem escala de graduação.'),

      podeEditar
        ? el('div', { classe: 'acoes', estilo: 'margin-top:1rem' }, [
          botao('+ Nova graduação', () => formulario()),
          referencia ? botao('Trazer a escala oficial completa', aplicarPadrao, 'botao secundario') : null,
        ].filter(Boolean))
        : null,
    );
  }

  /** Cada degrau é desenhado como a própria faixa, com a ponta e os graus. */
  function degrau(grau, indice) {
    return el('li', { classe: 'degrau' }, [
      el('span', { classe: 'ordem-degrau', texto: String(indice + 1) }),

      el('span', {
        classe: 'faixa-visual',
        estilo: `--cor-faixa:${grau.cor || '#888'};--cor-ponta:${grau.cor_ponta || grau.cor || '#888'}`,
        'aria-hidden': 'true',
      }, [
        el('span', { classe: 'ponta-faixa' }),
        ...Array.from({ length: Math.min(grau.graus, 6) }, () => el('span', { classe: 'grau-faixa' })),
      ]),

      el('div', { classe: 'dados-degrau' }, [
        el('strong', { texto: grau.nome }),
        grau.descricao ? el('span', { classe: 'dica', texto: grau.descricao }) : null,
        el('div', { classe: 'acoes' }, [
          etiqueta(ETARIAS.find((e) => e.valor === grau.faixa_etaria)?.rotulo || grau.faixa_etaria,
            COR_ETARIA[grau.faixa_etaria] || 'neutra'),
          grau.graus ? etiqueta(`até ${grau.graus} grau(s)`, 'neutra') : null,
          grau.idade_minima ? etiqueta(`a partir de ${grau.idade_minima} anos`, 'neutra') : null,
          grau.tempo_minimo ? etiqueta(`${grau.tempo_minimo} meses de permanência`, 'neutra') : null,
          grau.alunos ? etiqueta(`${grau.alunos} aluno(s)`, 'ok') : null,
        ].filter(Boolean)),
      ]),

      podeEditar
        ? el('div', { classe: 'acoes-degrau' }, [
          botao('Editar', () => formulario(grau), 'botao pequeno secundario'),
          botao('Excluir', async () => {
            if (!confirmar(`Excluir a graduação "${grau.nome}"?`)) return;
            try {
              await api.remover(`/modalidades/${selecionada.id}/graduacoes/${grau.id}`);
              aviso('Graduação removida.');
              await carregar();
            } catch (erro) {
              aviso(erro.message, 'erro');
            }
          }, 'botao pequeno perigo'),
        ])
        : null,
    ]);
  }

  async function aplicarPadrao() {
    try {
      const resposta = await api.criar(`/modalidades/${selecionada.id}/graduacoes/padrao`, {});
      aviso(resposta.mensagem);
      await carregar();
    } catch (erro) {
      aviso(erro.message, 'erro');
    }
  }

  function formulario(grau = null) {
    abrirFormulario({
      titulo: grau ? `Editar ${grau.nome}` : `Nova graduação de ${selecionada.nome}`,
      aviso: 'A ordem define a sequência da escala: 1 é a primeira faixa, o número maior é a mais alta.',
      campos: [
        { nome: 'nome', rotulo: 'Nome da faixa, corda ou nível', obrigatorio: true,
          placeholder: 'Azul, Corda Verde, Amarela e Preta...' },
        { nome: 'ordem', rotulo: 'Posição na escala', tipo: 'number', min: 1 },
        { nome: 'cor', rotulo: 'Cor principal', tipo: 'color', valor: grau?.cor || '#888888' },
        { nome: 'cor_ponta', rotulo: 'Cor da ponta (deixe igual se a faixa for de uma cor só)', tipo: 'color',
          valor: grau?.cor_ponta || grau?.cor || '#888888' },
        { nome: 'graus', rotulo: 'Quantos graus cabem nesta faixa', tipo: 'number', min: 0, max: 10 },
        { nome: 'faixa_etaria', rotulo: 'Para qual público', tipo: 'select', opcoes: ETARIAS },
        { nome: 'idade_minima', rotulo: 'Idade mínima', tipo: 'number', min: 3, max: 90 },
        { nome: 'tempo_minimo', rotulo: 'Tempo mínimo de permanência (meses)', tipo: 'number', min: 0 },
        { nome: 'descricao', rotulo: 'O que se espera do aluno nesta faixa', tipo: 'textarea' },
      ],
      valores: grau || { faixa_etaria: 'ambos', graus: 0, tempo_minimo: 0 },
      aoSalvar: async (dados) => {
        if (grau) await api.atualizar(`/modalidades/${selecionada.id}/graduacoes/${grau.id}`, dados);
        else await api.criar(`/modalidades/${selecionada.id}/graduacoes`, dados);
        aviso('Escala de graduação atualizada.');
        await carregar();
      },
    });
  }

  desenharAbas();
  await carregar();

  return el('div', {}, [
    topo('Graduações', 'A escala completa de faixas, cordas e níveis de cada arte marcial da Atak'),

    el('p', { classe: 'explicacao' }, [
      icone('faixa', 16),
      'Cada arte marcial tem a sua escala própria: as faixas infantis e adultas do Jiu-Jitsu, o prajied do Muay Thai, '
      + 'os kyus e dans do Karatê, as cordas da Capoeira e os níveis técnicos do Boxe. '
      + 'Você pode editar cada degrau ou trazer a escala oficial da federação com um clique.',
    ]),

    abas,
    area,
  ]);
}
