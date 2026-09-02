import { api, sessao } from './api.js';
import { el, limpar, aviso, abrirFormulario, esqueleto } from './ui.js';
import { aplicarMarca, marca, logotipo, iniciais } from './marca.js';
import { icone } from './icones.js';
import { alternarTema, ehEscuro } from './tema.js';

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
import paginaAvaliacoes from './paginas/avaliacoes.js';
import paginaCertificados from './paginas/certificados.js';
import paginaCheckin from './paginas/checkin.js';
import paginaLoja from './paginas/loja.js';

const EQUIPE = ['dono', 'mestre', 'recepcao'];

/** Cada rota diz quem entra, em que grupo do menu aparece e o que desenha. */
const ROTAS = [
  { caminho: 'painel', titulo: 'Painel', curto: 'Painel', icone: 'painel', grupo: 'Visão geral', papeis: [...EQUIPE, 'aluno'], render: paginaPainel, principal: true },
  { caminho: 'minha-area', titulo: 'Minha área', curto: 'Meu treino', icone: 'aluno', grupo: 'Visão geral', papeis: ['aluno'], render: paginaMinhaArea, principal: true },
  { caminho: 'checkin', titulo: 'Check-in', curto: 'Check-in', icone: 'raio', grupo: 'Rotina', papeis: [...EQUIPE, 'aluno'], render: paginaCheckin, principal: true },
  { caminho: 'grade', titulo: 'Horários', curto: 'Horários', icone: 'calendario', grupo: 'Rotina', papeis: [...EQUIPE, 'aluno'], render: paginaGrade, principal: true },
  { caminho: 'chamada', titulo: 'Chamada', curto: 'Chamada', icone: 'chamada', grupo: 'Rotina', papeis: EQUIPE, render: paginaChamada, principal: true },
  { caminho: 'avisos', titulo: 'Avisos', curto: 'Avisos', icone: 'megafone', grupo: 'Rotina', papeis: [...EQUIPE, 'aluno'], render: paginaAvisos, principal: true },
  { caminho: 'alunos', titulo: 'Alunos', curto: 'Alunos', icone: 'alunos', grupo: 'Gestão', papeis: EQUIPE, render: paginaAlunos, principal: true },
  { caminho: 'turmas', titulo: 'Turmas e modalidades', curto: 'Turmas', icone: 'luva', grupo: 'Gestão', papeis: EQUIPE, render: paginaTurmas },
  { caminho: 'planos', titulo: 'Planos', curto: 'Planos', icone: 'cartao', grupo: 'Gestão', papeis: EQUIPE, render: paginaPlanos },
  { caminho: 'loja', titulo: 'Loja', curto: 'Loja', icone: 'sacola', grupo: 'Gestão', papeis: [...EQUIPE, 'aluno'], render: paginaLoja, principal: true },
  { caminho: 'avaliacoes', titulo: 'Avaliações', curto: 'Avaliar', icone: 'estrela', grupo: 'Rotina', papeis: [...EQUIPE, 'aluno'], render: paginaAvaliacoes },
  { caminho: 'certificados', titulo: 'Certificados', curto: 'Faixas', icone: 'medalha', grupo: 'Gestão', papeis: [...EQUIPE, 'aluno'], render: paginaCertificados },
  { caminho: 'financeiro', titulo: 'Financeiro', curto: 'Caixa', icone: 'dinheiro', grupo: 'Financeiro', papeis: ['dono', 'recepcao'], render: paginaFinanceiro, principal: true },
  { caminho: 'equipe', titulo: 'Equipe e academia', curto: 'Equipe', icone: 'engrenagem', grupo: 'Sistema', papeis: ['dono'], render: paginaEquipe },
];

const raiz = document.getElementById('app');
let avisosNaoLidos = 0;

function rotaAtual() {
  return (window.location.hash.replace(/^#\/?/, '').split('?')[0] || '').trim();
}

export function irPara(caminho) {
  window.location.hash = `#/${caminho}`;
}

function rotaInicial() {
  return sessao.papel === 'aluno' ? 'minha-área' : 'painel';
}

function rotasPermitidas() {
  return ROTAS.filter((rota) => rota.papeis.includes(sessao.papel));
}

export function traduzirPapel(papel) {
  return { dono: 'Dono da academia', mestre: 'Mestre / professor', recepcao: 'Recepção', aluno: 'Aluno' }[papel] || papel;
}

/* ------------------------------------------------------------------ menu */

function barraLateral(caminhoAtivo) {
  const permitidas = rotasPermitidas();
  const grupos = [...new Set(permitidas.map((rota) => rota.grupo))];

  return el('nav', { classe: 'lateral', id: 'lateral', 'aria-label': 'Menu principal' }, [
    el('div', { classe: 'identidade' }, [logotipo(40)]),

    ...grupos.flatMap((grupo) => [
      el('div', { classe: 'grupo-menu', texto: grupo }),
      ...permitidas.filter((rota) => rota.grupo === grupo).map((rota) => el('button', {
        classe: `item-menu ${rota.caminho === caminhoAtivo ? 'ativo' : ''}`,
        'aria-current': rota.caminho === caminhoAtivo ? 'page' : null,
        aoClicar: () => { irPara(rota.caminho); fecharMenu(); },
      }, [
        el('span', { classe: 'icone' }, [icone(rota.icone)]),
        rota.titulo,
        rota.caminho === 'avisos' && avisosNaoLidos
          ? el('span', { classe: 'contador', texto: String(avisosNaoLidos) })
          : null,
      ])),
    ]),

    el('div', { classe: 'rodape-lateral' }, [
      el('div', { classe: 'cartao-usuario' }, [
        el('span', { classe: 'avatar', texto: iniciais(sessao.usuario?.nome) }),
        el('div', { classe: 'dados' }, [
          el('strong', { texto: sessao.usuario?.nome || '' }),
          el('span', { texto: traduzirPapel(sessao.papel) }),
        ]),
      ]),
      el('button', { classe: 'item-menu', aoClicar: trocarSenha }, [el('span', { classe: 'icone' }, [icone('chave')]), 'Trocar senha']),
      el('button', {
        classe: 'item-menu',
        aoClicar: () => { sessao.encerrar(); window.location.hash = ''; window.location.reload(); },
      }, [el('span', { classe: 'icone' }, [icone('sair')]), 'Sair']),
    ]),
  ]);
}

function navegacaoInferior(caminhoAtivo) {
  const principais = rotasPermitidas().filter((rota) => rota.principal).slice(0, 5);
  return el('nav', { classe: 'nav-inferior', 'aria-label': 'Navegacao rapida' }, principais.map((rota) => el('button', {
    classe: `item ${rota.caminho === caminhoAtivo ? 'ativo' : ''}`,
    aoClicar: () => irPara(rota.caminho),
  }, [
    el('span', { classe: 'icone' }, [icone(rota.icone, 20)]),
    el('span', { texto: rota.curto }),
  ])));
}

function barraSuperior() {
  return el('header', { classe: 'topo-app' }, [
    el('button', {
      classe: 'botao-icone menu-mobile', 'aria-label': 'Abrir menu',
      aoClicar: () => document.getElementById('lateral')?.classList.toggle('aberta'),
    }, [icone('menu', 20)]),
    el('button', {
      classe: 'busca-global', 'aria-label': 'Buscar e navegar', aoClicar: abrirPaleta,
    }, [
      icone('busca', 16),
      el('span', { texto: 'Buscar telas e ações' }),
      el('kbd', { texto: atalhoDoSistema() }),
    ]),
    el('div', { estilo: 'margin-left:auto;display:flex;gap:.5rem' }, [
      el('button', {
        classe: 'botao-icone', id: 'botao-tema',
        'aria-label': 'Alternar tema claro e escuro',
        aoClicar: (evento) => {
          alternarTema();
          evento.currentTarget.replaceChildren(icone(ehEscuro() ? 'sol' : 'lua', 18));
        },
      }, [icone(ehEscuro() ? 'sol' : 'lua', 18)]),
    ]),
  ]);
}

function fecharMenu() {
  document.getElementById('lateral')?.classList.remove('aberta');
}

function atalhoDoSistema() {
  return navigator.platform?.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl K';
}

/* ------------------------------------------------- paleta de comandos */

function comandosDisponiveis() {
  const comandos = rotasPermitidas().map((rota) => ({
    icone: rota.icone, titulo: rota.titulo, atalho: rota.grupo, acao: () => irPara(rota.caminho),
  }));
  comandos.push(
    { icone: 'lua', titulo: 'Alternar tema claro / escuro', atalho: 'Aparência', acao: () => { alternarTema(); desenhar(); } },
    { icone: 'chave', titulo: 'Trocar senha', atalho: 'Conta', acao: trocarSenha },
    { icone: 'sair', titulo: 'Sair do sistema', atalho: 'Conta', acao: () => { sessao.encerrar(); window.location.hash = ''; window.location.reload(); } },
  );
  return comandos;
}

export function abrirPaleta() {
  const todos = comandosDisponiveis();
  let filtrados = todos;
  let marcado = 0;

  const lista = el('div', { classe: 'lista' });
  const campo = el('input', {
    type: 'text', placeholder: 'Para onde você quer ir?', 'aria-label': 'Buscar comando',
    aoDigitar: (evento) => {
      const termo = evento.target.value.toLowerCase().trim();
      filtrados = todos.filter((c) => c.titulo.toLowerCase().includes(termo) || c.atalho.toLowerCase().includes(termo));
      marcado = 0;
      desenharLista();
    },
  });

  function desenharLista() {
    lista.replaceChildren(...(filtrados.length
      ? filtrados.map((comando, indice) => el('button', {
        classe: `opcao ${indice === marcado ? 'marcada' : ''}`, type: 'button',
        aoClicar: () => { fechar(); comando.acao(); },
      }, [
        icone(comando.icone, 17),
        el('span', { texto: comando.titulo }),
        el('small', { texto: comando.atalho }),
      ]))
      : [el('div', { classe: 'vazio', texto: 'Nada encontrado.' })]));
  }

  const fundo = el('div', { classe: 'fundo-modal paleta' }, [
    el('div', { classe: 'caixa' }, [campo, lista]),
  ]);

  function fechar() {
    fundo.remove();
    document.removeEventListener('keydown', aoTeclar, true);
  }
  function aoTeclar(evento) {
    if (evento.key === 'Escape') { evento.preventDefault(); fechar(); }
    if (evento.key === 'ArrowDown') { evento.preventDefault(); marcado = (marcado + 1) % Math.max(1, filtrados.length); desenharLista(); }
    if (evento.key === 'ArrowUp') { evento.preventDefault(); marcado = (marcado - 1 + filtrados.length) % Math.max(1, filtrados.length); desenharLista(); }
    if (evento.key === 'Enter' && filtrados[marcado]) { evento.preventDefault(); const acao = filtrados[marcado].acao; fechar(); acao(); }
  }

  fundo.addEventListener('click', (evento) => { if (evento.target === fundo) fechar(); });
  document.addEventListener('keydown', aoTeclar, true);
  document.body.append(fundo);
  desenharLista();
  campo.focus();
}

function trocarSenha() {
  abrirFormulario({
    titulo: 'Trocar senha',
    campos: [
      { nome: 'senha_atual', rotulo: 'Senha atual', tipo: 'password', obrigatorio: true },
      { nome: 'senha_nova', rotulo: 'Nova senha', tipo: 'password', obrigatorio: true, dica: 'Mínimo de 6 caracteres.' },
    ],
    aoSalvar: async (dados) => {
      await api.atualizar('/auth/senha', dados);
      aviso('Senha atualizada com sucesso.');
    },
  });
}

/* ------------------------------------------------------- cabecalho de tela */

export function topo(titulo, subtitulo, acoes = []) {
  return el('header', { classe: 'cabecalho-pagina' }, [
    el('div', {}, [
      el('h1', { texto: titulo }),
      subtitulo ? el('p', { classe: 'legenda', texto: subtitulo }) : null,
    ]),
    acoes.length ? el('div', { classe: 'acoes' }, acoes) : null,
  ]);
}

/* --------------------------------------------------------------- desenho */

async function desenhar() {
  const caminho = rotaAtual();

  if (!sessao.usuario) {
    const publica = await paginaPublica();
    limpar(raiz).append(publica);
    ligarProfundidade(publica);
    return;
  }

  if (!caminho || caminho === 'entrar') return irPara(rotaInicial());

  const rota = ROTAS.find((r) => r.caminho === caminho);
  if (!rota) return irPara(rotaInicial());
  if (!rota.papeis.includes(sessao.papel)) {
    aviso('Você não tem acesso a essa área.', 'erro');
    return irPara(rotaInicial());
  }

  const pagina = el('main', { classe: 'pagina' }, [
    topo(rota.titulo, ''),
    el('div', { classe: 'grade col-4', estilo: 'margin-bottom:1rem' }, [
      esqueleto(1, 92), esqueleto(1, 92), esqueleto(1, 92), esqueleto(1, 92),
    ]),
    esqueleto(3, 120),
  ]);

  limpar(raiz).append(el('div', { classe: 'app' }, [
    barraLateral(caminho),
    el('div', { classe: 'conteudo' }, [barraSuperior(), pagina]),
    navegacaoInferior(caminho),
  ]));

  try {
    const conteudo = await rota.render();
    trocarConteudo(pagina, conteudo);
  } catch (erro) {
    limpar(pagina).append(
      topo(rota.titulo, ''),
      el('div', { classe: 'mensagem-erro' }, [el('span', { texto: '⚠' }), erro.message]),
    );
  }
}

/**
 * Inclina levemente os cartões marcados com .tilt conforme o ponteiro,
 * dando profundidade sem exagero. Desligado em telas de toque e quando
 * a pessoa pediu menos movimento.
 */
function ligarProfundidade(raiz) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(hover: none)').matches) return;

  for (const alvo of raiz.querySelectorAll('.tilt')) {
    alvo.addEventListener('pointermove', (evento) => {
      const caixa = alvo.getBoundingClientRect();
      const x = (evento.clientX - caixa.left) / caixa.width - 0.5;
      const y = (evento.clientY - caixa.top) / caixa.height - 0.5;
      alvo.style.setProperty('--ry', `${x * 9}deg`);
      alvo.style.setProperty('--rx', `${-y * 9}deg`);
    });
    alvo.addEventListener('pointerleave', () => {
      alvo.style.setProperty('--ry', '0deg');
      alvo.style.setProperty('--rx', '0deg');
    });
  }
}

/** Usa a View Transitions API quando o navegador tem suporte. */
function trocarConteudo(container, conteudo) {
  const aplicar = () => {
    limpar(container).append(conteudo);
    ligarProfundidade(container);
  };
  if (document.startViewTransition) document.startViewTransition(aplicar);
  else aplicar();
}

async function carregarContadores() {
  if (!sessao.usuario) return;
  try {
    const avisos = await api.obter('/avisos?ativo=1');
    const marcoDeLeitura = Number(localStorage.getItem('atak.avisos.lidos') || 0);
    avisosNaoLidos = avisos.filter((item) => new Date(item.criado_em).getTime() > marcoDeLeitura).length;
  } catch {
    avisosNaoLidos = 0;
  }
}

export function marcarAvisosComoLidos() {
  localStorage.setItem('atak.avisos.lidos', String(Date.now()));
  avisosNaoLidos = 0;
  document.querySelectorAll('.item-menu .contador').forEach((no) => no.remove());
}

export async function iniciar() {
  try {
    const { academia } = await api.obter('/publico/academia');
    aplicarMarca(academia);
  } catch { /* a marca padrao continua valendo */ }

  if (sessao.token) {
    try {
      const { usuario } = await api.obter('/auth/eu');
      sessao.usuario = usuario;
      await carregarContadores();
    } catch {
      sessao.encerrar();
    }
  }
  await desenhar();
}

/* ------------------------------------------------------------ atalhos */

window.addEventListener('keydown', (evento) => {
  if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
    if (!sessao.usuario) return;
    evento.preventDefault();
    abrirPaleta();
  }
});

window.addEventListener('hashchange', desenhar);
export { desenhar as recarregarTela, marca };

// Aplicativo instalavel (PWA) com cache da casca da interface.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

iniciar();
