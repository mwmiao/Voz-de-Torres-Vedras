# Voz de Torres Vedras

**Posições · Registos · Fontes**

Plataforma cívica local de transparência e participação. Residentes registam a sua posição sobre temas municipais de Torres Vedras, e as decisões oficiais aparecem ao lado, com ligação direta às fontes primárias.

Projeto independente, sem ligação ao Município de Torres Vedras.

## Princípios

- **Três tipos de conteúdo, sempre separados:** opinião de residentes, registo oficial e contexto editorial.
- **Sem fonte oficial, não é facto.** Afirmações sem fonte ficam como «Não verificado», fora do conteúdo factual. Decisões sem documento oficial não entram no Registo.
- **Uma pessoa, uma voz.** Uma posição por tema, sempre privada. Só se publicam agregados, e apenas a partir de um mínimo de respostas.
- **Neutralidade.** Sem acusações, classificações de pessoas ou recomendações de voto.
- **Dados mínimos.** O email não é guardado em claro.

## Tecnologia

Next.js (App Router) com TypeScript, Tailwind CSS, PostgreSQL com Prisma, entrada por ligação enviada por email, Docker e GitHub Actions. A aplicação usa a **porta 1400**.

## Desenvolvimento local

Requisitos: Node.js 22 ou superior e PostgreSQL 15 ou superior (ou Docker só para a base de dados).

```bash
cp .env.example .env
npm install
docker compose up -d db
npm run db:deploy
npm run db:seed
npm run dev
```

Abra <http://localhost:1400>.

Sem `SMTP_HOST`, a ligação de entrada é escrita na consola do servidor. A base de dados tem de usar a codificação UTF-8.

Verificações:

```bash
npm run typecheck
npm run lint
npm test
```

## Base de dados

| Comando | Função |
| --- | --- |
| `npm run db:migrate` | Cria uma migração em desenvolvimento |
| `npm run db:deploy` | Aplica as migrações |
| `npm run db:seed` | Carrega os dados; pode ser repetido |
| `npm run db:clear-examples` | Remove todos os dados de exemplo |

O modelo está em [prisma/schema.prisma](prisma/schema.prisma): contas, temas, posições, reuniões, decisões, votos, eleitos, fontes, contratos, orçamento, moderação e importações.

### Dados reais e dados de exemplo

O seed carrega **dados reais**, transcritos de fontes oficiais consultadas em 1 de novembro de 2026 ([prisma/data/real.ts](prisma/data/real.ts)):

- composição do Executivo, da Assembleia Municipal e das comissões;
- deliberações da Assembleia Municipal de dezembro de 2025 a junho de 2026 e a ordem de trabalhos de outubro de 2026;
- reuniões do Executivo com ligação às atas;
- 404 contratos de 2026 do Portal BASE e a situação financeira comunicada à Assembleia Municipal.

Os **dados de exemplo** são fictícios e têm sempre `[EXEMPLO]` e um selo próprio. Incluem dois temas com contagens inventadas e rubricas orçamentais. Saem com `npm run db:clear-examples` e não são criados em produção, salvo com `SEED_EXAMPLES=true`.

Os temas reais começam sem posições.

## Importação de dados públicos

Cada importação guarda URL de origem, data de recolha e SHA-256 do ficheiro.

### Contratos (Portal BASE)

```bash
npm run fetch:dataset -- "<url do contratos2026.zip em dados.gov.pt>" contratos2026.zip
```

Descompacte o ficheiro em `data/raw/` e importe. Só entram os contratos do Município (NIF 502173653) e dos SMAS (NIF 680015973):

```bash
npm run import -- base data/raw/Contratos2026.json
```

Quando o fornecedor é uma pessoa singular, o nome e o NIF não são republicados: a linha remete para o Portal BASE.

### Decisões (CSV ou JSON)

```bash
npm run import -- decisoes data/decisoes.csv https://www.am-tvedras.pt/sessoes/editais/
```

Colunas: `body`, `meetingDate` (AAAA-MM-DD), `meetingTitle`, `itemNumber`, `proposalRef`, `title`, `outcome`, `voteMode`, `votesFor`, `votesAgainst`, `abstentions`, `sourceName`, `sourceTitle`, `sourceUrl`, `sourceType`, `sourcePublishedAt`.

Linhas sem URL de um domínio oficial são recusadas e ficam listadas no histórico. A lista de domínios está em [src/lib/sources.ts](src/lib/sources.ts). A área de moderação também aceita ficheiros até 5 MB.

### Regras de acesso a sites públicos

`npm run fetch:dataset` consulta o `robots.txt`, identifica-se, espera entre pedidos e para se o servidor pedir para abrandar.

O `robots.txt` de `cm-tvedras.pt` exclui `/assets/upload` e `/ficheiros/`, onde estão os PDF de atas e orçamentos. A plataforma liga a esses documentos, mas não os recolhe automaticamente. Por isso, as deliberações do Executivo e as rubricas do orçamento têm de ser preparadas à mão ou pedidas à Câmara, por exemplo, em formato aberto.

## Moderação

Defina os emails com acesso em `ADMIN_EMAILS` ou `MODERATOR_EMAILS`. São comparados por hash em cada entrada. Depois de entrar, use <http://localhost:1400/moderacao>:

- **Propostas:** rever linguagem e duplicados, publicar para apoios, promover a tema ou recusar.
- **Temas:** editar resumo, fase e opções. As opções bloqueiam depois da primeira posição, e publicar exige uma fonte oficial.
- **Denúncias e afirmações:** tratar conteúdo denunciado e ligar fonte oficial ou remover afirmações não verificadas.
- **Importação e definições:** carregar ficheiros, ver o histórico e definir o limiar de apoios (25) e o mínimo público (10, nunca inferior a 5).

As contas múltiplas e as alterações repetidas geram sinais de abuso no registo de moderação. São indícios para revisão, não conclusões.

## Docker

Ambiente completo com aplicação, PostgreSQL e MailHog, a partir da imagem publicada. Basta o ficheiro `docker-compose.yml`, por isso serve também para um NAS:

```bash
docker compose up -d
```

- Aplicação: <http://localhost:1400>
- Emails de entrada: <http://localhost:8025>

Noutra máquina, defina num ficheiro `.env`, ao lado do `docker-compose.yml`, pelo menos `APP_URL` (o endereço real, usado nas ligações de entrada), `AUTH_SECRET` e `POSTGRES_PASSWORD`. Também pode definir `APP_PORT`, `DB_PORT`, `MAILHOG_PORT`, `ADMIN_EMAILS` e as variáveis `SMTP_*`.

Para compilar a partir do código:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up --build
```

Com o Adminer, em <http://localhost:8080>:

```bash
docker compose --profile tools up -d
```

Imagem publicada, em qualquer servidor:

```bash
docker run -p 1400:1400 \
  -e DATABASE_URL="postgresql://..." \
  -e APP_URL="https://exemplo.pt" \
  -e AUTH_SECRET="$(openssl rand -hex 32)" \
  -e SMTP_HOST="..." -e SMTP_USER="..." -e SMTP_PASSWORD="..." -e SMTP_FROM="..." \
  -e RUN_SEED="true" \
  eazyeight/voz-de-torres-vedras:latest
```

As migrações correm no arranque. Com `RUN_SEED=true`, o seed também corre em cada arranque; retire-o depois da primeira vez.

## Publicação no Docker Hub

O workflow [.github/workflows/ci.yml](.github/workflows/ci.yml) corre em pushes para `main` e em etiquetas `v*.*.*`. Verifica tipos, lint, testes, migrações, seed e build, e testa a aplicação na porta 1400. Só depois publica `docker.io/eazyeight/voz-de-torres-vedras`.

Usa os segredos do repositório `DOCKERHUB_USERNAME` e `DOCKERHUB_TOKEN`.

| Evento | Etiquetas |
| --- | --- |
| Push para `main` | `latest` e SHA curto |
| Etiqueta `v1.2.3` | `1.2.3`, `1.2` e SHA curto |

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Instalação em produção

A imagem funciona numa VPS europeia, atrás de um proxy com HTTPS. Em Vercel ou Netlify, defina as mesmas variáveis e execute `npm run db:deploy` na publicação, com um PostgreSQL gerido.

Antes de abrir ao público:

- defina `AUTH_SECRET` e **não o altere**: a identificação das contas depende dele;
- configure SMTP com SPF e DKIM;
- faça uma avaliação de impacto (AIPD): as posições podem revelar opiniões políticas, e o tratamento assenta em consentimento explícito;
- complete a página de privacidade com a identificação e o contacto do responsável pelo tratamento;
- peça revisão jurídica do texto e dos termos de utilização.

## Licença

Por definir.
