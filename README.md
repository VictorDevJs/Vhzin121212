# 🥋 CT ATAK PECHINCHA · Sistema de Gestão

Sistema completo para administrar o Centro de Treinamento Atak — Pechincha, Rio de Janeiro: **cadastro de alunos, planos, turmas, horários,
avisos, chamada e controle financeiro**, com áreas separadas para o **dono**, os **mestres**,
a **recepção** e os **alunos**.

Roda com **Node.js + SQLite** — sem banco de dados externo, sem build, sem dependência de front-end.

### O front-end

- **Tema claro e escuro** — segue o sistema do usuário e pode ser trocado no botão do topo.
- **Busca por comando (Ctrl/⌘ + K)** — vai para qualquer tela ou ação sem tirar a mão do teclado.
- **Gráficos em SVG puro** (sem bibliotecas): barras, rosca, linha e sparklines, com leitura no
  hover, no teclado e botão "ver tabela" — a paleta foi validada para daltonismo nos dois temas.
- **Aplicativo instalável (PWA)** — dá para "adicionar à tela de início" no celular da recepção
  ou dos mestres; a interface abre mesmo com internet ruim.
- **Feito para celular** — barra de navegação inferior, menu deslizante e tabelas com rolagem.
- **Acessibilidade** — navegação por teclado, foco visível, `prefers-reduced-motion` respeitado e
  identidade nunca dependendo só da cor.

---

## O que o sistema faz

### Página pública (sem login)
Vitrine da Atak com as modalidades, a **grade completa de horários** (filtrável por modalidade),
os planos e os avisos liberados para o site. É por ali que o aluno também **cria a própria conta**.

### Área de login com 4 perfis

| Perfil | O que enxerga e faz |
|---|---|
| **Dono** | Tudo. Cadastra modalidades, faixas, turmas, horários, planos, equipe, avisos, alunos, e vê o financeiro completo (receitas, despesas, saldo, inadimplência). |
| **Mestre** | Painel com as turmas dele, chamada, faixas/graduações dos alunos, avisos e a grade de horários. Edita as turmas em que é o responsável. |
| **Recepção** | Cadastro e matrícula de alunos, planos, mensalidades e recebimentos, avisos e chamada. Não vê despesas nem o resultado consolidado. |
| **Aluno** | "Minha área": plano, mensalidades, horários das turmas dele, frequência, graduações e os avisos direcionados a ele. |

### Módulos

- **Alunos** — cadastro completo (dados, responsável para os kids, observações), situação
  (pendente / ativo / trancado / inativo), ficha com histórico de turmas, graduações,
  mensalidades e presenças.
- **Cadastro aberto** — o aluno se cadastra sozinho pela página inicial e entra como *pendente*;
  a recepção confirma a matrícula e libera o plano.
- **Modalidades e faixas** — Jiu-Jitsu, Muay Thai, Karatê, Kickboxing e MMA já vêm cadastrados
  com as respectivas faixas, e o dono pode criar quantas modalidades quiser (Boxe, Judô, Capoeira...).
- **Turmas e horários** — cada turma tem modalidade, categoria (kids / adulto / misto / feminino),
  nível, mestre responsável, capacidade, local e vários horários na semana.
- **Grade de horários** — visão semanal completa, com filtro por modalidade e categoria.
- **Planos** — valor, periodicidade (mensal, trimestral, semestral, anual), aulas por semana e
  quais modalidades estão incluídas.
- **Matrículas** — vincula aluno + plano, ativa o cadastro, define o dia de vencimento e já
  gera a primeira mensalidade.
- **Financeiro** — mensalidades (geração mensal em um clique, recebimento, cancelamento),
  entradas e saídas por categoria, inadimplência, saldo do mês e evolução dos últimos meses.
  Todo pagamento de mensalidade vira automaticamente uma receita no caixa.
- **Avisos** — campeonatos, eventos, exames de faixa, cancelamento de aula e recados gerais,
  com público-alvo (todos, kids, adultos, uma modalidade, uma turma ou só a equipe) e opção de
  publicar também na página pública.
- **Chamada** — lista de presença por turma e por data, com resumo de frequência do mês e
  **ranking dos alunos mais presentes**.
- **Mensalidades por arte marcial** — quanto cada modalidade e cada turma faturou, recebeu e tem
  em aberto no mês. Quem treina duas artes tem a mensalidade **rateada entre elas**, então a soma
  das linhas fecha exatamente com o total do mês (nada é contado duas vezes).
- **Avaliações com estrelas e comentários** — alunos e visitantes do site avaliam de 1 a 5
  estrelas; tudo entra numa **fila de aprovação**, a academia responde publicamente e só o que
  for aprovado aparece no site. A página pública mostra a média e a distribuição das notas.
- **Certificados e titulações** — área do dono para publicar faixas pretas, titulações dos
  mestres, registros em federação, cursos e premiações, com **upload da foto ou do PDF** do
  diploma (até 5 MB). O que estiver marcado como público aparece no site, para qualquer pessoa
  conferir a formação da equipe.
- **Cobrança por WhatsApp** — na lista de alunos e nas mensalidades atrasadas, um botão abre a
  conversa com o aluno já com a mensagem de cobrança escrita.
- **Aniversariantes do mês** no painel, com link direto para mandar os parabéns.

---

## Como rodar

Requisitos: **Node.js 22.5 ou superior** (o SQLite já vem embutido no Node).

```bash
npm install          # instala o Express (única dependência)
npm start            # sobe o servidor em http://localhost:3000
```

Na primeira execução o sistema cria o banco em `dados/academia.db` já com as 5 modalidades,
as faixas, os planos de exemplo, as turmas com horários e o usuário do dono.

**Login inicial do dono:**

```
e-mail: dono@atak.com
senha:  admin123
```

> Troque essa senha no primeiro acesso (menu lateral → *Trocar senha*), ou defina
> `DONO_EMAIL` / `DONO_SENHA` antes de subir o sistema pela primeira vez.

### Dados de demonstração (opcional)

Para navegar com a academia "cheia" (alunos, mestres, mensalidades pagas e em aberto,
despesas e avisos):

```bash
npm run seed -- --demo
```

Logins criados pela demonstração:

| Perfil | E-mail | Senha |
|---|---|---|
| Mestre | `ricardo@atak.com` | `mestre123` |
| Recepção | `recepcao@atak.com` | `recepcao123` |
| Aluno | `lucas0@email.com` | `aluno123` |

A demonstração já vem com 24 alunos, 6 meses de mensalidades, avaliações (aprovadas e na fila)
e certificados publicados.

### Outros comandos

```bash
npm run dev    # sobe com recarregamento automático ao salvar arquivos
npm test       # testes automatizados da API (20 casos)
```

### Configuração

Copie `.env.example` para `.env` (ou exporte as variáveis no ambiente):

| Variável | Para que serve | Padrão |
|---|---|---|
| `PORT` | Porta do servidor | `3000` |
| `APP_SEGREDO` | Chave que assina os tokens de sessão — **troque em produção** | valor de desenvolvimento |
| `DB_ARQUIVO` | Caminho do banco SQLite | `./dados/academia.db` |
| `DONO_EMAIL` / `DONO_SENHA` / `DONO_NOME` | Primeiro usuário dono criado automaticamente | `dono@atak.com` / `admin123` |

**Backup:** todo o sistema vive no arquivo `dados/academia.db`. Copiar esse arquivo é o backup completo.

---

## Identidade visual da Atak

Tudo o que é marca fica em **dois lugares**:

| O quê | Onde |
|---|---|
| Logo horizontal | `public/marca/logo.svg` (aparece no topo do site e do sistema) |
| Símbolo quadrado | `public/marca/simbolo.svg` (ícone do app, favicon, avatar) |
| Cores da marca | `public/css/tema.css` → `--marca-1` (amarelo), `--marca-2` (laranja), `--marca-3` (vermelho) |
| Nome, frase, contato e cor principal | dentro do sistema, em **Equipe e academia → Identidade visual** |

Trocar a cor principal pelo sistema muda a interface inteira na hora (botões, menu, destaques) e
vale para todo mundo. As **cores dos gráficos são independentes da marca** de propósito: elas
seguem uma paleta validada para daltonismo, então continuam legíveis mesmo se a cor da academia
for vermelha, azul ou verde.

Os arquivos de marca que estão aqui são uma **reprodução aproximada** do brasão da Atak
(preto + amarelo, com as modalidades no anel). Substitua pelos arquivos oficiais quando tiver a
arte em alta — é só sobrescrever os dois SVG mantendo os nomes. Se preferir outro nome de arquivo,
aponte o caminho novo em `public/js/marca.js`; se um deles não existir, o sistema mostra o nome da
academia em texto.

> As fontes (Inter e Barlow Condensed) vêm do Google Fonts. Se a academia tiver internet instável,
> baixe os arquivos das fontes para `public/` e troque o `<link>` do `public/index.html` — o
> sistema já funciona normalmente com a fonte do próprio aparelho como reserva.

---

## Estrutura do projeto

```
server/
  index.js              servidor Express e registro das rotas
  db.js                 conexão SQLite e criação das tabelas
  auth.js               senha (scrypt), token de sessão e controle de permissão
  util.js               validações e formatos compartilhados
  seed.js               dados iniciais e carga de demonstração
  rotas/                uma rota por assunto (alunos, turmas, financeiro, avisos...)
public/
  index.html            casca da aplicação
  manifest.webmanifest  dados do app instalável
  sw.js                 cache da interface (funciona com internet ruim)
  marca/                logo, símbolo e instruções da marca
  css/tema.css          TOKENS: cores da marca, tema claro/escuro, paleta dos gráficos
  css/estilo.css        componentes visuais
  js/app.js             menu, rotas, permissões, busca por comando
  js/api.js             cliente da API e sessão
  js/ui.js              componentes (tabelas, modais, formulários, indicadores)
  js/graficos.js        gráficos em SVG (barras, rosca, linha, sparkline)
  js/icones.js          ícones em SVG
  js/marca.js           logo, nome e cor da academia
  js/tema.js            tema claro/escuro
  js/paginas/           uma tela por arquivo
testes/api.test.js      testes da API
```

## API

Todas as rotas ficam sob `/api` e usam `Authorization: Bearer <token>`, exceto as públicas.

| Rota | Descrição |
|---|---|
| `POST /api/auth/registrar` · `POST /api/auth/login` | cadastro do aluno e login (públicas) |
| `GET /api/publico/academia` | dados da vitrine: modalidades, grade, planos e avisos (pública) |
| `GET /api/painel` | números do painel conforme o perfil |
| `/api/alunos` | CRUD de alunos, ficha, graduações |
| `/api/modalidades` | modalidades e suas faixas |
| `/api/turmas` | turmas, horários, alunos da turma e `GET /api/turmas/grade` |
| `/api/planos` · `/api/matriculas` | planos e matrículas |
| `/api/financeiro` | mensalidades, lançamentos e `GET /api/financeiro/resumo` |
| `/api/avisos` | mural de avisos (filtrado pelo público-alvo de cada aluno) |
| `/api/presencas` | chamada, resumo de frequência e `GET /api/presencas/ranking` |
| `/api/avaliacoes` | moderação, resposta e envio de avaliações |
| `POST /api/publico/avaliacoes` | avaliação enviada por quem visita o site (pública) |
| `/api/certificados` | certificados e titulações |
| `POST /api/arquivos` | upload do PDF/imagem do certificado (só o dono) |
| `GET /api/financeiro/por-modalidade` | mensalidades divididas por arte marcial e por turma |
| `/api/usuarios` · `/api/configuracoes` | equipe e dados institucionais (dono) |
| `GET /api/minha-area` | tudo o que o aluno logado precisa ver |

---

## Segurança

- Senhas guardadas com **scrypt** + sal aleatório (nunca em texto puro).
- Sessão por **token assinado com HMAC-SHA256**, com validade de 7 dias.
- Permissão verificada **no servidor** em cada rota — esconder um botão no navegador não libera acesso.
- A interface monta todo conteúdo com `textContent`, sem `innerHTML`, evitando injeção de script
  através de dados cadastrados.

## Como adaptar para a sua academia

1. Entre como dono → **Equipe e academia** → preencha nome, telefone, endereço, Instagram e o texto
   "sobre" (aparecem na página pública).
2. **Turmas e modalidades** → ajuste as modalidades, as faixas de cada arte e crie as turmas com
   os horários reais.
3. **Planos** → cadastre os planos e valores que você vende.
4. **Equipe e academia** → crie os acessos dos mestres e da recepção.
5. **Alunos** → cadastre (ou aprove quem se cadastrou sozinho) e matricule em um plano.
6. Todo dia 1º, use **Financeiro → Gerar mensalidades** para criar as cobranças do mês.
7. **Certificados** → publique as faixas pretas e as titulações dos mestres (isso aparece no site
   e passa confiança para quem está pesquisando a academia).
8. **Avaliações** → aprove e responda o que os alunos escreveram; peça avaliação para os alunos
   antigos, é o que mais converte visitante em matrícula.

## Dados da unidade já cadastrados

- **CT Atak Pechincha** — Centro de Treinamento de Lutas
- Rua Coronel Francisco Lobo, 145 — Pechincha, Rio de Janeiro/RJ, 22740-350
- WhatsApp: (21) 97024-0245
- Mais de 15 anos de história (o ano de fundação fica em Equipe e academia e alimenta o contador
  do site automaticamente)
