export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'un';
export type PackagingUnit = 'un' | 'pacote' | 'rolo' | 'm';

export interface Purchase {
  id: string;
  date: string;
  supplier?: string;
  packagePrice: number;
  packageAmount: number;
  unit: Unit;
}

export interface Ingredient {
  id: string;
  name: string;
  supplier?: string;
  packagePrice: number;
  packageAmount: number;
  unit: Unit;
  purchaseDate?: string; // Date of the latest purchase
  history: Purchase[];
}

export interface Packaging {
  id: string;
  name: string;
  price: number;
  amount: number;
  unit: PackagingUnit;
}

export interface RecipeIngredient {
  id: string;
  ingredientId: string;
  amount: number;
  unit: Unit;
}

export interface IngredientSection {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
}

export interface RecipePackaging {
  id: string;
  packagingId: string;
  amount: number;
}

export interface Recipe {
  id:string;
  name: string;
  ingredientSections: IngredientSection[];
  packaging: RecipePackaging[];
  yieldAmount: number;
  yieldUnit: string;
  laborMinutes: number;
  energyUsageMinutes: number;
  gasUsageMinutes: number;
  variableCostsPercentage?: number;
  profitMargin?: number;
  evaporationPercentage: number;
  preparationMethod?: string[];
  observationsTitle?: string;
  observations?: string[];
}

export interface AppSettings {
  laborCostPerHour: number;
  kwhPrice: number;
  gasCanisterPrice: number;
  taxPercentage: number;
  ingredientOutdatedDays: number;
}

export type Page = 'dashboard' | 'ingredients' | 'packaging' | 'recipes' | 'settings' | 'recipe-pricer' | 'recipe-details' | 'ingredient-form' | 'packaging-form' | 'ingredient-details' | 'fillings' | 'filling-pricer' | 'filling-details';