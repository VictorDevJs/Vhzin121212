import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { um, todos, executar } from './db.js';

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
      'SELECT id, nome, email, papel, telefone, foto, apelido, ativo FROM usuarios WHERE id = :id',
      { id: dados.id },
    );
    if (usuario && usuario.ativo) {
      usuario.cargos = cargosDe(usuario.id);
      req.usuario = usuario;
    }
  }
  proximo();
}

/** Exige um usuario autenticado. */
export function exigirLogin(req, res, proximo) {
  if (!req.usuario) return res.status(401).json({ erro: 'Faça login para continuar.' });
  proximo();
}

/** Exige que o usuario tenha um dos papeis informados. */
export function exigirPapel(...papeis) {
  return (req, res, proximo) => {
    if (!req.usuario) return res.status(401).json({ erro: 'Faça login para continuar.' });
    if (!papeis.includes(req.usuario.papel)) {
      return res.status(403).json({ erro: 'Você não tem permissão para esta ação.' });
    }
    proximo();
  };
}

/** Papeis com acesso administrativo ao sistema. */
export const EQUIPE = ['dono', 'mestre', 'recepcao', 'competicoes'];
export const GESTAO = ['dono', 'recepcao'];

/**
 * Cargos sao responsabilidades extras. Um mestre pode acumular o cargo de
 * responsavel de competicoes sem deixar de ser mestre, e o cargo pode valer
 * so para uma modalidade.
 */
export const CARGOS = [
  { valor: 'competicoes', rotulo: 'Responsável de Competições',
    descricao: 'Cria competições, inscreve atletas, monta equipes e lança resultados.' },
  { valor: 'graduacao', rotulo: 'Responsável de Graduação',
    descricao: 'Conduz exames de faixa, registra graduações e emite certificados.' },
  { valor: 'financeiro', rotulo: 'Responsável Financeiro',
    descricao: 'Acompanha mensalidades, lançamentos e o caixa da academia.' },
  { valor: 'kids', rotulo: 'Coordenador Kids',
    descricao: 'Cuida das turmas infantis, dos responsáveis e dos avisos kids.' },
  { valor: 'loja', rotulo: 'Responsável da Loja',
    descricao: 'Cadastra produtos, controla estoque e registra as vendas.' },
  { valor: 'marketing', rotulo: 'Comunicação e Marketing',
    descricao: 'Publica avisos, cuida das fotos e do que aparece na página pública.' },
];

export function cargosDe(usuarioId) {
  return todos(`
    SELECT c.cargo, c.modalidade_id, m.nome AS modalidade
    FROM usuario_cargos c
    LEFT JOIN modalidades m ON m.id = c.modalidade_id
    WHERE c.usuario_id = :id
  `, { id: usuarioId });
}

/** O dono enxerga tudo; os demais dependem do papel ou de um cargo atribuido. */
export function temCargo(usuario, cargo, modalidadeId = null) {
  if (!usuario) return false;
  if (usuario.papel === 'dono') return true;
  if (cargo === 'competicoes' && usuario.papel === 'competicoes') return true;
  return (usuario.cargos || []).some((item) => item.cargo === cargo
    && (item.modalidade_id === null || modalidadeId === null || item.modalidade_id === modalidadeId));
}

/** Exige um cargo (ou o papel de dono) para seguir adiante. */
export function exigirCargo(cargo) {
  return (req, res, proximo) => {
    if (!req.usuario) return res.status(401).json({ erro: 'Faça login para continuar.' });
    if (!temCargo(req.usuario, cargo)) {
      return res.status(403).json({
        erro: 'Esta área é do responsável designado. Peça ao dono da academia para liberar o cargo.',
      });
    }
    proximo();
  };
}

/**
 * Guarda no historico quem mexeu em cada parte do sistema. Nunca derruba a
 * requisicao: registrar e importante, mas nao pode travar o atendimento.
 */
export function registrar(req, { acao, area, alvo = null, alvoId = null, detalhe = null }) {
  try {
    executar(`
      INSERT INTO auditoria (usuario_id, usuario_nome, papel, acao, area, alvo, alvo_id, detalhe)
      VALUES (:usuario_id, :usuario_nome, :papel, :acao, :area, :alvo, :alvo_id, :detalhe)
    `, {
      usuario_id: req.usuario?.id ?? null,
      usuario_nome: req.usuario?.nome ?? 'visitante',
      papel: req.usuario?.papel ?? 'publico',
      acao, area, alvo, alvo_id: alvoId, detalhe,
    });
  } catch { /* o historico nunca pode atrapalhar a operacao */ }
}
