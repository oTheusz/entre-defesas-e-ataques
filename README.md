# Entre Defesas e Ataques — Mesa virtual

Mesa virtual do RPG **Entre Defesas e Ataques** (Livro Básico 0.1): campo com as 9 zonas e CDs, tokens ao vivo, bola, placar, bloco, Momento, formações, recursos, perícias, dados e área secreta do mestre.

Site estático (HTML + JS, sem build) hospedado na Vercel, com dados e tempo real no Supabase.

## Configuração (uma vez)

1. **Supabase:** abra o projeto → **SQL Editor** → **New query** → cole todo o conteúdo de `supabase/schema.sql` → **Run**.
2. **GitHub:** suba os arquivos desta pasta no repositório.
3. **Vercel:** **Add New → Project** → importe o repositório → *Framework Preset*: **Other** → **Deploy**. Não precisa configurar nada mais.

A URL e a chave publicável do Supabase ficam em `config.js`.

## Como usar

- **Mestre:** na tela inicial, "Criar sala" com uma senha. Mande o link (aba Mestre → Copiar) para os jogadores.
- **Jogador:** abre o link, escolhe "Jogador", digita o nome.
- O mestre clica num token e escolhe o **Dono** — a partir daí só aquele jogador (e o mestre) move o token.
- A bola é movida pelo mestre ou por quem estiver com ela. Soltar a bola em cima de um jogador dá a posse a ele.
- Cada jogador cadastra as perícias (o Total da ficha) em **Meu jogador** e rola em **Dados**.

## Teste local

`python3 -m http.server` na pasta e abra `http://localhost:8000/?local=1` (banco local no navegador, sem Supabase).

## Segurança

Mesa entre amigos: quem tem o link consegue editar a partida pela API. Só as notas e níveis secretos do mestre são protegidos por senha.
