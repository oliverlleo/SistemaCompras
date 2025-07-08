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

      // Configurar interface (não usado no dashboard, mas mantido para compatibilidade)
      // this.setupUI();
      
      // Configurar validações (será usado no modal)
      this.setupValidations();
      
      // Configurar auto-completar (será usado no modal)
      this.setupAutoComplete();

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

// Disponibilizar globalmente para debug
window.PedidosApp = app;