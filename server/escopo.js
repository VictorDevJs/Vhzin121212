import { todos, um } from './db.js';

/**
 * Escopo de modalidade.
 *
 * A academia é dividida por arte marcial: quem treina Jiu-Jitsu não tem
 * nada a ver com o campeonato de Karatê. Este módulo responde a uma única
 * pergunta — "quais modalidades esta pessoa enxerga?" — e as rotas usam a
 * resposta para cortar o que não é dela.
 *
 * Devolve null quando não há limite (dono e recepção veem a academia toda).
 */
export function modalidadesEmEscopo(usuario) {
  if (!usuario) return [];
  if (usuario.papel === 'dono' || usuario.papel === 'recepcao') return null;

  if (usuario.papel === 'aluno') {
    const aluno = um('SELECT id FROM alunos WHERE usuario_id = :id', { id: usuario.id });
    if (!aluno) return [];
    return todos(`
      SELECT DISTINCT t.modalidade_id AS id
      FROM aluno_turmas at JOIN turmas t ON t.id = at.turma_id
      WHERE at.aluno_id = :aluno AND t.modalidade_id IS NOT NULL
    `, { aluno: aluno.id }).map((m) => m.id);
  }

  // Mestre e responsável de competições: as artes que ensinam somadas às
  // que constam no cadastro dele.
  return todos(`
    SELECT DISTINCT v.modalidade_id AS id FROM (
      SELECT modalidade_id FROM usuario_modalidades WHERE usuario_id = :id
      UNION
      SELECT modalidade_id FROM turmas WHERE mestre_id = :id AND ativo = 1
    ) v WHERE v.modalidade_id IS NOT NULL
  `, { id: usuario.id }).map((m) => m.id);
}

/**
 * Monta o recorte SQL do escopo para uma coluna de modalidade.
 * `incluirGerais` deixa passar as linhas sem modalidade — um campeonato
 * aberto ou um plano livre valem para a academia inteira.
 */
export function recorteDeModalidade(usuario, coluna, { incluirGerais = true } = {}) {
  const escopo = modalidadesEmEscopo(usuario);
  if (escopo === null) return null;
  const lista = escopo.length ? escopo.join(',') : '-1';
  return incluirGerais
    ? `(${coluna} IN (${lista}) OR ${coluna} IS NULL)`
    : `${coluna} IN (${lista})`;
}

/** As modalidades da pessoa, já com nome e cor, para as abas das telas. */
export function modalidadesVisiveis(usuario) {
  const escopo = modalidadesEmEscopo(usuario);
  if (escopo === null) {
    return todos(`SELECT id, nome, cor, sigla FROM modalidades WHERE ativo = 1 ORDER BY ordem, nome`);
  }
  if (!escopo.length) return [];
  return todos(`
    SELECT id, nome, cor, sigla FROM modalidades
    WHERE ativo = 1 AND id IN (${escopo.join(',')}) ORDER BY ordem, nome
  `);
}

/** Quem não é dono nem recepção não pode espiar modalidade que não é dele. */
export function podeVerModalidade(usuario, modalidadeId) {
  const escopo = modalidadesEmEscopo(usuario);
  if (escopo === null) return true;
  if (modalidadeId === null || modalidadeId === undefined) return true;
  return escopo.includes(Number(modalidadeId));
}
