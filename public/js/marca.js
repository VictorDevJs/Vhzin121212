/**
 * Identidade visual da academia.
 * O nome, a cor principal e a chamada vem do cadastro (Equipe e academia);
 * os arquivos de logo ficam em /public/marca/.
 */
import { el } from './ui.js';

export const marca = {
  nome: 'CT Atak',
  chamada: '',
  cor: '',
  // Arquivos enviados pelo dono em Equipe e academia; se vazios, usa os de /marca/.
  logo: '',
  simbolo: '',
};

/** Aplica no documento os dados de marca vindos da API. */
export function aplicarMarca(academia = {}) {
  if (academia.nome) marca.nome = academia.nome;
  if (academia.chamada) marca.chamada = academia.chamada;
  marca.logo = academia.logo_url || '';
  marca.simbolo = academia.simbolo_url || '';
  if (marca.simbolo) {
    document.querySelector('link[rel="icon"]')?.setAttribute('href', marca.simbolo);
  }
  document.title = `${marca.nome} · Sistema de gestão`;
  if (academia.cor_primaria) definirCorPrincipal(academia.cor_primaria);
}

/** Troca a cor principal em tempo real (usada tambem na tela de identidade visual). */
export function definirCorPrincipal(cor) {
  if (!/^#[0-9a-f]{6}$/i.test(cor)) return;
  marca.cor = cor;
  const raiz = document.documentElement;
  raiz.style.setProperty('--marca-1', cor);
  raiz.style.setProperty('--marca-gradiente', `linear-gradient(135deg, ${cor}, ${clarear(cor, 26)})`);
  raiz.style.setProperty('--marca-contraste', luminancia(cor) > 0.55 ? '#0b0d10' : '#ffffff');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cor);
}

function componentes(cor) {
  return [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16));
}

function luminancia(cor) {
  const [r, g, b] = componentes(cor).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function clarear(cor, quanto) {
  const ajustado = componentes(cor).map((v) => Math.min(255, Math.round(v + (255 - v) * (quanto / 100))));
  return `#${ajustado.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Desenho da palavra ATAK - as mesmas formas usadas no brasão. */
const LETRAS_ATAK = [
  'M0,64 L18,0 H32 L50,64 H35.5 L32,50.5 H18 L14.5,64 Z M20.5,38.5 H29.5 L25,17 Z',
  'M55,0 H101 V13.5 H85 V64 H71 V13.5 H55 Z',
  'M106,64 L124,0 H138 L156,64 H141.5 L138,50.5 H124 L120.5,64 Z M126.5,38.5 H135.5 L131,17 Z',
  'M162,0 H176.5 V27 L195.5,0 H213 L191.5,30.5 L214,64 H196.5 L182,41.5 L176.5,48.5 V64 H162 Z',
];

function svg(tag, atributos) {
  const no = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [chave, valor] of Object.entries(atributos)) no.setAttribute(chave, valor);
  return no;
}

/**
 * Assinatura horizontal: brasão + a palavra ATAK.
 * A palavra é desenhada no próprio documento, e não dentro de um arquivo
 * separado, para herdar a cor do tema - preta no claro, clara no escuro.
 */
export function logotipo(altura = 32) {
  if (marca.logo) {
    const enviado = el('img', { src: marca.logo, alt: marca.nome, estilo: `height:${altura}px` });
    enviado.addEventListener('error', () => enviado.replaceWith(el('span', { classe: 'nome', texto: marca.nome })));
    return enviado;
  }

  const palavra = svg('svg', {
    viewBox: '0 0 214 64', height: String(Math.round(altura * 0.46)),
    fill: 'currentColor', role: 'img', 'aria-label': marca.nome,
  });
  for (const desenho of LETRAS_ATAK) {
    palavra.append(svg('path', { d: desenho, 'fill-rule': 'evenodd' }));
  }

  return el('span', { classe: 'assinatura' }, [simbolo(altura), palavra]);
}

/** Simbolo quadrado (menu, avatar da academia, favicon). */
export function simbolo(tamanho = 38) {
  const imagem = el('img', {
    classe: 'simbolo', src: marca.simbolo || '/marca/simbolo.svg', alt: '',
    estilo: `width:${tamanho}px;height:${tamanho}px;object-fit:contain`,
  });
  imagem.addEventListener('error', () => imagem.replaceWith(el('span', {
    classe: 'avatar', texto: marca.nome.slice(0, 1).toUpperCase(),
    estilo: `width:${tamanho}px;height:${tamanho}px;border-radius:12px`,
  })));
  return imagem;
}

export function iniciais(nome = '') {
  return nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0] || '').join('').toUpperCase() || '?';
}
