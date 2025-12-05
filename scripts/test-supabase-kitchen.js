/**
 * Script de Teste - Inserir Cozinha no Supabase
 * 
 * Execute no console do navegador (F12) após carregar a aplicação
 * 
 * Uso: await testInsertKitchen()
 */

async function testInsertKitchen() {
  console.log('🧪 Testando inserção de cozinha no Supabase...');
  
  try {
    // Importa Supabase
    const { supabase } = await import('/src/utils/supabase.js');
    
    if (!supabase) {
      console.error('❌ Supabase não está inicializado!');
      console.log('Verifique se as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão configuradas no .env');
      return;
    }
    
    console.log('✅ Supabase inicializado');
    console.log('URL:', supabase.supabaseUrl);
    
    // Testa SELECT primeiro
    console.log('\n📖 Testando SELECT...');
    const { data: selectData, error: selectError } = await supabase
      .from('kitchens')
      .select('*')
      .limit(5);
    
    if (selectError) {
      console.error('❌ Erro ao fazer SELECT:', selectError);
      return;
    }
    
    console.log('✅ SELECT funcionou! Cozinhas encontradas:', selectData?.length || 0);
    if (selectData && selectData.length > 0) {
      console.log('Exemplo:', selectData[0]);
    }
    
    // Testa INSERT
    console.log('\n📝 Testando INSERT...');
    const testKitchen = {
      id: crypto.randomUUID(),
      name: 'Teste Cozinha ' + Date.now(),
      unit_id: null,
      is_active: true,
      display_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      pending_sync: false,
    };
    
    console.log('Dados a inserir:', testKitchen);
    
    const { data: insertData, error: insertError } = await supabase
      .from('kitchens')
      .insert(testKitchen)
      .select();
    
    if (insertError) {
      console.error('❌ Erro ao fazer INSERT:', insertError);
      console.error('Código:', insertError.code);
      console.error('Mensagem:', insertError.message);
      console.error('Detalhes:', insertError.details);
      console.error('Hint:', insertError.hint);
      return;
    }
    
    console.log('✅ INSERT funcionou! Cozinha criada:', insertData);
    
    // Testa DELETE (limpa o teste)
    console.log('\n🗑️  Limpando cozinha de teste...');
    const { error: deleteError } = await supabase
      .from('kitchens')
      .delete()
      .eq('id', testKitchen.id);
    
    if (deleteError) {
      console.warn('⚠️  Erro ao deletar cozinha de teste:', deleteError);
    } else {
      console.log('✅ Cozinha de teste removida');
    }
    
    console.log('\n✅✅✅ TODOS OS TESTES PASSARAM! ✅✅✅');
    console.log('O Supabase está funcionando corretamente.');
    
  } catch (err) {
    console.error('❌ Erro geral:', err);
  }
}

// Exporta para uso no console
if (typeof window !== 'undefined') {
  (window as any).testInsertKitchen = testInsertKitchen;
  console.log('💡 Para testar, execute: await testInsertKitchen()');
}



