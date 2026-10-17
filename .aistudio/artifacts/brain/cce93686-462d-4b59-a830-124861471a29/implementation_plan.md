# Geração de Ordens de Compra a partir de Receitas

Implementação de um fluxo completo para confeiteiras selecionarem receitas, informarem a quantidade de fornadas/produção e gerarem automaticamente uma Ordem de Compra na nova aba **Lista de Compras**, convertendo frações de receitas (ex: 250ml de leite ou 395g de leite condensado) em pacotes comerciais inteiros fechados (ex: 1L de leite ou latas/caixas fechadas), com checklist interativo, estimativa de custos e compartilhamento direto para WhatsApp.

***

### Confirmações e Decisões Críticas

> [!IMPORTANT]
> **Decisões confirmadas com o usuário:**
> - **Definição da quantidade a produzir:** O usuário informará a quantidade de fornadas ou múltiplos de rendimento por receita ao selecioná-las (ex: 2 fornadas de Bolo de Cenoura + 1 fornada de Bolo de Chocolate + 1 cento de Brigadeiro).
> - **Cálculo de ingredientes na ordem:** Arredondamento automático para cima em pacotes comerciais inteiros (ex: necessidade de 250ml de leite com caixa de 1.000ml resulta em 1 caixa fechada de 1 Litro).
> - **Nome da nova aba no menu:** **Lista de Compras** (ícone de prancheta/carrinho no menu lateral, mantendo distinção clara da aba existente "Compras & Notas").

***

## 1. Visão Geral e Demonstração Prática com 3 Receitas de Exemplo

Para ilustrar exatamente como o recurso funcionará na prática, considere o seguinte exemplo real de produção:

### As 3 Receitas Selecionadas:
1. **Bolo de Cenoura com Cobertura:** 2 fornadas (rendimento: 2 bolos)
   - Cenoura: 250g × 2 = `500g`
   - Ovos: 3 un × 2 = `6 un`
   - Óleo de Soja: 120ml × 2 = `240ml`
   - Açúcar Refinado: 300g × 2 = `600g`
   - Farinha de Trigo: 300g × 2 = `600g`
   - Fermento Químico: 15g × 2 = `30g`
   - Leite Condensado (cobertura): 395g × 2 = `790g`
   - Chocolate em Pó 50%: 50g × 2 = `100g`
   - Manteiga: 20g × 2 = `40g`

2. **Bolo de Chocolate / Nega Maluca:** 1 fornada (rendimento: 1 bolo)
   - Farinha de Trigo: `250g`
   - Açúcar Refinado: `200g`
   - Leite Integral: `250ml` *(exemplo do usuário)*
   - Chocolate em Pó 50%: `90g`
   - Ovos: `3 un`
   - Óleo de Soja: `100ml`
   - Fermento Químico: `10g`

3. **Cento de Brigadeiro Tradicional:** 1 lote (rendimento: 100 brigadeiros)
   - Leite Condensado: `790g` (2 caixas de 395g)
   - Creme de Leite: `400g` (2 caixas de 200g)
   - Chocolate em Pó 50%: `100g`
   - Manteiga: `30g`
   - Granulado: `250g`

---

### Resultado da Consolidação e Arredondamento Comercial:

| Ingrediente | Qtd. Líquida Necessária | Embalagem de Venda Cadastrada | Qtd. Pacotes a Comprar (Arredondado) | Preço Unit. Pacote | Custo Estimado |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Leite Condensado** | 1.580 g (790g + 790g) | Caixa de 395 g | **4 caixas** | R$ 6,50 | R$ 26,00 |
| **Leite Integral** | 250 ml | Caixa de 1.000 ml (1 L) | **1 litro** *(teto)* | R$ 5,20 | R$ 5,20 |
| **Farinha de Trigo** | 850 g (600g + 250g) | Pacote de 1.000 g (1 kg) | **1 pacote** | R$ 5,50 | R$ 5,50 |
| **Açúcar Refinado** | 800 g (600g + 200g) | Pacote de 1.000 g (1 kg) | **1 pacote** | R$ 4,50 | R$ 4,50 |
| **Chocolate em Pó 50%**| 290 g (100g + 90g + 100g)| Pacote de 1.000 g (1 kg) | **1 pacote** | R$ 38,00 | R$ 38,00 |
| **Óleo de Soja** | 340 ml (240ml + 100ml) | Garrafa de 900 ml | **1 garrafa** | R$ 7,50 | R$ 7,50 |
| **Ovos** | 9 un (6 + 3) | Cartela de 30 un | **1 cartela** | R$ 24,00 | R$ 24,00 |
| **Creme de Leite** | 400 g | Caixa de 200 g | **2 caixas** | R$ 3,80 | R$ 7,60 |
| **Manteiga** | 70 g (40g + 30g) | Pote de 500 g | **1 pote** | R$ 22,00 | R$ 22,00 |
| **Granulado** | 250 g | Pacote de 500 g | **1 pacote** | R$ 14,00 | R$ 14,00 |
| **Fermento em Pó** | 40 g (30g + 10g) | Pote de 250 g | **1 pote** | R$ 8,00 | R$ 8,00 |
| **Cenoura** | 500 g | Pacote/Kg de 1.000 g | **1 kg** | R$ 6,00 | R$ 6,00 |
| **TOTAL GERAL** | - | - | **16 embalagens** | - | **R$ 168,30** |

---

## 2. Experiência do Usuário e Telas

### A. Seleção na Aba "Receitas"
Na barra superior da aba Receitas, haverá o botão **"Gerar Ordem de Compra"**:
- Ao clicar, ativa o modo de seleção com checkboxes nos cards de receitas.
- Para cada receita marcada, surge um campo numérico simples para indicar as fornadas (ex: `2` fornadas de Bolo de Cenoura).
- Barra flutuante inferior com:
  ```
  [ 3 receitas selecionadas (4 fornadas no total) ]  ---> [ Continuar para Lista de Compras ]
  ```

### B. Tela da Nova Aba "Lista de Compras"
Na barra lateral de navegação:
- `Dashboard`
- `Compras & Notas`
- `Ingredientes`
- `Embalagens`
- `Equipamentos`
- `Receitas`
- `Recheios`
- **`Lista de Compras`** *(Nova aba dedicada)*
- `Ajustes`
- `Suporte`

#### Visão da Ordem de Compra Criada (Interface):
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ◄ Voltar para Listas            ORDEM DE COMPRA #04 - PRODUÇÃO DE FIM DE SEMANA                 │
│  Criada em 17/10/2026 · Status: Pendente                                                         │
│  Receitas: Bolo de Cenoura (2x) · Bolo de Chocolate (1x) · Cento de Brigadeiro (1x)              │
│                                                                                                  │
│  [ Copiar p/ WhatsApp ]   [ Imprimir Lista ]   [ Marcar Todos Comprados ]   [ Excluir ]          │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  STATUS │ INGREDIENTE             │ NECESSÁRIO │ EMBALAGEM COMERCIAL  │ COMPRAR     │ VALOR EST. │
├─────────┼─────────────────────────┼────────────┼──────────────────────┼─────────────┼────────────┤
│  [   ]  │ Leite Condensado Moça   │ 1.580 g    │ Caixa 395 g          │ 4 caixas    │   R$ 26,00 │
│  [   ]  │ Leite Integral          │ 250 ml     │ Caixa 1.000 ml (1 L) │ 1 litro     │    R$ 5,20 │
│  [   ]  │ Farinha de Trigo        │ 850 g      │ Pacote 1 kg (1.000g) │ 1 pacote    │    R$ 5,50 │
│  [   ]  │ Açúcar Refinado         │ 800 g      │ Pacote 1 kg (1.000g) │ 1 pacote    │    R$ 4,50 │
│  [   ]  │ Chocolate em Pó 50%     │ 290 g      │ Pacote 1 kg (1.000g) │ 1 pacote    │   R$ 38,00 │
│  [   ]  │ Óleo de Soja            │ 340 ml     │ Garrafa 900 ml       │ 1 garrafa   │    R$ 7,50 │
│  [   ]  │ Ovos Brancos Grandes    │ 9 un       │ Cartela 30 un        │ 1 cartela   │   R$ 24,00 │
│  [   ]  │ Creme de Leite          │ 400 g      │ Caixa 200 g          │ 2 caixas    │    R$ 7,60 │
│  [   ]  │ Manteiga sem Sal        │ 70 g       │ Pote 500 g           │ 1 pote      │   R$ 22,00 │
│  [   ]  │ Granulado Chocolate     │ 250 g      │ Pacote 500 g         │ 1 pacote    │   R$ 14,00 │
│  [   ]  │ Fermento Químico        │ 40 g       │ Pote 250 g           │ 1 pote      │    R$ 8,00 │
│  [   ]  │ Cenoura                 │ 500 g      │ Kg (1.000 g)         │ 1 kg        │    R$ 6,00 │
├─────────┴─────────────────────────┴────────────┴──────────────────────┴─────────────┼────────────┤
│  TOTAL ESTIMADO: 16 embalagens a comprar                                            │  R$ 168,30 │
└─────────────────────────────────────────────────────────────────────────────────────┴────────────┘
```

### C. Formato Gerado ao "Copiar para WhatsApp":
Ao clicar em "Copiar para WhatsApp", o app gera uma mensagem pronta para enviar pelo celular ou web:
```text
📝 *LISTA DE COMPRAS - PRECIFY*
🗓 Data: 17/10/2026
🍰 *Produção:*
• Bolo de Cenoura com Cobertura (2x)
• Bolo de Chocolate (1x)
• Cento de Brigadeiro Tradicional (1x)

🛒 *ITENS A COMPRAR:*
[ ] 4x Leite Condensado (cx 395g)
[ ] 1x Leite Integral (cx 1L)
[ ] 1x Farinha de Trigo (pct 1kg)
[ ] 1x Açúcar Refinado (pct 1kg)
[ ] 1x Chocolate em Pó 50% (pct 1kg)
[ ] 1x Óleo de Soja (garrafa 900ml)
[ ] 1x Cartela de Ovos (30 un)
[ ] 2x Creme de Leite (cx 200g)
[ ] 1x Manteiga (pote 500g)
[ ] 1x Granulado (pct 500g)
[ ] 1x Fermento Químico (pote 250g)
[ ] 1x Cenoura (1 kg)

💰 *Custo estimado:* R$ 168,30
```

---

## 3. Decisões Técnicas e Integração

1. **Desdobramento de Recheios (`fillings`):**
   - Se uma receita usa um recheio (ex: `filling-brigadeiro`), o motor desdobra automaticamente os ingredientes base do recheio, garantindo que o leite condensado e cacau do recheio entrem na lista de compras.
2. **Normalização de Unidades:**
   - Massa: `g` ↔ `kg` (1 kg = 1.000 g).
   - Volume: `ml` ↔ `l` (1 L = 1.000 ml).
   - Unidades: `un` ↔ `un`.
3. **Persistência no Firebase:**
   - Salvo no documento `appData/{userId}` sob a chave `purchaseOrders`, com carregamento automático e sincronização em tempo real na nuvem.

---

## 4. Plano de Execução do Código

1. **`types.ts`:**
   - Adicionar interface `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseOrderRecipeRef`.
   - Adicionar `'shopping-list'` ao union type `Page`.
2. **`components/shoppingCalculator.ts`:**
   - Implementar cálculo de consolidação, conversão de unidades e arredondamento comercial (`Math.ceil`).
3. **`components/ShoppingListManager.tsx`:**
   - Implementar visualização das ordens de compra, checklist interativo com marcação de comprado, totalizadores, exportação p/ WhatsApp e impressão.
4. **`components/Recipes.tsx`:**
   - Adicionar modo de seleção de receitas com ajuste de fornadas e botão para gerar a ordem de compra.
5. **`App.tsx`:**
   - Incluir a aba **Lista de Compras** no menu lateral.
   - Gerenciar o estado de `purchaseOrders` e salvar no Firestore.
6. **Verificação & Testes:**
   - Executar `compile_applet` para validar integridade de tipos e compilação.
