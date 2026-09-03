import { Router } from 'express';
import { todos } from '../db.js';
import { exigirPapel, EQUIPE } from '../auth.js';
import { rota, ErroApi, texto } from '../util.js';
import { REGRAS } from '../regras-federacoes.js';
import { CATEGORIAS_PESO } from '../graduacoes-padrao.js';
import { modalidadesEmEscopo } from '../escopo.js';

const roteador = Router();

/**
 * Regras de competição. Segue o mesmo recorte do resto do sistema:
 * o aluno consulta as regras da arte que ele treina.
 */
roteador.get('/', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  const escopo = modalidadesEmEscopo(req.usuario);
  const cadastradas = todos('SELECT id, nome, cor, sigla FROM modalidades WHERE ativo = 1 ORDER BY ordem, nome')
    .filter((m) => escopo === null || escopo.includes(m.id));

  res.json(cadastradas
    .filter((m) => REGRAS[m.nome])
    .map((m) => ({
      modalidade_id: m.id,
      modalidade: m.nome,
      cor: m.cor,
      federacao: REGRAS[m.nome].federacao,
      resumo: REGRAS[m.nome].resumo,
    })));
}));

roteador.get('/:modalidade', exigirPapel(...EQUIPE, 'aluno'), rota((req, res) => {
  // Aceita tanto o nome ("Jiu-Jitsu") quanto o id da modalidade.
  const chave = texto(req.params.modalidade);
  const linha = todos(
    'SELECT id, nome, cor FROM modalidades WHERE nome = :chave COLLATE NOCASE OR id = :id',
    { chave, id: Number(chave) || 0 },
  )[0];
  if (!linha) throw new ErroApi('Modalidade não encontrada.', 404);

  // A permissão vem antes da existência do regulamento: ninguém descobre o que
  // tem em outra arte pela diferença entre um 404 e um 403.
  const escopo = modalidadesEmEscopo(req.usuario);
  if (escopo !== null && !escopo.includes(linha.id)) {
    throw new ErroApi('Estas são as regras de uma modalidade que você não treina.', 403);
  }
  if (!REGRAS[linha.nome]) throw new ErroApi('Não há regulamento cadastrado para esta modalidade.', 404);

  res.json({
    modalidade_id: linha.id,
    modalidade: linha.nome,
    cor: linha.cor,
    ...REGRAS[linha.nome],
    categorias_peso: CATEGORIAS_PESO[linha.nome] || [],
  });
}));

export default roteador;
