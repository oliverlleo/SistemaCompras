# Sistema de Gerenciamento de Pedidos - Guia do Desenvolvedor

## Visão Geral do Sistema

Este é um sistema completo de gerenciamento de pedidos com integração Firebase/Firestore, processamento de planilhas client-side e interface dinâmica. O sistema permite cadastrar projetos, carregar listas de materiais via CSV/XLSX e salvar dados em tempo real no banco.

## Arquitetura e Estrutura

### Organização de Arquivos
```
/
├── index.html (entrypoint - ÚNICO arquivo HTML exibido)
├── css/
│   └── styles.css (estilos customizados + Tailwind)
├── js/
│   ├── firebase-config.js (configuração e serviços Firebase)
│   ├── file-processor.js (processamento CSV/XLSX com SheetJS)
│   ├── form-handler.js (validações e manipulação de formulários)
│   ├── ui-manager.js (interface dinâmica e estados)
│   └── main.js (aplicação principal e inicialização)
└── assets/ (recursos estáticos)
```

### Arquitetura Modular
- **Separação de responsabilidades**: Cada arquivo JS tem uma responsabilidade específica
- **Comunicação entre módulos**: Uso de window globals para integração
- **Estado centralizado**: UIManager controla estado da interface e dados carregados

## Firebase/Firestore - Configuração

### Credenciais (já configuradas)
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC38MEJFXKITFrrGkwxmyotgD1mCBVctc4",
  authDomain: "compras-e492e.firebaseapp.com",
  projectId: "compras-e492e",
  // ... outras configurações
};
```

### Estrutura do Banco
- **Coleção 'pedidos'**: Dados principais do pedido
- **Coleção 'itens'**: Itens individuais com referência ao pedido (pedidoId)
- **Persistência offline habilitada**

## Processamento de Arquivos

### Tecnologia
- **SheetJS (XLSX.js)**: Processamento client-side de CSV/XLSX
- **Mapeamento inteligente**: Sistema que identifica colunas por variações de nomes
- **UTF-8**: Suporte completo a caracteres especiais

### Mapeamento de Colunas
O sistema reconhece automaticamente colunas com nomes variados:
```javascript
const headerVariations = {
  codigo: ['codigo', 'cod', 'cód', 'doc', 'code', 'id'],
  descricao: ['descricao', 'desc', 'item', 'produto'],
  quantidade: ['quantidade', 'quant', 'qtde', 'qtd'],
  // ... outras variações
};
```

## Interface Dinâmica

### Responsividade
- **Desktop**: Layout em duas colunas (formulário + pré-visualização)
- **Mobile**: Layout empilhado com pré-visualização no topo
- **Breakpoints**: 1024px, 768px, 480px

### Estados Condicionais
- **Tipo de projeto**: Determina categorias de materiais disponíveis
- **Serviço terceirizado**: Alterna entre campos de fornecedor e upload de materiais
- **Opções específicas**: Brise/ACM mostram campos de fechadura

### Categorias por Projeto
```javascript
materialCategories = {
  'PVC': ['Perfil', 'Reforço', 'Aço', 'Ferragens', 'Vidros', 'Vedação'],
  'Alumínio': ['Perfil', 'Acessórios', 'Ferragens', 'Vidros', 'Vedação'],
  'Brise': ['Perfil', 'Lâminas', 'Ferragens', 'Acessórios'],
  'ACM': ['Placas ACM', 'Perfis', 'Fixação', 'Acessórios'],
  'Outros': ['Materiais Diversos']
};
```

## Comandos e Funcionalidades

### Teclas de Atalho
- **Ctrl+S**: Salvar pedido
- **Ctrl+R**: Confirmar reset do formulário
- **Ctrl+Shift+R**: Reset forçado
- **ESC**: Fechar notificações

### Debug
```javascript
// Console do navegador
window.debugPedidos() // Estado completo da aplicação
window.PedidosApp.debug() // Debug detalhado
window.PedidosApp.exportData() // Exportar dados para backup
```

### Validações
- **Campos obrigatórios**: Nome cliente, número pedido, tipo projeto
- **Condicionais**: Fornecedor/prazo (se terceirizado), modelo fechadura (se possui)
- **Arquivos**: Validação de tipo e estrutura de dados
- **Tempo real**: Feedback imediato durante digitação

## Dependências Externas

### CDNs Utilizados
- **Tailwind CSS**: `https://cdn.tailwindcss.com/3.4.16`
- **Firebase**: `https://www.gstatic.com/firebasejs/9.23.0/`
- **SheetJS**: `https://cdn.sheetjs.com/xlsx-0.20.1/`

### Compatibilidade
- **Browsers modernos**: Chrome 80+, Firefox 75+, Safari 13+
- **Mobile**: iOS Safari, Chrome Mobile
- **Offline**: Persistência Firebase habilitada

## Fluxo de Desenvolvimento

### Modificações de Interface
1. Ajustar CSS em `styles.css` 
2. Modificar HTML em `index.html`
3. Atualizar lógica em `ui-manager.js`

### Mudanças no Processamento
1. Alterar `file-processor.js` para novos formatos
2. Atualizar `headerVariations` para novas colunas
3. Modificar validações conforme necessário

### Integração com Backend
1. Configurar novas credenciais em `firebase-config.js`
2. Ajustar estrutura de dados no `FirebaseService`
3. Implementar novos métodos de persistência

## Importante para Manutenção

### Limitações Conhecidas
- **Tailwind CDN**: Não usar em produção (warning esperado)
- **Arquivo único**: Só `index.html` é exibido ao usuário
- **Client-side**: Todo processamento ocorre no navegador

### Boas Práticas
- **Usar dados reais**: Sistema foi projetado para dados reais, não mocks
- **Testar uploads**: Validar com planilhas reais dos usuários
- **Monitorar console**: Logs detalhados para debug
- **Backup de dados**: LocalStorage para auto-completar dados frequentes

### Performance
- **Arquivos grandes**: SheetJS processa até milhares de linhas
- **Batch operations**: Firebase batch para múltiplos itens
- **Lazy loading**: Componentes carregam sob demanda