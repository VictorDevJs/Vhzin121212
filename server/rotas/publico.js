import { Router } from 'express';
import { todos, um } from '../db.js';
import { rota, DIAS_SEMANA, ErroApi } from '../util.js';
import { registrarAvaliacao, resumoAvaliacoes } from './avaliacoes.js';

const roteador = Router();

/**
 * Vitrine da academia: informacoes abertas, sem login.
 * Mostra modalidades, grade de horarios, planos e avisos marcados para o site.
 */
roteador.get('/academia', rota((_req, res) => {
  const configuracoes = Object.fromEntries(
    todos('SELECT chave, valor FROM configuracoes').map((c) => [c.chave, c.valor]),
  );

  const modalidades = todos(`
    SELECT m.id, m.nome, m.descricao, m.cor,
           (SELECT COUNT(*) FROM turmas t WHERE t.modalidade_id = m.id AND t.ativo = 1) AS turmas
    FROM modalidades m WHERE m.ativo = 1 ORDER BY m.nome
  `);

  const grade = todos(`
    SELECT h.dia_semana, h.hora_inicio, h.hora_fim,
           t.nome AS turma, t.categoria, t.nivel, t.local,
           m.nome AS modalidade, m.cor AS modalidade_cor, u.nome AS mestre
    FROM horarios h
    JOIN turmas t ON t.id = h.turma_id
    JOIN modalidades m ON m.id = t.modalidade_id
    LEFT JOIN usuarios u ON u.id = t.mestre_id
    WHERE h.ativo = 1 AND t.ativo = 1 AND m.ativo = 1
    ORDER BY h.dia_semana, h.hora_inicio
  `);

  const planos = todos(`SELECT id, nome, descricao, valor, periodicidade, aulas_semana FROM planos WHERE ativo = 1 ORDER BY valor`);
  for (const plano of planos) {
    plano.modalidades = todos(`
      SELECT m.nome FROM plano_modalidades pm JOIN modalidades m ON m.id = pm.modalidade_id
      WHERE pm.plano_id = :id ORDER BY m.nome
    `, { id: plano.id }).map((m) => m.nome);
  }

  const avisos = todos(`
    SELECT id, titulo, mensagem, tipo, data_evento, local_evento, criado_em
    FROM avisos
    WHERE ativo = 1 AND publicar_site = 1 AND publico IN ('todos','kids','adultos')
    ORDER BY fixado DESC, criado_em DESC LIMIT 8
  `);

  const totalAlunos = um(`SELECT COUNT(*) AS total FROM alunos WHERE status = 'ativo'`);

  // Professores mostrados no site, com as titulacoes que o dono publicou.
  const mestres = todos(`
    SELECT u.id, u.nome,
           (SELECT COUNT(*) FROM turmas t WHERE t.mestre_id = u.id AND t.ativo = 1) AS turmas
    FROM usuarios u WHERE u.papel = 'mestre' AND u.ativo = 1 ORDER BY u.nome
  `);
  for (const mestre of mestres) {
    mestre.modalidades = todos(`
      SELECT DISTINCT m.nome FROM turmas t JOIN modalidades m ON m.id = t.modalidade_id
      WHERE t.mestre_id = :id AND t.ativo = 1 ORDER BY m.nome
    `, { id: mestre.id }).map((m) => m.nome);
    mestre.titulos = todos(`
      SELECT titulo, tipo, entidade, data_emissao FROM certificados
      WHERE usuario_id = :id AND publicar_site = 1 ORDER BY data_emissao DESC
    `, { id: mestre.id });
  }

  const certificados = todos(`
    SELECT c.id, c.titulo, c.tipo, c.pessoa_nome, c.entidade, c.registro, c.data_emissao,
           c.descricao, c.arquivo, m.nome AS modalidade, m.cor AS modalidade_cor
    FROM certificados c
    LEFT JOIN modalidades m ON m.id = c.modalidade_id
    WHERE c.publicar_site = 1
    ORDER BY c.data_emissao DESC, c.id DESC LIMIT 24
  `);

  const avaliacoes = todos(`
    SELECT av.id, av.autor_nome, av.nota, av.comentario, av.resposta, av.criado_em, m.nome AS modalidade
    FROM avaliacoes av
    LEFT JOIN modalidades m ON m.id = av.modalidade_id
    WHERE av.status = 'aprovada'
    ORDER BY av.criado_em DESC LIMIT 12
  `);

  const anoFundacao = Number(configuracoes.ano_fundacao) || null;
  const anosDeHistoria = anoFundacao ? new Date().getFullYear() - anoFundacao : null;

  res.json({
    academia: {
      nome: configuracoes.nome_academia || 'Atak',
      telefone: configuracoes.telefone || '',
      whatsapp: configuracoes.whatsapp || '',
      endereco: configuracoes.endereco || '',
      instagram: configuracoes.instagram || '',
      sobre: configuracoes.sobre || '',
      chamada: configuracoes.chamada || '',
      cor_primaria: configuracoes.cor_primaria || '',
      historia: configuracoes.historia || '',
      horario_funcionamento: configuracoes.horario_funcionamento || '',
      ano_fundacao: anoFundacao,
      anos_de_historia: anosDeHistoria,
    },
    dias: DIAS_SEMANA,
    modalidades,
    grade,
    planos,
    avisos,
    mestres,
    certificados,
    avaliacoes,
    resumo_avaliacoes: resumoAvaliacoes(),
    numeros: {
      alunos_ativos: totalAlunos.total,
      modalidades: modalidades.length,
      aulas_semana: grade.length,
      anos_de_historia: anosDeHistoria,
    },
  });
}));

/**
 * Avaliacao enviada por quem visita o site (sem login).
 * Entra como pendente: so aparece depois que a academia aprovar.
 */
roteador.post('/avaliacoes', rota((req, res) => {
  const comentario = String(req.body?.comentario || '');
  if (comentario.length > 1200) throw new ErroApi('Comentario longo demais.');
  const id = registrarAvaliacao(req.body || {}, { origem: 'site' });
  res.status(201).json({
    id,
    mensagem: 'Obrigado! Sua avaliacao foi enviada e aparece no site depois de aprovada.',
  });
}));

export default roteador;
