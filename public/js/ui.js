/** Blocos de interface reutilizados por todas as telas. */

/**
 * Cria elementos sem usar innerHTML (todo texto entra como textContent),
 * o que evita qualquer injecao vinda de dados cadastrados pelos usuarios.
 */
export function el(tag, props = {}, filhos = []) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (chave === 'classe') no.className = valor;
    else if (chave === 'texto') no.textContent = valor;
    else if (chave === 'aoClicar') no.addEventListener('click', valor);
    else if (chave === 'aoMudar') no.addEventListener('change', valor);
    else if (chave === 'aoEnviar') no.addEventListener('submit', valor);
    else if (chave === 'aoDigitar') no.addEventListener('input', valor);
    else if (chave === 'estilo') no.setAttribute('style', valor);
    else if (chave in no && chave !== 'list') no[chave] = valor;
    else no.setAttribute(chave, valor);
  }
  for (const filho of [].concat(filhos)) {
    if (filho === null || filho === undefined || filho === false) continue;
    no.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return no;
}

export function limpar(no) {
  no.replaceChildren();
  return no;
}

// ---------- Formatadores ----------

export function moeda(valor) {
  // O espaco inquebravel mantem "R$ 1.234,00" em uma linha so dentro dos cartoes.
  return (Number(valor) || 0)
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    .replace(/\s/g, '\u00a0');
}

export function dataBr(iso) {
  if (!iso) return '-';
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
  return dia ? `${dia}/${mes}/${ano}` : iso;
}

export function dataHoraBr(valor) {
  if (!valor) return '-';
  const [data, hora = ''] = String(valor).split(' ');
  return `${dataBr(data)}${hora ? ` ${hora.slice(0, 5)}` : ''}`;
}

export function competenciaBr(competencia) {
  if (!competencia) return '-';
  const [ano, mes] = competencia.split('-');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano}`;
}

export function hojeISO() {
  return new Date().toLocaleDateString('sv-SE');
}

export function competenciaAtual() {
  return hojeISO().slice(0, 7);
}

export function idade(dataNascimento) {
  if (!dataNascimento) return null;
  const nascimento = new Date(`${dataNascimento}T00:00:00`);
  if (Number.isNaN(nascimento.getTime())) return null;
  return Math.floor((Date.now() - nascimento.getTime()) / (365.25 * 24 * 3600 * 1000));
}

// ---------- Componentes ----------

const MAPA_TIPO = { ok: 'bom', erro: 'critico', alerta: 'atenção', info: 'info', neutra: 'neutra', bom: 'bom', critico: 'critico', atencao: 'atenção', marca: 'marca' };

export function etiqueta(texto, tipo = 'neutra') {
  return el('span', { classe: `etiqueta ${MAPA_TIPO[tipo] || 'neutra'}`, texto });
}

/** Etiqueta com um ponto colorido - usada quando a cor vem do cadastro. */
export function etiquetaCor(texto, cor) {
  return el('span', { classe: 'etiqueta neutra' }, [
    el('span', { classe: 'ponto', estilo: `background:${cor || 'var(--marca-1)'}` }),
    texto,
  ]);
}

const ESTILO_STATUS = { ativo: 'ok', pendente: 'alerta', inativo: 'neutra', trancado: 'erro', ativa: 'ok', pago: 'ok', cancelado: 'neutra', suspensa: 'alerta', encerrada: 'neutra' };
export function etiquetaStatus(status) {
  return etiqueta(status, ESTILO_STATUS[status] || 'neutra');
}

export function cartao(titulo, filhos, acoes = null) {
  const cabecalho = (titulo || acoes)
    ? el('div', { classe: 'titulo-cartao' }, [
      titulo ? el('h3', { texto: titulo }) : el('span'),
      acoes ? el('div', { classe: 'acoes' }, [].concat(acoes)) : null,
    ])
    : null;
  return el('section', { classe: 'cartao' }, [cabecalho, ...[].concat(filhos)]);
}

const MAPA_INDICADOR = { ok: 'bom', erro: 'critico', alerta: 'atenção', info: 'destaque', bom: 'bom', critico: 'critico', atencao: 'atenção', marca: 'destaque', destaque: 'destaque' };

/**
 * Cartao de número. `delta` recebe { valor: '+12%', sobe: true } e vem sempre
 * com seta + texto, para nunca depender só da cor.
 */
export function indicador({ rotulo, valor, detalhe, tipo = '', delta = null, extra = null }) {
  return el('div', { classe: `indicador ${MAPA_INDICADOR[tipo] || ''}` }, [
    el('span', { classe: 'faixa' }),
    el('div', { classe: 'rotulo', texto: rotulo }),
    el('div', { classe: 'valor', texto: valor }),
    delta ? el('div', { classe: `delta ${delta.sobe ? 'sobe' : 'desce'}` }, [
      el('span', { texto: delta.sobe ? '\u2191' : '\u2193' }),
      delta.valor,
    ]) : null,
    detalhe ? el('div', { classe: 'detalhe', texto: detalhe }) : null,
    extra,
  ]);
}

export function botao(texto, aoClicar, classe = 'botao') {
  return el('button', { classe, texto, aoClicar, type: 'button' });
}

/** Estado vazio discreto: um traço fino e a explicação, sem emoji. */
export function vazio(mensagem) {
  return el('div', { classe: 'vazio' }, [
    el('span', { classe: 'risco' }),
    el('div', { texto: mensagem }),
  ]);
}

/** Placeholder animado enquanto os dados chegam. */
export function esqueleto(linhas = 3, altura = 46) {
  return el('div', {}, Array.from({ length: linhas }, (_, i) => el('div', {
    classe: 'esqueleto',
    estilo: `height:${altura}px;opacity:${1 - i * 0.12}`,
  })));
}

/** Tabela simples: colunas de texto e linhas com strings ou elementos. */
export function tabela(colunas, linhas, mensagemVazia = 'Nada por aqui ainda.') {
  if (!linhas.length) return vazio(mensagemVazia);
  return el('div', { classe: 'rolagem' }, [
    el('table', {}, [
      el('thead', {}, [el('tr', {}, colunas.map((c) => el('th', { texto: c })))]),
      el('tbody', {}, linhas.map((celulas) => el('tr', {}, celulas.map((celula) => (
        celula && celula.__celula
          ? el('td', { classe: celula.classe || '' }, [].concat(celula.conteudo))
          : el('td', {}, [celula instanceof Node ? celula : String(celula ?? '-')])
      ))))),
    ]),
  ]);
}

/** Marca uma celula com conteudo composto (varios elementos ou classe propria). */
export function celula(conteudo, classe = '') {
  return { __celula: true, conteudo, classe };
}

export function aviso(mensagem, tipo = 'ok') {
  const caixa = document.getElementById('avisos-flutuantes');
  const item = el('div', { classe: `aviso-flutuante ${tipo === 'erro' ? 'erro' : ''}`, texto: mensagem });
  caixa.append(item);
  setTimeout(() => item.remove(), 4200);
}

// ---------- Formularios ----------

/**
 * Monta um campo de formulario.
 * campo: { nome, rotulo, tipo, opções, obrigatório, dica, placeholder, valor }
 */
export function campoFormulario(campo, valor) {
  const valorAtual = valor ?? campo.valor ?? '';
  let controle;

  if (campo.tipo === 'estrelas') {
    return el('div', { classe: 'campo' }, [
      el('label', { texto: campo.rotulo }),
      entradaEstrelas(campo.nome, Number(valorAtual) || 5),
      campo.dica ? el('div', { classe: 'dica', texto: campo.dica }) : null,
    ]);
  }

  if (campo.tipo === 'arquivo') {
    // Le o arquivo no navegador e guarda como data URL para enviar junto do formulario.
    const previa = el('div', { classe: 'dica', texto: valorAtual ? 'Arquivo atual mantido.' : 'Nenhum arquivo escolhido.' });
    const entrada = el('input', {
      type: 'file', name: campo.nome, accept: campo.aceita || 'image/*,application/pdf',
      aoMudar: (evento) => {
        const arquivo = evento.target.files?.[0];
        if (!arquivo) { entrada.dataset.conteudo = ''; previa.textContent = 'Nenhum arquivo escolhido.'; return; }
        if (arquivo.size > 5 * 1024 * 1024) {
          entrada.value = '';
          previa.textContent = 'Arquivo maior que 5 MB. Escolha um menor.';
          return;
        }
        const leitor = new FileReader();
        leitor.onload = () => {
          entrada.dataset.conteudo = String(leitor.result);
          previa.textContent = `${arquivo.name} (${Math.round(arquivo.size / 1024)} KB)`;
        };
        leitor.readAsDataURL(arquivo);
      },
    });
    return el('div', { classe: 'campo' }, [
      el('label', { texto: campo.rotulo }),
      entrada,
      previa,
      campo.dica ? el('div', { classe: 'dica', texto: campo.dica }) : null,
    ]);
  }

  if (campo.tipo === 'select') {
    controle = el('select', { name: campo.nome }, (campo.opcoes || []).map((opcao) => el('option', {
      value: opcao.valor,
      texto: opcao.rotulo,
      selected: String(opcao.valor) === String(valorAtual),
    })));
  } else if (campo.tipo === 'textarea') {
    controle = el('textarea', { name: campo.nome, value: valorAtual, placeholder: campo.placeholder || '' });
  } else if (campo.tipo === 'checkbox') {
    return el('div', { classe: 'campo' }, [
      el('label', { classe: 'checkbox' }, [
        el('input', { type: 'checkbox', name: campo.nome, checked: !!Number(valorAtual) }),
        campo.rotulo,
      ]),
      campo.dica ? el('div', { classe: 'dica', texto: campo.dica }) : null,
    ]);
  } else if (campo.tipo === 'multi') {
    const selecionados = new Set((valorAtual || []).map(String));
    controle = el('div', { classe: 'linha' }, (campo.opcoes || []).map((opcao) => el('label', { classe: 'checkbox' }, [
      el('input', {
        type: 'checkbox', name: campo.nome, value: opcao.valor, checked: selecionados.has(String(opcao.valor)),
      }),
      opcao.rotulo,
    ])));
  } else {
    controle = el('input', {
      type: campo.tipo || 'text',
      name: campo.nome,
      value: valorAtual === null ? '' : valorAtual,
      placeholder: campo.placeholder || '',
      required: !!campo.obrigatorio,
      step: campo.tipo === 'number' ? (campo.passo || 'any') : null,
      min: campo.min ?? null,
      max: campo.max ?? null,
    });
  }

  return el('div', { classe: 'campo' }, [
    el('label', { texto: campo.rotulo + (campo.obrigatorio ? ' *' : '') }),
    controle,
    campo.dica ? el('div', { classe: 'dica', texto: campo.dica }) : null,
  ]);
}

/** Le os valores de um <form> respeitando o tipo de cada campo declarado. */
export function lerFormulario(form, campos) {
  const dados = {};
  for (const campo of campos) {
    if (campo.tipo === 'checkbox') {
      dados[campo.nome] = form.elements[campo.nome].checked ? 1 : 0;
    } else if (campo.tipo === 'multi') {
      dados[campo.nome] = [...form.querySelectorAll(`input[name="${campo.nome}"]:checked`)].map((i) => Number(i.value));
    } else if (campo.tipo === 'arquivo') {
      dados[campo.nome] = form.elements[campo.nome]?.dataset.conteudo || '';
    } else {
      const controle = form.elements[campo.nome];
      dados[campo.nome] = controle ? controle.value : '';
    }
  }
  return dados;
}

/**
 * Abre um modal com formulario. aoSalvar recebe os dados e pode ser assincrono;
 * lancar um erro mantem o modal aberto exibindo a mensagem.
 */
export function abrirFormulario({ titulo, campos, valores = {}, textoConfirmar = 'Salvar', aoSalvar, aviso: textoAviso, extras = [] }) {
  const erro = el('div', { classe: 'mensagem-erro', estilo: 'display:none' });
  const form = el('form', { classe: 'corpo' }, [
    textoAviso ? el('p', { classe: 'dica', texto: textoAviso }) : null,
    erro,
    ...campos.map((campo) => campoFormulario(campo, valores[campo.nome])),
  ]);

  const confirmar = el('button', { classe: 'botao', type: 'submit', texto: textoConfirmar });
  const fundo = el('div', { classe: 'fundo-modal' }, [
    el('div', { classe: 'modal' }, [
      el('header', {}, [
        el('h3', { texto: titulo, estilo: 'margin:0' }),
        el('button', { classe: 'fechar', texto: '×', type: 'button', aoClicar: fechar }),
      ]),
      form,
      el('footer', {}, [
        ...extras,
        el('span', { estilo: 'flex:1' }),
        botao('Cancelar', fechar, 'botao secundario'),
        confirmar,
      ]),
    ]),
  ]);

  form.id = 'form-modal';
  confirmar.setAttribute('form', 'form-modal');
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    erro.style.display = 'none';
    confirmar.disabled = true;
    try {
      await aoSalvar(lerFormulario(form, campos));
      fechar();
    } catch (falha) {
      erro.textContent = falha.message;
      erro.style.display = 'block';
    } finally {
      confirmar.disabled = false;
    }
  });

  function fechar() {
    fundo.remove();
    document.removeEventListener('keydown', aoTeclar);
  }
  function aoTeclar(evento) {
    if (evento.key === 'Escape') fechar();
  }
  fundo.addEventListener('click', (evento) => { if (evento.target === fundo) fechar(); });
  document.addEventListener('keydown', aoTeclar);
  document.body.append(fundo);
  form.querySelector('input, select, textarea')?.focus();
  return fechar;
}

/**
 * Estrelas de avaliação. A nota também vai por texto e por aria-label,
 * para nunca depender só do desenho.
 */
export function estrelas(nota, { tamanho = 16, mostrarNumero = false } = {}) {
  const valor = Math.round(Number(nota) || 0);
  const caixa = el('span', {
    classe: 'estrelas',
    estilo: `font-size:${tamanho}px`,
    role: 'img',
    'aria-label': `${valor} de 5 estrelas`,
  }, Array.from({ length: 5 }, (_, i) => el('span', {
    classe: i < valor ? 'cheia' : 'vazia',
    texto: i < valor ? '\u2605' : '\u2606',
    'aria-hidden': 'true',
  })));
  if (!mostrarNumero) return caixa;
  return el('span', { classe: 'nota-composta' }, [caixa, el('strong', { texto: Number(nota).toFixed(1) })]);
}

/** Campo de nota por estrelas, com teclado e valor num input escondido. */
export function entradaEstrelas(nome, valorInicial = 5) {
  const oculto = el('input', { type: 'hidden', name: nome, value: String(valorInicial) });
  const botoes = [];
  function pintar(nota) {
    oculto.value = String(nota);
    botoes.forEach((botao, indice) => {
      botao.textContent = indice < nota ? '\u2605' : '\u2606';
      botao.classList.toggle('cheia', indice < nota);
      botao.setAttribute('aria-checked', indice + 1 === nota ? 'true' : 'false');
    });
  }
  for (let i = 1; i <= 5; i += 1) {
    const botao = el('button', {
      type: 'button', classe: 'estrela-botao', role: 'radio',
      'aria-label': `${i} estrela${i > 1 ? 's' : ''}`,
      aoClicar: () => pintar(i),
    });
    botoes.push(botao);
  }
  pintar(valorInicial);
  return el('div', { classe: 'entrada-estrelas', role: 'radiogroup', 'aria-label': 'Nota' }, [...botoes, oculto]);
}

/** Modal livre, para fichas e telas de detalhe. */
export function abrirModal({ titulo, conteudo, largura }) {
  const corpo = el('div', { classe: 'corpo' }, [].concat(conteudo));
  const caixa = el('div', { classe: 'modal', estilo: largura ? `width:min(${largura},100%)` : null }, [
    el('header', {}, [
      el('h3', { texto: titulo, estilo: 'margin:0' }),
      el('button', { classe: 'fechar', texto: '\u00d7', type: 'button', aoClicar: () => fechar() }),
    ]),
    corpo,
  ]);
  const fundo = el('div', { classe: 'fundo-modal' }, [caixa]);

  function fechar() {
    fundo.remove();
    document.removeEventListener('keydown', aoTeclar);
  }
  function aoTeclar(evento) { if (evento.key === 'Escape') fechar(); }
  fundo.addEventListener('click', (evento) => { if (evento.target === fundo) fechar(); });
  document.addEventListener('keydown', aoTeclar);
  document.body.append(fundo);
  return { fechar, corpo };
}

/** Confirmacao simples antes de acoes destrutivas. */
export function confirmar(mensagem) {
  return window.confirm(mensagem);
}

export function opcoesDe(lista, campoValor = 'id', campoRotulo = 'nome') {
  return lista.map((item) => ({ valor: item[campoValor], rotulo: item[campoRotulo] }));
}

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
