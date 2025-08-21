// Arquivo principal da aplicação
class PedidosApp {
  constructor() {
    this.uiManager = null;
    this.formHandler = null;
    this.dashboardManager = null;
    this.isInitialized = false;
  }

  // Inicializar aplicação
  async init() {
    try {
      console.log('Inicializando aplicação...');
      
      // Aguardar carregamento do DOM
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // Verificar se Firebase está disponível
      if (typeof firebase === 'undefined') {
        throw new Error('Firebase não foi carregado');
      }

      // Verificar se SheetJS está disponível
      if (typeof XLSX === 'undefined') {
        throw new Error('SheetJS não foi carregado');
      }

      // Inicializar componentes
      this.uiManager = new UIManager();
      this.formHandler = new FormHandler();
      this.dashboardManager = new DashboardManager();

      // Tornar uiManager globalmente acessível para os botões de deletar
      window.uiManager = this.uiManager;

      // Configurar interface (não usado no dashboard, mas mantido para compatibilidade)
      // this.setupUI();
      
      // Configurar validações (será usado no modal)
      this.setupValidations();
      
      // Configurar auto-completar (será usado no modal)
      this.setupAutoComplete();

      // Configurar análise final
      this.setupAnaliseFinal();

      this.isInitialized = true;
      console.log('Aplicação inicializada com sucesso');

    } catch (error) {
      console.error('Erro ao inicializar aplicação:', error);
      this.showErrorMessage('Erro ao carregar sistema: ' + error.message);
    }
  }

  // Configurar interface do usuário
  setupUI() {
    // Inicializar gerenciador de UI
    this.uiManager.init();

    // Configurar tooltips
    this.setupTooltips();

    // Configurar teclas de atalho
    this.setupKeyboardShortcuts();

    // Configurar responsividade
    this.setupResponsiveLayout();
  }

  // Configurar validações do formulário
  setupValidations() {
    const formRules = {
      nomeCliente: ['required'],
      numeroPedido: ['required'],
      tipoProjeto: ['required'],
      nomeFornecedor: [], // Será validado condicionalmente
      prazoEntrega: [], // Será validado condicionalmente
      modeloFechadura: [] // Será validado condicionalmente
    };

    // Configurar validação em tempo real
    this.formHandler.setupRealTimeValidation(formRules);

    // Validação condicional para campos terceirizados
    const terceirizadoToggle = document.getElementById('terceirizado');
    if (terceirizadoToggle) {
      terceirizadoToggle.addEventListener('change', () => {
        const isTerceirizado = terceirizadoToggle.checked;
        
        if (isTerceirizado) {
          // Validar campos de terceirizado
          this.formHandler.validateField('nomeFornecedor', ['required']);
          this.formHandler.validateField('prazoEntrega', ['required']);
        } else {
          // Limpar validações de terceirizado
          this.formHandler.updateFieldValidation(document.getElementById('nomeFornecedor'), true);
          this.formHandler.updateFieldValidation(document.getElementById('prazoEntrega'), true);
        }
      });
    }

    // Validação condicional para fechadura
    const possuiFechadura = document.getElementById('possuiFechadura');
    if (possuiFechadura) {
      possuiFechadura.addEventListener('change', () => {
        const hasFechadura = possuiFechadura.checked;
        
        if (hasFechadura) {
          this.formHandler.validateField('modeloFechadura', ['required']);
        } else {
          this.formHandler.updateFieldValidation(document.getElementById('modeloFechadura'), true);
        }
      });
    }
  }

  // Configurar auto-completar
  setupAutoComplete() {
    // Auto-completar para nome do cliente
    this.formHandler.setupAutoComplete('nomeCliente', 'clientes_recentes');
    
    // Auto-completar para fornecedores
    this.formHandler.setupAutoComplete('nomeFornecedor', 'fornecedores_recentes');
    
    // Auto-completar para modelos de fechadura
    this.formHandler.setupAutoComplete('modeloFechadura', 'modelos_fechadura');
  }

  // Configurar tooltips
  setupTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    
    tooltipElements.forEach(element => {
      element.addEventListener('mouseenter', (e) => {
        this.showTooltip(e.target, e.target.dataset.tooltip);
      });
      
      element.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
    });
  }

  // Mostrar tooltip
  showTooltip(element, text) {
    // Remover tooltip anterior se existir
    this.hideTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.id = 'active-tooltip';
    tooltip.className = 'absolute z-50 px-2 py-1 text-sm text-white bg-gray-800 rounded shadow-lg pointer-events-none';
    tooltip.textContent = text;
    
    document.body.appendChild(tooltip);
    
    // Posicionar tooltip
    const rect = element.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = (rect.top - tooltip.offsetHeight - 5) + 'px';
  }

  // Esconder tooltip
  hideTooltip() {
    const tooltip = document.getElementById('active-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  // Configurar teclas de atalho
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+S para salvar
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        const salvarBtn = document.getElementById('salvarPedido');
        if (salvarBtn && !salvarBtn.disabled) {
          salvarBtn.click();
        }
      }
      
      // Ctrl+R para resetar formulário
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        if (confirm('Deseja limpar todos os dados do formulário?')) {
          this.uiManager.resetForm();
        }
      }
      
      // ESC para fechar notificações
      if (e.key === 'Escape') {
        document.querySelectorAll('.notification').forEach(notif => notif.remove());
      }
    });
  }

  // Configurar layout responsivo
  setupResponsiveLayout() {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      
      // Ajustar layout para mobile
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        if (isMobile) {
          mainContent.classList.add('mobile-layout');
        } else {
          mainContent.classList.remove('mobile-layout');
        }
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Executar imediatamente
  }

  // Mostrar mensagem de erro
  showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed inset-0 bg-red-500 text-white flex items-center justify-center z-50';
    errorDiv.innerHTML = `
      <div class="bg-white text-red-800 p-8 rounded-lg shadow-lg max-w-md mx-4">
        <h2 class="text-xl font-bold mb-4">Erro no Sistema</h2>
        <p class="mb-4">${message}</p>
        <button onclick="location.reload()" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
          Recarregar Página
        </button>
      </div>
    `;
    
    document.body.appendChild(errorDiv);
  }

  // Inicializar dashboard
  async initDashboard() {
    try {
      if (!this.isInitialized) {
        console.warn('Aplicação não foi inicializada ainda');
        return;
      }

      await this.dashboardManager.init();
      
      // Disponibilizar globalmente para uso nos botões
      window.dashboardManager = this.dashboardManager;
      
      console.log('Dashboard inicializado com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar dashboard:', error);
    }
  }

  // Método para debug
  debug() {
    return {
      isInitialized: this.isInitialized,
      loadedFiles: this.uiManager ? this.uiManager.loadedFiles : null,
      allItems: this.uiManager ? this.uiManager.allItems : null,
      pedidos: this.dashboardManager ? this.dashboardManager.pedidos : null,
      firebase: typeof firebase !== 'undefined',
      xlsx: typeof XLSX !== 'undefined'
    };
  }

  // Exportar dados para debug/backup
  exportData() {
    if (!this.uiManager) return null;
    
    return {
      formData: this.formHandler.serializeForm(),
      loadedFiles: Array.from(this.uiManager.loadedFiles.keys()),
      itemsCount: this.uiManager.allItems.length,
      timestamp: new Date().toISOString()
    };
  }

  // Importar dados (para restaurar estado)
  importData(data) {
    if (!this.uiManager || !this.formHandler) return false;
    
    try {
      // Restaurar dados do formulário
      if (data.formData) {
        this.formHandler.populateForm(data.formData);
      }
      
      console.log('Dados importados com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao importar dados:', error);
      return false;
    }
  }
}

// Inicializar aplicação quando o DOM estiver pronto
const app = new PedidosApp();

// Aguardar carregamento das bibliotecas externas
window.addEventListener('load', () => {
  app.init();
});

// Configurar listeners para botões do dashboard
document.addEventListener('DOMContentLoaded', () => {
  // Botão Análise de Estoque
  const btnAnaliseEstoque = document.getElementById('btnAnaliseEstoque');
  if (btnAnaliseEstoque) {
    btnAnaliseEstoque.addEventListener('click', () => {
      window.location.href = 'analise-estoque.html';
    });
  }

  // Botão Compra Inicial
  const btnCompraInicial = document.getElementById('btnCompraInicial');
  if (btnCompraInicial) {
    btnCompraInicial.addEventListener('click', () => {
      window.location.href = 'gestao-compras.html';
    });
  }
});

// Configurar análise final
app.setupAnaliseFinal = function() {
  // Event listeners para botões de visualizar listas
  const btnVerListaInicial = document.getElementById('btnVerListaInicial');
  const btnVerListaProducao = document.getElementById('btnVerListaProducao');
  
  if (btnVerListaInicial) {
    btnVerListaInicial.addEventListener('click', () => {
      this.abrirModalListaInicial();
    });
  }
  
  if (btnVerListaProducao) {
    btnVerListaProducao.addEventListener('click', () => {
      this.abrirModalListaProducao();
    });
  }
  
  // Event listeners para fechar modais
  const btnFecharModalListaInicial = document.getElementById('btnFecharModalListaInicial');
  const btnFecharModalListaProducao = document.getElementById('btnFecharModalListaProducao');
  
  if (btnFecharModalListaInicial) {
    btnFecharModalListaInicial.addEventListener('click', () => {
      this.fecharModal('modalListaInicial');
    });
  }
  
  if (btnFecharModalListaProducao) {
    btnFecharModalListaProducao.addEventListener('click', () => {
      this.fecharModal('modalListaProducao');
    });
  }
  
  // Fechar modais clicando fora
  const modalListaInicial = document.getElementById('modalListaInicial');
  const modalListaProducao = document.getElementById('modalListaProducao');
  
  if (modalListaInicial) {
    modalListaInicial.addEventListener('click', (e) => {
      if (e.target === modalListaInicial) {
        this.fecharModal('modalListaInicial');
      }
    });
  }
  
  if (modalListaProducao) {
    modalListaProducao.addEventListener('click', (e) => {
      if (e.target === modalListaProducao) {
        this.fecharModal('modalListaProducao');
      }
    });
  }
  
  // Carregar dados iniciais
  this.carregarDadosAnaliseFinal();
};

// Abrir modal da lista inicial
app.abrirModalListaInicial = async function() {
  try {
    const dados = await this.obterDadosListaInicial();
    this.preencherModalListaInicial(dados);
    this.abrirModal('modalListaInicial');
  } catch (error) {
    console.error('Erro ao abrir modal lista inicial:', error);
    this.uiManager.showNotification('Erro ao carregar dados da lista inicial', 'error');
  }
};

// Abrir modal da lista produção
app.abrirModalListaProducao = async function() {
  try {
    const dados = await this.obterDadosListaProducao();
    this.preencherModalListaProducao(dados);
    this.abrirModal('modalListaProducao');
  } catch (error) {
    console.error('Erro ao abrir modal lista produção:', error);
    this.uiManager.showNotification('Erro ao carregar dados da lista produção', 'error');
  }
};

// Obter dados da lista inicial (quantidade original dos pedidos)
app.obterDadosListaInicial = async function() {
  const snapshot = await firebase.firestore().collection('pedidos').get();
  const itens = [];
  
  snapshot.forEach(doc => {
    const pedido = doc.data();
    if (pedido.materiais) {
      pedido.materiais.forEach(material => {
        const item = {
          codigo: material.codigo,
          descricao: material.descricao,
          quantidade: parseFloat(material.quantidade) || 0
        };
        
        // Verificar se já existe um item com o mesmo código
        const existente = itens.find(i => i.codigo === item.codigo);
        if (existente) {
          existente.quantidade += item.quantidade;
        } else {
          itens.push(item);
        }
      });
    }
  });
  
  return itens.sort((a, b) => a.codigo.localeCompare(b.codigo));
};

// Obter dados da lista produção (qtdNecFinal)
app.obterDadosListaProducao = async function() {
  const snapshot = await firebase.firestore().collection('analiseItens').get();
  const itens = [];
  
  snapshot.forEach(doc => {
    const item = doc.data();
    if (item.qtdNecFinal !== undefined && item.qtdNecFinal !== null) {
      itens.push({
        codigo: item.codigo,
        descricao: item.descricao,
        quantidade: parseFloat(item.qtdNecFinal) || 0
      });
    }
  });
  
  return itens.sort((a, b) => a.codigo.localeCompare(b.codigo));
};

// Preencher modal lista inicial
app.preencherModalListaInicial = function(dados) {
  const totalItens = dados.length;
  const quantidadeTotal = dados.reduce((acc, item) => acc + item.quantidade, 0);
  
  // Atualizar resumo
  document.getElementById('resumoItensListaInicial').textContent = totalItens;
  document.getElementById('resumoQuantidadeListaInicial').textContent = quantidadeTotal.toFixed(2);
  
  // Preencher tabela
  const tbody = document.getElementById('tabelaListaInicial');
  tbody.innerHTML = '';
  
  dados.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.codigo}</td>
      <td>${item.descricao}</td>
      <td>${item.quantidade.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
};

// Preencher modal lista produção
app.preencherModalListaProducao = function(dados) {
  const totalItens = dados.length;
  const quantidadeTotal = dados.reduce((acc, item) => acc + item.quantidade, 0);
  
  // Atualizar resumo
  document.getElementById('resumoItensListaProducao').textContent = totalItens;
  document.getElementById('resumoQuantidadeListaProducao').textContent = quantidadeTotal.toFixed(2);
  
  // Preencher tabela
  const tbody = document.getElementById('tabelaListaProducao');
  tbody.innerHTML = '';
  
  dados.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.codigo}</td>
      <td>${item.descricao}</td>
      <td>${item.quantidade.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
};

// Carregar dados para os cards
app.carregarDadosAnaliseFinal = async function() {
  try {
    // Verificar se os elementos existem na página atual
    const totalItensInicialEl = document.getElementById('totalItensListaInicial');
    const quantidadeTotalInicialEl = document.getElementById('quantidadeTotalListaInicial');
    const totalItensProducaoEl = document.getElementById('totalItensListaProducao');
    const quantidadeTotalProducaoEl = document.getElementById('quantidadeTotalListaProducao');
    
    if (!totalItensInicialEl || !quantidadeTotalInicialEl || !totalItensProducaoEl || !quantidadeTotalProducaoEl) {
      // Elementos não existem nesta página, pular execução
      return;
    }
    
    // Dados lista inicial
    const dadosListaInicial = await this.obterDadosListaInicial();
    const totalItensInicial = dadosListaInicial.length;
    const quantidadeTotalInicial = dadosListaInicial.reduce((acc, item) => acc + item.quantidade, 0);
    
    totalItensInicialEl.textContent = totalItensInicial;
    quantidadeTotalInicialEl.textContent = quantidadeTotalInicial.toFixed(2);
    
    // Dados lista produção
    const dadosListaProducao = await this.obterDadosListaProducao();
    const totalItensProducao = dadosListaProducao.length;
    const quantidadeTotalProducao = dadosListaProducao.reduce((acc, item) => acc + item.quantidade, 0);
    
    totalItensProducaoEl.textContent = totalItensProducao;
    quantidadeTotalProducaoEl.textContent = quantidadeTotalProducao.toFixed(2);
    
  } catch (error) {
    console.error('Erro ao carregar dados análise final:', error);
  }
};

// Abrir modal
app.abrirModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
};

// Fechar modal
app.fecharModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
};

// Disponibilizar globalmente para debug
window.PedidosApp = app;

// Em js/main.js

// ... código existente ...

// ADICIONE ESTE BLOCO DE CÓDIGO
// Event listener para o novo botão "Visão Geral do Gestor"
const btnVisaoGeralGestor = document.getElementById('btnVisaoGeralGestor');
if (btnVisaoGeralGestor) {
    btnVisaoGeralGestor.addEventListener('click', () => {
        const button = btnVisaoGeralGestor;
        // Mostra um feedback visual de carregamento antes de navegar
        button.innerHTML = '<div class="spinner h-5 w-5 border-2 border-white rounded-full animate-spin" style="border-top-color: transparent;"></div> Carregando...';
        button.disabled = true;

        setTimeout(() => {
            window.location.href = './visao-geral-gestor.html';
        }, 300); // Pequeno delay para o usuário ver o feedback
    });
}