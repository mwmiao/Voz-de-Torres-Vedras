# Voz de Torres Vedras

**Registos · Dados · Fontes**

Plataforma pública e só de leitura sobre a transparência municipal de Torres Vedras. Reúne orçamento, contratos, reuniões, decisões e eleitos, com ligação às fontes oficiais. Todas as páginas são de acesso livre: não há contas, registo, participação de utilizadores nem envio de email.

Projeto independente, sem ligação ao Município de Torres Vedras.

- **Registos:** decisões, reuniões, agendas, atas e votos da Assembleia Municipal e do Executivo Municipal.
- **Dados:** orçamento, despesa, contratos públicos, fornecedores e projetos municipais.
- **Fontes:** cada informação liga a uma fonte oficial.

## Princípios

- **Sem fonte oficial, não é facto.** Afirmações sem fonte ficam como «Não verificado», fora do conteúdo factual. Decisões sem documento oficial não entram no Registo.
- **Registo e contexto, sempre separados.** Os resumos editoriais estão identificados como tal.
- **Neutralidade.** Sem acusações, classificações de pessoas ou recomendações de voto.
- **Sem estimativas.** Dados não publicados pela fonte aparecem como tal. Valores aproximados na fonte aparecem com «cerca de».

## Páginas

| Página | Conteúdo |
| --- | --- |
| `/` | Resumo, próximas reuniões e decisões recentes |
| `/orcamento` | Orçamento, despesa identificada e situação financeira |
| `/contratos` | Contratos do Portal BASE, com filtros, ordenação e somas descritivas |
| `/reunioes` | Decisões pesquisáveis e lista de reuniões, com página por reunião |
| `/dossies` | Assuntos municipais com contexto, datas e decisões |
| `/camara` | Diretório de eleitos e comissões |
| `/fontes` | Todas as fontes, pesquisáveis |
| `/metodo`, `/privacidade` | Método e tratamento de dados |

Exportações CSV: `/dados/decisoes.csv`, `/dados/contratos.csv` (ambas seguem os filtros da página), `/dados/reunioes.csv` e `/dados/orcamento.csv`.

Cada conjunto e registo mostra a «Última atualização», que é a data em que foi recolhido ou verificado na fonte oficial.

## Tecnologia

Next.js (App Router) com TypeScript, Tailwind CSS, PostgreSQL com Prisma, Docker e GitHub Actions. A aplicação usa a **porta 1400**.

## Desenvolvimento local

Requisitos: Node.js 22 ou superior e PostgreSQL 15 ou superior em UTF-8 (ou Docker só para a base de dados).

```bash
cp .env.example .env
npm install
docker compose up -d db
npm run db:deploy
npm run db:seed
npm run dev
```

Abra <http://localhost:1400>.

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

O modelo está em [prisma/schema.prisma](prisma/schema.prisma). Os votos guardados são apenas votos de eleitos em órgãos municipais, tal como constam das fontes oficiais.

O seed carrega dados reais, transcritos de fontes oficiais consultadas em 1 de novembro de 2026 ([prisma/data/real.ts](prisma/data/real.ts)). Não há dados fictícios.

## Importação de dados públicos

Cada importação guarda URL de origem, data de recolha e SHA-256 do ficheiro. Linhas sem URL de um domínio oficial são recusadas. A lista de domínios está em [src/lib/sources.ts](src/lib/sources.ts).

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

### Orçamento (CSV ou JSON)

```bash
npm run import -- orcamento data/orcamento.csv https://www.cm-tvedras.pt/documentos/gestao/
```

Colunas: `year`, `kind` (`RESUMO`, `RECEITA`, `DESPESA` ou `SITUACAO_FINANCEIRA`), `label`, `amountEur`, `approximate`, `asOf`, `note`, `sourceName`, `sourceTitle`, `sourceUrl`.

### Regras de acesso a sites públicos

`npm run fetch:dataset` consulta o `robots.txt`, identifica-se, espera entre pedidos e para se o servidor pedir para abrandar.

O `robots.txt` de `cm-tvedras.pt` exclui `/assets/upload` e `/ficheiros/`, onde estão os PDF de atas e orçamentos. A plataforma liga a esses documentos, mas não os recolhe automaticamente. Por isso, as deliberações do Executivo e os mapas completos do orçamento têm de ser transcritos à mão ou pedidos à Câmara em formato aberto.

## Docker

Aplicação e PostgreSQL, a partir da imagem publicada. Basta o ficheiro `docker-compose.yml`, por isso serve também para um NAS:

```bash
docker compose up -d
```

Abra <http://localhost:1400>.

Noutra máquina, defina num ficheiro `.env`, ao lado do `docker-compose.yml`, `APP_URL` (o endereço público) e `POSTGRES_PASSWORD` (apenas letras e números). Também pode definir `APP_PORT` e `DB_PORT`.

Para compilar a partir do código:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up --build
```

Com o Adminer, para desenvolvimento, em <http://localhost:8080>:

```bash
docker compose --profile tools up -d
```

Imagem publicada, em qualquer servidor:

```bash
docker run -p 1400:1400 \
  -e DATABASE_URL="postgresql://..." \
  -e APP_URL="https://exemplo.pt" \
  -e RUN_SEED="true" \
  eazyeight/voz-de-torres-vedras:latest
```

As migrações correm no arranque. Com `RUN_SEED=true`, o seed também corre em cada arranque e repõe os dados da versão publicada.

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

## Licença

Por definir.
