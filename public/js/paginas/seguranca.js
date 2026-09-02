import { api } from '../api.js';
import {
  el, cartao, tabela, celula, indicador, etiqueta, dataHoraBr, vazio,
} from '../ui.js';
import { barrasHorizontais } from '../graficos.js';
import { icone } from '../icones.js';
import { topo, traduzirPapel } from '../app.js';

const ROTULO_AREA = {
  acesso: 'Entradas no sistema',
  equipe: 'Equipe e acessos',
  seguranca: 'Segurança e cargos',
  competicoes: 'Competições',
  equipes: 'Equipes de competição',
  modalidades: 'Modalidades',
  graduacoes: 'Graduações',
};

const ROTULO_CARGO = {
  competicoes: 'Competições', graduacao: 'Graduação', financeiro: 'Financeiro',
  kids: 'Kids', loja: 'Loja', marketing: 'Comunicação',
};

/**
 * Segurança e registro de atividades: quem entrou, quem mexeu no quê e
 * quais acessos estão abertos. Só o dono da academia enxerga esta tela.
 */
export default async function paginaSeguranca() {
  const filtro = { area: '' };
  const [resumo, inicial] = await Promise.all([
    api.obter('/auditoria/resumo'),
    api.obter('/auditoria?limite=120'),
  ]);

  const areaHistorico = el('div');
  let registros = inicial;

  function desenharHistorico() {
    areaHistorico.replaceChildren(registros.length
      ? tabela(
        ['Quando', 'Quem', 'Função', 'O que fez', 'Onde', 'Detalhe'],
        registros.map((linha) => [
          dataHoraBr(linha.criado_em),
          linha.usuario_nome || 'sistema',
          celula([etiqueta(traduzirPapel(linha.papel), linha.papel === 'dono' ? 'alerta' : 'neutra')]),
          `${linha.acao}${linha.alvo ? ` ${linha.alvo}` : ''}`,
          ROTULO_AREA[linha.area] || linha.area,
          linha.detalhe || '-',
        ]),
      )
      : vazio('Nenhuma atividade registrada neste filtro.'));
  }

  async function recarregar() {
    registros = await api.obter(`/auditoria?limite=120${filtro.area ? `&area=${filtro.area}` : ''}`);
    desenharHistorico();
  }

  desenharHistorico();

  return el('div', {}, [
    topo('Segurança e atividades',
      'Quem entra, quem altera e quais acessos estão liberados no sistema da academia'),

    el('p', { classe: 'explicacao' }, [
      icone('cadeado', 16),
      'Toda ação importante fica registrada com nome, função, data e hora. Se algo for alterado por engano, '
      + 'você descobre aqui quem fez e quando.',
    ]),

    el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, [
      indicador({ rotulo: 'Equipe com acesso', valor: String(resumo.contas.equipe_ativa),
        detalhe: 'Contas ativas de mestres e recepção', tipo: 'destaque' }),
      indicador({ rotulo: 'Alunos com login', valor: String(resumo.contas.alunos_com_acesso),
        detalhe: 'Podem fazer check-in pelo aplicativo' }),
      indicador({ rotulo: 'Acessos bloqueados', valor: String(resumo.contas.bloqueados),
        detalhe: 'Contas desativadas',
        tipo: resumo.contas.bloqueados > 0 ? 'atencao' : 'bom' }),
      indicador({ rotulo: 'Ações nos 7 dias', valor: String(resumo.contas.acoes_semana),
        detalhe: 'Movimentação registrada na semana' }),
    ]),

    el('div', { classe: 'grade col-2' }, [
      cartao('Atividade por área', barrasHorizontais({
        dados: resumo.por_area.map((linha) => ({
          rotulo: ROTULO_AREA[linha.area] || linha.area, valor: linha.total,
        })),
        formatar: (v) => `${v} ação${v === 1 ? '' : 'ões'}`,
      })),
      cartao('Quem mais movimentou o sistema', tabela(
        ['Pessoa', 'Função', 'Ações (30 dias)', 'Última vez'],
        resumo.por_pessoa.map((linha) => [
          linha.usuario_nome || 'sistema',
          celula([etiqueta(traduzirPapel(linha.papel), 'neutra')]),
          String(linha.total),
          dataHoraBr(linha.ultima),
        ]),
        'Nada registrado nos últimos 30 dias.',
      )),
    ]),

    cartao('Acessos abertos no sistema', tabela(
      ['Nome', 'E-mail', 'Função', 'Cargos', 'Situação', 'Último acesso'],
      resumo.acessos.map((acesso) => [
        acesso.nome,
        acesso.email,
        celula([etiqueta(traduzirPapel(acesso.papel), acesso.papel === 'dono' ? 'alerta' : 'info')]),
        celula(acesso.cargos.length
          ? acesso.cargos.map((c) => etiqueta(
            `${ROTULO_CARGO[c.cargo] || c.cargo}${c.modalidade ? ` · ${c.modalidade}` : ''}`, 'ok'))
          : [el('span', { classe: 'dica', texto: '-' })]),
        celula([acesso.ativo ? etiqueta('ativo', 'ok') : etiqueta('bloqueado', 'erro')]),
        acesso.ultimo_acesso ? dataHoraBr(acesso.ultimo_acesso) : 'nunca entrou',
      ]),
    )),

    cartao('Registro de atividades', el('div', {}, [
      el('div', { classe: 'filtros' }, [
        el('div', { classe: 'campo' }, [
          el('label', { texto: 'Área' }),
          el('select', { aoMudar: (evento) => { filtro.area = evento.target.value; recarregar(); } }, [
            el('option', { value: '', texto: 'Todas as áreas' }),
            ...Object.entries(ROTULO_AREA).map(([valor, rotulo]) => el('option', { value: valor, texto: rotulo })),
          ]),
        ]),
      ]),
      areaHistorico,
    ])),
  ]);
}
