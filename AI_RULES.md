# Regras de Desenvolvimento e Stack Tecnológica

Este documento resume a pilha de tecnologia (Tech Stack) e estabelece diretrizes claras sobre o uso de bibliotecas e componentes para garantir a manutenibilidade e a consistência do código.

## 1. Resumo da Tech Stack

A aplicação é construída com a seguinte pilha de tecnologia:

*   **Linguagem:** TypeScript.
*   **Framework:** React (v19).
*   **Roteamento:** React Router DOM.
*   **Estilização:** Exclusivamente Tailwind CSS para todos os estilos e layouts.
*   **Componentes UI:** Utiliza componentes base customizados (`src/components/base/`) e tem acesso à biblioteca shadcn/ui para componentes mais complexos.
*   **Ícones:** Utiliza a biblioteca Remixicon (classes `ri-*`).
*   **Gerenciamento de Estado/Dados:** Utiliza o hook customizado `useLocalStorage` para persistência de dados no lado do cliente.
*   **Internacionalização (i18n):** Implementada com `i18next` e `react-i18next`.
*   **Funcionalidades Específicas:** Inclui hooks customizados para detecção de status offline (`useOffline`) e controle de tempo (`useTimer`).
*   **Build Tool:** Vite.

## 2. Regras de Uso de Bibliotecas

| Funcionalidade | Biblioteca/Recurso Preferencial | Regras de Uso |
| :--- | :--- | :--- |
| **Estilização** | Tailwind CSS | **Obrigatório** usar classes utilitárias do Tailwind para todo o design. Não usar CSS ou módulos CSS tradicionais. |
| **Componentes UI** | Componentes em `src/components/base/` ou shadcn/ui | Reutilizar `Button`, `Input`, `Modal` existentes. Para novos componentes complexos, priorizar a implementação via shadcn/ui. |
| **Ícones** | Remixicon | Usar classes `ri-*` (ex: `ri-home-line`). A biblioteca `lucide-react` está disponível, mas Remixicon é o padrão atual. |
| **Roteamento** | React Router DOM | Usar `Link`, `useNavigate`, `useLocation`, etc., e manter a configuração de rotas em `src/router/config.tsx`. |
| **Persistência de Dados** | `useLocalStorage` | Usar o hook customizado para persistir dados não críticos no navegador. |
| **Notificações** | Toasts (Implementar se necessário) | Usar um sistema de toast para feedback ao usuário (ex: sucesso, erro, aviso). |
| **Estrutura de Arquivos** | Padrão do Projeto | Componentes em `src/components/`, Páginas em `src/pages/`, Hooks em `src/hooks/`. Criar um arquivo por componente/hook. |