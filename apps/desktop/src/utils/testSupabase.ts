/**
 * Função de teste para verificar conexão e inserção no Supabase
 * Execute no console: await window.testSupabaseKitchen()
 */

import { supabase } from './supabase';

export async function testSupabaseKitchen() {
  console.log('🧪 Testando Supabase - Cozinhas...\n');
  
  if (!supabase) {
    console.error('❌ Supabase NÃO está inicializado!');
    console.log('Verifique:');
    console.log('1. Arquivo .env existe na raiz do projeto?');
    console.log('2. VITE_SUPABASE_URL está configurado?');
    console.log('3. VITE_SUPABASE_ANON_KEY está configurado?');
    console.log('4. Servidor foi reiniciado após alterar .env?');
    console.log('\nVariáveis atuais:');
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL || 'NÃO DEFINIDO');
    console.log('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'DEFINIDO' : 'NÃO DEFINIDO');
    return;
  }
  
  console.log('✅ Supabase inicializado');
  console.log('URL:', supabase.supabaseUrl);
  
  // Teste 1: SELECT
  console.log('\n📖 Teste 1: SELECT (ler cozinhas)...');
  try {
    const { data: selectData, error: selectError } = await supabase
      .from('kitchens')
      .select('*')
      .limit(5);
    
    if (selectError) {
      console.error('❌ Erro do Supabase no SELECT:', selectError);
      console.error('Código:', selectError.code);
      console.error('Mensagem:', selectError.message);
      console.error('Detalhes:', selectError.details);
      console.error('Hint:', selectError.hint);
      return;
    }
  
    console.log('✅ SELECT OK! Cozinhas encontradas:', selectData?.length || 0);
    if (selectData && selectData.length > 0) {
      console.log('Exemplo:', selectData[0]);
    }
  } catch (networkError: any) {
    console.error('❌ Erro de REDE no SELECT:', networkError);
    console.error('Tipo:', networkError?.name);
    console.error('Mensagem:', networkError?.message);
    console.error('Stack:', networkError?.stack);
    console.error('\n💡 Possíveis causas:');
    console.error('1. CORS não habilitado no Supabase');
    console.error('2. URL do Supabase incorreta');
    console.error('3. Problema de conexão com internet');
    console.error('4. Firewall bloqueando requisições');
    return;
  }
  
  // Teste 2: INSERT
  console.log('\n📝 Teste 2: INSERT (criar cozinha de teste)...');
  const testId = crypto.randomUUID();
  const testKitchen = {
    id: testId,
    name: `Teste ${Date.now()}`,
    unit_id: null,
    is_active: true,
    display_order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
    pending_sync: false,
  };
  
  console.log('Dados:', testKitchen);
  
  const { data: insertData, error: insertError } = await supabase
    .from('kitchens')
    .insert(testKitchen)
    .select();
  
  if (insertError) {
    console.error('❌ Erro no INSERT:', insertError);
    console.error('Código:', insertError.code);
    console.error('Mensagem:', insertError.message);
    console.error('Detalhes:', insertError.details);
    console.error('Hint:', insertError.hint);
    return;
  }
  
  console.log('✅ INSERT OK! Cozinha criada:', insertData);
  
  // Teste 3: DELETE (limpar teste)
  console.log('\n🗑️  Teste 3: DELETE (remover cozinha de teste)...');
  const { error: deleteError } = await supabase
    .from('kitchens')
    .delete()
    .eq('id', testId);
  
  if (deleteError) {
    console.warn('⚠️  Erro no DELETE:', deleteError);
  } else {
    console.log('✅ DELETE OK! Cozinha de teste removida');
  }
  
  console.log('\n✅✅✅ TODOS OS TESTES PASSARAM! ✅✅✅');
  console.log('O Supabase está funcionando corretamente.');
  console.log('Agora tente adicionar uma cozinha pela interface.');
}

// Disponibiliza no window para uso no console
if (typeof window !== 'undefined') {
  (window as any).testSupabaseKitchen = testSupabaseKitchen;
}

