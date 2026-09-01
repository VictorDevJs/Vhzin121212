/** Tema claro/escuro com preferencia salva no aparelho. */
const CHAVE = 'atak.tema';

export function temaAtual() {
  return localStorage.getItem(CHAVE) || 'sistema';
}

export function aplicarTema(tema = temaAtual()) {
  const raiz = document.documentElement;
  if (tema === 'sistema') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', tema);
  localStorage.setItem(CHAVE, tema);
  const escuro = tema === 'escuro'
    || (tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', escuro ? 'dark' : 'light');
  return tema;
}

/** Alterna entre claro e escuro (a partir do que esta valendo agora). */
export function alternarTema() {
  const escuroAgora = document.documentElement.getAttribute('data-tema') === 'escuro'
    || (!document.documentElement.hasAttribute('data-tema')
      && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return aplicarTema(escuroAgora ? 'claro' : 'escuro');
}

export function ehEscuro() {
  return document.documentElement.getAttribute('data-tema') === 'escuro'
    || (!document.documentElement.hasAttribute('data-tema')
      && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

aplicarTema();
