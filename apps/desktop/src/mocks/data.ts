import type { Category, MenuItem } from '../types';

// --- CATEGORIAS ---
export const mockCategories: Category[] = [
  {
    id: 'cat_burritos',
    name: 'Burritos',
    icon: 'ri-cake-3-line',
    order: 1,
    active: true
  },
  {
    id: 'cat_quesadillas',
    name: 'Quesadillas',
    icon: 'ri-cake-2-line',
    order: 2,
    active: true
  },
  {
    id: 'cat_tacos',
    name: 'Tacos',
    icon: 'ri-restaurant-line',
    order: 3,
    active: true
  },
  {
    id: 'cat_nachos',
    name: 'Nachos',
    icon: 'ri-bowl-line',
    order: 4,
    active: true
  },
  {
    id: 'cat_extras',
    name: 'Extras',
    icon: 'ri-add-circle-line',
    order: 5,
    active: true
  },
  {
    id: 'cat_bebidas',
    name: 'Bebidas',
    icon: 'ri-drop-line',
    order: 6,
    active: true
  },
  {
    id: 'cat_drinks_na',
    name: 'Drinks Não Alcoólicos',
    icon: 'ri-glass-line',
    order: 7,
    active: true
  },
  {
    id: 'cat_drinks_a',
    name: 'Drinks Alcoólicos',
    icon: 'ri-goblet-line',
    order: 8,
    active: true
  },
  {
    id: 'cat_chope',
    name: 'Chope',
    icon: 'ri-beer-line',
    order: 9,
    active: true
  }
];

// --- ITENS ---
let codeCounter = 1;

const createItem = (
  name: string,
  price: number,
  sla: number,
  categoryId: string,
  observations: string[],
  active: boolean = true,
  image?: string,
  skipKitchen: boolean = false
): MenuItem => ({
    id: Date.now().toString() + codeCounter,
    name,
    price,
    sla,
    categoryId,
    observations,
    active,
    code: (codeCounter++).toString(), // Código sequencial numérico
    image,
    skipKitchen
});

export const mockMenuItems: MenuItem[] = [
  // Burritos (SLA 8 min)
  createItem('Classic Burrito', 38.00, 8, 'cat_burritos', ['Tortilla de Trigo', 'Chilli com Carne', 'Bacon Crocante', 'Cheddar', 'Barbecue', 'Alface', 'Tomate', 'Pimenta Jalapeño', 'Molho de Pimenta']),
  createItem('4 Quesos Burrito', 38.00, 8, 'cat_burritos', ['Tortilla de Trigo', 'Molho 4 Queijos', 'Frango', 'Tomate', 'Rúcula', 'Bacon', 'Molho de Pimenta']),
  createItem('Al Pastor Burrito', 38.00, 8, 'cat_burritos', ['Tortilla de Trigo', 'Pernil em Cubos', 'Bacon Crocante', 'Pasta de Feijão', 'Abacaxi', 'Cheddar', 'Barbecue', 'Alface', 'Tomate', 'Molho de Pimenta']),
  createItem('Barbacoa Burrito', 41.00, 8, 'cat_burritos', ['Tortilla de Trigo', 'Barbacoa (carne bovina desfiada com molho apimentado)', 'Mussarela', 'Jalapeño', 'Pico de Gallo (contém pimenta)', 'Alface', 'Rúcula']),
  
  // Quesadillas (SLA 8 min)
  createItem('Chilli con Carne Quesadilla', 21.00, 8, 'cat_quesadillas', ['Tortilla de Trigo', 'Chilli com Carne', 'Mussarela', 'Cheddar', 'Molho de Pimenta']),
  createItem('Pollo Quesadilla', 21.00, 8, 'cat_quesadillas', ['Tortilla de Trigo', 'Tiras de Frango', 'Bacon Crocante', 'Mussarela', 'Cheddar', 'Molho de Pimenta']),
  createItem('Al Pastor Quesadilla', 21.00, 8, 'cat_quesadillas', ['Tortilla de Trigo', 'Pernil em Cubos', 'Abacaxi', 'Barbecue', 'Mussarela', 'Cheddar', 'Molho de Pimenta']),
  createItem('Barbacoa Quesadilla', 21.00, 8, 'cat_quesadillas', ['Tortilla de Trigo', 'Barbacoa (carne bovina desfiada com molho apimentado)', 'Pico de Gallo (contém pimenta)', 'Mussarela']),
  createItem('Ovomaltine Quesadilla', 18.00, 5, 'cat_quesadillas', ['Tortilla de Trigo', 'Chocolate Branco', 'Ovomaltine', 'Mussarela']),
  
  // Nachos (SLA 8 min)
  createItem('Chilli con Carne Nachos', 38.00, 8, 'cat_nachos', ['Tortilla Chips original ou Doritos', 'Chilli con Carne', 'Cheddar', 'Mussarela', 'Molho de Pimenta', 'Guacamole', 'Sour Cream']),
  
  // Tacos (SLA 8 min)
  createItem('Trio de Tacos Sortidos', 44.00, 8, 'cat_tacos', ['1 unidade de Taco Pollo Caliente', '1 unidade de Taco Al Pastor', '1 unidade de Taco Classic']),
  
  // Extras (SLA 3 min)
  createItem('Guacamole 50ml', 5.00, 3, 'cat_extras', ['Acompanhamento']),
  createItem('Sour Cream 50ml', 5.00, 3, 'cat_extras', ['Acompanhamento']),
  createItem('Guacamole 50ml + Sour Cream 50ml + Tortilla Chips 30g', 12.00, 3, 'cat_extras', ['Combo de Acompanhamentos']),

  // Bebidas (SLA 3 min)
  createItem('Água Mineral (Com ou Sem Gás)', 5.00, 3, 'cat_bebidas', ['Com Gás', 'Sem Gás'], true, undefined, true),
  createItem('Refrigerante Lata (Coca-Cola, Coca-Cola Zero e Fanta Guaraná)', 8.00, 3, 'cat_bebidas', ['Coca-Cola', 'Coca-Cola Zero', 'Fanta Guaraná'], true, undefined, true),
  createItem('Del Valle Lata (Uva ou Maracujá)', 8.00, 3, 'cat_bebidas', ['Uva', 'Maracujá'], true, undefined, true),
  createItem('Sucos Naturais (Morango, Maracujá ou Abacaxi com Hortelã)', 12.00, 3, 'cat_bebidas', ['Morango', 'Maracujá', 'Abacaxi com Hortelã'], true, undefined, true),

  // Drinks Não Alcoólicos (SLA 3 min)
  createItem('Soda Italiana (Maçã Verde ou Blueberry) 500ml', 20.00, 3, 'cat_drinks_na', ['Maçã Verde', 'Blueberry', 'Água Gaseificada'], true, undefined, true),
  createItem('Pink Lemonade 500ml', 20.00, 3, 'cat_drinks_na', ['Limão', 'Frutas Vermelhas', 'Água Gaseificada'], true, undefined, true),

  // Drinks Alcoólicos (SLA 3 min)
  createItem('Pink Lemonade Alcoólico 500ml', 25.00, 3, 'cat_drinks_a', ['Limão', 'Frutas Vermelhas', 'Vodka', 'Água Gaseificada'], true, undefined, true),
  createItem('Soda Italiana Alcoólica 500ml', 25.00, 3, 'cat_drinks_a', ['Maçã Verde', 'Blueberry', 'Vodka', 'Água Gaseificada'], true, undefined, true),

  // Chope (SLA 3 min)
  createItem('Chope Pilsen 500ml', 15.00, 3, 'cat_chope', ['Pilsen'], true, undefined, true),
  createItem('Chope IPA 500ml', 20.00, 3, 'cat_chope', ['IPA'], true, undefined, true),
  createItem('Dupla Chope Pilsen 500ml', 25.00, 3, 'cat_chope', ['Pilsen'], true, undefined, true),
  createItem('Dupla Chope IPA 500ml', 35.00, 3, 'cat_chope', ['IPA'], true, undefined, true),
];

export const mockPaymentMethods = [
  'PIX',
  'Dinheiro',
  'Cartão de Débito',
  'Cartão de Crédito'
];
