import { Router } from 'express';
import { todos, um } from '../db.js';
import { exigirPapel } from '../auth.js';
import { rota, texto, inteiro } from '../util.js';

const roteador = Router();

/**
 * Registro de atividades e painel de segurança. Só o dono entra aqui:
 * é onde fica a trilha de quem mexeu em cada parte do sistema.
 */
roteador.get('/', exigirPapel('dono'), rota((req, res) => {
  const filtros = [];
  const params = { limite: Math.min(inteiro(req.query.limite, 120), 500) };
  if (texto(req.query.area)) { filtros.push('area = :area'); params.area = texto(req.query.area); }
  if (inteiro(req.query.usuario_id)) {
    filtros.push('usuario_id = :usuario_id');
    params.usuario_id = inteiro(req.query.usuario_id);
  }
  const onde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  res.json(todos(`SELECT * FROM auditoria ${onde} ORDER BY id DESC LIMIT :limite`, params));
}));

roteador.get('/resumo', exigirPapel('dono'), rota((_req, res) => {
  const porArea = todos(`
    SELECT area, COUNT(*) AS total FROM auditoria
    WHERE criado_em >= datetime('now','localtime','-30 day')
    GROUP BY area ORDER BY total DESC
  `);
  const porPessoa = todos(`
    SELECT usuario_nome, papel, COUNT(*) AS total, MAX(criado_em) AS ultima
    FROM auditoria
    WHERE criado_em >= datetime('now','localtime','-30 day')
    GROUP BY usuario_id ORDER BY total DESC LIMIT 12
  `);
  const acessos = todos(`
    SELECT id, nome, email, papel, ativo, ultimo_acesso, criado_em
    FROM usuarios WHERE papel != 'aluno' ORDER BY papel, nome
  `);
  for (const acesso of acessos) {
    acesso.cargos = todos(`
      SELECT c.cargo, m.nome AS modalidade FROM usuario_cargos c
      LEFT JOIN modalidades m ON m.id = c.modalidade_id WHERE c.usuario_id = :id
    `, { id: acesso.id });
  }

  const contas = um(`
    SELECT
      (SELECT COUNT(*) FROM usuarios WHERE papel != 'aluno' AND ativo = 1) AS equipe_ativa,
      (SELECT COUNT(*) FROM usuarios WHERE papel = 'aluno' AND ativo = 1) AS alunos_com_acesso,
      (SELECT COUNT(*) FROM usuarios WHERE ativo = 0) AS bloqueados,
      (SELECT COUNT(*) FROM usuarios WHERE ultimo_acesso IS NULL) AS nunca_entraram,
      (SELECT COUNT(*) FROM auditoria WHERE criado_em >= datetime('now','localtime','-7 day')) AS acoes_semana
  `);

  res.json({ por_area: porArea, por_pessoa: porPessoa, acessos, contas });
}));

export default roteador;
