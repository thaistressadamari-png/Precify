
import type { Ingredient, Packaging, AppSettings, Recipe } from '../types';

export const defaultIngredients: Ingredient[] = [
  {
    "id": "1761065980485",
    "name": "Farinha de Trigo Sol",
    "unit": "kg",
    "supplier": "Kibe",
    "packagePrice": 5.29,
    "packageAmount": 1,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761065980485-0",
        "date": "2025-10-21",
        "supplier": "Kibe",
        "packagePrice": 5.29,
        "packageAmount": 1,
        "unit": "kg"
      }
    ]
  },
  {
    "id": "1761066340541",
    "name": "Nata Crioulo",
    "unit": "g",
    "supplier": "Kibe",
    "packagePrice": 14.49,
    "packageAmount": 300,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761066340541-0",
        "date": "2025-10-21",
        "supplier": "Kibe",
        "packagePrice": 14.49,
        "packageAmount": 300,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761066380808",
    "name": "Manteiga Extra Sem Sal Xandô ",
    "unit": "g",
    "supplier": "Kibe",
    "packagePrice": 15.49,
    "packageAmount": 200,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761066380808-0",
        "date": "2025-10-21",
        "supplier": "Kibe",
        "packagePrice": 15.49,
        "packageAmount": 200,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761066405354",
    "name": "Essência de Panetone",
    "unit": "ml",
    "supplier": "Funchal",
    "packagePrice": 3.8,
    "packageAmount": 30,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761066405354-0",
        "date": "2025-10-21",
        "supplier": "Funchal",
        "packagePrice": 3.8,
        "packageAmount": 30,
        "unit": "ml"
      }
    ]
  },
  {
    "id": "1761066458516",
    "name": "Óleo",
    "unit": "ml",
    "supplier": "Inova",
    "packagePrice": 8.29,
    "packageAmount": 900,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761066458516-0",
        "date": "2025-10-21",
        "supplier": "Inova",
        "packagePrice": 8.29,
        "packageAmount": 900,
        "unit": "ml"
      }
    ]
  },
  {
    "id": "1761066487423",
    "name": "Ovo",
    "unit": "un",
    "supplier": "Ceará",
    "packagePrice": 1,
    "packageAmount": 1,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761066487423-0",
        "date": "2025-10-21",
        "supplier": "Ceará",
        "packagePrice": 1,
        "packageAmount": 1,
        "unit": "un"
      }
    ]
  },
  {
    "id": "1761066513357",
    "name": "Leite",
    "unit": "l",
    "supplier": "Inova",
    "packagePrice": 4.59,
    "packageAmount": 1,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761066513357-0",
        "date": "2025-10-21",
        "supplier": "Inova",
        "packagePrice": 4.59,
        "packageAmount": 1,
        "unit": "l"
      }
    ]
  },
  {
    "id": "1761066560039",
    "name": "Amido de Milho",
    "unit": "g",
    "supplier": "Inova",
    "packagePrice": 7,
    "packageAmount": 200,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761066560039-0",
        "date": "2025-10-21",
        "supplier": "Inova",
        "packagePrice": 7,
        "packageAmount": 200,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761066629623",
    "name": "Leite Condensado Moça 8% Gordura Lata",
    "unit": "g",
    "supplier": "Inova",
    "packagePrice": 9.99,
    "packageAmount": 394.999,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761066629623-0",
        "date": "2025-10-21",
        "supplier": "Inova",
        "packagePrice": 9.99,
        "packageAmount": 394.999,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761066655567",
    "name": "Milho Quero",
    "unit": "g",
    "supplier": "Inova",
    "packagePrice": 4.99,
    "packageAmount": 239.998,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761066655567-0",
        "date": "2025-10-21",
        "supplier": "Inova",
        "packagePrice": 4.99,
        "packageAmount": 239.998,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761066692634",
    "name": "Fermento em pó",
    "unit": "g",
    "supplier": "Inova",
    "packagePrice": 13.99,
    "packageAmount": 250,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761066692634-0",
        "date": "2025-10-21",
        "supplier": "Inova",
        "packagePrice": 13.99,
        "packageAmount": 250,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761066729558",
    "name": "Massa de Aipim Fleishman",
    "unit": "un",
    "supplier": "Inova",
    "packagePrice": 7.5,
    "packageAmount": 1,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761066729558-0",
        "date": "2025-10-21",
        "supplier": "Inova",
        "packagePrice": 7.5,
        "packageAmount": 1,
        "unit": "un"
      }
    ]
  },
  {
    "id": "1761066760441",
    "name": "Canela em Pó Pura Granel ",
    "unit": "kg",
    "supplier": "Barbosa",
    "packagePrice": 80.9,
    "packageAmount": 1,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761066760441-0",
        "date": "2025-10-21",
        "supplier": "Barbosa",
        "packagePrice": 80.9,
        "packageAmount": 1,
        "unit": "kg"
      }
    ]
  },
  {
    "id": "1761066791481",
    "name": "Doce de Leite Frimesa Tradicional",
    "unit": "g",
    "supplier": "Kibe",
    "packagePrice": 9.49,
    "packageAmount": 400,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761066791481-0",
        "date": "2025-10-21",
        "supplier": "Kibe",
        "packagePrice": 9.49,
        "packageAmount": 400,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761066817508",
    "name": "Creme de Leite Piracanjuba 15% ",
    "unit": "g",
    "supplier": "Inova",
    "packagePrice": 4.49,
    "packageAmount": 200,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761066817508-0",
        "date": "2025-10-21",
        "supplier": "Inova",
        "packagePrice": 4.49,
        "packageAmount": 200,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761067112164",
    "name": "Leite Condensado Italac Gourmet",
    "unit": "g",
    "supplier": "",
    "packagePrice": 9.99,
    "packageAmount": 395,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761067112164-0",
        "date": "2025-10-21",
        "supplier": "",
        "packagePrice": 9.99,
        "packageAmount": 395,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761068490600",
    "name": "Leite em Pó Ninho Integral",
    "unit": "g",
    "supplier": "Dia",
    "packagePrice": 26.49,
    "packageAmount": 380,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761068490600-0",
        "date": "2025-10-21",
        "supplier": "Dia",
        "packagePrice": 26.49,
        "packageAmount": 380,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761068531759",
    "name": "Cacau em Pó 100% Sicao",
    "unit": "g",
    "supplier": "Funchal",
    "packagePrice": 39.99,
    "packageAmount": 500,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761068531759-0",
        "date": "2025-10-21",
        "supplier": "Funchal",
        "packagePrice": 39.99,
        "packageAmount": 500,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761068585635",
    "name": "Chocolate Gotas Chips Ao Leite Sicao",
    "unit": "kg",
    "supplier": "Funchal",
    "packagePrice": 122.99,
    "packageAmount": 1.01,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761068585635-0",
        "date": "2025-10-21",
        "supplier": "Funchal",
        "packagePrice": 122.99,
        "packageAmount": 1.01,
        "unit": "kg"
      }
    ]
  },
  {
    "id": "1761068618757",
    "name": "Chocolate em Pó 70% Cacau Sicao",
    "unit": "g",
    "supplier": "Funchal",
    "packagePrice": 29.99,
    "packageAmount": 500,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761068618757-0",
        "date": "2025-10-21",
        "supplier": "Funchal",
        "packagePrice": 29.99,
        "packageAmount": 500,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761068692293",
    "name": "Chocolate Ao Leite Nobre em Gotas Sicao",
    "unit": "kg",
    "supplier": "Funchal",
    "packagePrice": 89.99,
    "packageAmount": 1.01,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761068692293-0",
        "date": "2025-10-21",
        "supplier": "Funchal",
        "packagePrice": 89.99,
        "packageAmount": 1.01,
        "unit": "kg"
      }
    ]
  },
  {
    "id": "1761068776763",
    "name": "Chocolate em Barra Meio Amargo Melken",
    "unit": "g",
    "supplier": "Funchal",
    "packagePrice": 59.99,
    "packageAmount": 500,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761068776763-0",
        "date": "2025-10-21",
        "supplier": "Funchal",
        "packagePrice": 59.99,
        "packageAmount": 500,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761069056379",
    "name": "Chocolate em Pó 33% Cacau Melken",
    "unit": "kg",
    "supplier": "Shopee",
    "packagePrice": 44.99,
    "packageAmount": 1.01,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761069056379-0",
        "date": "2025-10-21",
        "supplier": "Shopee",
        "packagePrice": 44.99,
        "packageAmount": 1.01,
        "unit": "kg"
      }
    ]
  },
  {
    "id": "1761069110716",
    "name": "Leite Condensado Cemil 8%",
    "unit": "g",
    "supplier": "Funchal",
    "packagePrice": 5.79,
    "packageAmount": 395,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761069110716-0",
        "date": "2025-10-21",
        "supplier": "Funchal",
        "packagePrice": 5.79,
        "packageAmount": 395,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761069133541",
    "name": "Creme de Leite Cemil 20%",
    "unit": "g",
    "supplier": "Funchal",
    "packagePrice": 3.99,
    "packageAmount": 200,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761069133541-0",
        "date": "2025-10-21",
        "supplier": "Funchal",
        "packagePrice": 3.99,
        "packageAmount": 200,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761084733945",
    "name": "Café Solúvel Nescafé Suave Pacote 40g",
    "unit": "g",
    "supplier": "Dia",
    "packagePrice": 9.99,
    "packageAmount": 40,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761084733945-0",
        "date": "2025-10-21",
        "supplier": "Dia",
        "packagePrice": 9.99,
        "packageAmount": 40,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761084769563",
    "name": "Granulé de Chocolate Melken Meio Amargo",
    "unit": "g",
    "supplier": "Loja de Doces",
    "packagePrice": 16.49,
    "packageAmount": 130,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761084769563-0",
        "date": "2025-10-21",
        "supplier": "Loja de Doces",
        "packagePrice": 16.49,
        "packageAmount": 130,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761084791314",
    "name": "Granulé de Chocolate Melken Branco",
    "unit": "g",
    "supplier": "Loja de Doces",
    "packagePrice": 16.49,
    "packageAmount": 130,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761084791314-0",
        "date": "2025-10-21",
        "supplier": "Loja de Doces",
        "packagePrice": 16.49,
        "packageAmount": 130,
        "unit": "g"
      }
    ]
  },
  {
    "id": "1761084812368",
    "name": "Maracujá Azedo ",
    "unit": "un",
    "supplier": "Inova",
    "packagePrice": 2,
    "packageAmount": 1,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761084812368-0",
        "date": "2025-10-21",
        "supplier": "Inova",
        "packagePrice": 2,
        "packageAmount": 1,
        "unit": "un"
      }
    ]
  },
  {
    "id": "1761084827180",
    "name": "Limão",
    "unit": "un",
    "supplier": "Dia",
    "packagePrice": 40,
    "packageAmount": 1,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761084827180-0",
        "date": "2025-10-21",
        "supplier": "Dia",
        "packagePrice": 40,
        "packageAmount": 1,
        "unit": "un"
      }
    ]
  },
  {
    "id": "1761084863930",
    "name": "Amêndoas Laminadas Granel 1kg",
    "unit": "kg",
    "supplier": "Empório Cerealista",
    "packagePrice": 129.9,
    "packageAmount": 1,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "1761084863930-0",
        "date": "2025-10-21",
        "supplier": "Empório Cerealista",
        "packagePrice": 129.9,
        "packageAmount": 1,
        "unit": "kg"
      }
    ]
  },
  {
    "id": "ing-acucar-refinado-1",
    "name": "Açúcar Refinado União",
    "unit": "kg",
    "supplier": "Inova",
    "packagePrice": 4.89,
    "packageAmount": 1,
    "purchaseDate": "2025-10-21",
    "history": [
      {
        "id": "ing-acucar-refinado-1-0",
        "date": "2025-10-21",
        "supplier": "Inova",
        "packagePrice": 4.89,
        "packageAmount": 1,
        "unit": "kg"
      }
    ]
  }
];

export const defaultPackaging: Packaging[] = [
  {
    id: 'pkg-bolo-padrao-1',
    name: 'Caixa para Bolo Padrão (25cm)',
    price: 3.50,
    amount: 1,
    unit: 'un'
  },
  {
    id: 'pkg-fatia-torta-1',
    name: 'Embalagem para Fatia de Torta',
    price: 15.00,
    amount: 50,
    unit: 'un'
  }
];

export const defaultSettings: AppSettings = {
  laborCostPerHour: 20.00,
  kwhPrice: 0.92,
  gasCanisterPrice: 110.00,
  taxPercentage: 6,
  ingredientOutdatedDays: 45,
};

export const defaultRecipes: Recipe[] = [];
