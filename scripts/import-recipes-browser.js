/**
 * Script de Importação - Versão para Console do Navegador
 * 
 * Cole este script no console do navegador (F12) após carregar a aplicação
 * Execute: await importRecipesAndPrices()
 */

(async function importRecipesAndPrices() {
  console.log('🚀 Iniciando importação de preços e fichas técnicas...');
  
  // Dados de preços
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
  ];

  // Fichas técnicas
  const receitasData = {
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

  function normalizeName(name) {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function findProductByName(products, recipeName) {
    const normalizedRecipe = normalizeName(recipeName);
    let match = products.find(p => normalizeName(p.name) === normalizedRecipe);
    if (match) return match;
    match = products.find(p => {
      const normalizedProduct = normalizeName(p.name);
      return normalizedProduct.includes(normalizedRecipe) || normalizedRecipe.includes(normalizedProduct);
    });
    if (match) return match;
    const recipeWords = normalizedRecipe.split(/\s+/).filter(w => !['de', 'com', 'em', 'a', 'o'].includes(w));
    match = products.find(p => {
      const productWords = normalizeName(p.name).split(/\s+/);
      return recipeWords.some(rw => productWords.some(pw => pw.includes(rw) || rw.includes(pw)));
    });
    return match || null;
  }

  function findIngredientByName(ingredients, ingredientName) {
    const normalized = normalizeName(ingredientName);
    let match = ingredients.find(i => normalizeName(i.name) === normalized);
    if (match) return match;
    match = ingredients.find(i => {
      const normalizedIng = normalizeName(i.name);
      return normalizedIng.includes(normalized) || normalized.includes(normalizedIng);
    });
    return match || null;
  }

  try {
    // Importar módulos
    const inventoryService = await import('/src/offline/services/inventoryService.js');
    const productsService = await import('/src/offline/services/productsService.js');
    const { supabase } = await import('/src/utils/supabase.js');

    // 1. Importar ingredientes e preços
    console.log('📦 Importando ingredientes e preços...');
    const ingredientMap = new Map();

    for (const preco of precosData) {
      try {
        let ingredientId = ingredientMap.get(preco.nome);
        if (!ingredientId) {
          ingredientId = await inventoryService.upsertIngredient({ name: preco.nome });
          ingredientMap.set(preco.nome, ingredientId);
        }
        const priceCents = Math.round(preco.preco * 100);
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

    console.log(`\n✅ ${ingredientMap.size} ingredientes importados!\n`);

    // 2. Buscar produtos
    console.log('🔍 Buscando produtos...');
    let products = [];
    if (supabase) {
      const { data, error } = await supabase.from('products').select('id, name').eq('is_active', true);
      if (error) throw error;
      products = data || [];
    } else {
      products = await productsService.listProducts();
    }
    console.log(`📋 Encontrados ${products.length} produtos\n`);

    // 3. Importar fichas técnicas
    console.log('📝 Importando fichas técnicas...');
    const recipesImported = [];
    const recipesNotFound = [];
    const allIngredients = await inventoryService.listIngredients();

    for (const [recipeName, ingredients] of Object.entries(receitasData)) {
      try {
        const product = findProductByName(products, recipeName);
        if (!product) {
          recipesNotFound.push(recipeName);
          console.log(`⚠️  Produto não encontrado: "${recipeName}"`);
          continue;
        }

        for (const ing of ingredients) {
          let ingredient = findIngredientByName(allIngredients, ing.nome);
          if (!ingredient) {
            const newIngId = await inventoryService.upsertIngredient({ name: ing.nome });
            ingredient = { id: newIngId, name: ing.nome };
            allIngredients.push(ingredient);
            console.log(`  ➕ Criado ingrediente: ${ing.nome}`);
          }

          await inventoryService.upsertRecipeLine({
            productId: product.id,
            ingredientId: ingredient.id,
            quantity: ing.quantidade,
            unit: ing.unidade,
          });
        }

        recipesImported.push(recipeName);
        console.log(`✅ "${recipeName}" (${ingredients.length} ingredientes)`);
      } catch (err) {
        console.error(`❌ Erro ao importar "${recipeName}":`, err);
      }
    }

    // Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO');
    console.log('='.repeat(60));
    console.log(`✅ Ingredientes: ${ingredientMap.size}`);
    console.log(`✅ Fichas técnicas: ${recipesImported.length}`);
    if (recipesNotFound.length > 0) {
      console.log(`⚠️  Não encontrados: ${recipesNotFound.length}`);
      console.log('   ', recipesNotFound.join(', '));
    }
    console.log('='.repeat(60));

    return { success: true, ingredientsImported: ingredientMap.size, recipesImported: recipesImported.length, recipesNotFound };
  } catch (err) {
    console.error('❌ Erro:', err);
    throw err;
  }
})();



