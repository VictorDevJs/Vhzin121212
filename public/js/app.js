import { api, sessao } from './api.js';
import { el, limpar, aviso, abrirFormulario } from './ui.js';

import paginaPublica from './paginas/publico.js';
import paginaPainel from './paginas/painel.js';
import paginaAlunos from './paginas/alunos.js';
import paginaTurmas from './paginas/turmas.js';
import paginaGrade from './paginas/grade.js';
import paginaPlanos from './paginas/planos.js';
import paginaFinanceiro from './paginas/financeiro.js';
import paginaAvisos from './paginas/avisos.js';
import paginaChamada from './paginas/chamada.js';
import paginaEquipe from './paginas/equipe.js';
import paginaMinhaArea from './paginas/minha-area.js';

const EQUIPE = ['dono', 'mestre', 'recepcao'];

/** Cada rota declara quem pode acessar e como aparece no menu. */
const ROTAS = [
  { caminho: 'painel', titulo: 'Painel', icone: '📊', papeis: [...EQUIPE, 'aluno'], render: paginaPainel },
  { caminho: 'minha-area', titulo: 'Minha area', icone: '🥋', papeis: ['aluno'], render: paginaMinhaArea },
  { caminho: 'grade', titulo: 'Horarios', icone: '🗓️', papeis: [...EQUIPE, 'aluno'], render: paginaGrade },
  { caminho: 'avisos', titulo: 'Avisos', icone: '📢', papeis: [...EQUIPE, 'aluno'], render: paginaAvisos },
  { caminho: 'alunos', titulo: 'Alunos', icone: '👥', papeis: EQUIPE, render: paginaAlunos },
  { caminho: 'chamada', titulo: 'Chamada', icone: '✅', papeis: EQUIPE, render: paginaChamada },
  { caminho: 'turmas', titulo: 'Turmas e modalidades', icone: '🥊', papeis: EQUIPE, render: paginaTurmas },
  { caminho: 'planos', titulo: 'Planos', icone: '💳', papeis: EQUIPE, render: paginaPlanos },
  { caminho: 'financeiro', titulo: 'Financeiro', icone: '💰', papeis: ['dono', 'recepcao'], render: paginaFinanceiro },
  { caminho: 'equipe', titulo: 'Equipe e academia', icone: '⚙️', papeis: ['dono'], render: paginaEquipe },
];

const raiz = document.getElementById('app');

function rotaAtual() {
  return (window.location.hash.replace(/^#\/?/, '').split('?')[0] || '').trim();
}

export function irPara(caminho) {
  window.location.hash = `#/${caminho}`;
}

function rotaInicial() {
  return sessao.papel === 'aluno' ? 'minha-area' : 'painel';
}

/** Monta a barra lateral com os itens permitidos para o papel do usuario. */
function barraLateral(caminhoAtivo) {
  const permitidas = ROTAS.filter((rota) => rota.papeis.includes(sessao.papel));
  const barra = el('nav', { classe: 'barra-lateral', id: 'barra-lateral' }, [
    el('div', { classe: 'marca' }, [
      el('span', { classe: 'logo', texto: '🥋' }),
      el('div', {}, [
        el('span', { texto: 'Academia de Lutas' }),
        el('small', { texto: 'Sistema de gestao' }),
      ]),
    ]),
    ...permitidas.map((rota) => el('button', {
      classe: `menu-item ${rota.caminho === caminhoAtivo ? 'ativo' : ''}`,
      aoClicar: () => { irPara(rota.caminho); document.getElementById('barra-lateral')?.classList.remove('aberta'); },
    }, [el('span', { classe: 'icone', texto: rota.icone }), rota.titulo])),
    el('div', { classe: 'rodape-lateral' }, [
      el('div', { classe: 'usuario-atual' }, [
        el('strong', { texto: sessao.usuario?.nome || '' }),
        traduzirPapel(sessao.papel),
      ]),
      el('button', { classe: 'menu-item', aoClicar: trocarSenha }, [el('span', { classe: 'icone', texto: '🔑' }), 'Trocar senha']),
      el('button', {
        classe: 'menu-item',
        aoClicar: () => { sessao.encerrar(); irPara('entrar'); },
      }, [el('span', { classe: 'icone', texto: '🚪' }), 'Sair']),
    ]),
  ]);
  return barra;
}

export function traduzirPapel(papel) {
  return { dono: 'Dono da academia', mestre: 'Mestre / professor', recepcao: 'Recepcao', aluno: 'Aluno' }[papel] || papel;
}

function trocarSenha() {
  abrirFormulario({
    titulo: 'Trocar senha',
    campos: [
      { nome: 'senha_atual', rotulo: 'Senha atual', tipo: 'password', obrigatorio: true },
      { nome: 'senha_nova', rotulo: 'Nova senha', tipo: 'password', obrigatorio: true, dica: 'Minimo de 6 caracteres.' },
    ],
    aoSalvar: async (dados) => {
      await api.atualizar('/auth/senha', dados);
      aviso('Senha atualizada com sucesso.');
    },
  });
}

/** Cabecalho padrao das telas internas. */
export function topo(titulo, subtitulo, acoes = []) {
  return el('header', { classe: 'topo' }, [
    el('div', {}, [
      el('div', { estilo: 'display:flex;align-items:center;gap:.6rem' }, [
        el('button', {
          classe: 'botao secundario pequeno abrir-menu',
          texto: '☰',
          aoClicar: () => document.getElementById('barra-lateral')?.classList.toggle('aberta'),
        }),
        el('h1', { texto: titulo, estilo: 'margin:0' }),
      ]),
      subtitulo ? el('p', { classe: 'subtitulo', texto: subtitulo }) : null,
    ]),
    el('div', { classe: 'acoes' }, acoes),
  ]);
}

async function desenhar() {
  const caminho = rotaAtual();

  // Visitante: apenas a vitrine da academia com login e cadastro.
  if (!sessao.usuario) {
    limpar(raiz).append(await paginaPublica());
    return;
  }

  if (!caminho || caminho === 'entrar') return irPara(rotaInicial());

  const rota = ROTAS.find((r) => r.caminho === caminho);
  if (!rota) return irPara(rotaInicial());
  if (!rota.papeis.includes(sessao.papel)) {
    aviso('Voce nao tem acesso a essa area.', 'erro');
    return irPara(rotaInicial());
  }

  const conteudo = el('main', { classe: 'conteudo' }, [el('div', { classe: 'carregando', texto: 'Carregando...' })]);
  limpar(raiz).append(el('div', { classe: 'app' }, [barraLateral(caminho), conteudo]));

  try {
    limpar(conteudo).append(await rota.render());
  } catch (erro) {
    limpar(conteudo).append(
      topo(rota.titulo, ''),
      el('div', { classe: 'mensagem-erro', texto: erro.message }),
    );
  }
}

export async function iniciar() {
  if (sessao.token) {
    try {
      const { usuario } = await api.obter('/auth/eu');
      sessao.usuario = usuario;
    } catch {
      sessao.encerrar();
    }
  }
  await desenhar();
}

window.addEventListener('hashchange', desenhar);
export { desenhar as recarregarTela };

iniciar();
