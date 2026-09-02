import { api, sessao } from '../api.js';
import {
  el, moeda, dataBr, DIAS_SEMANA, hojeISO, etiqueta, etiquetaCor, estrelas, entradaEstrelas, aviso,
} from '../ui.js';
import { linkWhatsapp } from '../whatsapp.js';
import { logotipo, simbolo, marca } from '../marca.js';
import { icone } from '../icones.js';
import { alternarTema, ehEscuro } from '../tema.js';
import { iniciar, irPara } from '../app.js';

const PERIODICIDADE = {
  mensal: 'por mês', trimestral: 'por trimestre', semestral: 'por semestre', anual: 'por ano',
};

const TIPO_AVISO = {
  geral: 'Aviso', campeonato: 'Campeonato', evento: 'Evento',
  cancelamento: 'Sem aula', manutencao: 'Manutenção', graduacao: 'Exame de faixa',
};

const CATEGORIA_PRODUTO = {
  kimono: 'Kimono', faixa: 'Faixa', rashguard: 'Rashguard', short: 'Short', luva: 'Luva',
  caneleira: 'Caneleira', protetor: 'Protetor', camisa: 'Camisa', casaco: 'Casaco',
  bermuda: 'Bermuda', mochila: 'Mochila', acessorio: 'Acessório',
};

/** Página pública do CT Atak: vitrine da academia e porta de entrada do sistema. */
export default async function paginaPublica() {
  const dados = await api.obter('/publico/academia');
  const {
    academia, modalidades, grade, planos, avisos, mestres, produtos, competicoes, equipes,
    medalhas, certificados, avaliacoes, resumo_avaliacoes: resumoAvaliacoes, numeros,
  } = dados;

  return el('div', { classe: 'site' }, [
    cabecalho(),
    el('div', { classe: 'envolucro' }, [
      heroi(academia, numeros),
      academia.historia ? secaoHistoria(academia) : null,
      secaoModalidades(modalidades),
      secaoHorarios(grade, modalidades),
      mestres.length ? secaoProfessores(mestres) : null,
      secaoGraduacoes(modalidades),
      competicoes.length ? secaoCompeticoes(competicoes, equipes, medalhas) : null,
      secaoPlanos(planos, academia),
      produtos.length ? secaoLoja(produtos) : null,
      certificados.length ? secaoCertificados(certificados) : null,
      secaoAvaliacoes(avaliacoes, resumoAvaliacoes, modalidades),
      avisos.length ? secaoAvisos(avisos) : null,
      rodape(academia),
    ]),
    botaoWhatsapp(academia),
  ]);
}

/* --------------------------------------------------------- cabeçalho */

function rolarAte(id) {
  return (evento) => {
    evento.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

function cabecalho() {
  return el('header', { classe: 'site-topo' }, [
    el('div', { classe: 'identidade', estilo: 'padding:0' }, [logotipo(34)]),
    el('nav', {}, [
      el('a', { href: '#modalidades', texto: 'Modalidades', aoClicar: rolarAte('modalidades') }),
      el('a', { href: '#horarios', texto: 'Horários', aoClicar: rolarAte('horarios') }),
      el('a', { href: '#professores', texto: 'Professores', aoClicar: rolarAte('professores') }),
      el('a', { href: '#graduacoes', texto: 'Graduações', aoClicar: rolarAte('graduacoes') }),
      el('a', { href: '#competicoes', texto: 'Competições', aoClicar: rolarAte('competicoes') }),
      el('a', { href: '#planos', texto: 'Planos', aoClicar: rolarAte('planos') }),
      el('a', { href: '#loja', texto: 'Loja', aoClicar: rolarAte('loja') }),
    ]),
    el('div', { classe: 'acoes' }, [
      el('button', {
        classe: 'botao-icone', 'aria-label': 'Alternar tema claro e escuro',
        aoClicar: (evento) => {
          alternarTema();
          evento.currentTarget.replaceChildren(icone(ehEscuro() ? 'sol' : 'lua', 18));
        },
      }, [icone(ehEscuro() ? 'sol' : 'lua', 18)]),
      el('button', { classe: 'botao', texto: 'Entrar', aoClicar: rolarAte('acesso') }),
    ]),
  ]);
}

/* -------------------------------------------------------------- topo */

function heroi(academia, numeros) {
  return el('section', { classe: 'heroi' }, [
    el('div', { classe: 'heroi-grade' }, [
      el('div', {}, [
        el('span', { classe: 'selo' }, [
          el('span', { classe: 'ponto', estilo: 'background:var(--marca-1)' }),
          academia.chamada || 'Centro de treinamento de lutas',
        ]),
        tituloDaCasa(academia.nome),
        el('p', { classe: 'chamada', texto: academia.sobre || '' }),
        el('div', { classe: 'acoes', estilo: 'margin-top:1.5rem' }, [
          el('button', {
            classe: 'botao grande', texto: 'Fazer minha matrícula',
            aoClicar: (evento) => {
              rolarAte('acesso')(evento);
              document.getElementById('aba-cadastro')?.click();
            },
          }),
          el('button', { classe: 'botao secundario grande', texto: 'Ver horários', aoClicar: rolarAte('horarios') }),
        ]),
        numeros.anos_de_historia
          ? el('div', { classe: 'numeros' }, [numero(`+${numeros.anos_de_historia}`, 'anos de história')])
          : null,
      ]),

      el('div', { estilo: 'display:grid;gap:1.5rem' }, [
        el('div', { classe: 'palco-3d' }, [
          el('div', { classe: 'brasao-3d' }, [
            el('div', { classe: 'anel' }),
            el('div', { classe: 'anel dois' }),
            simbolo(300),
          ]),
        ]),
        el('div', { id: 'acesso' }, [caixaAcesso()]),
      ]),
    ]),
  ]);
}

/** O nome da academia vira o título, com a última palavra em dourado. */
function tituloDaCasa(nome) {
  const partes = String(nome || 'Atak').trim().split(/\s+/);
  const ultima = partes.length > 1 ? partes.pop() : null;
  return el('h1', {}, [
    partes.join(' '),
    ultima ? el('span', { classe: 'destaque', texto: ` ${ultima}` }) : null,
  ]);
}

function numero(valor, rotulo) {
  return el('div', {}, [el('strong', { texto: valor }), el('span', { texto: rotulo })]);
}

function botaoWhatsapp(academia) {
  const link = linkWhatsapp(academia.whatsapp || academia.telefone,
    `Olá! Vim pelo site do ${academia.nome} e quero saber mais sobre as aulas e os planos.`);
  if (!link) return null;
  return el('a', { classe: 'zap', href: link, target: '_blank', rel: 'noopener' }, [
    icone('zap', 18), 'Falar no WhatsApp',
  ]);
}

/* ------------------------------------------------------------ seções */

function tituloSecao(olho, titulo) {
  return el('div', { classe: 'titulo-secao' }, [
    el('div', { classe: 'olho', texto: olho }),
    el('h2', { texto: titulo }),
  ]);
}

function secaoHistoria(academia) {
  return el('section', { classe: 'secao', id: 'historia' }, [
    tituloSecao('Quem somos',
      academia.anos_de_historia ? `Mais de ${academia.anos_de_historia} anos de história` : 'Nossa história'),
    el('div', { classe: 'grade col-2' }, [
      el('p', { estilo: 'font-size:1.08rem;color:var(--tinta-2);max-width:60ch', texto: academia.historia }),
      el('div', { classe: 'cartao tilt' }, [
        academia.horario_funcionamento
          ? linhaContato('Funcionamento', academia.horario_funcionamento)
          : null,
        academia.endereco ? linhaContato('Onde treinamos', academia.endereco) : null,
        academia.telefone ? linhaContato('Contato', academia.telefone) : null,
        el('a', {
          classe: 'botao secundario', target: '_blank', rel: 'noopener',
          href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(academia.endereco || academia.nome)}`,
          texto: 'Ver no mapa',
        }),
      ]),
    ]),
  ]);
}

function linhaContato(rotulo, valor) {
  return el('div', { estilo: 'margin-bottom:.9rem' }, [
    el('div', { classe: 'olho', estilo: 'font-size:.78rem;letter-spacing:.2em', texto: rotulo }),
    el('div', { texto: valor }),
  ]);
}

function secaoModalidades(modalidades) {
  return el('section', { classe: 'secao', id: 'modalidades' }, [
    tituloSecao('O que você treina aqui', 'Modalidades'),
    el('div', { classe: 'grade col-3' }, modalidades.map((modalidade) => el('article', {
      classe: 'cartao-modalidade tilt',
      estilo: `--cor-modalidade:${modalidade.cor || 'var(--marca-1)'}`,
    }, [
      el('h3', { texto: modalidade.nome }),
      el('p', { classe: 'dica', estilo: 'font-size:.92rem', texto: modalidade.descricao || '' }),
      modalidade.destaque
        ? el('div', { classe: 'acoes' }, [etiqueta(modalidade.destaque, 'marca')])
        : null,
    ]))),
  ]);
}

function secaoHorarios(grade, modalidades) {
  const area = el('div', { classe: 'rolagem' });
  let filtro = '';

  function desenhar() {
    const aulas = filtro ? grade.filter((a) => a.modalidade === filtro) : grade;
    area.replaceChildren(el('div', { classe: 'semana' }, DIAS_SEMANA.map((dia, indice) => {
      const doDia = aulas.filter((aula) => aula.dia_semana === indice);
      return el('div', { classe: `dia ${indice === new Date().getDay() ? 'hoje' : ''}` }, [
        el('h4', { texto: dia }),
        doDia.length
          ? el('div', {}, doDia.map((aula) => el('div', {
            classe: 'aula', estilo: `border-left-color:${aula.modalidade_cor || 'var(--marca-1)'}`,
          }, [
            el('div', { classe: 'hora', texto: `${aula.hora_inicio} – ${aula.hora_fim}` }),
            el('div', {}, [aula.modalidade, aula.rotulo ? el('span', { classe: 'b-rotulo', estilo: 'margin-left:.35rem', texto: aula.rotulo }) : null]),
            el('div', { classe: 'info', texto: aula.turma }),
            el('div', { classe: 'info', texto: [aula.categoria, aula.mestre].filter(Boolean).join(' · ') }),
          ])))
          : el('div', { classe: 'info dica', texto: 'Sem aulas' }),
      ]);
    })));
  }

  const chips = el('div', { classe: 'acoes', estilo: 'margin-bottom:1rem' }, [
    chip('Todas', true, () => { filtro = ''; marcar(chips, 'Todas'); desenhar(); }),
    ...modalidades.map((m) => chip(m.nome, false, () => { filtro = m.nome; marcar(chips, m.nome); desenhar(); })),
  ]);

  desenhar();
  return el('section', { classe: 'secao', id: 'horarios' }, [
    tituloSecao('Grade da semana', 'Horários das aulas'),
    chips,
    area,
  ]);
}

function chip(texto, ativo, aoClicar) {
  return el('button', { classe: `botao pequeno ${ativo ? '' : 'secundario'}`, texto, 'data-chip': texto, aoClicar });
}

function marcar(container, ativo) {
  container.querySelectorAll('[data-chip]').forEach((botao) => {
    botao.className = `botao pequeno ${botao.dataset.chip === ativo ? '' : 'secundario'}`;
  });
}

function secaoProfessores(mestres) {
  return el('section', { classe: 'secao', id: 'professores' }, [
    tituloSecao('Quem conduz o treino', 'Professores'),
    el('div', { classe: 'grade col-3' }, mestres.map((mestre) => el('article', { classe: 'cartao pessoa tilt' }, [
      el('div', { classe: 'cabecalho-pessoa' }, [
        mestre.foto
          ? el('img', { classe: 'retrato', src: mestre.foto, alt: `Foto de ${mestre.nome}`, loading: 'lazy' })
          : el('span', { classe: 'retrato vazio', texto: iniciaisDe(mestre.nome) }),
        el('div', { classe: 'dados-pessoa' }, [
          el('h3', { texto: mestre.apelido || mestre.nome }),
          mestre.faixa ? el('span', { classe: 'legenda', texto: mestre.faixa }) : null,
        ]),
      ]),
      el('div', { classe: 'acoes', estilo: 'margin:.7rem 0 .5rem' },
        mestre.modalidades.map((m) => etiquetaCor(m.nome, m.cor))),
      mestre.bio ? el('p', { classe: 'bio', texto: mestre.bio }) : null,
      el('dl', { classe: 'ficha' }, [
        parFicha('Turmas na semana', String(mestre.turmas)),
        mestre.desde ? parFicha('Na Atak desde', dataBr(mestre.desde)) : null,
        mestre.instagram ? parFicha('Instagram', mestre.instagram) : null,
      ].filter(Boolean)),
      ...mestre.titulos.map((titulo) => el('p', { classe: 'dica', estilo: 'margin:.3rem 0 0' }, [
        icone('medalha', 13),
        ` ${titulo.titulo}${titulo.entidade ? ` · ${titulo.entidade}` : ''}`,
      ])),
    ]))),
  ]);
}

function parFicha(rotulo, valor) {
  return el('div', { classe: 'linha-ficha' }, [
    el('dt', { texto: rotulo }),
    el('dd', { texto: valor }),
  ]);
}

function iniciaisDe(nome = '') {
  return nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase();
}

/** A escala completa de faixas de cada arte marcial, desenhada como faixa. */
function secaoGraduacoes(modalidades) {
  const comFaixas = modalidades.filter((m) => (m.faixas || []).length);
  if (!comFaixas.length) return null;

  const area = el('div');
  let escolhida = comFaixas[0];

  function desenhar() {
    area.replaceChildren(
      el('nav', { classe: 'abas-modalidade' }, comFaixas.map((modalidade) => el('button', {
        classe: `aba-modalidade ${escolhida.id === modalidade.id ? 'ativa' : ''}`,
        type: 'button',
        estilo: `--cor-aba:${modalidade.cor}`,
        aoClicar: () => { escolhida = modalidade; desenhar(); },
      }, [
        el('span', { classe: 'ponto-aba' }),
        modalidade.nome,
        el('span', { classe: 'contador-aba', texto: String(modalidade.faixas.length) }),
      ]))),

      el('ol', { classe: 'escala' }, escolhida.faixas.map((faixa, indice) => el('li', { classe: 'degrau' }, [
        el('span', { classe: 'ordem-degrau', texto: String(indice + 1) }),
        el('span', {
          classe: 'faixa-visual', 'aria-hidden': 'true',
          estilo: `--cor-faixa:${faixa.cor || '#888'};--cor-ponta:${faixa.cor_ponta || faixa.cor || '#888'}`,
        }, [
          el('span', { classe: 'ponta-faixa' }),
          ...Array.from({ length: Math.min(faixa.graus, 6) }, () => el('span', { classe: 'grau-faixa' })),
        ]),
        el('div', { classe: 'dados-degrau' }, [
          el('strong', { texto: faixa.nome }),
          faixa.descricao ? el('span', { classe: 'dica', texto: faixa.descricao }) : null,
          el('div', { classe: 'acoes' }, [
            faixa.faixa_etaria === 'kids' ? etiqueta('infantil', 'info') : null,
            faixa.faixa_etaria === 'adulto' ? etiqueta('adulto', 'neutra') : null,
            faixa.graus ? etiqueta(`até ${faixa.graus} grau(s)`, 'neutra') : null,
          ].filter(Boolean)),
        ]),
      ]))),
    );
  }

  desenhar();
  return el('section', { classe: 'secao', id: 'graduacoes' }, [
    tituloSecao('O caminho até a faixa preta', 'Graduações'),
    el('p', { classe: 'dica', estilo: 'max-width:70ch;margin-bottom:1.1rem' },
      ['Cada arte marcial tem a sua escala. Aqui está a sequência completa que a Atak segue, '
        + 'da primeira faixa até a graduação de mestre.']),
    area,
  ]);
}

/** Calendário de competições e as equipes que representam a academia. */
function secaoCompeticoes(competicoes, equipes, medalhas) {
  const total = (medalhas?.ouro || 0) + (medalhas?.prata || 0) + (medalhas?.bronze || 0);
  return el('section', { classe: 'secao', id: 'competicoes' }, [
    tituloSecao('A Atak no pódio', 'Competições'),

    total
      ? el('div', { classe: 'grade col-3', estilo: 'margin-bottom:1.4rem' }, [
        placar(medalhas.ouro, 'medalhas de ouro'),
        placar(medalhas.prata, 'medalhas de prata'),
        placar(medalhas.bronze, 'medalhas de bronze'),
      ])
      : null,

    el('div', { classe: 'grade col-2' }, competicoes.map((competicao) => el('article', {
      classe: 'cartao competicao tilt',
    }, [
      competicao.cartaz
        ? el('img', { classe: 'cartaz', src: competicao.cartaz, alt: `Cartaz de ${competicao.nome}`, loading: 'lazy' })
        : null,
      el('div', { classe: 'acoes', estilo: 'margin-bottom:.5rem' }, [
        competicao.modalidade ? etiquetaCor(competicao.modalidade, competicao.modalidade_cor) : null,
        etiqueta(competicao.nivel, 'neutra'),
        competicao.status === 'inscricoes' ? etiqueta('inscrições abertas', 'ok') : null,
        competicao.status === 'realizada' ? etiqueta('já realizada', 'neutra') : null,
      ].filter(Boolean)),
      el('h3', { texto: competicao.nome }),
      el('p', { classe: 'dica', texto: competicao.organizador || '' }),
      el('dl', { classe: 'ficha' }, [
        parFicha('Data', dataBr(competicao.data_inicio)),
        parFicha('Local', [competicao.local, competicao.cidade].filter(Boolean).join(' · ') || 'A definir'),
        competicao.inscricao_ate ? parFicha('Inscrições até', dataBr(competicao.inscricao_ate)) : null,
        parFicha('Atletas da Atak', `${competicao.inscritos} inscrito(s)`),
      ].filter(Boolean)),
      competicao.descricao ? el('p', { texto: competicao.descricao }) : null,
    ]))),

    equipes.length
      ? el('div', { estilo: 'margin-top:1.6rem' }, [
        el('h3', { estilo: 'margin-bottom:.8rem', texto: 'Equipes de competição' }),
        el('div', { classe: 'grade col-3' }, equipes.map((equipe) => el('article', {
          classe: 'cartao equipe', estilo: `--cor-equipe:${equipe.cor || 'var(--marca-1)'}`,
        }, [
          el('div', { classe: 'faixa-equipe' }),
          equipe.imagem
            ? el('img', { classe: 'cartaz', src: equipe.imagem, alt: `Equipe ${equipe.nome}`, loading: 'lazy' })
            : null,
          el('h3', { texto: equipe.nome }),
          el('p', { classe: 'dica', texto: equipe.descricao || '' }),
          el('div', { classe: 'numeros-equipe' }, [
            el('div', { classe: 'bloco-numero' }, [
              el('strong', { texto: String(equipe.atletas) }),
              el('span', { texto: 'atletas' }),
            ]),
          ]),
          el('p', { classe: 'dica', texto: `Técnico: ${equipe.tecnico || 'a definir'}` }),
        ]))),
      ])
      : null,
  ]);
}

function placar(valor, rotulo) {
  return el('div', { classe: 'cartao', estilo: 'text-align:center' }, [
    el('strong', { estilo: 'display:block;font:750 2.2rem/1 var(--fonte-titulo, inherit)', texto: String(valor || 0) }),
    el('span', { classe: 'dica', texto: rotulo }),
  ]);
}

function secaoPlanos(planos, academia) {
  if (!planos.length) return null;
  const maiorValor = Math.max(...planos.map((p) => p.valor));

  return el('section', { classe: 'secao', id: 'planos' }, [
    tituloSecao('Escolha o seu', 'Planos e valores'),
    el('p', { classe: 'dica', estilo: 'margin:-.5rem 0 1.5rem;max-width:60ch' },
      ['Sem taxa escondida: o valor abaixo é o que você paga. A primeira aula é experimental e não custa nada.']),
    el('div', { classe: 'grade col-3' }, planos.map((plano) => el('article', {
      classe: `cartao-plano tilt ${plano.valor === maiorValor && planos.length > 1 ? 'destaque' : ''}`,
    }, [
      plano.valor === maiorValor && planos.length > 1
        ? el('div', {}, [etiqueta('mais completo', 'marca')])
        : null,
      el('h3', { texto: plano.nome, estilo: 'font-family:var(--fonte-titulo);font-size:1.4rem;text-transform:uppercase' }),
      el('div', { classe: 'preco' }, [
        moeda(plano.valor),
        el('small', { texto: ` ${PERIODICIDADE[plano.periodicidade] || ''}` }),
      ]),
      plano.descricao ? el('p', { classe: 'dica', estilo: 'font-size:.9rem', texto: plano.descricao }) : null,
      el('ul', { classe: 'lista-beneficios' }, [
        el('li', { texto: plano.aulas_semana ? `${plano.aulas_semana} treinos por semana` : 'Treinos livres, sem limite' }),
        el('li', {
          texto: plano.modalidades.length
            ? `Modalidades: ${plano.modalidades.join(', ')}`
            : 'Todas as modalidades da academia',
        }),
        el('li', { texto: 'Acompanhamento dos professores e controle de presença no app' }),
      ]),
      el('a', {
        classe: 'botao', target: '_blank', rel: 'noopener',
        href: linkWhatsapp(academia.whatsapp || academia.telefone,
          `Olá! Quero saber mais sobre o plano ${plano.nome} do ${academia.nome}.`) || '#planos',
        texto: 'Quero este plano',
      }),
    ]))),
  ]);
}

function secaoLoja(produtos) {
  const grupos = new Map();
  for (const produto of produtos) {
    const chave = produto.modalidade || 'Acessórios e vestuário';
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(produto);
  }

  const area = el('div');
  let aberto = [...grupos.keys()][0];

  function desenhar() {
    area.replaceChildren(el('div', { classe: 'grade produtos' }, (grupos.get(aberto) || []).map((produto) => el('article', {
      classe: 'produto tilt',
    }, [
      el('div', { classe: 'capa' }, [
        produto.imagem
          ? el('img', { src: produto.imagem, alt: produto.nome, loading: 'lazy' })
          : el('span', { classe: 'sem-foto', texto: (CATEGORIA_PRODUTO[produto.categoria] || 'Produto').slice(0, 2).toUpperCase() }),
        el('span', { classe: 'selo', texto: CATEGORIA_PRODUTO[produto.categoria] || produto.categoria }),
      ]),
      el('div', { classe: 'corpo-produto' }, [
        el('h3', { texto: produto.nome, estilo: 'margin:0;font-size:1rem' }),
        produto.tamanhos ? el('div', { classe: 'dica', texto: `Tamanhos: ${produto.tamanhos}` }) : null,
        el('div', { classe: 'preco', texto: moeda(produto.preco) }),
        produto.estoque > 0
          ? etiqueta('disponível na academia', 'bom')
          : etiqueta('sob encomenda', 'atencao'),
      ]),
    ]))));
  }

  const abas = el('div', { classe: 'acoes', estilo: 'margin-bottom:1.25rem' },
    [...grupos.keys()].map((nome) => chip(nome, nome === aberto, () => {
      aberto = nome;
      marcar(abas, nome);
      desenhar();
    })));

  desenhar();
  return el('section', { classe: 'secao', id: 'loja' }, [
    tituloSecao('Equipamento oficial', 'Loja da Atak'),
    el('p', { classe: 'dica', estilo: 'margin:-.5rem 0 1.5rem;max-width:60ch' },
      ['Kimono, faixa, luva, rashguard e a linha de vestuário da casa. A compra é feita na recepção.']),
    abas,
    area,
  ]);
}

function secaoCertificados(certificados) {
  const rotulos = {
    faixa_preta: 'Faixa preta', graduacao: 'Graduação', mestre: 'Titulação de mestre',
    federacao: 'Federação', curso: 'Curso', premiacao: 'Premiação', outro: 'Documento',
  };
  return el('section', { classe: 'secao', id: 'certificados' }, [
    tituloSecao('Transparência', 'Certificados e titulações'),
    el('p', { classe: 'dica', estilo: 'margin:-.5rem 0 1.5rem;max-width:62ch' },
      ['Nossos professores e faixas pretas com registro em federação. Está tudo publicado para qualquer pessoa conferir.']),
    el('div', { classe: 'grade col-2' }, certificados.map((item) => el('article', { classe: 'certificado' }, [
      el('div', { classe: 'miniatura' }, [
        item.arquivo && !item.arquivo.endsWith('.pdf')
          ? el('img', { src: item.arquivo, alt: `Certificado de ${item.pessoa_nome}`, loading: 'lazy' })
          : el('span', { classe: 'sem-foto', texto: 'CT' }),
      ]),
      el('div', { estilo: 'min-width:0' }, [
        el('div', { classe: 'selo-tipo', texto: rotulos[item.tipo] || item.tipo }),
        el('h3', { texto: item.titulo, estilo: 'margin:.15rem 0 .2rem;font-size:1.02rem' }),
        el('div', { estilo: 'font-weight:700', texto: item.pessoa_nome }),
        el('div', { classe: 'dica', texto: [item.modalidade, item.entidade, item.data_emissao && dataBr(item.data_emissao)].filter(Boolean).join(' · ') }),
      ]),
    ]))),
  ]);
}

function secaoAvaliacoes(avaliacoes, resumo, modalidades) {
  const maior = Math.max(1, ...resumo.distribuicao.map((d) => d.quantidade));
  return el('section', { classe: 'secao', id: 'avaliacoes' }, [
    tituloSecao('O que dizem sobre a gente', 'Avaliações'),
    el('div', { classe: 'grade col-2' }, [
      el('div', { classe: 'cartao' }, [
        resumo.total
          ? el('div', { classe: 'nota-grande' }, [
            el('div', {}, [
              el('div', { classe: 'media', texto: resumo.media.toFixed(1).replace('.', ',') }),
              estrelas(resumo.media, { tamanho: 19 }),
              el('div', { classe: 'dica', texto: `${resumo.total} avaliação(ões)` }),
            ]),
            el('div', { classe: 'distribuicao' }, resumo.distribuicao.map((linha) => el('div', { classe: 'faixa-nota' }, [
              el('span', { texto: `${linha.nota}★`, estilo: 'width:28px' }),
              el('span', { classe: 'barra' }, [
                el('span', { estilo: `width:${(linha.quantidade / maior) * 100}%;background:var(--marca-gradiente)` }),
              ]),
              el('span', { texto: String(linha.quantidade), estilo: 'width:22px;text-align:right' }),
            ]))),
          ])
          : el('p', { classe: 'dica' },
            ['Ainda não temos avaliações publicadas. Seja a primeira pessoa a contar como é treinar aqui.']),
        formularioAvaliacao(modalidades),
      ]),
      el('div', { classe: 'grade' }, avaliacoes.slice(0, 4).map((item) => el('article', { classe: 'depoimento' }, [
        estrelas(item.nota),
        el('p', { classe: 'texto', estilo: 'margin-top:.6rem', texto: item.comentario || '' }),
        el('div', { classe: 'autor' }, [
          el('strong', { texto: item.autor_nome }),
          item.modalidade ? el('span', { texto: `· ${item.modalidade}` }) : null,
        ]),
        item.resposta
          ? el('div', { classe: 'resposta' }, [el('strong', { texto: 'Resposta da academia: ' }), item.resposta])
          : null,
      ]))),
    ]),
  ]);
}

function formularioAvaliacao(modalidades) {
  const retorno = el('div');
  const form = el('form', { estilo: 'margin-top:1.5rem' }, [
    el('h4', { texto: 'Deixe sua avaliação' }),
    retorno,
    el('div', { classe: 'campo' }, [el('label', { texto: 'Sua nota' }), entradaEstrelas('nota', 5)]),
    el('div', { classe: 'linha' }, [
      campo('Seu nome *', { name: 'autor_nome', required: true }),
      el('div', { classe: 'campo' }, [
        el('label', { texto: 'Modalidade' }),
        el('select', { name: 'modalidade_id' }, [
          el('option', { value: '', texto: 'A academia em geral' }),
          ...modalidades.map((m) => el('option', { value: m.id, texto: m.nome })),
        ]),
      ]),
    ]),
    el('div', { classe: 'campo' }, [
      el('label', { texto: 'Comentário' }),
      el('textarea', { name: 'comentario', placeholder: 'Conte como está sendo treinar no CT Atak.' }),
    ]),
    el('button', { classe: 'botao', type: 'submit', texto: 'Enviar avaliação' }),
  ]);

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const enviar = form.querySelector('button[type=submit]');
    enviar.disabled = true;
    try {
      const resposta = await api.criar('/publico/avaliacoes', Object.fromEntries(new FormData(form).entries()));
      form.reset();
      retorno.replaceChildren(el('div', { classe: 'mensagem-ok', texto: resposta.mensagem }));
      aviso('Avaliação enviada. Obrigado!');
    } catch (falha) {
      retorno.replaceChildren(el('div', { classe: 'mensagem-erro', texto: falha.message }));
    } finally {
      enviar.disabled = false;
    }
  });
  return form;
}

function secaoAvisos(avisos) {
  return el('section', { classe: 'secao', id: 'avisos' }, [
    tituloSecao('Fique por dentro', 'Avisos e campeonatos'),
    el('div', { classe: 'grade col-2' }, avisos.map((item) => el('article', { classe: 'cartao tilt' }, [
      el('div', { classe: 'acoes', estilo: 'margin-bottom:.6rem' }, [
        etiqueta(TIPO_AVISO[item.tipo] || item.tipo, item.tipo === 'cancelamento' ? 'critico' : 'marca'),
        item.data_evento ? etiqueta(dataBr(item.data_evento), 'neutra') : null,
      ]),
      el('h3', { texto: item.titulo }),
      el('p', { classe: 'dica', estilo: 'font-size:.92rem', texto: item.mensagem }),
      item.local_evento ? el('p', { classe: 'dica', texto: `Local: ${item.local_evento}` }) : null,
    ]))),
  ]);
}

function rodape(academia) {
  const contatos = [
    academia.endereco,
    academia.telefone,
    academia.instagram,
    academia.horario_funcionamento,
  ].filter(Boolean);

  return el('footer', { classe: 'rodape-site' }, [
    el('div', { estilo: 'display:flex;gap:1.5rem;flex-wrap:wrap;align-items:center;justify-content:space-between' }, [
      el('div', { classe: 'identidade', estilo: 'padding:0' }, [logotipo(30)]),
      el('div', {}, contatos.map((linha) => el('div', { texto: linha }))),
    ]),
    el('p', { estilo: 'margin-top:1.25rem' },
      [`© ${new Date().getFullYear()} ${academia.nome} · sistema de gestão da academia`]),
  ]);
}

/* -------------------------------------------------- login e cadastro */

function caixaAcesso() {
  const conteudo = el('div');
  const abaEntrar = el('button', { classe: 'ativo', texto: 'Entrar', type: 'button', id: 'aba-entrar' });
  const abaCriar = el('button', { texto: 'Criar conta', type: 'button', id: 'aba-cadastro' });

  function selecionar(aba) {
    abaEntrar.classList.toggle('ativo', aba === 'entrar');
    abaCriar.classList.toggle('ativo', aba === 'criar');
    conteudo.replaceChildren(aba === 'entrar' ? formularioLogin() : formularioCadastro());
  }
  abaEntrar.addEventListener('click', () => selecionar('entrar'));
  abaCriar.addEventListener('click', () => selecionar('criar'));
  selecionar('entrar');

  return el('div', { classe: 'painel-acesso' }, [
    el('div', { classe: 'abas' }, [abaEntrar, abaCriar]),
    conteudo,
  ]);
}

function campo(rotulo, atributos) {
  return el('div', { classe: 'campo' }, [el('label', { texto: rotulo }), el('input', atributos)]);
}

async function entrar(dados) {
  sessao.salvar(dados.token, dados.usuario);
  irPara(dados.usuario.papel === 'aluno' ? 'minha-area' : 'painel');
  await iniciar();
}

function aoEnviar(form, retorno, acao) {
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    retorno.replaceChildren();
    const enviar = form.querySelector('button[type=submit]');
    const original = enviar.textContent;
    enviar.disabled = true;
    enviar.textContent = 'Aguarde…';
    try {
      await acao();
    } catch (falha) {
      retorno.replaceChildren(el('div', { classe: 'mensagem-erro', texto: falha.message }));
      enviar.disabled = false;
      enviar.textContent = original;
    }
  });
}

function formularioLogin() {
  const retorno = el('div');
  const form = el('form', {}, [
    retorno,
    campo('E-mail', { type: 'email', name: 'email', required: true, autocomplete: 'email', placeholder: 'você@email.com' }),
    campo('Senha', { type: 'password', name: 'senha', required: true, autocomplete: 'current-password' }),
    el('button', { classe: 'botao', type: 'submit', texto: 'Entrar no sistema', estilo: 'width:100%' }),
    el('p', { classe: 'dica', estilo: 'margin-top:.75rem' },
      ['Aluno, mestre, recepção e dono usam o mesmo login.']),
  ]);

  aoEnviar(form, retorno, async () => {
    const dados = await api.criar('/auth/login', {
      email: form.elements.email.value.trim(),
      senha: form.elements.senha.value,
    });
    await entrar(dados);
  });
  return form;
}

function formularioCadastro() {
  const retorno = el('div');
  const form = el('form', {}, [
    retorno,
    el('p', { classe: 'dica' },
      [`Crie sua conta no ${marca.nome} para acompanhar horários, avisos, mensalidades e fazer o check-in do treino.`]),
    campo('Nome completo *', { name: 'nome', required: true }),
    el('div', { classe: 'linha' }, [
      campo('E-mail *', { type: 'email', name: 'email', required: true }),
      campo('Telefone / WhatsApp', { name: 'telefone', placeholder: '(21) 90000-0000' }),
    ]),
    el('div', { classe: 'linha' }, [
      campo('Data de nascimento', { type: 'date', name: 'data_nascimento', max: hojeISO() }),
      campo('Senha *', { type: 'password', name: 'senha', required: true, minlength: 6 }),
    ]),
    el('div', { classe: 'linha' }, [
      campo('Responsável (menor de idade)', { name: 'responsavel_nome' }),
      campo('Telefone do responsável', { name: 'responsavel_telefone' }),
    ]),
    el('div', { classe: 'campo' }, [
      el('label', { texto: 'Já treina? Tem alguma lesão? Qual luta quer fazer?' }),
      el('textarea', { name: 'observacoes' }),
    ]),
    el('button', { classe: 'botao', type: 'submit', texto: 'Criar minha conta', estilo: 'width:100%' }),
  ]);

  aoEnviar(form, retorno, async () => {
    const dados = await api.criar('/auth/registrar', Object.fromEntries(new FormData(form).entries()));
    await entrar(dados);
  });
  return form;
}
