/** Conjunto de icones em SVG (traco), para nao depender de emoji do sistema. */

const CAMINHOS = {
  painel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  faixa: '<path d="M4 8h16"/><path d="M4 8v3a8 8 0 0 0 16 0V8"/><path d="M9 8V5a3 3 0 0 1 6 0v3"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chamada: '<path d="M4 12.5 9 17.5 20 6.5"/>',
  megafone: '<path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1Z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  alunos: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3.2 3.2 0 0 1 0 5"/><path d="M17.5 20a6 6 0 0 0-3-5.2"/>',
  luva: '<path d="M6 10V6.5a2.5 2.5 0 0 1 5 0V10"/><path d="M11 10V5.5a2.5 2.5 0 0 1 5 0V10"/><path d="M16 8.5a2.5 2.5 0 0 1 4 0V13a7 7 0 0 1-7 7H10a6 6 0 0 1-6-6v-3.5a2 2 0 0 1 2-2"/>',
  cartao: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/>',
  dinheiro: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M14.5 9.5a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2s1.1 1.8 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2a2.7 2.7 0 0 1-2.5-1.5"/>',
  engrenagem: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.4 15a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7 2 2 0 1 1 0 4Z"/>',
  chave: '<circle cx="8" cy="14" r="4"/><path d="M11 11 20 2l2 2-2 2 2 2-3 3-2-2-2 2"/>',
  sair: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h10"/>',
  busca: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lua: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
  aluno: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M7 10.5V15c0 1.7 2.2 3 5 3s5-1.3 5-3v-4.5"/>',
  estrela: '<path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.6Z"/>',
  medalha: '<circle cx="12" cy="15" r="6"/><path d="m8.5 9.5-3-6.5h5l2 4"/><path d="m15.5 9.5 3-6.5h-5l-2 4"/><path d="m12 12.5.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9 14.7l2-.3.9-1.9Z"/>',
  zap: '<path d="M20 12a8 8 0 0 1-11.9 7L4 20l1.1-4A8 8 0 1 1 20 12Z"/>',
};

/** Devolve um SVG pronto para colocar no DOM. */
export function icone(nome, tamanho = 18) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', tamanho);
  svg.setAttribute('height', tamanho);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = CAMINHOS[nome] || CAMINHOS.painel;
  return svg;
}
