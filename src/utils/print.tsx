import ReactDOMServer from 'react-dom/server';
import PrintableOrder from '../components/feature/PrintableOrder';
import { Order } from '../types';

/**
 * Simula a impressão de um componente React em uma nova janela/iframe
 * e aciona a caixa de diálogo de impressão do navegador.
 * @param order O objeto Order a ser impresso.
 * @param categoryMap Mapa de ID da categoria para Nome da categoria.
 */
export const printOrder = (order: Order, categoryMap: Record<string, string> = {}) => {
  // 1. Renderiza o componente React para HTML estático
  const printableHtml = ReactDOMServer.renderToStaticMarkup(
    <PrintableOrder order={order} categoryMap={categoryMap} />
  );

  // 2. Cria o conteúdo HTML completo com estilos de impressão
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Recibo - Pedido ${order.pin}</title>
      <style>
        /* Estilos básicos para impressão de recibo */
        body {
          margin: 0;
          padding: 0;
          font-family: monospace;
          font-size: 12px;
          width: 300px; /* Largura típica de recibo */
        }
        @media print {
          /* Garante que apenas o conteúdo do recibo seja impresso */
          body {
            width: 100%;
            margin: 0;
            padding: 0;
          }
        }
        /* Classes Tailwind ajustadas para layout compacto */
        .font-mono { font-family: monospace; }
        .text-\[10px\] { font-size: 10px; }
        .text-xs { font-size: 12px; }
        .text-sm { font-size: 14px; }
        .text-lg { font-size: 18px; }
        .text-xl { font-size: 20px; }
        .text-3xl { font-size: 30px; }
        .font-bold { font-weight: bold; }
        .font-extrabold { font-weight: 800; }
        .text-center { text-align: center; }
        
        /* Espaçamentos reduzidos */
        .mb-0 { margin-bottom: 0; }
        .mb-1 { margin-bottom: 4px; }
        .mb-2 { margin-bottom: 8px; }
        .pb-1 { padding-bottom: 4px; }
        .pt-1 { padding-top: 4px; }
        .py-1 { padding-top: 4px; padding-bottom: 4px; }
        .p-2 { padding: 8px; }
        
        .rounded { border-radius: 4px; }
        .border-b { border-bottom: 1px solid; }
        .border-t { border-top: 1px solid; }
        .border-dashed { border-style: dashed; }
        .border-gray-700 { border-color: #374151; }
        .bg-gray-200 { background-color: #e5e7eb; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .w-\[300px\] { width: 300px; }
        .italic { font-style: italic; }
        .ml-2 { margin-left: 8px; }
        .space-y-1 > * + * { margin-top: 4px; }
        .pt-2 { padding-top: 8px; }
        
        /* Estilos para opções obrigatórias */
        .required-option { color: #dc2626; font-weight: bold; }
      </style>
    </head>
    <body>
      ${printableHtml}
      <script>
        // Aciona a impressão assim que o conteúdo for carregado
        window.onload = function() {
          window.print();
          // Fecha a janela/aba após a impressão (com um pequeno delay para garantir que a caixa de diálogo abra)
          setTimeout(function() {
            window.close();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;

  // 3. Abre uma nova janela e escreve o conteúdo
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    alert('O bloqueador de pop-ups impediu a impressão. Por favor, desative-o.');
  }
};