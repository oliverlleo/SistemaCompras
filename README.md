# Sistema de Gerenciamento de Pedidos

## Sobre o Sistema
Sistema completo de gerenciamento de pedidos com integração Firebase/Firestore, processamento de planilhas client-side e interface dinâmica.

## Estrutura do Projeto
- **index.html** - Página principal do sistema (único ponto de entrada)
- **css/styles.css** - Estilos customizados + Tailwind CSS
- **js/** - Módulos JavaScript organizados por responsabilidade
  - **dashboard-manager.js** - Gerenciamento do dashboard e modal
  - **file-processor.js** - Processamento de CSV/XLSX
  - **firebase-config.js** - Configuração Firebase/Firestore
  - **form-handler.js** - Validações e manipulação de formulários
  - **main.js** - Aplicação principal e inicialização
  - **ui-manager.js** - Interface dinâmica e estados
- **YOUWARE.md** - Documentação técnica completa

## Como Usar
1. Abra o arquivo `index.html` em um navegador moderno
2. O sistema carregará automaticamente todos os módulos
3. Configure suas credenciais Firebase em `js/firebase-config.js`
4. Sistema pronto para uso!

## Tecnologias
- HTML5 + CSS3 + JavaScript ES6
- Tailwind CSS (via CDN)
- Firebase/Firestore
- SheetJS para processamento de planilhas
- Arquitetura modular responsiva

## Suporte
Para mais informações, consulte o arquivo YOUWARE.md

Gerado em: 07/07/2025, 10:35:16
