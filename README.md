# WynnExtractor

WynnExtractor é um **web scraper em Node.js com Puppeteer** construído para extrair dados completos de builds do [WynnBuilder Beta](https://wynnbuilder-beta.github.io/builder/), um calculador de loadouts (builds) para o MMORPG Wynncraft.

Este script acessa de forma "headless" a URL de uma build, aguarda os downloads e a renderização completa (já que o WynnBuilder é renderizado no lado do cliente), lê todos os painéis dinâmicos e exporta os dados extraídos de forma bastante profunda para um arquivo `.json` estruturado.

## Recursos Extraídos (17 seções)

O Extrator não captura apenas as superfícies; ele entra nas informações ocultas ou tooltips complexos:

1. **Equipamentos:** Nome, raridade, HP, level e slots de powders de 9 espaços (incluindo anéis, pulseiras, colares e arma).
2. **Nível:** Nível geral da build (do player).
3. **Skill Points:** Total, distribuídos e base.
4. **Summary Stats:** HP, EHP, Defesas, Mana, Walk Speed, etc.
5. **Detailed Stats:** 35 tipos de stats detalhados como bônus de dano %, custo de magias, reflexões.
6. **Spells:** Breakdown minucioso dos 9 ataques/magias (com e sem crítico, total por elemento, base, etc).
7. **Ability Tree:** Árvore de habilidades capturada diretamente dos objetos globais do WynnBuilder, trazendo as 93 habilidades (indicando as ativas baseadas na Hash da URL) com nomes, descrição, arquétipos e AP (Ability Points).
8. **Active Boosts:** Buffs ativos de combate ativados pelos "toggle buttons".
9. **Boost Sliders:** Valores informados nos sliders para simulação de bônus (ex: element boost armor).
10. **Tomes:** Uso de tomos pela build.
11. **Aspects:** Informações extras da build (Aspects com nome e tier).
12. **Identificações (IDs):** 28 identificações extraídas (Current value vs Base value).
13. **Poison Stats:** Breakdown de dano contínuo.
14. **Powder Specials:** Habilidades advindas de combinações de powders (Quake, Courage, etc).
15. **Set Bonuses:** Bônus advindos do uso de partes iguais do mesmo Set de armadura.
16. **Build Order:** Recomendação de ordem de build se constar.
17. **Item Tooltips:** Texto bruto extraído e re-padronizado com os "requirimentos" e outros dados não explícitos.

## Como Usar

### 1. Requisitos
- Node.js (v18 ou superior)
- NPM ou Yarn

### 2. Instalação
Baixe ou faça um clone do repositório, instale as dependências.
```bash
npm install
```

### 3. Extraindo uma Build
Execute o comando principal `node app.js`, passando **obrigatoriamente a URL** completa com a *Hash* do Wynnbuilder desejada **entre aspas**:

```bash
node app.js "https://wynnbuilder-beta.github.io/builder/#CT013HxGyb0yQWT82eGnEamWecKS230q-Kz7sNAI50"
```

> **Atenção:** Se não informar a URL, o script irá lançar um erro informando como proceder.

### 4. Entendendo o Resultado
Após carregar o navegador virtual e fazer todos os passos, ele reportará no terminal o total de itens capturados:
```
✅ Extração completa!
   📦 9 equipamentos
   📊 35 stats detalhados
   🔮 9 magias/ataques
   🌳 17/93 habilidades (ativas/total)
   📄 Arquivo: build-wynncraft.json
```

O arquivo `build-wynncraft.json` será gerado ou atualizado no diretório local, pesando em média 120KB, com os dados organizados em um JSON hierárquico pronto para uso por outras aplicações.

## Detalhes Técnicos do Scraper
Como o WynnBuilder baseia a representação da build via **decodificação de uma hash BitVector codificada em Base64**, todo o "estado" (State) existe no DOM e em scripts JS dinâmicos (não numa API de JSON).

Para conseguir o sucesso dessa extração, o Puppeteer é configurado para:
* Utilizar espera até `networkidle0` em cima de um tempo extra e de avaliações se elementos-chave foram renderizados.
* Forçar com Injeções CSS a visibilidade (`display: block`) das dezenas de tooltips flutuantes na DOM de itens e spells que normalmente são carregados com a interação do Mouse do usuário.
* Ao longo das identificações, em que alguns spans ocultos (min/max/base) existem de forma estruturada (3 colunas CSS grid), o Web Scraper usa métodos como a iteração por `children.textContent` de cada item que funciona melhor sobre CSS Hidden do que o convencional `innerText`.
* Usa os objetos base (como `ATREES`) gerados em tempo real pela decodificação para mapear e cruzar os bits do Vetor de Tree para gerar um dado fiel da Árvore de Habilidades (Ability Tree).

## Próximos Passos (Sugestões para contribuição)
* Extração em Batch (Listas/múltiplas URLS).
* Error Handling complexo (Timeout/Fallbacks).
* Converter strings raw com valores para inteiros nas chaves das Identificações (ex: `"Health": "4100"` para `"Health": 4100`).
* Fazer a quebra das Strings de "Descrição" das habilidades em objetos (`{manaCost: 30}`).
