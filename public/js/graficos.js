/**
 * Graficos em SVG puro, sem bibliotecas.
 *
 * Regras seguidas em todos eles:
 * - cores das series vem da paleta validada para daltonismo (tokens --serie-*);
 * - texto nunca usa a cor da serie: a identidade vem do marcador colorido ao lado;
 * - toda serie aparece na legenda e tem rotulo direto quando cabe;
 * - passar o mouse (ou focar pelo teclado) mostra os valores;
 * - todo grafico oferece "ver tabela" para quem nao consegue ler o desenho.
 */
import { el, moeda } from './ui.js';

const CORES_SERIE = ['var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)', 'var(--serie-4)',
  'var(--serie-5)', 'var(--serie-6)', 'var(--serie-7)', 'var(--serie-8)'];

export function corDaSerie(indice) {
  return CORES_SERIE[indice % CORES_SERIE.length];
}

/** Cria um no SVG com atributos. */
function svgEl(tag, atributos = {}, filhos = []) {
  const no = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [chave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined) continue;
    no.setAttribute(chave, String(valor));
  }
  for (const filho of [].concat(filhos)) if (filho) no.append(filho);
  return no;
}

function texto(conteudo, atributos = {}) {
  const no = svgEl('text', atributos);
  no.textContent = conteudo;
  return no;
}

/**
 * Escolhe o topo e o passo do eixo em numeros redondos
 * (0, 1.000, 2.000...) em vez de fracoes quebradas.
 */
function escalaEixo(maximo, passosAlvo = 4) {
  if (maximo <= 0) return { topo: 1, passo: 1 };
  const bruto = maximo / passosAlvo;
  const magnitude = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((p) => p >= bruto) ?? 10 * magnitude;
  return { topo: Math.ceil(maximo / passo) * passo, passo };
}

function numeroCurto(valor) {
  const n = Number(valor) || 0;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

/** Legenda padrao: marcador colorido + nome em cor de texto. */
export function legenda(series, formato = 'quadro') {
  return el('div', { classe: 'legenda' }, series.map((serie) => el('span', { classe: 'chave' }, [
    el('span', { classe: formato, estilo: `background:${serie.cor}` }),
    serie.nome,
  ])));
}

/** Alterna entre o grafico e a tabela com os mesmos dados. */
function comTabela(figura, construirTabela) {
  const area = el('div');
  let mostrando = false;
  const alternar = el('button', {
    classe: 'alternar-tabela', type: 'button', texto: 'ver tabela',
    aoClicar: () => {
      mostrando = !mostrando;
      alternar.textContent = mostrando ? 'ver grafico' : 'ver tabela';
      area.replaceChildren(mostrando ? construirTabela() : figura);
    },
  });
  area.append(figura);
  return el('div', {}, [area, el('div', { estilo: 'text-align:right;margin-top:.4rem' }, [alternar])]);
}

/** Caixa de dica reaproveitada pelos graficos. */
function criarDica(container) {
  const dica = el('div', { classe: 'dica-grafico' });
  container.append(dica);
  return {
    mostrar(x, y, titulo, linhas) {
      dica.replaceChildren(
        el('div', { classe: 'titulo', texto: titulo }),
        ...linhas.map((linha) => el('div', { classe: 'linha-dica' }, [
          el('span', { classe: 'traco', estilo: `background:${linha.cor};width:12px;height:3px;border-radius:2px` }),
          el('span', { texto: linha.nome }),
          el('strong', { texto: linha.valor }),
        ])),
      );
      dica.classList.add('visivel');
      const larguraCaixa = dica.offsetWidth || 160;
      const limite = container.clientWidth - larguraCaixa - 8;
      dica.style.left = `${Math.max(4, Math.min(x + 14, limite))}px`;
      dica.style.top = `${Math.max(4, y - 12)}px`;
    },
    esconder() { dica.classList.remove('visivel'); },
  };
}

/* ------------------------------------------------------------------------
   Barras horizontais - comparar magnitude entre categorias
   ------------------------------------------------------------------------ */

export function barrasHorizontais({ dados, formatar = numeroCurto }) {
  const itens = dados.filter((d) => Number(d.valor) > 0);
  if (!itens.length) return el('div', { classe: 'vazio', texto: 'Sem dados para exibir.' });

  const maximo = Math.max(...itens.map((d) => d.valor));

  // Montado em HTML (nao em SVG) para o texto nunca esticar junto com a barra.
  const lista = el('div', { classe: 'barras' }, itens.map((item, indice) => {
    const cor = item.cor || corDaSerie(indice);
    return el('div', {
      classe: 'barra-linha', tabindex: '0',
      'aria-label': `${item.rotulo}: ${formatar(item.valor)}`,
      title: `${item.rotulo}: ${formatar(item.valor)}${item.legenda ? ` (${item.legenda})` : ''}`,
    }, [
      el('span', { classe: 'barra-rotulo', texto: item.rotulo }),
      el('span', { classe: 'barra-trilho' }, [
        el('span', { classe: 'barra-valor', estilo: `width:${Math.max(2, (item.valor / maximo) * 100)}%;background:${cor}` }),
      ]),
      el('strong', { classe: 'barra-numero', texto: formatar(item.valor) }),
    ]);
  }));

  return comTabela(lista, () => tabelaSimples(['Categoria', 'Valor'],
    itens.map((i) => [i.rotulo, formatar(i.valor)])));
}

/* ------------------------------------------------------------------------
   Rosca - composicao de um total com poucas fatias
   ------------------------------------------------------------------------ */

export function rosca({ dados, titulo = 'total', formatar = numeroCurto }) {
  const itens = dados.filter((d) => Number(d.valor) > 0);
  const total = itens.reduce((soma, d) => soma + d.valor, 0);
  if (!total) return el('div', { classe: 'vazio', texto: 'Sem dados para exibir.' });

  const tamanho = 210;
  const centro = tamanho / 2;
  const raio = 88;
  const espessura = 26;
  const vaoGrau = 2.4; // o vao de 2px que separa as fatias

  const container = el('div', { classe: 'grafico' });
  const dica = criarDica(container);
  const svg = svgEl('svg', {
    viewBox: `0 0 ${tamanho} ${tamanho}`, style: `max-width:${tamanho}px;margin:0 auto`,
    role: 'img', 'aria-label': `Rosca: ${itens.map((i) => `${i.rotulo} ${formatar(i.valor)}`).join(', ')}`,
  });

  let anguloAtual = -90;
  itens.forEach((item, indice) => {
    const fatia = (item.valor / total) * 360;
    const inicio = anguloAtual + vaoGrau / 2;
    const fim = anguloAtual + fatia - vaoGrau / 2;
    anguloAtual += fatia;
    if (fim <= inicio) return;

    const cor = item.cor || corDaSerie(indice);
    const caminho = svgEl('path', {
      d: arco(centro, centro, raio, inicio, fim),
      fill: 'none', stroke: cor, 'stroke-width': espessura,
      tabindex: '0', 'aria-label': `${item.rotulo}: ${formatar(item.valor)}`,
      style: 'transition:opacity 120ms',
    });
    svg.append(caminho);

    const mostrar = (evento) => {
      const caixa = container.getBoundingClientRect();
      const ponto = evento.touches?.[0] ?? evento;
      dica.mostrar((ponto.clientX ?? caixa.left + centro) - caixa.left,
        (ponto.clientY ?? caixa.top + centro) - caixa.top,
        item.rotulo,
        [{ nome: `${Math.round((item.valor / total) * 100)}% do total`, valor: formatar(item.valor), cor }]);
      caminho.style.opacity = '.75';
    };
    caminho.addEventListener('pointermove', mostrar);
    caminho.addEventListener('focus', mostrar);
    caminho.addEventListener('pointerleave', () => { dica.esconder(); caminho.style.opacity = '1'; });
    caminho.addEventListener('blur', () => { dica.esconder(); caminho.style.opacity = '1'; });
  });

  svg.append(texto(formatar(total), {
    x: centro, y: centro + 2, 'text-anchor': 'middle',
    style: 'fill:var(--tinta);font-size:30px;font-weight:700;font-family:var(--fonte-titulo)',
  }));
  svg.append(texto(titulo, {
    x: centro, y: centro + 22, 'text-anchor': 'middle',
    style: 'fill:var(--tinta-3);font-size:11px;letter-spacing:.08em;text-transform:uppercase',
  }));

  container.append(svg);
  const series = itens.map((item, indice) => ({
    nome: `${item.rotulo} · ${formatar(item.valor)}`,
    cor: item.cor || corDaSerie(indice),
  }));

  return comTabela(
    el('div', {}, [container, legenda(series)]),
    () => tabelaSimples(['Categoria', 'Valor', 'Participacao'],
      itens.map((i) => [i.rotulo, formatar(i.valor), `${Math.round((i.valor / total) * 100)}%`])),
  );
}

function arco(cx, cy, raio, grauInicio, grauFim) {
  const rad = (g) => (g * Math.PI) / 180;
  const x1 = cx + raio * Math.cos(rad(grauInicio));
  const y1 = cy + raio * Math.sin(rad(grauInicio));
  const x2 = cx + raio * Math.cos(rad(grauFim));
  const y2 = cy + raio * Math.sin(rad(grauFim));
  const grande = grauFim - grauInicio > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${raio} ${raio} 0 ${grande} 1 ${x2} ${y2}`;
}

/* ------------------------------------------------------------------------
   Linha + area - evolucao no tempo, com mira e leitura das duas series
   ------------------------------------------------------------------------ */

export function evolucao({ pontos, series, formatar = moeda }) {
  if (!pontos.length) return el('div', { classe: 'vazio', texto: 'Sem movimentacao registrada ainda.' });

  const largura = 720;
  const altura = 260;
  const margem = { topo: 18, direita: 66, baixo: 30, esquerda: 54 };
  const areaL = largura - margem.esquerda - margem.direita;
  const areaA = altura - margem.topo - margem.baixo;

  const maximoReal = Math.max(1, ...pontos.flatMap((p) => p.valores));
  const { topo, passo } = escalaEixo(maximoReal);
  const x = (i) => margem.esquerda + (pontos.length === 1 ? areaL / 2 : (i / (pontos.length - 1)) * areaL);
  const y = (v) => margem.topo + areaA - (v / topo) * areaA;

  const container = el('div', { classe: 'grafico' });
  const dica = criarDica(container);
  const svg = svgEl('svg', {
    viewBox: `0 0 ${largura} ${altura}`, role: 'img',
    'aria-label': `Evolucao de ${series.map((s) => s.nome).join(' e ')} ao longo de ${pontos.length} meses`,
  });

  // Grade e eixo Y em numeros redondos
  for (let valor = 0; valor <= topo + 0.001; valor += passo) {
    const py = y(valor);
    svg.append(svgEl('line', {
      x1: margem.esquerda, x2: largura - margem.direita, y1: py, y2: py,
      class: valor === 0 ? 'linha-base' : 'grade-linha',
    }));
    svg.append(texto(numeroCurto(valor), { x: margem.esquerda - 8, y: py + 4, 'text-anchor': 'end', class: 'eixo-texto' }));
  }

  pontos.forEach((ponto, indice) => {
    svg.append(texto(ponto.x, { x: x(indice), y: altura - 8, 'text-anchor': 'middle', class: 'eixo-texto' }));
  });

  // Com duas ou mais series o preenchimento seria sobreposto e embaralharia as cores:
  // nesse caso ficam so as linhas.
  const preencherArea = series.length === 1;

  series.forEach((serie, indiceSerie) => {
    const caminhoLinha = pontos.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p.valores[indiceSerie])}`).join(' ');
    if (preencherArea) {
      const caminhoArea = `${caminhoLinha} L ${x(pontos.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;
      svg.append(svgEl('path', { d: caminhoArea, fill: serie.cor, opacity: '.10' }));
    }
    svg.append(svgEl('path', {
      d: caminhoLinha, fill: 'none', stroke: serie.cor, 'stroke-width': 2,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round',
    }));

    const ultimo = pontos.length - 1;
    // Marcador final com anel na cor da superficie, para nao sumir sobre a outra linha.
    svg.append(svgEl('circle', {
      cx: x(ultimo), cy: y(pontos[ultimo].valores[indiceSerie]), r: 4.5,
      fill: serie.cor, stroke: 'var(--superficie)', 'stroke-width': 2,
    }));
    // Rotulo direto so no ultimo ponto de cada serie.
    svg.append(texto(numeroCurto(pontos[ultimo].valores[indiceSerie]), {
      x: x(ultimo) + 10, y: y(pontos[ultimo].valores[indiceSerie]) + 4, class: 'rotulo-direto',
    }));
  });

  // Mira: encontra o mes mais proximo do ponteiro e mostra as duas series juntas.
  const mira = svgEl('line', { y1: margem.topo, y2: margem.topo + areaA, class: 'grade-linha', opacity: '0', style: 'stroke:var(--tinta-3)' });
  svg.append(mira);
  const captura = svgEl('rect', {
    x: margem.esquerda, y: margem.topo, width: areaL, height: areaA, fill: 'transparent', tabindex: '0',
  });
  svg.append(captura);

  function lerPonto(evento) {
    const caixa = svg.getBoundingClientRect();
    const escala = largura / caixa.width;
    const posX = ((evento.touches?.[0] ?? evento).clientX - caixa.left) * escala;
    const indice = Math.max(0, Math.min(pontos.length - 1,
      Math.round(((posX - margem.esquerda) / areaL) * (pontos.length - 1))));
    const ponto = pontos[indice];
    mira.setAttribute('x1', x(indice));
    mira.setAttribute('x2', x(indice));
    mira.setAttribute('opacity', '1');
    const caixaContainer = container.getBoundingClientRect();
    dica.mostrar((x(indice) / largura) * caixaContainer.width, 10, ponto.rotuloLongo || ponto.x,
      series.map((serie, i) => ({ nome: serie.nome, valor: formatar(ponto.valores[i]), cor: serie.cor })));
  }
  captura.addEventListener('pointermove', lerPonto);
  captura.addEventListener('pointerleave', () => { mira.setAttribute('opacity', '0'); dica.esconder(); });
  captura.addEventListener('focus', () => {
    const ultimo = pontos.length - 1;
    mira.setAttribute('x1', x(ultimo)); mira.setAttribute('x2', x(ultimo)); mira.setAttribute('opacity', '1');
    dica.mostrar((x(ultimo) / largura) * container.clientWidth, 10, pontos[ultimo].x,
      series.map((serie, i) => ({ nome: serie.nome, valor: formatar(pontos[ultimo].valores[i]), cor: serie.cor })));
  });
  captura.addEventListener('blur', () => { mira.setAttribute('opacity', '0'); dica.esconder(); });

  container.append(svg);
  return comTabela(
    el('div', {}, [legenda(series, 'traco'), container]),
    () => tabelaSimples(['Mes', ...series.map((s) => s.nome)],
      pontos.map((p) => [p.x, ...p.valores.map((v) => formatar(v))])),
  );
}

/* ------------------------------------------------------------------------
   Sparkline - tendencia dentro do cartao de indicador
   ------------------------------------------------------------------------ */

export function sparkline({ valores, cor = 'var(--marca-1)', altura = 34 }) {
  if (!valores || valores.length < 2) return el('div');
  const largura = 120;
  const maximo = Math.max(...valores);
  const minimo = Math.min(...valores);
  const faixa = maximo - minimo || 1;
  const x = (i) => (i / (valores.length - 1)) * largura;
  const y = (v) => altura - 4 - ((v - minimo) / faixa) * (altura - 8);
  const linha = valores.map((v, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(v)}`).join(' ');

  const svg = svgEl('svg', {
    viewBox: `0 0 ${largura} ${altura}`, style: `height:${altura}px;width:100%`,
    'aria-hidden': 'true', focusable: 'false',
  }, [
    svgEl('path', { d: `${linha} L ${largura} ${altura} L 0 ${altura} Z`, fill: cor, opacity: '.10' }),
    svgEl('path', { d: linha, fill: 'none', stroke: cor, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    svgEl('circle', { cx: x(valores.length - 1), cy: y(valores[valores.length - 1]), r: 3, fill: cor, stroke: 'var(--superficie)', 'stroke-width': 2 }),
  ]);
  return el('div', { classe: 'mini-grafico' }, [svg]);
}

/** Tabela de apoio usada pelo botao "ver tabela". */
function tabelaSimples(colunas, linhas) {
  return el('div', { classe: 'rolagem' }, [
    el('table', {}, [
      el('thead', {}, [el('tr', {}, colunas.map((c) => el('th', { texto: c })))]),
      el('tbody', {}, linhas.map((linha) => el('tr', {}, linha.map((celula, indice) => el('td', {
        texto: String(celula), classe: indice ? 'num' : '',
      }))))),
    ]),
  ]);
}
