# Voz de Torres Vedras

**Registos · Dados · Fontes**

Plataforma pública e só de leitura sobre a transparência municipal de Torres Vedras. Reúne orçamento, contratos, reuniões, decisões, eleitos, resumos simples, métricas, dados de segurança e alertas, com ligação às fontes oficiais. Todas as páginas são de acesso livre: não há contas, registo, participação de utilizadores nem envio de email.

Projeto independente, sem ligação ao Município de Torres Vedras.

- **Registos:** decisões, reuniões, agendas, atas e votos da Assembleia Municipal e do Executivo Municipal.
- **Dados:** orçamento, despesa, contratos públicos, fornecedores e projetos municipais.
- **Fontes:** cada informação liga a uma fonte oficial.

## Princípios

- **Sem fonte oficial, não é facto.** Afirmações e documentos sem fonte oficial ficam como «Não verificado». Decisões sem documento oficial não entram no Registo.
- **Registo e contexto, sempre separados.** Os resumos editoriais estão identificados como tal.
- **Neutralidade.** Sem acusações, classificações de pessoas ou recomendações de voto.
- **Sem estimativas.** Dados não publicados pela fonte aparecem como tal. Valores aproximados na fonte aparecem com «cerca de».

## Páginas

| Página | Conteúdo |
| --- | --- |
| `/` | Alertas ativos, últimas atualizações, números principais, reuniões, decisões, contratos e segurança |
| `/orcamento` | Orçamento, despesa identificada e situação financeira |
| `/contratos` | Contratos, modificações e procedimentos, com filtros e somas descritivas |
| `/reunioes` | Decisões pesquisáveis e lista de reuniões, com página por reunião |
| `/resumos` | Resumos simples de decisões, reuniões, contratos, regulamentos e documentos |
| `/seguranca` | Mapa das ocorrências publicadas nos últimos 14 dias, com localização aproximada, e crimes registados por ano, em vista simples e detalhada |
| `/alertas` | Avisos oficiais ativos e arquivo pesquisável |
| `/metricas` | Indicadores neutros, com variações e fontes |
| `/dossies` | Assuntos municipais com contexto, datas e decisões |
| `/camara` | Diretório de eleitos e comissões |
| `/fontes` | Todas as fontes, incluindo regulamentos e editais, pesquisáveis |
| `/estado-das-fontes` | Origens de dados, última atualização, estado e erros |
| `/metodo`, `/privacidade` | Método e tratamento de dados |

Exportações CSV: `/dados/decisoes.csv`, `/dados/contratos.csv` (ambas seguem os filtros da página), `/dados/reunioes.csv`, `/dados/orcamento.csv`, `/dados/seguranca.csv`, `/dados/ocorrencias.csv` (inclui o arquivo), `/dados/alertas.csv`, `/dados/metricas.csv` e `/dados/resumos.csv`.

## Tecnologia

Next.js (App Router) com TypeScript, Tailwind CSS, SQLite com Prisma, Docker e GitHub Actions. A aplicação usa a **porta 1400**.

## Desenvolvimento local

Requisito: Node.js 22 ou superior.

```bash
cp .env.example .env
npm install
npm run db:deploy
npm run data:bootstrap
npm run dev
```

Abra <http://localhost:1400>.

Verificações:

```bash
npm run typecheck
npm run lint
npm test
npm run data:validate
```

## Base de dados SQLite

Os dados ficam num único ficheiro, `data/voz-torres-vedras.db`, que não entra no Git. A versão pública dos dados está em `data/snapshot/`, com um ficheiro `.jsonl` por tabela.

| Comando | Função |
| --- | --- |
| `npm run db:deploy` | Cria o ficheiro, se não existir, e aplica as migrações |
| `npm run db:migrate` | Cria uma migração em desenvolvimento |
| `npm run data:bootstrap` | Numa base vazia, carrega `data/snapshot` ou, na sua falta, o seed |
| `npm run db:seed` | Carrega os dados transcritos, sem as recolhas automáticas |
| `npm run data:backup` | Grava uma cópia consistente em `data/backups/` |
| `npm run data:export` | Escreve a base de dados em `data/snapshot/` |
| `npm run data:validate` | Confirma fontes oficiais e a integridade do ficheiro |

O modelo está em [prisma/schema.prisma](prisma/schema.prisma). Os votos guardados são apenas votos de eleitos em órgãos municipais, tal como constam das fontes oficiais.

### Fazer e repor cópias de segurança

```bash
npm run data:backup
```

O comando funciona com o site a correr. Para repor uma cópia, pare a aplicação, substitua o ficheiro e volte a arrancar:

```bash
docker compose down
cp data/backups/voz-torres-vedras-AAAA-MM-DDTHH-MM-SS.db data/voz-torres-vedras.db
docker compose up -d
```

### Substituir a base de dados

Para recomeçar a partir da cópia publicada, pare a aplicação, apague `data/voz-torres-vedras.db` e arranque de novo. O contentor recria o ficheiro e carrega a cópia incluída na imagem. Sem Docker:

```bash
rm data/voz-torres-vedras.db
npm run db:deploy
npm run data:bootstrap
```

## Atualização de dados

O módulo [ingestion/](ingestion/) recolhe, valida e grava os dados das fontes oficiais.

| Pasta | Função |
| --- | --- |
| `ingestion/sources` | A recolha de cada origem |
| `ingestion/fetchers` | Acesso HTTP respeitoso, API do WordPress e dados abertos |
| `ingestion/parsers` | Leitura de JSON, HTML e PDF |
| `ingestion/normalizers` | Datas, URL e texto uniformes |
| `ingestion/validators` | Campos obrigatórios e deteção de mudanças de estrutura |
| `ingestion/updaters` | Comparação, gravação e histórico de alterações |
| `ingestion/derive` | Resumos, métricas, taxas e freguesias, calculados no fim de cada execução |

O catálogo de origens, com identificador, URL, frequência, método, validação e política de acesso, está em [src/lib/source-catalog.ts](src/lib/source-catalog.ts).

### Origens

Antes de recolher páginas, verificou-se se existia API, ficheiro ou índice oficial.

| Origem | Método | Frequência | Dados |
| --- | --- | --- | --- |
| `am-documentos` | API do site (WordPress) | Diária | Atas, editais, moções e relatórios |
| `am-editais` | API do site (WordPress) | Diária | Editais e sessões convocadas |
| `am-situacao-financeira` | Ficheiro PDF, localizado pela API | Diária | Disponibilidades e dívida |
| `base-contratos` | API de dados.gov.pt e ficheiro | Semanal | Contratos |
| `base-anuncios` | API de dados.gov.pt e ficheiro | Semanal | Concursos e anúncios |
| `base-modificacoes` | API de dados.gov.pt e ficheiro | Semanal | Modificações contratuais |
| `am-composicao` | Página pública | Semanal | Alterações à composição e às comissões |
| `cm-editais` | Página pública | Diária | Editais e reuniões convocadas |
| `cm-atas` | Página pública | Diária | Atas e minutas |
| `cm-gestao` | Página pública | Semanal | Orçamentos e prestação de contas |
| `cm-regulamentos` | Página pública | Semanal | Regulamentos |
| `cm-contratacao` | Página pública | Semanal | Procedimentos |
| `cm-composicao` | Página pública | Semanal | Eleitos e pelouros |
| `ine-crime` | API do INE | Semanal | Crimes registados, taxa de criminalidade e população do concelho, 2011 em diante |
| `ipma-avisos` | Dados abertos do IPMA | Hora a hora | Avisos do distrito de Lisboa |
| `cm-avisos` | Página pública | 6 horas | Avisos do Município |
| `cm-prociv` | Página pública | 6 horas | Comunicados da Proteção Civil Municipal |
| `smas-avisos` | Página pública | 3 horas | Interrupções e avisos de água |
| `alertas-curados` | Ficheiro [prisma/data/alertas-curados.json](prisma/data/alertas-curados.json) | Com os avisos | Avisos oficiais registados à mão |
| `gnr-comunicados` | Página pública | 12 horas | Comunicados da GNR que referem Torres Vedras |
| `noticias-ao-minuto` | Sitemap de notícias e artigos | 3 horas | Notícias da secção País sobre ocorrências no concelho |
| `rtv-oeste` | Feed RSS público | 3 horas | RTV Oeste: notícias de Torres Vedras e do Oeste (nível 2) |
| `onfm-torres-vedras` | Feed RSS público da categoria Torres Vedras | 3 horas | ON FM: notícias locais e comunicados da Câmara republicados (nível 2) |
| `mastodon-torresvedras` | API pública do Mastodon | 3 horas | Publicações públicas com etiquetas de Torres Vedras (nível 3 ou 4) |
| `telegram-canais` | Página pública t.me/s/ | 3 horas | Canais públicos configurados (nível 3 ou 4) |
| `ocorrencias-curadas` | Ficheiro [prisma/data/ocorrencias-curadas.json](prisma/data/ocorrencias-curadas.json) | Com as ocorrências | Ocorrências e publicações registadas à mão, de qualquer nível |
| `badaladas`, `jn-torres-vedras`, `psp-comunicados`, `anepc-ocorrencias`, `redes-sociais-automaticas` | Desativadas, só registo à mão | Sem recolha | Ver abaixo |
| `anepc-avisos` | Desativada | Sem recolha | Ver abaixo |
| `dre-legislacao` | Desativada | Sem recolha | Ver abaixo |

As origens da Câmara usam páginas porque o site não tem API, feed nem mapa do site.

**Limites conhecidos:**

- O `robots.txt` da Câmara exclui `/assets/upload` e `/ficheiros/`, onde estão os PDF. As ligações são guardadas, mas os PDF não são lidos. Por isso, os valores por rubrica do orçamento e as deliberações do Executivo não são extraídos. Podem ser importados depois de transcritos, ou pedidos à Câmara em formato aberto.
- O Diário da República não tem API pública, e os seus mapas do site não indicam a entidade. Filtrar Torres Vedras obrigaria a abrir cada ato, pelo que a origem está desativada. Os anúncios de procedimentos do Município chegam por `base-anuncios`.
- Não existem dados oficiais públicos de crimes por freguesia, nem valores mensais ou trimestrais por concelho. Danos e tráfico não são publicados por concelho. A plataforma assinala estas lacunas e não faz estimativas.
- A execução orçamental por categoria e os projetos ativos não têm fonte estruturada. Aparecem em `/metricas` como indicadores sem dados.
- A ANEPC recusa a leitura do `robots.txt`, pelo que a sua página não é recolhida. O fogos.pt não é uma entidade oficial e não é usado. As alterações de transportes não têm fonte estruturada e só entram quando publicadas nos avisos da Câmara.
- O Badaladas e o Jornal de Notícias proíbem no `robots.txt` a recolha automática sem licença, e a PSP rejeita os pedidos às páginas de notícias. Facebook, Instagram e X exigem sessão e proíbem a recolha automática. Estas fontes só entram quando registadas à mão em `ocorrencias-curadas`. Não há fonte oficial aberta de ocorrências da ANEPC.
- Os resumos são gerados por regras, a partir de campos oficiais ([src/lib/summaries.ts](src/lib/summaries.ts)). Não usam inteligência artificial nem leem PDF. Títulos ambíguos ficam com «Resumo não disponível. Consulte o documento oficial.»
- As deliberações dos editais da Assembleia são guardadas como documentos. A transcrição ponto a ponto continua a ser feita à mão, para não publicar resultados oficiais mal interpretados.

### Regras de recolha

- Só se recolhem páginas públicas e nunca se contornam restrições técnicas.
- O `robots.txt` é sempre consultado. Se não puder ser lido, uma página pública não é recolhida.
- Há um intervalo entre pedidos no mesmo domínio (`INGEST_DELAY_MS`, 1500 ms por omissão) e um `User-Agent` identificado.
- Respostas 429 ou 503 param a origem nessa execução.
- As páginas não alteradas não voltam a ser interpretadas, e os ficheiros do IMPIC só são descarregados quando há nova revisão.
- Contactos pessoais publicados nas páginas não são guardados.

### Integridade dos dados

- Duplicados evitados com chaves naturais: identificador do contrato, URL do documento ou órgão e data da reunião.
- Cada alteração guarda o campo, o valor anterior, o valor novo, a fonte e a data.
- Um registo sem fonte válida é recusado. Um documento fora dos domínios oficiais fica como «Não verificado».
- O URL de uma fonte é a sua chave, pelo que nunca é substituído. Os títulos transcritos à mão também não.
- Se uma origem falhar, o que já existe não é alterado e o erro aparece em `/estado-das-fontes`.
- Cada registo guarda a origem, o estado (`NEW`, `UPDATED`, `UNCHANGED` ou `FAILED`), a data de recolha e, quando útil, a impressão digital do conteúdo.

Na primeira execução de uma origem, o arquivo existente entra sem aparecer como novidade. Só o que tem menos de 45 dias surge em «Atualizações recentes».

### Atualização manual

```bash
npm run update:data
```

Mostra um resumo de registos novos, atualizados, inalterados e falhados. Cada origem só é consultada se a sua frequência o justificar.

```bash
npm run update:data -- --source cm-editais --source base-anuncios
```

```bash
npm run update:data -- --force
```

Com `--strict`, o comando termina com erro se alguma origem falhar. No contentor:

```bash
docker compose exec app npx tsx ingestion/run.ts --force
```

### Atualização agendada

Há duas formas, que podem ser usadas em conjunto.

**No contentor.** Com `UPDATE_INTERVAL_HOURS` (24 por omissão, 0 desliga), o site consulta as origens por si e atualiza a base de dados em `./data`.

**No GitHub Actions.** O workflow [atualizar-dados.yml](.github/workflows/atualizar-dados.yml) corre todos os dias às 05:30 UTC. Recolhe as origens, valida, corre os testes e exporta `data/snapshot`. Só abre um pull request se houver alterações, para rever antes de entrar em `main`.

Para o configurar:

1. Em **Settings > Actions > General > Workflow permissions**, ative **Read and write permissions** e **Allow GitHub Actions to create and approve pull requests**.
2. Para mudar a hora, edite o `cron` no workflow.
3. Opcionalmente, em **Settings > Secrets and variables > Actions > Variables**, defina `INGEST_DELAY_MS` e `INGEST_DISABLED_SOURCES`.

Não são necessários segredos: todas as origens são públicas. Os pull requests criados com o token do GitHub não acionam o CI. Os testes correm dentro do próprio workflow, e o CI corre depois da integração em `main`.

### Atualização a pedido

Em **Actions > Atualizar dados municipais > Run workflow**, pode indicar origens e ignorar a frequência.

### Importação manual

Cada importação guarda URL de origem, data de recolha e SHA-256 do ficheiro. Linhas sem URL de um domínio oficial são recusadas. A lista de domínios está em [src/lib/sources.ts](src/lib/sources.ts).

```bash
npm run import -- decisoes data/decisoes.csv https://www.am-tvedras.pt/sessoes/editais/
```

Colunas: `body`, `meetingDate` (AAAA-MM-DD), `meetingTitle`, `itemNumber`, `proposalRef`, `title`, `outcome`, `voteMode`, `votesFor`, `votesAgainst`, `abstentions`, `sourceName`, `sourceTitle`, `sourceUrl`, `sourceType`, `sourcePublishedAt`.

```bash
npm run import -- orcamento data/orcamento.csv https://www.cm-tvedras.pt/documentos/gestao/
```

Colunas: `year`, `kind` (`RESUMO`, `RECEITA`, `DESPESA` ou `SITUACAO_FINANCEIRA`), `label`, `amountEur`, `approximate`, `asOf`, `note`, `sourceName`, `sourceTitle`, `sourceUrl`.

### Adicionar uma origem

1. Procure primeiro uma API, ficheiro, feed ou mapa do site oficial, e leia o `robots.txt` e os termos de utilização.
2. Acrescente a origem a [src/lib/source-catalog.ts](src/lib/source-catalog.ts).
3. Escreva o parser em `ingestion/parsers`, a devolver registos do tipo definido em [ingestion/types.ts](ingestion/types.ts).
4. Registe a recolha em `COLLECTORS`, em [ingestion/sources/index.ts](ingestion/sources/index.ts), com `assertMinimum` para detetar mudanças de estrutura.
5. Se a entidade for nova, acrescente o domínio a [src/lib/sources.ts](src/lib/sources.ts).
6. Acrescente testes em [tests/ingestion.test.ts](tests/ingestion.test.ts). Um teste confirma que catálogo e recolhas coincidem.

### Quando um site muda de estrutura

A recolha para com a mensagem «Estrutura da fonte alterada», os dados existentes mantêm-se e a origem aparece com erro em `/estado-das-fontes`. Para resolver:

1. Abra a página oficial e compare-a com o parser em `ingestion/parsers`.
2. Atualize o parser e o teste correspondente.
3. Confirme com `npm run update:data -- --source <id>`.

Enquanto isso, pode desativar a origem em `INGEST_DISABLED_SOURCES`. Não reduza o mínimo em `assertMinimum` para ultrapassar o erro sem perceber a causa.

### Avisos urgentes

Os avisos têm uma frequência própria. No contentor, a variável `ALERT_INTERVAL_MINUTES` (por omissão, 60) define de quanto em quanto são consultados, entre recolhas completas. Manualmente:

```bash
npm run update:alerts
```

Para registar um aviso oficial de uma página sem estrutura legível, acrescente-o a `prisma/data/alertas-curados.json`:

```json
[{ "title": "Título", "type": "MOBILIDADE", "severity": "ATENCAO", "description": "Texto curto.", "area": "Concelho de Torres Vedras", "sourceUrl": "https://www.cm-tvedras.pt/...", "endsAt": "2026-12-01T23:59:00Z" }]
```

### Ocorrências recentes

O mapa em `/seguranca` mostra só ocorrências dos últimos 14 dias, pela data da ocorrência. Reúne fontes oficiais, imprensa e fontes locais, incluindo redes sociais, sempre com o estado de verificação à vista.

**Níveis das fontes** ([src/lib/source-tiers.ts](src/lib/source-tiers.ts)):

| Nível | Fonte | Exemplos |
| --- | --- | --- |
| 1 | Autoridade oficial | GNR, PSP, ANEPC, Proteção Civil, IPMA, Câmara Municipal, registos públicos |
| 2 | Comunicação social | Redações com responsabilidade editorial |
| 3 | Conta oficial em rede social | Contas registadas em `prisma/data/fontes-comunitarias.json` como de uma autoridade ou redação |
| 4 | Fonte comunitária | Grupos locais, contas pessoais, canais, fóruns, relatos de residentes |

**Estados públicos** ([src/lib/verification.ts](src/lib/verification.ts)):

- **Confirmado:** pelo menos uma fonte de nível 1 corrobora. É o único estado descrito como confirmado.
- **Reportado:** a primeira fonte é de nível 2, ou uma ocorrência que surgiu nos níveis 3 e 4 foi noticiada por duas redações independentes.
- **Não confirmado:** só fontes de nível 3 e 4, sem ser recente, ou factos essenciais em conflito entre fontes.
- **Em apuramento:** fonte não oficial nas primeiras 24 horas, ou situação em curso sem confirmação oficial. Volta à fila de revisão quando chega informação nova.

**Cruzamento de fontes:** cada relato é comparado com as ocorrências das 48 horas à volta por categoria, freguesia, data e impressões das palavras, nunca pelo título exato. Fica guardado em `incident_references`, com nível, ligação, data, uma afirmação estruturada (tipo, área e dia) e a concordância: corrobora, acrescenta detalhe, contradiz ou não relacionada. Repetição não é confirmação: publicações da mesma conta, cópias quase iguais e notícias da Lusa republicadas contam como uma só fonte.

**Revisão e arquivo:** entram na fila de revisão as ocorrências de nível 3 e 4 com alegações graves, violência, menores ou violência doméstica, as que têm fontes em conflito, as muito repetidas ou partilhadas, e as que ficam mais de 48 horas sem confirmação. Casos de redes sociais com menores ou violência doméstica, e registos com área ou categoria ambígua, só aparecem depois de revistos. São arquivadas, com o motivo, quando a publicação original é apagada, quando uma fonte oficial as contradiz, ou ao fim de 7 dias sem confirmação. Os limites ajustam-se com `INCIDENT_DEVELOPING_HOURS`, `INCIDENT_REVIEW_HOURS`, `INCIDENT_ARCHIVE_DAYS`, `INCIDENT_REPETITION_THRESHOLD` e `INCIDENT_ENGAGEMENT_THRESHOLD`.

```bash
npm run review:incidents
```

Para saber porque é que um artigo não aparece no mapa:

```bash
npm run diagnose:incidents
```

```bash
npm run diagnose:incidents -- --url dois-mil-litros
```

O resumo mostra, por origem, a última recolha, os artigos lidos, os passados ao parser, os recusados com o motivo, os gravados e os visíveis no mapa. Com `--url`, mostra o percurso de um artigo: nunca chegou ao parser, foi recusado, ficou retido, foi arquivado, está fora da janela ou está no mapa.

A decisão regista-se em `prisma/data/revisoes-ocorrencias.json` e aplica-se na recolha seguinte:

```json
[{ "key": "https://www.facebook.com/...", "decision": "publicar", "note": "Confirmado com a Junta de Freguesia" }]
```

`decision` pode ser `publicar` (sai da retenção), `manter` ou `arquivar`.

**Localização e datas:** sem freguesia nem localidade, uma notícia de autoridade ou imprensa fica ao nível do concelho e aparece no painel «Concelho inteiro» do mapa, sem marcador. Fontes de nível 3 e 4 precisam de uma freguesia ou localidade. Um concelho vizinho só conta como lugar quando aparece como tal («na Lourinhã»), não no nome de uma instituição («Bombeiros Voluntários da Lourinhã»). Sem data da ocorrência, autoridades e imprensa ficam com a data de publicação, assinalada no cartão. A janela inclui o 14.º dia: a 2 de novembro, começa a 19 de outubro.

**Privacidade:** nomes, idades, moradas, matrículas e contactos nunca são publicados. Os resumos e as afirmações são modelos neutros; o texto e o título originais não são guardados, só impressões das palavras. Em fontes de nível 3 e 4, a ligação não é publicada quando a publicação expõe dados pessoais ou não pode ser arquivada, como grupos fechados ou mensagens. Em violência doméstica fica sempre a freguesia. A localização é a freguesia, a localidade (raio de 900 m) ou uma área pública nomeada por fonte de nível 1 ou 2.

**Recolha:**

- `gnr-comunicados` (nível 1) e `noticias-ao-minuto` (nível 2), como antes.
- `rtv-oeste` e `onfm-torres-vedras` (nível 2): feeds RSS públicos, com pedidos condicionais e até três páginas enquanto os artigos estiverem na janela. O texto do feed só serve para extrair data, área e tipo; guardam-se a ligação, o autor, a categoria do artigo e um resumo próprio. Na ON FM, os comunicados da Câmara republicados mantêm a autoria e contam como fonte da Câmara, não como redação independente. Nenhuma destas fontes torna uma ocorrência «Confirmado» sem uma autoridade.
- O Jornal de Notícias proíbe no `robots.txt` a recolha automática sem licença: fica só para registo à mão.
- `mastodon-torresvedras`: publicações públicas com as etiquetas configuradas em `prisma/data/fontes-comunitarias.json`. Publicações apagadas são detetadas e o registo é arquivado.
- `telegram-canais`: canais públicos listados no mesmo ficheiro. Sem canais, não faz pedidos.
- Facebook, Instagram e X não permitem recolha automática: as publicações relevantes registam-se à mão em `prisma/data/ocorrencias-curadas.json`, com o nível calculado pelo endereço ou indicado em `sourceTier`:

```json
[{ "sourceUrl": "https://www.facebook.com/groups/.../posts/...", "sourceName": "Grupo comunitário no Facebook", "sourceTier": "COMUNITARIA", "account": { "platform": "facebook", "handle": "grupo" }, "publishedAt": "2026-11-02T10:00:00Z", "incidentStart": "2026-11-02T08:00:00Z", "category": "FURTO", "freguesia": "silveira", "precision": "LOCALIDADE", "placeName": "Santa Cruz", "personalData": false }]
```

Use `"freguesia": "concelho"` quando a fonte só indica o concelho, e omita `incidentStart` quando não dá a data da ocorrência. O campo `title` só serve para comparar com outras fontes: não é guardado. Para ligar uma fonte a uma ocorrência existente, indique `incidentKey` (URL da primeira fonte) e `agreement`. Para registar que a publicação foi apagada, `removed: true`.

A tabela `incident_logs` guarda os registos novos, atualizados, duplicados, recusados, arquivados e enviados para revisão, com o motivo. Os limites das freguesias estão em [public/geo/freguesias-torres-vedras.json](public/geo/freguesias-torres-vedras.json), simplificados a partir da CAOP 2025 da DGT. O mapa de fundo é do OpenStreetMap.

## Docker

Só corre a aplicação. Basta o ficheiro `docker-compose.yml`, por isso serve também para um NAS:

```bash
docker compose up -d
```

Abra <http://localhost:1400>. No primeiro arranque, a imagem cria `./data/voz-torres-vedras.db` e carrega a cópia de dados incluída.

| Variável | Valor por omissão | Função |
| --- | --- | --- |
| `APP_URL` | `http://localhost:1400` | Endereço público, usado no mapa do site |
| `APP_PORT` | `1400` | Porta no anfitrião |
| `UPDATE_INTERVAL_HOURS` | `24` | Frequência das verificações; 0 desliga |
| `INGEST_DISABLED_SOURCES` | Vazio | Origens a não recolher |

A origem `base-contratos` descomprime um ficheiro com centenas de MB. Em máquinas com pouca memória, desative-a com `INGEST_DISABLED_SOURCES=base-contratos` e use a cópia que chega com cada imagem.

O ficheiro SQLite deve ficar num disco local. Em pastas de rede (NFS ou SMB), o SQLite pode não conseguir bloquear o ficheiro corretamente.

Para compilar a partir do código:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up --build
```

## Publicação no Docker Hub

O workflow [.github/workflows/ci.yml](.github/workflows/ci.yml) corre em pushes para `main` e em etiquetas `v*.*.*`. Verifica tipos, lint, testes, migrações e dados, compila e testa a aplicação na porta 1400. Só depois publica `docker.io/eazyeight/voz-de-torres-vedras`.

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

A imagem funciona numa VPS europeia, atrás de um proxy com HTTPS, com um volume persistente em `/app/data`. Vercel e Netlify não são adequados nesta versão, porque o seu sistema de ficheiros é temporário e o SQLite precisa de um ficheiro persistente.

## Licença

Por definir.
