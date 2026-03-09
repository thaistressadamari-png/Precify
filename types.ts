
export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'un';
export type PackagingUnit = 'un' | 'pacote' | 'rolo' | 'm';

export interface GlobalConfig {
  paymentLink: string;
  trialDays: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  trialEndsAt?: any; // Firestore Timestamp
  hasGivenFeedback?: boolean;
  isSubscribed?: boolean;
  paymentConfirmationClicked?: boolean;
  role?: 'admin' | 'user';
}

export interface SupportMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'admin' | 'user';
  text: string;
  timestamp: any; // Firestore Timestamp
}

export type TicketStatus = 'open' | 'in_progress' | 'closed';
export type TicketCategory = 'bug' | 'improvement' | 'question' | 'other';

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  messages: SupportMessage[];
}

export interface ActionHistory {
  id: string;
  timestamp: any; // Firestore Timestamp
  actionType: 'ADMIN_STATUS_CHANGE' | 'USER_CONFIRMED_PAYMENT' | 'TICKET_RESPONSE' | 'GLOBAL_CONFIG_CHANGE';
  description: string;
  adminId?: string;
  adminName?: string;
  userId: string;
  userName: string;
  details?: Record<string, any>;
}

export interface UserAuth extends User {
  password?: string;
}

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
  id:string;
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
  category?: string;
  laborMinutes: number;
  energyUsageMinutes: number;
  gasUsageMinutes: number;
  variableCostsPercentage?: number;
  profitMargin?: number;
  taxPercentage?: number;
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

export type Page = 'dashboard' | 'ingredients' | 'packaging' | 'recipes' | 'settings' | 'recipe-pricer' | 'recipe-details' | 'ingredient-form' | 'packaging-form' | 'ingredient-details' | 'fillings' | 'filling-pricer' | 'filling-details' | 'support';
