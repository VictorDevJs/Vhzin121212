/**
 * Freio de força bruta no login.
 *
 * Sem isto dá para tentar senha infinitas vezes, e o e-mail do dono é o
 * primeiro que qualquer um chuta. A conta nunca fica travada de vez — a
 * espera cresce e depois zera sozinha, senão bastaria errar de propósito
 * para trancar o dono para fora da própria academia.
 */

const JANELA_MS = 15 * 60 * 1000; // as tentativas esquecem depois de 15 min
const LIVRES = 5;                 // erros antes de começar a esperar
const ESPERA_BASE_MS = 20 * 1000; // 20s, dobrando a cada erro seguinte
const ESPERA_MAXIMA_MS = 10 * 60 * 1000;

const registros = new Map();

function agora() { return Date.now(); }

function limpar() {
  const limite = agora() - JANELA_MS;
  for (const [chave, registro] of registros) {
    if (registro.ultima < limite) registros.delete(chave);
  }
}

/** Quem está tentando: e-mail somado ao endereço, para não travar por e-mail só. */
export function chaveDaTentativa(req, email) {
  const ip = req.ip || req.socket?.remoteAddress || 'desconhecido';
  return `${String(email || '').trim().toLowerCase()}|${ip}`;
}

/** Quanto falta esperar, em milissegundos. Zero quando pode tentar. */
export function esperaRestante(chave) {
  limpar();
  const registro = registros.get(chave);
  if (!registro || registro.erros <= LIVRES) return 0;

  const passos = registro.erros - LIVRES - 1;
  const espera = Math.min(ESPERA_BASE_MS * (2 ** passos), ESPERA_MAXIMA_MS);
  const restante = registro.ultima + espera - agora();
  return restante > 0 ? restante : 0;
}

export function registrarErro(chave) {
  limpar();
  const registro = registros.get(chave) || { erros: 0, ultima: 0 };
  registro.erros += 1;
  registro.ultima = agora();
  registros.set(chave, registro);
  return registro.erros;
}

/** Acertou a senha: o contador daquela pessoa zera. */
export function limparTentativas(chave) {
  registros.delete(chave);
}

/** Só para os testes, que precisam de um ponto de partida limpo. */
export function zerarTudo() {
  registros.clear();
}

export const LIMITES = { JANELA_MS, LIVRES, ESPERA_BASE_MS, ESPERA_MAXIMA_MS };
