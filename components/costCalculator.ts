import type { Recipe, Ingredient, Packaging, AppSettings, Unit } from '../types';

export const convertToBaseUnitAmount = (amount: number, unit: string) => {
    if (unit === 'kg' || unit === 'l') return amount * 1000;
    return amount;
};

export const getBaseUnit = (unit: string) => {
    if (unit === 'kg') return 'g';
    if (unit === 'l') return 'ml';
    return unit;
};

const GAS_CANISTER_HOURS = 60;

export const calculateCosts = (
    recipe: Omit<Recipe, 'id'>,
    ingredients: Ingredient[],
    packagingItems: Packaging[],
    settings: AppSettings,
    type: 'recipe' | 'filling' = 'recipe'
) => {
    const allRecipeIngredients = recipe.ingredientSections.flatMap(section => section.ingredients);
    
    const ingredientsCost = allRecipeIngredients.reduce((total, recipeIng) => {
      const ingData = ingredients.find(i => i.id === recipeIng.ingredientId);
      if (!ingData) return total;

      const recipeIngBaseAmount = convertToBaseUnitAmount(recipeIng.amount, recipeIng.unit);
      const ingDataBaseAmount = convertToBaseUnitAmount(ingData.packageAmount, ingData.unit);
      
      if (getBaseUnit(recipeIng.unit) !== getBaseUnit(ingData.unit)) return total;
      
      const cost = (ingData.packagePrice / ingDataBaseAmount) * recipeIngBaseAmount;
      return total + (isNaN(cost) ? 0 : cost);
    }, 0);

    const packagingCost = recipe.packaging.reduce((total, recipePkg) => {
        const pkgData = packagingItems.find(p => p.id === recipePkg.packagingId);
        if(!pkgData) return total;
        const cost = (pkgData.price / pkgData.amount) * recipePkg.amount;
        return total + (isNaN(cost) ? 0 : cost);
    }, 0);
    
    const laborCost = (recipe.laborMinutes / 60) * (settings.laborCostPerHour || 0);
    const energyCost = (recipe.energyUsageMinutes / 60) * (settings.kwhPrice || 0);
    const gasCost = (recipe.gasUsageMinutes / 60) * ((settings.gasCanisterPrice || 0) / GAS_CANISTER_HOURS);
    
    const operationalCosts = laborCost + energyCost + gasCost;
    const baseCost = ingredientsCost + packagingCost + operationalCosts;

    // --- Default values for filling ---
    let totalCost = baseCost;
    let taxValue = 0;
    let variableCostsValue = 0;
    let finalSalePrice = 0;
    let salePricePerUnit = 0;
    let profitValue = 0;

    // --- Calculations for 'recipe' type ---
    if (type === 'recipe') {
        const taxRate = (settings.taxPercentage || 0) / 100; // t
        const variableCostsRate = (recipe.variableCostsPercentage || 0) / 100; // v
        const profitMarginRate = (recipe.profitMargin || 0) / 100; // m_c (markup on cost)

        const denominator = 1 - taxRate - variableCostsRate;
        
        // Use the formula: Price = F * (1 + m_c) / (1 - t - v)
        finalSalePrice = (denominator > 0 && isFinite(baseCost))
            ? (baseCost * (1 + profitMarginRate)) / denominator
            : baseCost * (1 + profitMarginRate); // Fallback if denominator is invalid
        
        if (!isFinite(finalSalePrice)) {
            finalSalePrice = 0;
        }

        // Calculate monetary values based on the final sale price
        taxValue = finalSalePrice * taxRate;
        variableCostsValue = finalSalePrice * variableCostsRate;
        
        // Profit is the remaining part after all costs are subtracted from the sale price
        profitValue = finalSalePrice - baseCost - taxValue - variableCostsValue;
        
        // Total Cost for display is the sum of all costs (everything except profit)
        totalCost = baseCost + taxValue + variableCostsValue;

        const yieldAmount = recipe.yieldAmount || 0;
        if (yieldAmount > 0) {
          salePricePerUnit = finalSalePrice / yieldAmount;
        }
    }
    
    // --- Calculations for 'filling' type ---
    const netYieldAmount = (recipe.yieldAmount || 0) * (1 - ((recipe.evaporationPercentage || 0) / 100));

    let pricePerKg = 0;
    const yieldUnit = recipe.yieldUnit?.toLowerCase() || 'g';
    if ((yieldUnit.includes('g') || yieldUnit.includes('kg')) && netYieldAmount > 0) {
        const yieldInKg = yieldUnit.includes('kg') ? netYieldAmount : netYieldAmount / 1000;
        // For fillings, totalCost is just baseCost
        const costForFilling = (type === 'filling') ? baseCost : totalCost;
        pricePerKg = isFinite(costForFilling) && yieldInKg > 0 ? costForFilling / yieldInKg : 0;
    }

    return { 
        ingredientsCost, 
        packagingCost, 
        laborCost, 
        energyCost, 
        gasCost, 
        baseCost,
        taxValue,
        variableCostsValue,
        totalCost,
        netYieldAmount,
        pricePerKg,
        finalSalePrice,
        salePricePerUnit,
        profitValue,
    };
}

export const getPricePerBaseUnit = (price: number, amount: number, unit: Unit): { pricePerUnit: number, baseUnitLabel: string } => {
    const baseAmount = convertToBaseUnitAmount(amount, unit);
    const baseUnit = getBaseUnit(unit);
    if (baseAmount === 0) return { pricePerUnit: 0, baseUnitLabel: unit };

    const pricePerBaseAmount = price / baseAmount;
    
    if (baseUnit === 'g') {
        return { pricePerUnit: pricePerBaseAmount * 1000, baseUnitLabel: 'kg' };
    }
     if (baseUnit === 'ml') {
        return { pricePerUnit: pricePerBaseAmount * 1000, baseUnitLabel: 'l' };
    }
    
    return { pricePerUnit: pricePerBaseAmount, baseUnitLabel: baseUnit };
};