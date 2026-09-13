import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * A chave que assina as sessões.
 *
 * Antes existia um valor padrão escrito no código. Quem tivesse o código
 * conseguia fabricar um token de dono e entrar como ele. Agora:
 *
 * 1. Se APP_SEGREDO estiver definida, é ela que vale.
 * 2. Se não, o sistema gera uma chave aleatória na primeira vez e guarda
 *    em disco, ao lado do banco. Cada instalação passa a ter a sua.
 *
 * Gerar sozinho é melhor do que recusar a subir: quem instala numa academia
 * não deveria precisar entender variável de ambiente para o sistema ser
 * seguro. Mas a chave nunca é previsível.
 */

const ARQUIVO_PADRAO = process.env.APP_SEGREDO_ARQUIVO
  || resolve(dirname(process.env.DB_ARQUIVO || './dados/academia.db'), 'chave-de-sessao');

let emMemoria = null;

export function segredoDaInstalacao(arquivo = ARQUIVO_PADRAO) {
  if (process.env.APP_SEGREDO) return process.env.APP_SEGREDO;
  if (emMemoria) return emMemoria;

  // Banco em memória (testes) não tem onde guardar: chave só desta execução.
  if ((process.env.DB_ARQUIVO || '') === ':memory:') {
    emMemoria = randomBytes(48).toString('base64url');
    return emMemoria;
  }

  try {
    const salva = readFileSync(arquivo, 'utf8').trim();
    if (salva.length >= 32) {
      emMemoria = salva;
      return emMemoria;
    }
  } catch { /* primeira execução: ainda não existe */ }

  const nova = randomBytes(48).toString('base64url');
  try {
    mkdirSync(dirname(arquivo), { recursive: true });
    writeFileSync(arquivo, `${nova}\n`, { mode: 0o600 });
    chmodSync(arquivo, 0o600); // garante a permissão mesmo se o arquivo já existia
    console.log(`Chave de sessão criada em ${arquivo}. Guarde junto do backup: `
      + 'perder essa chave desconecta todo mundo (ninguém perde dados).');
  } catch (erro) {
    console.warn(`Não consegui gravar a chave de sessão em ${arquivo} (${erro.message}). `
      + 'Usando uma chave só desta execução: todo mundo será desconectado no próximo reinício. '
      + 'Defina APP_SEGREDO para resolver.');
  }
  emMemoria = nova;
  return emMemoria;
}
