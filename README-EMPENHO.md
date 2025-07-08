# Sistema de Empenho - Documentação

## Visão Geral

O Sistema de Empenho é uma aplicação web completa para gestão de empenho de materiais, desenvolvida com HTML, CSS, JavaScript e Firebase. O sistema permite controlar o processo de empenho de itens de pedidos através de uma interface intuitiva e robusta.

## Arquivos do Sistema

- **`empenho.html`** - Página principal com interface completa
- **`js/empenho.js`** - Lógica JavaScript com todas as funcionalidades
- **`README-EMPENHO.md`** - Esta documentação

## Configuração do Firebase

### 1. Configuração Inicial

No arquivo `empenho.html`, localize a seção de configuração do Firebase e substitua pelos seus dados:

```javascript
const firebaseConfig = {
    apiKey: "sua-api-key",
    authDomain: "seu-projeto.firebaseapp.com", 
    projectId: "seu-projeto-id",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "123456789",
    appId: "sua-app-id"
};
```

### 2. Estrutura do Banco de Dados

O sistema espera as seguintes coleções no Firestore:

#### Coleção `pedidos`
```javascript
{
    id: "documento-id",
    clienteNome: "Nome do Cliente",
    tipoProjeto: "Tipo do Projeto", 
    statusGeral: "Em Andamento", // "Em Andamento", "Concluído", "Itens Empenhados"
    ultimaAtualizacao: "2024-01-01T00:00:00.000Z"
}
```

#### Coleção `itens`
```javascript
{
    id: "documento-id",
    pedidoId: "id-do-pedido-pai",
    codigoItem: "COD-001",
    descricaoItem: "Descrição do item",
    quantidadeNecessaria: 100,
    quantidadeAlocar: 80,
    listaMaterial: "Lista A",
    statusItem: "Indefinido", // "Indefinido", "Parcialmente Empenhado", "Empenhado"
    historicoEmpenhos: [
        {
            dataEmpenho: "2024-01-01T00:00:00.000Z",
            qtdeEmpenhadaDoEstoque: 20,
            qtdeEmpenhadaDoRecebido: 10,
            responsavel: "Usuario",
            observacoes: "Observações do empenho"
        }
    ],
    historicoRecebimentos: [
        {
            dataRecebimento: "2024-01-01T00:00:00.000Z",
            qtde: 50,
            fornecedor: "Fornecedor A",
            notaFiscal: "NF-001"
        }
    ]
}
```

## Funcionalidades Implementadas

### ✅ 1. Seção de Filtros (Navegação em Cascata)
- **Dropdown Cliente**: Carregado automaticamente na inicialização
- **Dropdown Projeto**: Habilitado após seleção do cliente  
- **Dropdown Lista**: Habilitado após seleção do projeto
- **Estados de carregamento**: "Carregando..." durante busca de dados
- **Validação**: Filtros subsequentes são resetados quando o anterior muda

### ✅ 2. Tabela de Itens Disponíveis para Empenho
- **Colunas**: Checkbox, Código, Descrição, Qtd. Necessária, Disponível (Estoque), Disponível (Recebido), Qtd. Já Empenhada, Status
- **Checkbox principal**: Selecionar/Desselecionar todos os itens
- **Checkboxes individuais**: Seleção específica de itens
- **Visual cues**: Linhas com fundo diferenciado para itens parcialmente empenhados
- **Tooltips**: Informações adicionais ao passar o mouse sobre colunas de quantidade
- **Estado vazio**: Mensagens informativas quando não há dados

### ✅ 3. Modal de Empenho
- **Título dinâmico**: Mostra quantidade de itens selecionados
- **Tabela interna**: Exibe itens selecionados com campos editáveis
- **Inputs de quantidade**: 
  - Empenhar (do Estoque)
  - Empenhar (do Recebido)
- **Validação em tempo real**: Impede valores maiores que o disponível
- **Botões de ação**: Salvar e Cancelar

### ✅ 4. Sistema de Feedback
- **Notificações toast**: Feedback visual para sucesso/erro
- **Estados de carregamento**: Indicadores durante operações
- **Validações**: Prevenção de dados inconsistentes

### ✅ 5. Integração Firebase
- **Carregamento otimizado**: Busca todos os dados uma vez e filtra em memória
- **Transações batch**: Operações atômicas para consistência
- **Enriquecimento de dados**: Relacionamento automático entre itens e pedidos
- **Verificação de completude**: Atualização automática de status de pedidos

## Fluxo de Uso

1. **Carregamento Inicial**: Sistema busca todos os pedidos e itens ativos
2. **Seleção de Filtros**: 
   - Usuário seleciona Cliente
   - Dropdown de Projeto é habilitado e populado
   - Usuário seleciona Projeto  
   - Dropdown de Lista é habilitado e populado
   - Usuário seleciona Lista de Material
3. **Visualização de Itens**: Tabela é populada com itens disponíveis para empenho
4. **Seleção de Itens**: Usuário marca checkboxes dos itens desejados
5. **Abertura do Modal**: Botão "Empenhar" abre modal com itens selecionados
6. **Definição de Quantidades**: Usuário informa quantidades a empenhar
7. **Salvamento**: Sistema executa transação no Firebase
8. **Feedback**: Notificação de sucesso/erro e atualização da interface

## Cálculos de Saldo

### Saldo Disponível (Estoque)
```
quantidadeAlocar - Σ(historicoEmpenhos.qtdeEmpenhadaDoEstoque)
```

### Saldo Disponível (Recebido)  
```
Σ(historicoRecebimentos.qtde) - Σ(historicoEmpenhos.qtdeEmpenhadaDoRecebido)
```

### Status do Item
- **Indefinido**: Estado inicial
- **Parcialmente Empenhado**: Quantidade empenhada < quantidade necessária
- **Empenhado**: Quantidade empenhada >= quantidade necessária

## Recursos Técnicos

### Performance
- **Carregamento único**: Dados carregados uma vez na inicialização
- **Filtros em memória**: Operações rápidas sem consultas ao Firebase
- **Lazy loading**: Renderização sob demanda

### UX/UI
- **Design responsivo**: Funciona em desktop e mobile
- **Feedback visual**: Estados claros para todas as ações
- **Validação preventiva**: Impede erros antes que aconteçam
- **Navegação intuitiva**: Fluxo lógico e fácil de seguir

### Segurança e Consistência
- **Transações atômicas**: Operações indivisíveis no Firebase
- **Validação dupla**: Cliente e servidor (através das regras do Firestore)
- **Rollback automático**: Em caso de erro, nenhuma alteração é mantida

## Personalização

### Campos Adicionais
Para adicionar novos campos, edite:
1. Estrutura da tabela em `empenho.html`
2. Função `criarLinhaItem()` em `empenho.js`
3. Função `criarLinhaModal()` se necessário

### Validações Customizadas
Modifique a função `validateInput()` em `empenho.js`

### Estilos Visuais
Customize o CSS no `<style>` de `empenho.html`

## Suporte e Manutenção

### Logs e Debug
O sistema inclui logs detalhados no console do navegador. Para debug:
```javascript
// Ativar logs detalhados
console.log('Estado atual:', sistema.itensEnriquecidos);
```

### Tratamento de Erros
Todos os erros são capturados e exibidos via toast. Verifique:
1. Console do navegador para erros técnicos
2. Configuração do Firebase
3. Estrutura dos dados no Firestore

### Backup e Recovery
Recomenda-se fazer backup regular das coleções Firestore antes de operações em lote.

---

**Desenvolvido seguindo as melhores práticas de desenvolvimento web e integração Firebase.**