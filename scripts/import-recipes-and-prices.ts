/**
 * Script de Importação de Fichas Técnicas e Preços
 * 
 * Este script importa:
 * 1. Ingredientes com seus preços
 * 2. Fichas técnicas (receitas) ligando produtos aos ingredientes
 * 
 * Execute no console do navegador após carregar a aplicação
 */

// ============== DADOS DE PREÇOS ==============
const precosData = [
  { nome: 'Tortilha de Trigo 12"', preco: 2.58, tipo_preco: 'UN' },
  { nome: 'Tortilha de Trigo 8', preco: 1.08, tipo_preco: 'UN' },
  { nome: 'Tortilha de Trigo 6"', preco: 0.89, tipo_preco: 'UN' },
  { nome: 'Alface', preco: 0.0133, tipo_preco: 'g' },
  { nome: 'Tomate', preco: 0.0050, tipo_preco: 'g' },
  { nome: 'Pimenta Jalapeño', preco: 0.098, tipo_preco: 'g' },
  { nome: 'Molho de Pimenta', preco: 0.0234, tipo_preco: 'g' },
  { nome: 'Cheddar', preco: 0.0220, tipo_preco: 'g' },
  { nome: 'Coentro', preco: 0.0699, tipo_preco: 'g' },
  { nome: 'Cebola Roxa', preco: 0.0080, tipo_preco: 'g' },
  { nome: 'Rúcula', preco: 0.0190, tipo_preco: 'g' },
  { nome: 'Milho', preco: 0.0205, tipo_preco: 'g' },
  { nome: 'Doritos', preco: 0.0666, tipo_preco: 'g' },
  { nome: 'Abacate', preco: 0.0110, tipo_preco: 'g' },
  { nome: 'Limão Taiti', preco: 0.0040, tipo_preco: 'g' },
  { nome: 'Chocolate', preco: 0.0439, tipo_preco: 'g' },
  { nome: 'Tortilha de milho', preco: 0.0503, tipo_preco: 'g' },
  { nome: 'Avocado', preco: 0.0522, tipo_preco: 'g' },
  { nome: 'Barbacoa', preco: 0.056, tipo_preco: 'g' },
  { nome: 'Chilli com Carne', preco: 0.0265, tipo_preco: 'g' },
  { nome: 'Chilli de Soja', preco: 0.0140, tipo_preco: 'g' },
  { nome: 'Pasta de feijão', preco: 0.0118, tipo_preco: 'g' },
  { nome: 'Frango em tiras', preco: 0.0437, tipo_preco: 'g' },
  { nome: 'Molho 4 queijos', preco: 0.0321, tipo_preco: 'g' },
  { nome: 'Pernil com Abacaxi', preco: 0.0460, tipo_preco: 'g' },
  { nome: 'Sour Cream', preco: 0.039, tipo_preco: 'g' },
  { nome: 'Bacon Crocante', preco: 0.090, tipo_preco: 'g' },
  { nome: 'Barbeccue', preco: 0.0253, tipo_preco: 'g' },
  { nome: 'Pico de galo', preco: 0.0135, tipo_preco: 'g' },
  { nome: 'Mussarela', preco: 0.0345, tipo_preco: 'g' },
  { nome: 'Guacamole', preco: 0.0137, tipo_preco: 'g' },
  { nome: 'Ovomaltine', preco: 0.054, tipo_preco: 'g' },
  { nome: 'Confeti', preco: 0.031, tipo_preco: 'g' },
  { nome: 'Arroz', preco: 0.004, tipo_preco: 'g' },
  { nome: 'Feijão preto', preco: 0.010, tipo_preco: 'g' },
  { nome: 'Barreira', preco: 0.11, tipo_preco: 'UN' },
  { nome: 'Guardanapo', preco: 0.10, tipo_preco: 'UN' },
  { nome: 'Embalagem Nachos', preco: 0.69, tipo_preco: 'UN' },
  { nome: 'Dell Valle Goiabada 290 ml', preco: 3.99, tipo_preco: 'UN' },
  { nome: 'Dell Valle Pessego 290 ml', preco: 3.11, tipo_preco: 'UN' },
  { nome: 'Dell Valle Maracuja 290 ml', preco: 3.28, tipo_preco: 'UN' },
  { nome: 'Dell Valle Uva 290 ml', preco: 3.11, tipo_preco: 'UN' },
  { nome: 'Fanta Laranja Lata 350 ml', preco: 3.49, tipo_preco: 'UN' },
  { nome: 'Coca Cola Zero Lata 350ml', preco: 3.14, tipo_preco: 'UN' },
  { nome: 'Coca Cola Lata 350ml', preco: 3.49, tipo_preco: 'UN' },
  { nome: 'Agua mineral com gas 500 ml', preco: 1.38, tipo_preco: 'UN' },
  { nome: 'Agua mineral sem gas 500 ml', preco: 1.08, tipo_preco: 'UN' },
  { nome: 'Pimenta El Patron Pepper 300g', preco: 12.90, tipo_preco: 'UN' },
  { nome: 'Molho Barbecue Chipotle 300g', preco: 11.02, tipo_preco: 'UN' },
  { nome: 'Molho Barbecue Original El Patron Pepper 300g', preco: 9.90, tipo_preco: 'UN' },
  { nome: 'Molho Sweet Chilli El Patron Pepper 300g', preco: 10.50, tipo_preco: 'UN' },
  { nome: 'Gelo', preco: 0.0027, tipo_preco: 'g' },
  { nome: 'Água com Gás drink', preco: 0.00267, tipo_preco: 'g' },
  { nome: 'Xarope Maçã Verde', preco: 0.056, tipo_preco: 'g' },
  { nome: 'Vodka', preco: 0.03998, tipo_preco: 'g' },
  { nome: 'Canudo', preco: 0.2038, tipo_preco: 'UN' },
  { nome: 'Copo personalizado', preco: 0.59, tipo_preco: 'UN' },
  { nome: 'Limão drink', preco: 0.00519, tipo_preco: 'g' },
  { nome: 'Xarope Pink Lemonade', preco: 0.0654, tipo_preco: 'g' },
  { nome: 'chopp manics', preco: 0.01176, tipo_preco: 'g' },
  { nome: 'cerveja ipa lN manics', preco: 8, tipo_preco: 'UN' },
  { nome: 'cerveja ipa lata manics', preco: 7, tipo_preco: 'UN' },
  { nome: 'chopp germania', preco: 0.011, tipo_preco: 'g' },
  { nome: 'embalagem ensalada', preco: 0.70, tipo_preco: 'UN' },
  { nome: 'garfo', preco: 0.117, tipo_preco: 'UN' },
  { nome: 'pote para molho 75 ml', preco: 0.1787, tipo_preco: 'UN' },
  { nome: 'pote para molho 120 ml', preco: 0.2735, tipo_preco: 'UN' },
  { nome: 'tampa pote para molho', preco: 0.31279, tipo_preco: 'UN' },
  { nome: 'pazinha', preco: 0.1646, tipo_preco: 'UN' },
  { nome: 'saco chips', preco: 0.276, tipo_preco: 'UN' },
  { nome: 'saco 02 kg', preco: 0.03933, tipo_preco: 'UN' },
  { nome: 'saco 10 kg', preco: 0.12, tipo_preco: 'UN' },
  { nome: 'saco 18 kg', preco: 0.168, tipo_preco: 'UN' },
];

// ============== FICHAS TÉCNICAS ==============
const receitasData: Record<string, Array<{ nome: string; quantidade: number; unidade: string }>> = {
  'Burrito Clássico': [
    { nome: 'Tortilha de Trigo 12"', quantidade: 1, unidade: 'UN' },
    { nome: 'Barbeccue', quantidade: 17, unidade: 'g' },
    { nome: 'Bacon Crocante', quantidade: 10, unidade: 'g' },
    { nome: 'Chilli com Carne', quantidade: 150, unidade: 'g' },
    { nome: 'Alface', quantidade: 10, unidade: 'g' },
    { nome: 'Tomate', quantidade: 50, unidade: 'g' },
    { nome: 'Pimenta Jalapeño', quantidade: 15, unidade: 'g' },
    { nome: 'Molho de Pimenta', quantidade: 5, unidade: 'g' },
    { nome: 'Cheddar', quantidade: 20, unidade: 'g' },
    { nome: 'Barreira', quantidade: 1, unidade: 'UN' },
    { nome: 'Guardanapo', quantidade: 2, unidade: 'UN' },
  ],
  'Burrito Barbacoa': [
    { nome: 'Tortilha de Trigo 12"', quantidade: 1, unidade: 'UN' },
    { nome: 'Barbacoa', quantidade: 150, unidade: 'g' },
    { nome: 'Mussarela', quantidade: 30, unidade: 'g' },
    { nome: 'Pimenta Jalapeño', quantidade: 15, unidade: 'g' },
    { nome: 'Pico de galo', quantidade: 40, unidade: 'g' },
    { nome: 'Alface', quantidade: 10, unidade: 'g' },
    { nome: 'Rúcula', quantidade: 10, unidade: 'g' },
    { nome: 'Barreira', quantidade: 1, unidade: 'UN' },
    { nome: 'Guardanapo', quantidade: 2, unidade: 'UN' },
  ],
  'Burrito Al Pastor': [
    { nome: 'Tortilha de Trigo 12"', quantidade: 1, unidade: 'UN' },
    { nome: 'Pasta de feijão', quantidade: 35, unidade: 'g' },
    { nome: 'Bacon Crocante', quantidade: 10, unidade: 'g' },
    { nome: 'Pernil com Abacaxi', quantidade: 120, unidade: 'g' },
    { nome: 'Barbeccue', quantidade: 17, unidade: 'g' },
    { nome: 'Alface', quantidade: 10, unidade: 'g' },
    { nome: 'Tomate', quantidade: 50, unidade: 'g' },
    { nome: 'Molho de Pimenta', quantidade: 5, unidade: 'g' },
    { nome: 'Cheddar', quantidade: 20, unidade: 'g' },
    { nome: 'Barreira', quantidade: 1, unidade: 'UN' },
    { nome: 'Guardanapo', quantidade: 2, unidade: 'UN' },
  ],
  'Burrito Veggie': [
    { nome: 'Tortilha de Trigo 12"', quantidade: 1, unidade: 'UN' },
    { nome: 'Chilli de Soja', quantidade: 120, unidade: 'g' },
    { nome: 'Milho', quantidade: 40, unidade: 'g' },
    { nome: 'Alface', quantidade: 10, unidade: 'g' },
    { nome: 'Tomate', quantidade: 50, unidade: 'g' },
    { nome: 'Pimenta Jalapeño', quantidade: 15, unidade: 'g' },
    { nome: 'Molho de Pimenta', quantidade: 5, unidade: 'g' },
    { nome: 'Cheddar', quantidade: 20, unidade: 'g' },
    { nome: 'Barreira', quantidade: 1, unidade: 'UN' },
    { nome: 'Guardanapo', quantidade: 2, unidade: 'UN' },
  ],
  'Burrito 4 Queijos': [
    { nome: 'Tortilha de Trigo 12"', quantidade: 1, unidade: 'UN' },
    { nome: 'Frango em tiras', quantidade: 90, unidade: 'g' },
    { nome: 'Bacon Crocante', quantidade: 10, unidade: 'g' },
    { nome: 'Molho 4 queijos', quantidade: 90, unidade: 'g' },
    { nome: 'Rúcula', quantidade: 10, unidade: 'g' },
    { nome: 'Tomate', quantidade: 50, unidade: 'g' },
    { nome: 'Molho de Pimenta', quantidade: 5, unidade: 'g' },
    { nome: 'Barreira', quantidade: 1, unidade: 'UN' },
    { nome: 'Guardanapo', quantidade: 2, unidade: 'UN' },
  ],
  'Burrito Pollo': [
    { nome: 'Tortilha de Trigo 12"', quantidade: 1, unidade: 'UN' },
    { nome: 'Pasta de feijão', quantidade: 35, unidade: 'g' },
    { nome: 'Frango em tiras', quantidade: 90, unidade: 'g' },
    { nome: 'Barbeccue', quantidade: 17, unidade: 'g' },
    { nome: 'Milho', quantidade: 40, unidade: 'g' },
    { nome: 'Alface', quantidade: 10, unidade: 'g' },
    { nome: 'Pico de galo', quantidade: 40, unidade: 'g' },
    { nome: 'Molho de Pimenta', quantidade: 5, unidade: 'g' },
    { nome: 'Cheddar', quantidade: 20, unidade: 'g' },
    { nome: 'Barreira', quantidade: 1, unidade: 'UN' },
    { nome: 'Guardanapo', quantidade: 2, unidade: 'UN' },
  ],
  'Quesadilla Chilli com Carne': [
    { nome: 'Tortilha de Trigo 8', quantidade: 1, unidade: 'UN' },
    { nome: 'Chilli com Carne', quantidade: 50, unidade: 'g' },
    { nome: 'Cheddar', quantidade: 10, unidade: 'g' },
    { nome: 'Molho de Pimenta', quantidade: 2.5, unidade: 'g' },
    { nome: 'Mussarela', quantidade: 30, unidade: 'g' },
    { nome: 'Barreira', quantidade: 1, unidade: 'UN' },
  ],
  'Quesadilla Pollo': [
    { nome: 'Tortilha de Trigo 8', quantidade: 1, unidade: 'UN' },
    { nome: 'Frango em tiras', quantidade: 30, unidade: 'g' },
    { nome: 'Bacon Crocante', quantidade: 10, unidade: 'g' },
    { nome: 'Cheddar', quantidade: 10, unidade: 'g' },
    { nome: 'Molho de Pimenta', quantidade: 2.5, unidade: 'g' },
    { nome: 'Mussarela', quantidade: 30, unidade: 'g' },
    { nome: 'Barreira', quantidade: 1, unidade: 'UN' },
  ],
  'Quesadilla Al Pastor': [
    { nome: 'Tortilha de Trigo 8', quantidade: 1, unidade: 'UN' },
    { nome: 'Pernil com Abacaxi', quantidade: 45, unidade: 'g' },
    { nome: 'Barbeccue', quantidade: 10, unidade: 'g' },
    { nome: 'Cheddar', quantidade: 10, unidade: 'g' },
    { nome: 'Molho de Pimenta', quantidade: 2.5, unidade: 'g' },
    { nome: 'Mussarela', quantidade: 30, unidade: 'g' },
    { nome: 'Barreira', quantidade: 1, unidade: 'UN' },
  ],
  'Quesadilla Chilli Veggie': [
    { nome: 'Tortilha de Trigo 8', quantidade: 1, unidade: 'UN' },
    { nome: 'Chilli de Soja', quantidade: 40, unidade: 'g' },
    { nome: 'Pico de galo', quantidade: 40, unidade: 'g' },
    { nome: 'Milho', quantidade: 40, unidade: 'g' },
    { nome: 'Mussarela', quantidade: 30, unidade: 'g' },
    { nome: 'Barreira', quantidade: 1, unidade: 'UN' },
  ],
  'Quesadilla Barbacoa': [
    { nome: 'Tortilha de Trigo 8', quantidade: 1, unidade: 'UN' },
    { nome: 'Barbacoa', quantidade: 50, unidade: 'g' },
    { nome: 'Pico de galo', quantidade: 40, unidade: 'g' },
    { nome: 'Mussarela', quantidade: 30, unidade: 'g' },
    { nome: 'Barreira', quantidade: 1, unidade: 'UN' },
  ],
  'Quesadilla Fiesta': [
    { nome: 'Tortilha de Trigo 8', quantidade: 1, unidade: 'UN' },
    { nome: 'Chocolate', quantidade: 25, unidade: 'g' },
    { nome: 'Confeti', quantidade: 16, unidade: 'g' },
    { nome: 'Mussarela', quantidade: 15, unidade: 'g' },
    { nome: 'Barreira', quantidade: 1, unidade: 'UN' },
  ],
  'Quesadilla Ovomaltine': [
    { nome: 'Tortilha de Trigo 8', quantidade: 1, unidade: 'UN' },
    { nome: 'Chocolate', quantidade: 25, unidade: 'g' },
    { nome: 'Ovomaltine', quantidade: 16, unidade: 'g' },
    { nome: 'Mussarela', quantidade: 15, unidade: 'g' },
    { nome: 'Barreira', quantidade: 1, unidade: 'UN' },
  ],
  'Taco Trio Sortidos': [
    { nome: 'Tortilha de Trigo 6"', quantidade: 3, unidade: 'UN' },
    { nome: 'Pasta de feijão', quantidade: 35, unidade: 'g' },
    { nome: 'Frango em tiras', quantidade: 30, unidade: 'g' },
    { nome: 'Molho 4 queijos', quantidade: 45, unidade: 'g' },
    { nome: 'Bacon Crocante', quantidade: 5, unidade: 'g' },
    { nome: 'Pimenta Jalapeño', quantidade: 10, unidade: 'g' },
    { nome: 'Pernil com Abacaxi', quantidade: 60, unidade: 'g' },
    { nome: 'Pico de galo', quantidade: 40, unidade: 'g' },
    { nome: 'Chilli com Carne', quantidade: 100, unidade: 'g' },
    { nome: 'Molho de Pimenta', quantidade: 6, unidade: 'g' },
    { nome: 'Cheddar', quantidade: 30, unidade: 'g' },
    { nome: 'Barreira', quantidade: 1, unidade: 'UN' },
  ],
};

// Função auxiliar para normalizar nomes (remove acentos, converte para minúsculas)
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Função para fazer match de produtos por nome (fuzzy match)
function findProductByName(products: any[], recipeName: string): any | null {
  const normalizedRecipe = normalizeName(recipeName);
  
  // Tenta match exato primeiro
  let match = products.find(p => normalizeName(p.name) === normalizedRecipe);
  if (match) return match;
  
  // Tenta match parcial (contém)
  match = products.find(p => {
    const normalizedProduct = normalizeName(p.name);
    return normalizedProduct.includes(normalizedRecipe) || normalizedRecipe.includes(normalizedProduct);
  });
  if (match) return match;
  
  // Tenta match removendo palavras comuns
  const recipeWords = normalizedRecipe.split(/\s+/).filter(w => !['de', 'com', 'em', 'a', 'o'].includes(w));
  match = products.find(p => {
    const productWords = normalizeName(p.name).split(/\s+/);
    return recipeWords.some(rw => productWords.some(pw => pw.includes(rw) || rw.includes(pw)));
  });
  
  return match || null;
}

// Função para fazer match de ingredientes por nome
function findIngredientByName(ingredients: any[], ingredientName: string): any | null {
  const normalized = normalizeName(ingredientName);
  
  // Tenta match exato
  let match = ingredients.find(i => normalizeName(i.name) === normalized);
  if (match) return match;
  
  // Tenta match parcial
  match = ingredients.find(i => {
    const normalizedIng = normalizeName(i.name);
    return normalizedIng.includes(normalized) || normalized.includes(normalizedIng);
  });
  
  return match || null;
}

// Função principal de importação
export async function importRecipesAndPrices() {
  console.log('🚀 Iniciando importação de preços e fichas técnicas...');
  
  try {
    // Importar serviços
    const inventoryService = await import('../src/offline/services/inventoryService');
    const productsService = await import('../src/offline/services/productsService');
    const { supabase } = await import('../src/utils/supabase');
    
    // 1. IMPORTAR INGREDIENTES E PREÇOS
    console.log('📦 Importando ingredientes e preços...');
    const ingredientMap = new Map<string, string>(); // nome -> id
    
    for (const preco of precosData) {
      try {
        // Cria ou busca ingrediente
        let ingredientId = ingredientMap.get(preco.nome);
        if (!ingredientId) {
          ingredientId = await inventoryService.upsertIngredient({ name: preco.nome });
          ingredientMap.set(preco.nome, ingredientId);
        }
        
        // Converte preço para centavos
        const priceCents = Math.round(preco.preco * 100);
        
        // Salva preço
        await inventoryService.upsertPrice({
          ingredientId,
          unit: preco.tipo_preco,
          pricePerUnitCents: priceCents,
        });
        
        console.log(`✅ ${preco.nome}: R$ ${preco.preco.toFixed(4)}/${preco.tipo_preco}`);
      } catch (err) {
        console.error(`❌ Erro ao importar ${preco.nome}:`, err);
      }
    }
    
    console.log(`\n✅ ${ingredientMap.size} ingredientes importados com sucesso!\n`);
    
    // 2. BUSCAR PRODUTOS EXISTENTES
    console.log('🔍 Buscando produtos existentes...');
    let products: any[] = [];
    
    if (supabase) {
      // Busca do Supabase
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true);
      
      if (error) throw error;
      products = data || [];
    } else {
      // Busca do DB local
      products = await productsService.listProducts();
    }
    
    console.log(`📋 Encontrados ${products.length} produtos\n`);
    
    // 3. IMPORTAR FICHAS TÉCNICAS
    console.log('📝 Importando fichas técnicas...');
    const recipesImported: string[] = [];
    const recipesNotFound: string[] = [];
    
    // Busca todos os ingredientes
    const allIngredients = await inventoryService.listIngredients();
    const ingredientMapById = new Map(allIngredients.map(i => [i.id, i]));
    const ingredientMapByName = new Map(allIngredients.map(i => [normalizeName(i.name), i]));
    
    for (const [recipeName, ingredients] of Object.entries(receitasData)) {
      try {
        // Encontra o produto
        const product = findProductByName(products, recipeName);
        
        if (!product) {
          recipesNotFound.push(recipeName);
          console.log(`⚠️  Produto não encontrado: "${recipeName}"`);
          continue;
        }
        
        // Importa cada ingrediente da receita
        for (const ing of ingredients) {
          // Encontra o ingrediente
          let ingredient = findIngredientByName(allIngredients, ing.nome);
          
          if (!ingredient) {
            // Cria ingrediente se não existir
            const newIngId = await inventoryService.upsertIngredient({ name: ing.nome });
            ingredient = { id: newIngId, name: ing.nome };
            allIngredients.push(ingredient);
            ingredientMapByName.set(normalizeName(ing.nome), ingredient);
            console.log(`  ➕ Criado ingrediente: ${ing.nome}`);
          }
          
          // Cria/atualiza linha da receita
          await inventoryService.upsertRecipeLine({
            productId: product.id,
            ingredientId: ingredient.id,
            quantity: ing.quantidade,
            unit: ing.unidade,
          });
        }
        
        recipesImported.push(recipeName);
        console.log(`✅ Ficha técnica importada: "${recipeName}" (${ingredients.length} ingredientes)`);
      } catch (err) {
        console.error(`❌ Erro ao importar receita "${recipeName}":`, err);
      }
    }
    
    // 4. RESUMO
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DA IMPORTAÇÃO');
    console.log('='.repeat(60));
    console.log(`✅ Ingredientes importados: ${ingredientMap.size}`);
    console.log(`✅ Fichas técnicas importadas: ${recipesImported.length}`);
    if (recipesNotFound.length > 0) {
      console.log(`⚠️  Produtos não encontrados: ${recipesNotFound.length}`);
      console.log('   Produtos:', recipesNotFound.join(', '));
    }
    console.log('='.repeat(60));
    
    return {
      success: true,
      ingredientsImported: ingredientMap.size,
      recipesImported: recipesImported.length,
      recipesNotFound,
    };
  } catch (err) {
    console.error('❌ Erro na importação:', err);
    throw err;
  }
}

// Exporta também para uso no console do navegador
if (typeof window !== 'undefined') {
  (window as any).importRecipesAndPrices = importRecipesAndPrices;
  console.log('💡 Para importar, execute: await importRecipesAndPrices()');
}



