import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { um } from './db.js';

const SEGREDO = process.env.APP_SEGREDO || 'academia-de-lutas-segredo-padrao-troque-em-producao';
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

/** Gera o hash da senha usando scrypt (sem dependencias externas). */
export function gerarHashSenha(senha) {
  const sal = randomBytes(16).toString('hex');
  const derivada = scryptSync(senha, sal, 64).toString('hex');
  return `scrypt$${sal}$${derivada}`;
}

export function conferirSenha(senha, hashArmazenado) {
  try {
    const [algoritmo, sal, esperado] = String(hashArmazenado).split('$');
    if (algoritmo !== 'scrypt' || !sal || !esperado) return false;
    const derivada = scryptSync(senha, sal, 64);
    const alvo = Buffer.from(esperado, 'hex');
    return derivada.length === alvo.length && timingSafeEqual(derivada, alvo);
  } catch {
    return false;
  }
}

function base64url(dado) {
  return Buffer.from(dado).toString('base64url');
}

function assinar(conteudo) {
  return createHmac('sha256', SEGREDO).update(conteudo).digest('base64url');
}

/** Token de sessao assinado (formato parecido com JWT, porem minimo). */
export function gerarToken(usuario) {
  const corpo = base64url(JSON.stringify({
    id: usuario.id,
    papel: usuario.papel,
    exp: Date.now() + VALIDADE_MS,
  }));
  return `${corpo}.${assinar(corpo)}`;
}

export function lerToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [corpo, assinatura] = token.split('.');
  const esperada = assinar(corpo);
  const a = Buffer.from(assinatura || '');
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    if (!dados.exp || dados.exp < Date.now()) return null;
    return dados;
  } catch {
    return null;
  }
}

/** Preenche req.usuario quando houver um token valido no cabecalho. */
export function autenticacaoOpcional(req, _res, proximo) {
  const cabecalho = req.headers.authorization || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null;
  const dados = lerToken(token);
  if (dados) {
    const usuario = um(
      'SELECT id, nome, email, papel, telefone, ativo FROM usuarios WHERE id = :id',
      { id: dados.id },
    );
    if (usuario && usuario.ativo) req.usuario = usuario;
  }
  proximo();
}

/** Exige um usuario autenticado. */
export function exigirLogin(req, res, proximo) {
  if (!req.usuario) return res.status(401).json({ erro: 'Faca login para continuar.' });
  proximo();
}

/** Exige que o usuario tenha um dos papeis informados. */
export function exigirPapel(...papeis) {
  return (req, res, proximo) => {
    if (!req.usuario) return res.status(401).json({ erro: 'Faca login para continuar.' });
    if (!papeis.includes(req.usuario.papel)) {
      return res.status(403).json({ erro: 'Você não tem permissao para esta ação.' });
    }
    proximo();
  };
}

/** Papeis com acesso administrativo ao sistema. */
export const EQUIPE = ['dono', 'mestre', 'recepcao'];
export const GESTAO = ['dono', 'recepcao'];
