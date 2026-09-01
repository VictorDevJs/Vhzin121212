/**
 * Identidade visual da academia.
 * O nome, a cor principal e a chamada vem do cadastro (Equipe e academia);
 * os arquivos de logo ficam em /public/marca/.
 */
import { el } from './ui.js';

export const marca = {
  nome: 'Atak',
  chamada: '',
  cor: '',
};

/** Aplica no documento os dados de marca vindos da API. */
export function aplicarMarca(academia = {}) {
  if (academia.nome) marca.nome = academia.nome;
  if (academia.chamada) marca.chamada = academia.chamada;
  document.title = `${marca.nome} · Sistema de gestao`;
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

/** Logo horizontal, com o nome em texto caso o arquivo nao exista. */
export function logotipo(altura = 32) {
  const imagem = el('img', { src: '/marca/logo.svg', alt: marca.nome, estilo: `height:${altura}px` });
  imagem.addEventListener('error', () => imagem.replaceWith(el('span', { classe: 'nome', texto: marca.nome })));
  return imagem;
}

/** Simbolo quadrado (menu, avatar da academia, favicon). */
export function simbolo(tamanho = 38) {
  const imagem = el('img', {
    classe: 'simbolo', src: '/marca/simbolo.svg', alt: '',
    estilo: `width:${tamanho}px;height:${tamanho}px`,
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
