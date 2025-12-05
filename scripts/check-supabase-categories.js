/**
 * Script para verificar e corrigir categorias no Supabase
 * Execute: node scripts/check-supabase-categories.js
 */

// Tenta importar do node_modules local ou global
let createClient;
try {
  const supabaseModule = await import('@supabase/supabase-js');
  createClient = supabaseModule.createClient;
} catch {
  try {
    const supabaseModule = await import('../apps/desktop/node_modules/@supabase/supabase-js/dist/module/index.js');
    createClient = supabaseModule.createClient;
  } catch {
    console.error('❌ Não foi possível importar @supabase/supabase-js');
    process.exit(1);
  }
}
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Lê o .env
const envContent = readFileSync(resolve(rootDir, '.env'), 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndFix() {
  console.log('🔍 Verificando categorias no Supabase...\n');

  // 1. Lista todas as categorias
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name, created_at, updated_at')
    .order('name');

  if (catError) {
    console.error('❌ Erro ao buscar categorias:', catError);
    return;
  }

  console.log(`📋 Total de categorias no Supabase: ${categories.length}\n`);
  categories.forEach(cat => {
    console.log(`  - ${cat.name} (ID: ${cat.id})`);
  });

  // 2. Lista todas as associações categoria-cozinha
  const { data: associations, error: assocError } = await supabase
    .from('category_kitchens')
    .select('category_id, kitchen_id')
    .order('category_id');

  if (assocError) {
    console.error('❌ Erro ao buscar associações:', assocError);
    return;
  }

  console.log(`\n🔗 Total de associações categoria-cozinha: ${associations.length}\n`);
  
  // Agrupa por categoria
  const assocByCategory = {};
  associations.forEach(assoc => {
    if (!assocByCategory[assoc.category_id]) {
      assocByCategory[assoc.category_id] = [];
    }
    assocByCategory[assoc.category_id].push(assoc.kitchen_id);
  });

  Object.entries(assocByCategory).forEach(([catId, kitchenIds]) => {
    const cat = categories.find(c => c.id === catId);
    console.log(`  - ${cat?.name || 'CATEGORIA NÃO ENCONTRADA'} (${catId}): ${kitchenIds.length} cozinha(s)`);
  });

  // 3. Verifica categorias órfãs (associações sem categoria)
  console.log('\n🔍 Verificando associações órfãs...\n');
  const orphanAssociations = associations.filter(assoc => {
    return !categories.some(cat => cat.id === assoc.category_id);
  });

  if (orphanAssociations.length > 0) {
    console.log(`⚠️  Encontradas ${orphanAssociations.length} associações órfãs (categoria não existe):`);
    orphanAssociations.forEach(assoc => {
      console.log(`  - category_id: ${assoc.category_id}, kitchen_id: ${assoc.kitchen_id}`);
    });
    
    console.log('\n🗑️  Removendo associações órfãs...');
    for (const assoc of orphanAssociations) {
      const { error } = await supabase
        .from('category_kitchens')
        .delete()
        .eq('category_id', assoc.category_id)
        .eq('kitchen_id', assoc.kitchen_id);
      
      if (error) {
        console.error(`  ❌ Erro ao remover associação ${assoc.category_id}-${assoc.kitchen_id}:`, error);
      } else {
        console.log(`  ✅ Associação órfã removida: ${assoc.category_id}-${assoc.kitchen_id}`);
      }
    }
  } else {
    console.log('✅ Nenhuma associação órfã encontrada');
  }

  // 4. Lista produtos sem categoria
  console.log('\n📦 Verificando produtos sem categoria...\n');
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, category_id')
    .eq('is_active', true);

  if (prodError) {
    console.error('❌ Erro ao buscar produtos:', prodError);
    return;
  }

  const productsWithoutCategory = products.filter(p => !p.category_id);
  const productsWithInvalidCategory = products.filter(p => {
    if (!p.category_id) return false;
    return !categories.some(cat => cat.id === p.category_id);
  });

  if (productsWithoutCategory.length > 0) {
    console.log(`⚠️  ${productsWithoutCategory.length} produtos sem categoria:`);
    productsWithoutCategory.forEach(p => {
      console.log(`  - ${p.name} (ID: ${p.id})`);
    });
  }

  if (productsWithInvalidCategory.length > 0) {
    console.log(`\n⚠️  ${productsWithInvalidCategory.length} produtos com categoria inválida:`);
    productsWithInvalidCategory.forEach(p => {
      console.log(`  - ${p.name} (ID: ${p.id}, category_id: ${p.category_id})`);
    });
  }

  if (productsWithoutCategory.length === 0 && productsWithInvalidCategory.length === 0) {
    console.log('✅ Todos os produtos têm categoria válida');
  }

  console.log('\n✅ Verificação concluída!');
}

checkAndFix().catch(console.error);

