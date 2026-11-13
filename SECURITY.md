# Segurança

## O que a aplicação faz

- É **só de leitura**: não há contas, formulários de utilizador, participação nem envio de email.
- Não recolhe dados pessoais dos visitantes. Os dados publicados vêm de fontes públicas e oficiais; nomes, idades, moradas, matrículas e contactos nunca são publicados.
- Envia cabeçalhos de segurança (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`), definidos em `next.config.ts`.
- A política CSP usa `'unsafe-inline'` em scripts e estilos, porque cabeçalhos estáticos não levam nonces. Um teste de browser (`e2e/seguranca.spec.ts`) confirma que não há violações no mapa.

## Limitações

- A aplicação não tem autenticação. Se a expuseres na Internet, usa um proxy com HTTPS.
- O ficheiro SQLite em `./data` não está encriptado; protege o acesso ao anfitrião.
- A recolha respeita o `robots.txt` e nunca contorna restrições técnicas.

## Comunicar uma vulnerabilidade

Abre um [aviso privado de segurança](https://github.com/mwmiao/Voz-de-Torres-Vedras/security/advisories/new) no GitHub. Evita abrir um issue público com detalhes de exploração.
