/** Utilidades compartilhadas pelas rotas. */

/** Envolve handlers async para que erros caiam no middleware de erro do Express. */
export function rota(handler) {
  return (req, res, proximo) => Promise.resolve(handler(req, res, proximo)).catch(proximo);
}

export class ErroApi extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

export function exigirCampos(corpo, campos) {
  const faltando = campos.filter((campo) => {
    const valor = corpo?.[campo];
    return valor === undefined || valor === null || String(valor).trim() === '';
  });
  if (faltando.length) {
    throw new ErroApi(`Campos obrigatórios: ${faltando.join(', ')}.`);
  }
}

export function texto(valor, padrao = null) {
  if (valor === undefined || valor === null) return padrao;
  const limpo = String(valor).trim();
  return limpo === '' ? padrao : limpo;
}

export function numero(valor, padrao = 0) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

export function inteiro(valor, padrao = null) {
  const n = Number.parseInt(valor, 10);
  return Number.isInteger(n) ? n : padrao;
}

export function booleano(valor, padrao = 0) {
  if (valor === undefined || valor === null || valor === '') return padrao;
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  return ['1', 'true', 'sim', 'on'].includes(String(valor).toLowerCase()) ? 1 : 0;
}

export function hoje() {
  return new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso local
}

export function competenciaAtual() {
  return hoje().slice(0, 7); // AAAA-MM
}

/** Valida uma data no formato AAAA-MM-DD. */
export function data(valor, padrao = null) {
  const limpo = texto(valor);
  if (!limpo) return padrao;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpo)) throw new ErroApi(`Data inválida: ${limpo}. Use AAAA-MM-DD.`);
  return limpo;
}

/** Valida hora no formato HH:MM. */
export function hora(valor) {
  const limpo = texto(valor);
  if (!limpo || !/^([01]\d|2[0-3]):[0-5]\d$/.test(limpo)) {
    throw new ErroApi(`Horário inválido: ${valor}. Use HH:MM.`);
  }
  return limpo;
}

export function emailValido(valor) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(valor || '').trim());
}

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Soma meses a uma data AAAA-MM-DD. */
export function somarMeses(dataISO, meses) {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  const d = new Date(ano, mes - 1 + meses, dia);
  return d.toLocaleDateString('sv-SE');
}

export const MESES_POR_PERIODICIDADE = {
  mensal: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};
