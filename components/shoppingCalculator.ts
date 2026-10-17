import type { Recipe, Ingredient, Unit, PurchaseOrder, PurchaseOrderItem, PurchaseOrderRecipeRef } from '../types';

/**
 * Normaliza e converte quantidades entre unidades compatíveis (g <-> kg, ml <-> l, un <-> un).
 * Retorna a quantidade convertida para a unidade de destino, ou null se forem incompatíveis.
 */
export function convertUnitAmount(amount: number, fromUnit: Unit, toUnit: Unit): number | null {
  if (fromUnit === toUnit) return amount;

  // Massa
  if (fromUnit === 'g' && toUnit === 'kg') return amount / 1000;
  if (fromUnit === 'kg' && toUnit === 'g') return amount * 1000;

  // Volume
  if (fromUnit === 'ml' && toUnit === 'l') return amount / 1000;
  if (fromUnit === 'l' && toUnit === 'ml') return amount * 1000;

  // Unidade incompatível
  return null;
}

export interface RecipeSelection {
  recipe: Recipe;
  batches: number;
}

interface ConsolidatedRawItem {
  ingredientId: string;
  name: string;
  supplier?: string;
  amount: number;
  unit: Unit;
}

/**
 * Desdobra os ingredientes de uma receita, incluindo recheios compostos
 */
function extractIngredientsFromRecipe(
  recipe: Recipe,
  multiplier: number,
  allFillings: Recipe[]
): ConsolidatedRawItem[] {
  const result: ConsolidatedRawItem[] = [];

  recipe.ingredientSections?.forEach(section => {
    section.ingredients?.forEach(item => {
      const totalAmount = item.amount * multiplier;

      // Verifica se o item é um recheio composto (ex: filling-123)
      if (item.ingredientId.startsWith('filling-')) {
        const fillingId = item.ingredientId.replace('filling-', '');
        const matchingFilling = allFillings.find(f => f.id === fillingId);

        if (matchingFilling && matchingFilling.yieldAmount > 0) {
          // O recheio rende yieldAmount (ex: 500g). A receita usa item.amount (ex: 250g).
          // Proporção de fornada do recheio:
          const fillingProportion = (totalAmount / matchingFilling.yieldAmount);
          const subItems = extractIngredientsFromRecipe(matchingFilling, fillingProportion, allFillings);
          result.push(...subItems);
          return;
        }
      }

      result.push({
        ingredientId: item.ingredientId,
        name: '',
        amount: totalAmount,
        unit: item.unit,
      });
    });
  });

  return result;
}

/**
 * Gera uma Ordem de Compra consolidada a partir de receitas e suas fornadas
 */
export function generatePurchaseOrder(
  selections: RecipeSelection[],
  catalogIngredients: Ingredient[],
  allFillings: Recipe[] = [],
  customName?: string
): PurchaseOrder {
  // 1. Filtrar seleções válidas com pelo menos 0.01 fornada
  const activeSelections = selections.filter(s => s.batches > 0);

  // 2. Extrair e acumular todos os insumos brutos
  const rawItemsMap = new Map<string, { amount: number; unit: Unit }>();

  activeSelections.forEach(sel => {
    const items = extractIngredientsFromRecipe(sel.recipe, sel.batches, allFillings);
    items.forEach(raw => {
      const existing = rawItemsMap.get(raw.ingredientId);
      if (!existing) {
        rawItemsMap.set(raw.ingredientId, { amount: raw.amount, unit: raw.unit });
      } else {
        // Tenta converter se as unidades diferirem
        const converted = convertUnitAmount(raw.amount, raw.unit, existing.unit);
        if (converted !== null) {
          existing.amount += converted;
        } else {
          // Se forem incompatíveis, mantém a soma bruta
          existing.amount += raw.amount;
        }
      }
    });
  });

  // 3. Montar referências das receitas selecionadas
  const recipeRefs: PurchaseOrderRecipeRef[] = activeSelections.map(sel => ({
    recipeId: sel.recipe.id,
    recipeName: sel.recipe.name,
    batches: sel.batches,
    yieldAmount: sel.recipe.yieldAmount,
    yieldUnit: sel.recipe.yieldUnit,
  }));

  // 4. Calcular quantidades de pacotes comerciais inteiros (arredondamento para cima)
  const items: PurchaseOrderItem[] = [];
  let totalEstimatedCost = 0;

  rawItemsMap.forEach((req, ingredientId) => {
    const catalogItem = catalogIngredients.find(ing => ing.id === ingredientId);

    const name = catalogItem ? catalogItem.name : `Ingrediente (${ingredientId})`;
    const supplier = catalogItem?.supplier || undefined;
    const packageAmount = catalogItem?.packageAmount || 1;
    const packageUnit = catalogItem?.unit || req.unit;
    const packagePrice = catalogItem?.packagePrice || 0;

    // Converter quantidade necessária para a unidade da embalagem comercial
    const convertedToPackageUnit = convertUnitAmount(req.amount, req.unit, packageUnit);
    const amountInPkgUnit = convertedToPackageUnit !== null ? convertedToPackageUnit : req.amount;

    // Calcular quantidade de pacotes comerciais inteiros necessários (teto / arredondamento para cima)
    let packagesToBuy = 1;
    if (packageAmount > 0 && amountInPkgUnit > 0) {
      packagesToBuy = Math.ceil(amountInPkgUnit / packageAmount);
    }

    const estimatedCost = packagesToBuy * packagePrice;
    totalEstimatedCost += estimatedCost;

    items.push({
      id: `poi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ingredientId,
      ingredientName: name,
      supplier,
      totalRequiredAmount: req.amount,
      recipeUnit: req.unit,
      packageAmount,
      packageUnit,
      packagePrice,
      packagesToBuy,
      estimatedCost,
      checked: false,
    });
  });

  // Ordenar itens por nome
  items.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName, 'pt-BR'));

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const defaultOrderName = `Produção ${dateStr} (${recipeRefs.length} ${recipeRefs.length === 1 ? 'receita' : 'receitas'})`;

  return {
    id: `order-${Date.now()}`,
    name: customName?.trim() || defaultOrderName,
    createdAt: now.toISOString(),
    status: 'pending',
    recipes: recipeRefs,
    items,
    totalEstimatedCost,
  };
}

/**
 * Formata a quantidade e unidade para exibição amigável
 */
export function formatAmountWithUnit(amount: number, unit: Unit): string {
  const formatted = amount % 1 === 0 ? amount.toString() : amount.toFixed(1).replace('.', ',');
  return `${formatted} ${unit}`;
}

/**
 * Gera texto formatado para envio no WhatsApp
 */
export function formatOrderForWhatsApp(order: PurchaseOrder): string {
  const dateFormatted = new Date(order.createdAt).toLocaleDateString('pt-BR');
  
  let text = `🛒 *LISTA DE COMPRAS - PRECIFY*\n`;
  text += `📋 *${order.name}*\n`;
  text += `🗓 *Data:* ${dateFormatted}\n\n`;

  if (order.recipes.length > 0) {
    text += `🍰 *Receitas Planejadas:*\n`;
    order.recipes.forEach(r => {
      text += `• ${r.recipeName} (${r.batches}x fornada${r.batches > 1 ? 's' : ''})\n`;
    });
    text += `\n`;
  }

  text += `📦 *ITENS A COMPRAR (PACOTES FECHADOS):*\n`;
  order.items.forEach(item => {
    const mark = item.checked ? '✅' : '⬜';
    const pkgDesc = `${item.packageAmount} ${item.packageUnit}`;
    text += `${mark} *${item.packagesToBuy}x* ${item.ingredientName} (${pkgDesc})`;
    if (item.supplier) {
      text += ` _[${item.supplier}]_`;
    }
    text += `\n`;
  });

  const costFormatted = order.totalEstimatedCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  text += `\n💰 *Total Estimado:* ${costFormatted}\n`;

  if (order.notes) {
    text += `\n📌 *Observações:* ${order.notes}\n`;
  }

  return text;
}
