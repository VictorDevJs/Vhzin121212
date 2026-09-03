import { Router } from 'express';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve, join, basename } from 'node:path';
import { um } from '../db.js';
import { exigirPapel, temCargo } from '../auth.js';
import { rota, ErroApi, texto } from '../util.js';

const roteador = Router();

export const PASTA_ARQUIVOS = resolve(process.env.ARQUIVOS_PASTA || './dados/arquivos');

const TIPOS_ACEITOS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const LIMITE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Recebe o arquivo como data URL (base64) e grava no disco.
 * Evita dependencia de upload multipart e mantem o servidor sem bibliotecas extras.
 */
roteador.post('/', exigirPapel('dono', 'recepcao', 'mestre', 'competicoes'), rota((req, res) => {
  // Quem publica foto precisa conseguir enviar o arquivo: gestão, mestres e
  // quem recebeu o cargo de comunicação.
  const podeEnviar = ['dono', 'recepcao', 'mestre'].includes(req.usuario.papel)
    || temCargo(req.usuario, 'marketing');
  if (!podeEnviar) throw new ErroApi('Você não tem permissão para enviar arquivos.', 403);

  const conteudo = texto(req.body?.conteudo);
  if (!conteudo) throw new ErroApi('Envie o arquivo no campo "conteudo".');

  const partes = /^data:([\w/+.-]+);base64,(.+)$/s.exec(conteudo);
  if (!partes) throw new ErroApi('Formato de arquivo inválido.');

  const [, tipo, base64] = partes;
  const extensao = TIPOS_ACEITOS[tipo];
  if (!extensao) throw new ErroApi('Aceitamos apenas imagem (PNG, JPG, WEBP) ou PDF.');

  const dados = Buffer.from(base64, 'base64');
  if (dados.length > LIMITE_BYTES) throw new ErroApi('O arquivo passa de 5 MB. Reduza e tente de novo.');

  mkdirSync(PASTA_ARQUIVOS, { recursive: true });
  const nome = `${randomUUID()}.${extensao}`;
  writeFileSync(join(PASTA_ARQUIVOS, nome), dados);

  res.status(201).json({ url: `/arquivos/${nome}`, tamanho: dados.length, tipo });
}));

/* --------------------------------------------------- limpeza de arquivos */

/** Toda coluna do banco que pode apontar para um arquivo enviado. */
const REFERENCIAS = [
  ['configuracoes', 'valor'],
  ['fotos', 'arquivo'],
  ['certificados', 'arquivo'],
  ['modalidades', 'imagem'],
  ['usuarios', 'foto'],
  ['produtos', 'imagem'],
  ['equipes', 'imagem'],
  ['competicoes', 'cartaz'],
];

/** O arquivo ainda é usado por alguma parte do sistema? */
export function arquivoEmUso(url) {
  return REFERENCIAS.some(([tabela, coluna]) => {
    try {
      return !!um(`SELECT 1 AS usado FROM ${tabela} WHERE ${coluna} = :url LIMIT 1`, { url });
    } catch {
      return true; // na dúvida, o arquivo fica
    }
  });
}

/**
 * Apaga o arquivo do disco quando nada mais aponta para ele.
 * Sem isso, cada foto trocada deixaria lixo para sempre na pasta.
 */
export function apagarArquivoOrfao(url) {
  const caminho = texto(url);
  if (!caminho || !caminho.startsWith('/arquivos/')) return false;

  // Só apaga um nome de arquivo simples dentro da pasta de uploads.
  const nome = basename(caminho);
  if (nome !== caminho.slice('/arquivos/'.length) || !/^[\w.-]+$/.test(nome)) return false;
  if (arquivoEmUso(caminho)) return false;

  try {
    rmSync(join(PASTA_ARQUIVOS, nome), { force: true });
    return true;
  } catch {
    return false; // arquivo já sumiu ou está em uso pelo sistema de arquivos
  }
}

export default roteador;
