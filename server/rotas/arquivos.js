import { Router } from 'express';
import { writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { exigirPapel } from '../auth.js';
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
roteador.post('/', exigirPapel('dono'), rota((req, res) => {
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

export default roteador;
