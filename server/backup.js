import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { abrirBanco, conexao } from './db.js';

/**
 * Backup do banco.
 *
 * Copiar o arquivo .db com o sistema ligado não serve: o SQLite roda em modo
 * WAL, então parte do que foi gravado ainda está no arquivo -wal e a cópia
 * sai incompleta. Você só descobre no dia em que precisa dela.
 *
 * VACUUM INTO grava um banco completo e consistente, mesmo com o sistema
 * em uso, e ainda sai menor por não levar espaço morto junto.
 */
export function fazerBackup(pasta = process.env.BACKUP_PASTA || './dados/backups') {
  abrirBanco();
  const destino = resolve(pasta);
  mkdirSync(destino, { recursive: true });

  const carimbo = new Date().toLocaleString('sv-SE').replace(/[: ]/g, '-');
  const arquivo = join(destino, `academia-${carimbo}.db`);

  // VACUUM INTO não aceita parâmetro ligado, então o caminho vai no texto.
  // Aspas simples dobradas é como o SQLite escapa aspas dentro de string.
  conexao().exec(`VACUUM INTO '${arquivo.replace(/'/g, "''")}'`);
  return arquivo;
}

const executadoDireto = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (executadoDireto) {
  try {
    const arquivo = fazerBackup(process.argv[2]);
    console.log(`Backup gravado em ${arquivo}`);
    console.log('Guarde também o arquivo dados/chave-de-sessao, se existir.');
  } catch (erro) {
    console.error(`Não consegui fazer o backup: ${erro.message}`);
    process.exit(1);
  }
}
