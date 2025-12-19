import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Module } from '../../types';

export default function Navigation() {
  const location = useLocation();
  const { hasPermission, logout } = useAuth();

  // Define os itens de navegação agrupados por MÓDULO
  const moduleNavItems: { module: Module, items: { path: string, label: string, icon: string }[] }[] = [
    {
      module: 'CAIXA',
      items: [
        { path: '/caixa', label: 'Caixa', icon: 'ri-shopping-cart-line' },
        { path: '/caixa/configuracoes', label: 'Configurações', icon: 'ri-settings-line' }, // MOVIDO PARA CAIXA
      ]
    },
    {
      module: 'COZINHA',
      items: [
        { path: '/cozinha', label: 'Cozinha', icon: 'ri-restaurant-line' },
        { path: '/cozinha/configuracoes', label: 'Configurações', icon: 'ri-settings-line' },
      ]
    },
    {
      module: 'GESTAO',
      items: [
        { path: '/relatorios', label: 'Relatórios', icon: 'ri-bar-chart-line' },
        { path: '/gerenciamento-caixa', label: 'Gerenciar Caixa', icon: 'ri-safe-line' },
        { path: '/tarefas', label: 'Tarefas', icon: 'ri-list-check-2-line' },
        { path: '/checklist', label: 'Check-list', icon: 'ri-checkbox-line' },
        { path: '/procedimentos', label: 'Procedimentos', icon: 'ri-book-open-line' },
        // { path: '/configuracoes', label: 'Configurações', icon: 'ri-settings-line' }, // REMOVIDO DE GESTAO
      ]
    },
    {
      module: 'RH',
      items: [
        { path: '/rh', label: 'RH', icon: 'ri-group-line' },
        { path: '/rh/config', label: 'Configurações', icon: 'ri-settings-line' },
      ]
    },
    {
      module: 'MASTER',
      items: [
        { path: '/master-config', label: 'Master Config', icon: 'ri-settings-3-line' },
      ]
    }
    ,
    {
      module: 'ESTOQUE',
      items: [
        { path: '/estoque/fichas', label: 'Fichas Técnicas', icon: 'ri-file-list-3-line' },
        { path: '/estoque/precos', label: 'Insumos', icon: 'ri-price-tag-3-line' },
        { path: '/estoque/gerenciamento', label: 'Gerenciamento', icon: 'ri-bar-chart-2-line' },
      ]
    }
  ];

  // Determina o módulo ativo com base na rota atual
  const currentModule = moduleNavItems.find(mod => 
    mod.items.some(item => location.pathname.startsWith(item.path))
  )?.module;

  // Filtra os itens para mostrar apenas os do módulo ativo (e que o usuário tem permissão)
  const navItems = moduleNavItems
    .filter(mod => mod.module === currentModule)
    .flatMap(mod => mod.items)
    .filter(item => {
      // Verifica se o usuário tem permissão para o módulo pai
      const parentModule = moduleNavItems.find(mod => mod.items.includes(item))?.module;
      return parentModule ? hasPermission(parentModule) : true;
    });

  // Se não estiver em um módulo específico (ex: Dashboard), não mostra navegação secundária
  if (!currentModule) return null;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
      <div className="px-6 flex items-center justify-between">
        
        {/* Links de Navegação do Módulo */}
        <div className="flex space-x-8">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-3 py-4 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                location.pathname === item.path
                  ? 'text-amber-600 border-b-2 border-amber-500'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className={`${item.icon} mr-2`}></i>
              {item.label}
            </Link>
          ))}
        </div>
        
        {/* Botão de Voltar para o Dashboard */}
        <Link 
          to="/module-selector" 
          className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center space-x-1"
          title="Voltar para a seleção de módulos"
        >
          <i className="ri-arrow-left-line"></i>
          <span>Módulos</span>
        </Link>
      </div>
    </nav>
  );
}
