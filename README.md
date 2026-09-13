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
- **Modalidades e faixas** — Jiu-Jitsu, Muay Thai, Karatê, Kickboxing, Boxe e MMA já vêm cadastrados
  com as respectivas faixas, e o dono pode criar quantas quiser (Judô, Capoeira, Wrestling...).
  Tudo é editável: nome, descrição, cor, foto, ordem no site e a **frase de destaque** que aparece
  no cartão (no lugar da contagem automática de turmas).
- **Turmas e horários** — cada turma tem modalidade, categoria (kids / adulto / misto / feminino),
  nível, mestre responsável, capacidade, local e vários horários na semana.
- **Grade de horários** — agenda semanal com eixo de horas, como uma agenda de verdade. O dono monta
  a grade ali mesmo: clica num espaço livre para criar a aula e num bloco para editar ou remover.
  Cada horário tem **rótulo próprio** — é assim que o Jiu-Jitsu tem No-Gi às 19h e Gi às 20h na
  mesma turma.
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
- **Check-in do treino** — na hora da aula o aluno abre o app e confirma presença com um toque.
  A janela abre 30 minutos antes e fecha 15 minutos depois do fim. Cada check-in entra no
  histórico do aluno (total de treinos, treinos do mês, sequência de semanas) e alimenta a
  chamada automaticamente. O dono acompanha, aula por aula, **quantos confirmaram de quantos
  matriculados**, a média por aula, o movimento dia a dia e quem mais treinou.
- **Loja** — kimonos, faixas, luvas, rashguards, camisas e casacos separados **por luta**
  (Jiu-Jitsu, Muay Thai, Karatê, Boxe, Kickboxing, MMA) e uma linha de acessórios que serve para
  todo mundo. Controle de estoque, foto do produto, vitrine na página pública e venda registrada
  em um clique — que já entra como receita no caixa e baixa o estoque.
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
npm run seed         # cria o banco e a conta do dono
npm start            # sobe o servidor em http://localhost:3000
```

O `npm run seed` mostra o e-mail e a senha do dono **uma única vez**. Anote.

### Como a academia nasce

O banco novo vem com o **mínimo que não faz sentido digitar à mão**:

| Vem pronto | Por quê |
|---|---|
| A conta do dono | É por onde tudo começa |
| As 9 artes marciais | Com a **escala completa de faixas** de cada uma: 105 graduações, da branca à preta, com tempo mínimo e faixa etária |
| Os dados da academia | Nome, endereço, telefone, WhatsApp, Instagram e horário de funcionamento |

E **nada além disso**. Sem aluno, sem plano, sem turma, sem horário, sem mensalidade.
Preço, grade e turmas são decisão de cada academia — o dono monta pelo sistema, em
*Planos*, *Turmas e modalidades* e *Horários*.

### A ordem para o dono preencher

1. **Equipe e academia** — confirma nome, endereço, contato, história e envia a logo e a foto de capa
2. **Turmas e modalidades** — apaga as artes que a academia não ensina e cria as turmas
3. **Horários** — monta a grade da semana clicando nos espaços vazios
4. **Planos** — cria os planos com os valores reais, um por modalidade
5. **Equipe** — cadastra os mestres e define quem ensina o quê
6. **Alunos** — cadastra os alunos e matricula cada um num plano
7. **Galeria** — sobe as fotos da academia

A partir daí a cobrança roda sozinha e o painel começa a mostrar o que precisa de atenção.

### Dados de demonstração (opcional, nunca em produção)

Para navegar com a academia "cheia" antes de usar de verdade:

```bash
npm run demo
```

Cria 36 alunos, 5 mestres, 18 turmas, 6 meses de mensalidades, competições e avaliações.
Logins: `ricardo@atak.com` / `mestre123` · `recepcao@atak.com` / `recepcao123` ·
`renata21@email.com` / `aluno123`.

> **Nunca rode isso no sistema da academia.** Use num banco separado
> (`DB_ARQUIVO=./dados/teste.db npm run demo`) ou apague o banco antes de valer.

### Outros comandos

```bash
npm run dev      # sobe com recarregamento automático ao salvar arquivos
npm test         # testes automatizados da API
npm run backup   # grava uma cópia consistente do banco em dados/backups/
```

---

## Colocar no ar

### 1. Variáveis

Copie `.env.example` para `.env`:

| Variável | Para que serve | Padrão |
|---|---|---|
| `PORT` | Porta do servidor | `3000` |
| `APP_SEGREDO` | Chave que assina as sessões | **gerada sozinha** na primeira execução, em `dados/chave-de-sessao` |
| `DB_ARQUIVO` | Caminho do banco SQLite | `./dados/academia.db` |
| `DONO_EMAIL` / `DONO_SENHA` / `DONO_NOME` | Primeiro usuário dono | e-mail `dono@atak.com`; **senha sorteada** e mostrada uma vez |
| `ATRAS_DE_PROXY` | `1` quando roda atrás de nginx/Caddy | `0` |
| `BACKUP_PASTA` | Onde o `npm run backup` grava | `./dados/backups` |

Não é obrigatório definir `APP_SEGREDO`: sem ela, o sistema sorteia uma chave na primeira
execução e guarda em `dados/chave-de-sessao` (permissão 600). Cada instalação tem a sua.
**Esse arquivo entra no backup** — perdê-lo desconecta todo mundo, mas não perde dado nenhum.

### 2. Onde hospedar

O sistema é um **servidor que fica ligado** e guarda tudo em arquivo: o banco
(`academia.db`) e os uploads (fotos, logo, certificados). Então ele precisa de duas
coisas do serviço de hospedagem:

- **Processo que não morre** entre uma visita e outra
- **Disco que sobrevive** a reinício e a novo deploy

> **Netlify, Vercel e GitHub Pages não servem.** Eles rodam funções sem estado, com disco
> temporário: a recepção cadastraria um aluno, a função morreria minutos depois e levaria o
> arquivo junto — sem erro na tela. Eles são feitos para site de conteúdo fixo ou que fala
> com um banco externo; aqui o sistema **é** o próprio banco.

Servem, do mais simples ao mais barato:

| Onde | Como | Observação |
|---|---|---|
| **Render** | `render.yaml` já está pronto: New → Blueprint → aponte para o repositório | O mais parecido com a simplicidade do Netlify. **O plano gratuito não tem disco** — use o Starter |
| **Fly.io** | `fly volumes create dados --size 2` e `fly deploy` | Região `gru` (São Paulo), boa latência no Rio |
| **Railway** | Conecta no repositório, adiciona um volume em `/dados` | Lê o `Dockerfile` sozinho |
| **VPS próprio** | `docker compose up -d` | `docker-compose.yml` já traz o Caddy com HTTPS automático |

Em todos, o disco precisa estar montado em **`/dados`**. É onde ficam o banco, a chave de
sessão e os arquivos enviados. Sem o volume, cada deploy zera a academia.

No primeiro deploy o sistema cria a academia e **mostra a senha do dono no log do serviço**.
Abra os logs e anote — ela não aparece de novo.

### 3. HTTPS é obrigatório

O token de sessão viaja no cabeçalho de cada requisição. Sem TLS, quem estiver na mesma
rede consegue capturá-lo e entrar como a pessoa.

Render, Fly e Railway já entregam HTTPS. Em VPS, o `docker-compose.yml` sobe um **Caddy**
que resolve o certificado sozinho — basta pôr o domínio no `Caddyfile`:

```caddy
atak.seudominio.com.br {
    reverse_proxy atak:3000
}
```

Em qualquer um deles, suba com `ATRAS_DE_PROXY=1` (já vem assim nos arquivos prontos), para
o freio de tentativas de login enxergar o endereço de quem está tentando, e não o do proxy.

### 4. Backup

```bash
npm run backup                       # direto na máquina
docker compose exec atak npm run backup   # em container
```

Grava uma cópia consistente em `dados/backups/`. **Não copie o `academia.db` direto**:
o banco roda em modo WAL e parte do que foi gravado ainda está no arquivo `-wal`, então a
cópia sai incompleta — e você só descobre no dia em que precisar dela.

Para rodar todo dia de madrugada:

```cron
0 3 * * * cd /opt/atak && npm run backup
```

Leve os backups **para fora do servidor** (nuvem, outro disco). Junto deles, guarde o
`dados/chave-de-sessao` e a pasta `dados/arquivos/` (fotos, logos e certificados enviados).

### 5. Antes de entregar aos alunos

- [ ] Trocar a senha do dono no primeiro acesso (menu lateral → *Trocar senha*)
- [ ] Substituir a logo pelo arquivo original da Atak (ver *Identidade visual*)
- [ ] Conferir os dados da academia em *Equipe e academia*
- [ ] Montar turmas, horários e planos
- [ ] Testar o cadastro de aluno pelo site, no celular

---

## Identidade visual da Atak

Tudo o que é marca fica em **dois lugares**:

| O quê | Onde |
|---|---|
| Logo horizontal | `public/marca/logo.svg` (aparece no topo do site e do sistema) |
| Símbolo quadrado | `public/marca/simbolo.svg` (ícone do app, favicon, avatar) |
| Cores da marca | `public/css/tema.css` → `--marca-1` (amarelo), `--marca-2` (dourado claro), `--marca-3` (vermelho) |
| **Enviar a arte oficial** | dentro do sistema, em **Equipe e academia → Identidade visual → Enviar logo / Enviar brasão** |
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
| `/api/checkins` | check-in do treino: `agora`, `meus`, `resumo` e `aula` |
| `/api/loja` | produtos, estoque e vendas |
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
- **A chave que assina as sessões é sorteada por instalação**, nunca um valor escrito no
  código — senão quem tivesse o código conseguiria fabricar um token de dono.
- **A senha inicial do dono é sorteada** e mostrada uma vez só, em vez de um padrão conhecido.
- **Freio de força bruta no login**: depois de 5 erros a espera começa em 20 segundos e
  dobra a cada nova tentativa, até 10 minutos. A conta nunca trava de vez — as tentativas
  são esquecidas em 15 minutos, senão bastaria errar de propósito para trancar o dono
  para fora da própria academia.
- Permissão verificada **no servidor** em cada rota — esconder um botão no navegador não libera acesso.
- **Recorte por modalidade também no servidor**: quem ensina Judô não lê, não edita e não
  apaga nada de Jiu-Jitsu, mesmo chamando a API direto.
- A interface monta todo conteúdo com `textContent`, sem `innerHTML`, evitando injeção de script
  através de dados cadastrados.

O que **não** está no sistema e depende de quem instala: **HTTPS** (ver *Colocar no ar*) e
**backup fora do servidor**.

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
