import { database } from './firebase-config.js';
import { ref, onValue, remove } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Gerenciador do Dashboard Principal
class DashboardManager {
  constructor() {
    this.pedidos = [];
    this.filteredPedidos = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.totalItems = 0;
    this.currentSort = { field: 'dataCriacao', order: 'desc' };
    this.filters = {
      search: '',
      tipoProjeto: '',
      terceirizado: '',
      listaMaterial: ''
    };
    this.listasMateriais = new Set(); // Para autocomplete
    this.tooltipData = {}; // Cache para dados de tooltip das listas
  }

  // Inicializar dashboard
  async init() {
    try {
      console.log('Inicializando Dashboard Manager...');
      
      // Verificar se o container de tooltip existe, se não, criar
      if (!document.getElementById('material-tooltip')) {
        this.createTooltipContainer();
      }
      
      this.setupEventListeners();
      await this.loadPedidos();
      this.updateDisplay();
      
      console.log('Dashboard Manager inicializado com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar Dashboard Manager:', error);
      this.showError('Erro ao carregar pedidos: ' + error.message);
    }
  }
  
  // Criar container para tooltips (caso o UIManager não tenha criado)
  createTooltipContainer() {
    const tooltip = document.createElement('div');
    tooltip.id = 'material-tooltip';
    tooltip.className = 'absolute z-50 bg-gray-900 text-white text-xs rounded py-2 px-3 pointer-events-none opacity-0 transition-opacity duration-200';
    tooltip.style.transform = 'translateX(-50%)';
    document.body.appendChild(tooltip);
    console.log('Container de tooltip criado');
  }
  
  // Carregar dados para tooltip de uma lista de material
  async carregarDadosTooltipListas(pedido) {
    if (!pedido || !pedido.id || !pedido.listasMateriais) return;
    
    const pedidoId = pedido.id;
    
    // Verificar se já temos os dados em cache
    if (this.tooltipData[pedidoId]) {
      return;
    }
    
    try {
      // Buscar itens deste pedido apenas uma vez
      const itens = await FirebaseService.buscarItensPedido(pedidoId);
      
      // Organizar itens por lista de material
      const itensPorLista = itens.reduce((acc, item) => {
        const lista = item.listaMaterial;
        if (!acc[lista]) acc[lista] = [];
        acc[lista].push(item);
        return acc;
      }, {});
      
      // Calcular dados para tooltip e armazenar em cache
      this.tooltipData[pedidoId] = {};
      
      for (const lista in itensPorLista) {
        const itensLista = itensPorLista[lista];
        const totalItens = itensLista.length;
        const totalQuantidade = itensLista.reduce((sum, item) => sum + (item.quantidade || 0), 0);
        
        this.tooltipData[pedidoId][lista] = {
          totalItens,
          totalQuantidade
        };
      }
    } catch (error) {
      console.error(`Erro ao carregar dados para tooltip do pedido ${pedidoId}:`, error);
    }
  }
  
  // Obter texto do tooltip para uma lista específica
  getTooltipTextForLista(pedido, lista) {
    if (!pedido || !pedido.id) return '';
    
    const pedidoId = pedido.id;
    
    // Verificar se temos dados para este pedido e lista
    if (this.tooltipData[pedidoId] && this.tooltipData[pedidoId][lista]) {
      const { totalItens, totalQuantidade } = this.tooltipData[pedidoId][lista];
      return `${totalItens} itens\nQuantidade total: ${totalQuantidade}`;
    }
    
    // Se não tivermos os dados, tentar carregar assincronamente
    this.carregarDadosTooltipListas(pedido);
    
    // Texto padrão enquanto carrega
    return 'Carregando informações...';
  }

  // Configurar eventos
  setupEventListeners() {
    // Botões de novo pedido
    document.getElementById('btnNovoPedido')?.addEventListener('click', () => {
      this.openModalNovoPedido();
    });
    
    document.getElementById('btnNovoPedidoEmpty')?.addEventListener('click', () => {
      this.openModalNovoPedido();
    });

    // Filtros
    document.getElementById('filterSearch')?.addEventListener('input', (e) => {
      this.filters.search = e.target.value;
      this.debounceFilter();
    });

    document.getElementById('filterTipoProjeto')?.addEventListener('change', (e) => {
      this.filters.tipoProjeto = e.target.value;
      this.applyFilters();
    });

    document.getElementById('filterTerceirizado')?.addEventListener('change', (e) => {
      this.filters.terceirizado = e.target.value;
      this.applyFilters();
    });

    document.getElementById('filterListaMaterial')?.addEventListener('input', (e) => {
      this.filters.listaMaterial = e.target.value;
      this.showMaterialsAutocomplete(e.target.value);
      this.debounceFilter();
    });

    // Limpar filtros
    document.getElementById('btnLimparFiltros')?.addEventListener('click', () => {
      this.clearFilters();
    });

    // Refresh
    document.getElementById('btnRefresh')?.addEventListener('click', () => {
      this.refreshData();
    });

    // Paginação
    document.getElementById('btnPrevPage')?.addEventListener('click', () => {
      this.previousPage();
    });

    document.getElementById('btnNextPage')?.addEventListener('click', () => {
      this.nextPage();
    });

    // Ordenação
    document.querySelectorAll('.sortable').forEach(header => {
      header.addEventListener('click', () => {
        const field = header.dataset.field;
        this.sortBy(field);
      });
    });

    // Fechar modal
    document.getElementById('btnFecharModal')?.addEventListener('click', () => {
      this.closeModal();
    });

    document.querySelector('.modal-overlay')?.addEventListener('click', () => {
      this.closeModal();
    });

    // ESC para fechar modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  }

  // Debounce para filtros de texto
  debounceFilter() {
    clearTimeout(this.filterTimeout);
    this.filterTimeout = setTimeout(() => {
      this.applyFilters();
    }, 300);
  }

  // Carregar pedidos do Firebase
  async loadPedidos() {
    try {
      this.showLoading(true);
      
      const dbRef = ref(database);
      onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        const pedidos = [];
        if (data) {
          for (const clienteNome in data) {
            for (const tipoProjeto in data[clienteNome]) {
              for (const pedidoId in data[clienteNome][tipoProjeto]) {
                pedidos.push({
                  id: pedidoId,
                  clienteNome: clienteNome,
                  tipoProjeto: tipoProjeto,
                  ...data[clienteNome][tipoProjeto][pedidoId]
                });
              }
            }
          }
        }

        this.pedidos = pedidos;
        this.applyFilters();
        this.showLoading(false);
      });
      
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      this.showError('Erro ao carregar pedidos: ' + error.message);
      this.showLoading(false);
    }
  }

  // Carregar listas de materiais para todos os pedidos
  async loadListasMateriais() {
    try {
      const promises = this.pedidos.map(async (pedido) => {
        const itens = await FirebaseService.buscarItensPedido(pedido.id);
        const listas = [...new Set(itens.map(item => item.listaMaterial))];
        pedido.listasMateriais = listas;
        
        // Adicionar ao conjunto global para autocomplete
        listas.forEach(lista => this.listasMateriais.add(lista));
        
        // Pré-processar dados para tooltips
        // Organizar itens por lista de material
        const itensPorLista = itens.reduce((acc, item) => {
          const lista = item.listaMaterial;
          if (!lista) return acc;
          if (!acc[lista]) acc[lista] = [];
          acc[lista].push(item);
          return acc;
        }, {});
        
        // Armazenar dados para tooltips
        if (!this.tooltipData[pedido.id]) {
          this.tooltipData[pedido.id] = {};
        }
        
        for (const lista in itensPorLista) {
          const itensLista = itensPorLista[lista];
          const totalItens = itensLista.length;
          const totalQuantidade = itensLista.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
          
          this.tooltipData[pedido.id][lista] = {
            totalItens,
            totalQuantidade
          };
          
          console.log(`Tooltip para ${pedido.id} - ${lista}: ${totalItens} itens, quantidade: ${totalQuantidade}`);
        }
        
        return pedido;
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('Erro ao carregar listas de materiais:', error);
    }
  }

  // Aplicar filtros
  applyFilters() {
    let filtered = [...this.pedidos];

    // Filtro de busca (cliente ou número do pedido)
    if (this.filters.search) {
      const search = this.filters.search.toLowerCase();
      filtered = filtered.filter(pedido => 
        pedido.clienteNome.toLowerCase().includes(search) ||
        pedido.numeroPedido.toLowerCase().includes(search)
      );
    }

    // Filtro de tipo de projeto
    if (this.filters.tipoProjeto) {
      filtered = filtered.filter(pedido => 
        pedido.tipoProjeto === this.filters.tipoProjeto
      );
    }

    // Filtro de terceirizado
    if (this.filters.terceirizado !== '') {
      const isTerceirizado = this.filters.terceirizado === 'true';
      filtered = filtered.filter(pedido => 
        pedido.ehTerceirizado === isTerceirizado
      );
    }

    // Filtro de lista de material
    if (this.filters.listaMaterial) {
      const material = this.filters.listaMaterial.toLowerCase();
      filtered = filtered.filter(pedido => 
        pedido.listasMateriais && 
        pedido.listasMateriais.some(lista => 
          lista.toLowerCase().includes(material)
        )
      );
    }

    this.filteredPedidos = filtered;
    this.totalItems = filtered.length;
    this.currentPage = 1; // Reset para primeira página
    
    this.updateDisplay();
  }

  // Ordenar por campo
  sortBy(field) {
    if (this.currentSort.field === field) {
      // Inverter ordem se já estiver ordenado por este campo
      this.currentSort.order = this.currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
      // Novo campo, ordem padrão
      this.currentSort.field = field;
      this.currentSort.order = 'asc';
    }

    this.filteredPedidos.sort((a, b) => {
      let aValue = a[field];
      let bValue = b[field];

      // Tratamento especial para datas
      if (field === 'dataCriacao') {
        aValue = new Date(aValue?.toDate ? aValue.toDate() : aValue);
        bValue = new Date(bValue?.toDate ? bValue.toDate() : bValue);
      }

      // Tratamento para strings
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      let result = 0;
      if (aValue < bValue) result = -1;
      if (aValue > bValue) result = 1;

      return this.currentSort.order === 'desc' ? -result : result;
    });

    this.updateSortIcons();
    this.updateDisplay();
  }

  // Atualizar ícones de ordenação
  updateSortIcons() {
    document.querySelectorAll('.sortable').forEach(header => {
      const icon = header.querySelector('.sort-icon');
      header.classList.remove('sorted-asc', 'sorted-desc');
      
      if (header.dataset.field === this.currentSort.field) {
        header.classList.add(`sorted-${this.currentSort.order}`);
      }
    });
  }

  // Paginação
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updateDisplay();
    }
  }

  nextPage() {
    const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.updateDisplay();
    }
  }

  goToPage(page) {
    const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      this.updateDisplay();
    }
  }

  // Atualizar display
  updateDisplay() {
    this.updateTable();
    this.updatePagination();
    this.updateTotalCount();
  }

  // Atualizar tabela
  updateTable() {
    const tableLoading = document.getElementById('tableLoading');
    const tableEmpty = document.getElementById('tableEmpty');
    const tableData = document.getElementById('tableData');
    const tableBody = document.getElementById('tableBody');

    // Esconder estados de loading
    tableLoading.classList.add('hidden');

    if (this.filteredPedidos.length === 0) {
      tableEmpty.classList.remove('hidden');
      tableData.classList.add('hidden');
      return;
    }

    tableEmpty.classList.add('hidden');
    tableData.classList.remove('hidden');

    // Calcular itens para página atual
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageItems = this.filteredPedidos.slice(startIndex, endIndex);

    // Renderizar linhas
    tableBody.innerHTML = '';
    pageItems.forEach(pedido => {
      const row = this.createTableRow(pedido);
      tableBody.appendChild(row);
    });
    
    // Configurar tooltips para as listas de materiais
    this.setupTooltipsForMaterialTags();
  }
  
  // Configurar tooltips para as tags de materiais
  setupTooltipsForMaterialTags() {
    // Obter todas as tags de materiais na tabela
    const materialTags = document.querySelectorAll('#tableBody .material-tag.tooltip-trigger');
    
    console.log(`Configurando tooltips para ${materialTags.length} tags de materiais`);
    
    // Configurar evento de tooltip para cada tag
    materialTags.forEach(tag => {
      // Verificar se temos uma instância do UIManager para usar seu método de tooltip
      if (window.PedidosApp && window.PedidosApp.uiManager) {
        window.PedidosApp.uiManager.setupTooltipEvents(tag);
      } else {
        // Implementação própria se UIManager não estiver disponível
        this.setupTooltipEventsBackup(tag);
      }
    });
  }
  
  // Versão de backup da configuração de tooltips caso o UIManager não esteja disponível
  setupTooltipEventsBackup(element) {
    const tooltip = document.getElementById('material-tooltip');
    if (!tooltip) return;
    
    element.addEventListener('mouseenter', (e) => {
      const tooltipText = element.getAttribute('data-tooltip');
      if (tooltipText) {
        tooltip.innerHTML = tooltipText.replace(/\n/g, '<br>');
        tooltip.style.opacity = '1';
        this.positionTooltipBackup(tooltip, e.target);
      }
    });
    
    element.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
    
    element.addEventListener('mousemove', (e) => {
      this.positionTooltipBackup(tooltip, e.target);
    });
  }
  
  // Versão de backup do posicionamento de tooltips
  positionTooltipBackup(tooltip, target) {
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Posicionar acima do elemento
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.top - tooltipRect.height - 8) + 'px';
  }

  // Criar linha da tabela
  createTableRow(pedido) {
    const row = document.createElement('tr');
    row.className = 'table-row';
    row.dataset.pedidoId = pedido.id;

    // Formatar data
    let dataFormatada = '-';
    if (pedido.dataCriacao) {
      const data = pedido.dataCriacao.toDate ? pedido.dataCriacao.toDate() : new Date(pedido.dataCriacao);
      dataFormatada = data.toLocaleDateString('pt-BR');
    }

    // Formatar listas de materiais como tags com tooltips
    let listasTags = '<span class="text-gray-400">-</span>';
    
    if (pedido.listasMateriais && pedido.listasMateriais.length > 0) {
      // Buscar dados de itens para mostrar no tooltip
      this.carregarDadosTooltipListas(pedido);
      
      listasTags = pedido.listasMateriais.map(lista => {
        // Verificar se já temos os dados do tooltip para esta lista
        const tooltipText = this.getTooltipTextForLista(pedido, lista);
        return `<span class="material-tag tooltip-trigger" data-tooltip="${tooltipText}">${lista}</span>`;
      }).join('');
    }

    // Status com cor
    const statusClass = this.getStatusClass(pedido.statusGeral);
    
    row.innerHTML = `
      <td class="table-cell">${pedido.clienteNome || '-'}</td>
      <td class="table-cell">${pedido.numeroPedido || '-'}</td>
      <td class="table-cell">${pedido.tipoProjeto || '-'}</td>
      <td class="table-cell">${listasTags}</td>
      <td class="table-cell">${dataFormatada}</td>
      <td class="table-cell">
        <span class="status-badge ${statusClass}">${pedido.statusGeral || 'Pendente'}</span>
      </td>
      <td class="table-cell">
        <div class="action-buttons">
          <button class="btn-action btn-view" onclick="dashboardManager.viewPedido('${pedido.id}')" title="Visualizar">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
          <button class="btn-action btn-edit" onclick="dashboardManager.editPedido('${pedido.id}')" title="Editar">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          <button class="btn-action btn-delete" onclick="dashboardManager.deletePedido('${pedido.id}', '${pedido.numeroPedido}')" title="Excluir">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </td>
    `;

    return row;
  }

  // Obter classe CSS para status
  getStatusClass(status) {
    const statusMap = {
      'Pendente de Análise': 'status-pending',
      'Em Produção': 'status-production',
      'Concluído': 'status-completed',
      'Cancelado': 'status-cancelled',
      'Aguardando Compras': 'status-pending',
      'Pronto para Separação': 'status-production'
    };
    return statusMap[status] || 'status-pending';
  }

  // Atualizar paginação
  updatePagination() {
    const pagination = document.getElementById('pagination');
    const paginationText = document.getElementById('paginationText');
    const btnPrevPage = document.getElementById('btnPrevPage');
    const btnNextPage = document.getElementById('btnNextPage');
    const pageNumbers = document.getElementById('pageNumbers');

    if (this.totalItems === 0) {
      pagination.classList.add('hidden');
      return;
    }

    pagination.classList.remove('hidden');

    // Calcular informações da página
    const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
    const endItem = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);

    // Atualizar texto
    paginationText.textContent = `Mostrando ${startItem}-${endItem} de ${this.totalItems} pedidos`;

    // Atualizar botões
    btnPrevPage.disabled = this.currentPage === 1;
    btnNextPage.disabled = this.currentPage === totalPages;

    // Atualizar números das páginas
    pageNumbers.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - this.currentPage) <= 2) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-number ${i === this.currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => this.goToPage(i));
        pageNumbers.appendChild(pageBtn);
      } else if (Math.abs(i - this.currentPage) === 3) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'page-ellipsis';
        ellipsis.textContent = '...';
        pageNumbers.appendChild(ellipsis);
      }
    }
  }

  // Atualizar contador total
  updateTotalCount() {
    const totalPedidos = document.getElementById('totalPedidos');
    if (totalPedidos) {
      const text = this.totalItems === 1 ? 'pedido encontrado' : 'pedidos encontrados';
      totalPedidos.textContent = `${this.totalItems} ${text}`;
    }
  }

  // Mostrar/esconder loading
  showLoading(show) {
    const tableLoading = document.getElementById('tableLoading');
    const tableEmpty = document.getElementById('tableEmpty');
    const tableData = document.getElementById('tableData');

    if (show) {
      tableLoading.classList.remove('hidden');
      tableEmpty.classList.add('hidden');
      tableData.classList.add('hidden');
    } else {
      tableLoading.classList.add('hidden');
    }
  }

  // Mostrar autocomplete de materiais
  showMaterialsAutocomplete(value) {
    const autocomplete = document.getElementById('materialsAutocomplete');
    
    if (!value || value.length < 2) {
      autocomplete.classList.add('hidden');
      return;
    }

    const matches = Array.from(this.listasMateriais)
      .filter(material => material.toLowerCase().includes(value.toLowerCase()))
      .slice(0, 10);

    if (matches.length === 0) {
      autocomplete.classList.add('hidden');
      return;
    }

    autocomplete.innerHTML = matches.map(material => 
      `<div class="autocomplete-item" onclick="dashboardManager.selectMaterial('${material}')">${material}</div>`
    ).join('');
    
    autocomplete.classList.remove('hidden');
  }

  // Selecionar material do autocomplete
  selectMaterial(material) {
    document.getElementById('filterListaMaterial').value = material;
    document.getElementById('materialsAutocomplete').classList.add('hidden');
    this.filters.listaMaterial = material;
    this.applyFilters();
  }

  // Limpar filtros
  clearFilters() {
    this.filters = {
      search: '',
      tipoProjeto: '',
      terceirizado: '',
      listaMaterial: ''
    };

    document.getElementById('filterSearch').value = '';
    document.getElementById('filterTipoProjeto').value = '';
    document.getElementById('filterTerceirizado').value = '';
    document.getElementById('filterListaMaterial').value = '';
    document.getElementById('materialsAutocomplete').classList.add('hidden');

    this.applyFilters();
  }

  // Refresh data
  async refreshData() {
    await this.loadPedidos();
    this.showNotification('Lista de pedidos atualizada!', 'success');
  }

  // Abrir modal para novo pedido
  openModalNovoPedido() {
    const modal = document.getElementById('modalPedido');
    const modalTitle = document.getElementById('modalTitle');
    const modalFormContainer = document.getElementById('modalFormContainer');

    modalTitle.textContent = 'Novo Pedido';
    
    // Carregar formulário no modal
    this.loadFormInModal(modalFormContainer);
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  // Visualizar pedido (somente leitura)
  async viewPedido(pedidoId) {
    try {
      const pedido = this.pedidos.find(p => p.id === pedidoId);
      if (!pedido) {
        this.showError('Pedido não encontrado');
        return;
      }

      // Carregar itens do pedido do Firebase
      this.showNotification('Carregando dados do pedido...', 'info');
      const itens = await FirebaseService.buscarItensPedido(pedidoId);
      
      // Adicionar itens ao objeto pedido
      pedido.itensExistentes = itens;

      const modal = document.getElementById('modalPedido');
      const modalTitle = document.getElementById('modalTitle');
      const modalFormContainer = document.getElementById('modalFormContainer');

      modalTitle.textContent = 'Visualizar Pedido';
      
      // Carregar formulário no modal em modo leitura com dados do pedido
      this.loadFormInModal(modalFormContainer, pedido, true); // true = modo visualização
      
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';

    } catch (error) {
      console.error('Erro ao visualizar pedido:', error);
      this.showError('Erro ao carregar dados do pedido: ' + error.message);
    }
  }

  // Editar pedido
  async editPedido(pedidoId) {
    try {
      const pedido = this.pedidos.find(p => p.id === pedidoId);
      if (!pedido) {
        this.showError('Pedido não encontrado');
        return;
      }

      // Carregar itens do pedido do Firebase
      this.showNotification('Carregando dados do pedido...', 'info');
      const itens = await FirebaseService.buscarItensPedido(pedidoId);
      
      // Adicionar itens ao objeto pedido
      pedido.itensExistentes = itens;

      const modal = document.getElementById('modalPedido');
      const modalTitle = document.getElementById('modalTitle');
      const modalFormContainer = document.getElementById('modalFormContainer');

      modalTitle.textContent = 'Editar Pedido';
      
      // Carregar formulário no modal com dados do pedido incluindo itens
      this.loadFormInModal(modalFormContainer, pedido, false); // false = modo edição
      
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';

    } catch (error) {
      console.error('Erro ao editar pedido:', error);
      this.showError('Erro ao carregar dados do pedido: ' + error.message);
    }
  }

  // Excluir pedido
  async deletePedido(pedidoId, numeroPedido) {
    if (!confirm(`Tem certeza que deseja excluir o pedido ${numeroPedido}?\n\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const pedido = this.pedidos.find(p => p.id === pedidoId);
      if (!pedido) {
        this.showError('Pedido não encontrado para exclusão.');
        return;
      }

      const { clienteNome, tipoProjeto } = pedido;
      const pedidoRef = ref(database, `${clienteNome}/${tipoProjeto}/${pedidoId}`);
      await remove(pedidoRef);

      this.showNotification('Pedido excluído com sucesso!', 'success');

    } catch (error) {
      console.error('Erro ao excluir pedido:', error);
      this.showError('Erro ao excluir pedido: ' + error.message);
    }
  }

  // Fechar modal
  closeModal() {
    const modal = document.getElementById('modalPedido');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // Carregar formulário no modal
  loadFormInModal(container, pedidoData = null, isViewMode = false) {
    // Criar o formulário completo dentro do modal
    container.innerHTML = this.getFormHTML(isViewMode);
    
    // Inicializar o UIManager para o modal
    setTimeout(() => {
      this.initModalForm(pedidoData, isViewMode);
    }, 100);
  }

  // HTML do formulário completo
  getFormHTML(isViewMode = false) {
    return `
      <div class="modal-form-content">
        <div class="form-grid">
          <!-- Seção do Formulário -->
          <section class="form-section-modal">
            <h3 class="section-title">Dados do Projeto</h3>
            
            <form id="pedidoFormModal" novalidate>
              <!-- Dados básicos do cliente -->
              <div class="form-group">
                <label for="nomeClienteModal" class="form-label">
                  Nome do Cliente *
                </label>
                <input 
                  type="text" 
                  id="nomeClienteModal" 
                  name="nomeCliente"
                  class="form-input"
                  placeholder="Digite o nome do cliente"
                  required
                  data-tooltip="Nome completo ou razão social do cliente"
                >
              </div>

              <div class="form-group">
                <label for="numeroPedidoModal" class="form-label">
                  Número do Pedido *
                </label>
                <input 
                  type="text" 
                  id="numeroPedidoModal" 
                  name="numeroPedido"
                  class="form-input"
                  placeholder="Ex: PED-2025-001"
                  required
                  data-tooltip="Código único para identificar este pedido"
                >
              </div>

              <div class="form-group">
                <label for="tipoProjetoModal" class="form-label">
                  Tipo de Projeto *
                </label>
                <select id="tipoProjetoModal" name="tipoProjeto" class="form-input form-select" required>
                  <option value="">Selecione o tipo de projeto</option>
                  <option value="PVC">PVC</option>
                  <option value="Alumínio">Alumínio</option>
                  <option value="Brise">Brise</option>
                  <option value="ACM">ACM</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <!-- Toggle para serviço terceirizado -->
              <div class="form-group">
                <div class="toggle-wrapper">
                  <label class="toggle">
                    <input type="checkbox" id="terceirizadoModal" name="terceirizado">
                    <span class="toggle-slider"></span>
                  </label>
                  <label for="terceirizadoModal" class="form-label cursor-pointer">
                    Serviço Terceirizado?
                  </label>
                </div>
                <p class="text-sm text-gray-600 mt-1">
                  Marque se este projeto será executado por terceiros
                </p>
              </div>

              <!-- Campos condicionais para terceirizados -->
              <div id="camposTerceirizadoModal" class="conditional-section hidden">
                <div class="form-group">
                  <label for="nomeFornecedorModal" class="form-label">
                    Nome do Fornecedor *
                  </label>
                  <input 
                    type="text" 
                    id="nomeFornecedorModal" 
                    name="nomeFornecedor"
                    class="form-input"
                    placeholder="Digite o nome do fornecedor"
                  >
                </div>

                <div class="form-group">
                  <label for="prazoEntregaModal" class="form-label">
                    Prazo de Entrega *
                  </label>
                  <input 
                    type="date" 
                    id="prazoEntregaModal" 
                    name="prazoEntrega"
                    class="form-input"
                  >
                </div>
              </div>

              <!-- Opções adicionais para Brise e ACM -->
              <div id="opcoesAdicionaisModal" class="conditional-section hidden">
                <h4 class="text-lg font-semibold text-gray-800 mb-4">Opções Adicionais</h4>
                
                <div class="form-group">
                  <div class="toggle-wrapper">
                    <label class="toggle">
                      <input type="checkbox" id="possuiFechaduraModal" name="possuiFechadura">
                      <span class="toggle-slider"></span>
                    </label>
                    <label for="possuiFechaduraModal" class="form-label cursor-pointer">
                      Possui Fechadura?
                    </label>
                  </div>
                </div>

                <div id="modeloFechaduraGroupModal" class="form-group conditional-section hidden">
                  <label for="modeloFechaduraModal" class="form-label">
                    Modelo da Fechadura *
                  </label>
                  <input 
                    type="text" 
                    id="modeloFechaduraModal" 
                    name="modeloFechadura"
                    class="form-input"
                    placeholder="Digite o modelo da fechadura"
                  >
                </div>
              </div>

              <!-- Seção de upload de materiais -->
              <div id="materiaisSectionModal" class="conditional-section">
                <h4 class="text-lg font-semibold text-gray-800 mb-4 mt-6">Listas de Materiais</h4>
                <p class="text-sm text-gray-600 mb-4">
                  Carregue as planilhas (CSV ou XLSX) com as listas de materiais necessárias para o projeto.
                </p>
                
                <div id="materiaisContainerModal" class="space-y-4">
                  <!-- Zonas de upload serão geradas dinamicamente aqui -->
                </div>
              </div>

              <!-- Botões de ação -->
              <div class="form-group mt-8 flex gap-4">
                <button 
                  type="button" 
                  id="salvarPedidoModal" 
                  class="btn btn-primary flex-1"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                  Salvar Pedido
                </button>
                <button 
                  type="button" 
                  id="cancelarPedidoModal" 
                  class="btn btn-secondary"
                  onclick="dashboardManager.closeModal()"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>

          <!-- Seção de Pré-visualização -->
          <section class="preview-section-modal">
            <div class="preview-header">
              <h3 class="section-title mb-0">Pré-visualização dos Itens</h3>
              <span id="itemsCounterModal" class="items-counter">0 itens</span>
            </div>
            
            <div class="preview-content">
              <!-- Estado vazio -->
              <div id="previewEmptyModal" class="empty-state">
                <svg class="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <h4 class="text-lg font-medium text-gray-600 mb-2">Nenhum item carregado</h4>
                <p class="text-sm text-gray-500">
                  Carregue as planilhas de materiais para ver a pré-visualização aqui
                </p>
              </div>

              <!-- Tabela de itens -->
              <div id="previewTableModal" class="hidden">
                <table class="preview-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Descrição</th>
                      <th>Qtde</th>
                      <th>Altura</th>
                      <th>Largura</th>
                      <th>Cor</th>
                      <th>Medida</th>
                      <th>Observações</th>
                      <th style="width: 100px;">Ações</th>
                    </tr>
                  </thead>
                  <tbody id="previewTableBodyModal">
                    <!-- Itens serão inseridos dinamicamente aqui -->
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  // Inicializar formulário no modal
  initModalForm(pedidoData = null, isViewMode = false) {
    // Criar uma instância do UIManager específica para o modal
    this.modalUIManager = new UIManager();
    
    // Adaptar os IDs para o modal
    this.modalUIManager.setupModalEvents();
    
    // Se for edição ou visualização, preencher dados
    if (pedidoData) {
      this.populateFormData(pedidoData);
      
      // Se há itens existentes, carregá-los
      if (pedidoData.itensExistentes) {
        this.loadExistingItems(pedidoData.itensExistentes);
      }
    }
    
    // Configurar modo visualização se necessário
    if (isViewMode) {
      this.setFormToViewMode();
    } else {
      // Configurar evento de salvamento apenas em modo edição
      document.getElementById('salvarPedidoModal')?.addEventListener('click', () => {
        this.handleModalSave(pedidoData);
      });
    }
  }

  // Preencher dados no formulário (para edição)
  populateFormData(pedidoData) {
    document.getElementById('nomeClienteModal').value = pedidoData.clienteNome || '';
    document.getElementById('numeroPedidoModal').value = pedidoData.numeroPedido || '';
    document.getElementById('tipoProjetoModal').value = pedidoData.tipoProjeto || '';
    document.getElementById('terceirizadoModal').checked = pedidoData.ehTerceirizado || false;
    
    // Trigger change events para atualizar interface
    document.getElementById('tipoProjetoModal').dispatchEvent(new Event('change'));
    document.getElementById('terceirizadoModal').dispatchEvent(new Event('change'));
    
    if (pedidoData.ehTerceirizado) {
      document.getElementById('nomeFornecedorModal').value = pedidoData.nomeFornecedor || '';
      document.getElementById('prazoEntregaModal').value = pedidoData.prazoEntrega || '';
    }
    
    document.getElementById('possuiFechaduraModal').checked = pedidoData.possuiFechadura || false;
    if (pedidoData.possuiFechadura) {
      document.getElementById('modeloFechaduraModal').value = pedidoData.modeloFechadura || '';
      document.getElementById('possuiFechaduraModal').dispatchEvent(new Event('change'));
    }
  }

  // Definir formulário em modo visualização
  setFormToViewMode() {
    // Desabilitar todos os inputs
    const inputs = document.querySelectorAll('#pedidoFormModal input, #pedidoFormModal select, #pedidoFormModal textarea');
    inputs.forEach(input => {
      input.disabled = true;
      input.style.backgroundColor = '#f8f9fa';
      input.style.cursor = 'not-allowed';
    });

    // Esconder botão de salvar
    const saveBtn = document.getElementById('salvarPedidoModal');
    if (saveBtn) {
      saveBtn.style.display = 'none';
    }

    // Esconder todas as zonas de upload
    const uploadZones = document.querySelectorAll('[id*="upload-modal"]');
    uploadZones.forEach(zone => {
      const uploadArea = zone.querySelector('.upload-content');
      if (uploadArea) {
        uploadArea.style.display = 'none';
      }
    });

    // Adicionar indicador visual de modo visualização
    const formSection = document.querySelector('.form-section-modal');
    if (formSection) {
      const viewModeIndicator = document.createElement('div');
      viewModeIndicator.className = 'view-mode-indicator';
      viewModeIndicator.innerHTML = `
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
            <span class="text-blue-700 font-medium">Modo Visualização</span>
          </div>
          <p class="text-blue-600 text-sm mt-1">Dados somente para leitura</p>
        </div>
      `;
      formSection.insertBefore(viewModeIndicator, formSection.firstChild.nextSibling);
    }
  }

  // Carregar itens existentes no modal
  loadExistingItems(itens) {
    // Agrupar itens por lista de material
    const itensPorLista = itens.reduce((acc, item) => {
      const lista = item.listaMaterial;
      if (!acc[lista]) acc[lista] = [];
      acc[lista].push(item);
      return acc;
    }, {});

    // 🔧 MODIFICAÇÃO: Marcar itens existentes corretamente 
    itens.forEach(item => {
      item.isExistingData = true;
      item.isNewItem = false;
      item.isModified = false;
      // Garantir que tem ID (itens do banco sempre têm)
      if (!item.id) {
        console.warn('Item existente sem ID:', item);
      }
    });
    
    // Adicionar itens ao modalUIManager
    this.modalUIManager.allItems = [...itens];
    
    // Agrupar para o sistema de arquivos carregados
    Object.keys(itensPorLista).forEach(listaMaterial => {
      const itensLista = itensPorLista[listaMaterial];
      this.modalUIManager.loadedFiles.set(listaMaterial, {
        success: true,
        items: itensLista,
        fileName: 'Dados existentes',
        totalRows: itensLista.length,
        processedRows: itensLista.length,
        isExistingData: true
      });
    });

    // Aguardar o DOM estar pronto e marcar zonas como carregadas
    setTimeout(() => {
      this.markUploadZonesAsLoaded(itensPorLista);
      this.modalUIManager.updateModalPreview();
    }, 500);
  }

  // Marcar zonas de upload como carregadas
  markUploadZonesAsLoaded(itensPorLista) {
    Object.keys(itensPorLista).forEach(listaMaterial => {
      const itensCount = itensPorLista[listaMaterial].length;
      const zoneId = `upload-modal-${listaMaterial.replace(/\s+/g, '-').toLowerCase()}`;
      const zone = document.getElementById(zoneId);
      
      if (zone) {
        const content = zone.querySelector('.upload-content');
        const success = zone.querySelector('.upload-success');
        const error = zone.querySelector('.upload-error');
        
        if (content && success) {
          content.classList.add('hidden');
          error.classList.add('hidden');
          success.classList.remove('hidden');
          
          // Atualizar informações
          const fileInfo = success.querySelector('.file-info');
          if (fileInfo) {
            fileInfo.innerHTML = `
              <div class="existing-data-info">
                <span class="text-green-700 font-medium">✓ Lista carregada - ${itensCount} itens</span>
                <div class="mt-2 space-y-1">
                  <button type="button" class="edit-existing-list block w-full" data-lista="${listaMaterial}">
                    📝 Editar/Substituir Lista
                  </button>
                </div>
              </div>
            `;
            
            // Adicionar evento para editar lista existente
            const editBtn = fileInfo.querySelector('.edit-existing-list');
            if (editBtn) {
              editBtn.addEventListener('click', () => {
                this.editExistingList(listaMaterial, zone);
              });
            }
          }

          // 🔧 ADICIONAR TOOLTIP para listas existentes
          const items = itensPorLista[listaMaterial];
          const totalQuantity = items.reduce((sum, item) => sum + (item.quantidade || 0), 0);
          const tooltipText = `${itensCount} itens\nQuantidade total: ${totalQuantity}`;
          
          success.setAttribute('data-tooltip', tooltipText);
          success.classList.add('tooltip-trigger');
          
          // Configurar eventos do tooltip
          this.modalUIManager.setupTooltipEvents(success);
          
          // Adicionar classe visual para dados existentes
          zone.classList.add('has-existing-data');
        }
      }
    });
  }

  // Editar lista existente
  editExistingList(listaMaterial, zone) {
    // Criar modal de opções mais elegante
    this.showEditOptionsModal(listaMaterial, zone);
  }

  // Mostrar modal de opções para editar lista
  showEditOptionsModal(listaMaterial, zone) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1001]';
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <h3 class="text-lg font-semibold mb-4 text-gray-900">Editar Lista: ${listaMaterial}</h3>
        <p class="text-sm text-gray-600 mb-6">Escolha o que deseja fazer com esta lista:</p>
        
        <div class="space-y-3">
          <button class="edit-option-btn w-full text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors" data-action="add">
            <div class="flex items-center">
              <span class="text-xl mr-3">📥</span>
              <div>
                <div class="font-medium">Adicionar mais itens</div>
                <div class="text-sm text-gray-500">Manter itens atuais e adicionar novos</div>
              </div>
            </div>
          </button>
          
          <button class="edit-option-btn w-full text-left p-3 border rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-colors" data-action="replace">
            <div class="flex items-center">
              <span class="text-xl mr-3">🔄</span>
              <div>
                <div class="font-medium">Substituir lista</div>
                <div class="text-sm text-gray-500">Remover todos os itens atuais e carregar novos</div>
              </div>
            </div>
          </button>
          
          <button class="edit-option-btn w-full text-left p-3 border rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors" data-action="remove">
            <div class="flex items-center">
              <span class="text-xl mr-3">🗑️</span>
              <div>
                <div class="font-medium">Remover lista</div>
                <div class="text-sm text-gray-500">Excluir todos os itens desta lista</div>
              </div>
            </div>
          </button>
        </div>
        
        <div class="mt-6 flex justify-end">
          <button class="cancel-edit px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors">Cancelar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Eventos
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('cancel-edit')) {
        document.body.removeChild(modal);
      }
    });
    
    modal.querySelectorAll('.edit-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        document.body.removeChild(modal);
        
        switch (action) {
          case 'add':
            this.addToExistingList(listaMaterial, zone);
            break;
          case 'replace':
            this.replaceExistingList(listaMaterial, zone);
            break;
          case 'remove':
            this.removeExistingList(listaMaterial, zone);
            break;
        }
      });
    });
  }

  // Adicionar à lista existente
  addToExistingList(listaMaterial, zone) {
    // Resetar zona para permitir novo upload
    this.resetUploadZone(zone, `Adicionar mais itens à lista "${listaMaterial}"`);
  }

  // Substituir lista existente
  replaceExistingList(listaMaterial, zone) {
    if (confirm(`Tem certeza que deseja substituir completamente a lista "${listaMaterial}"?\n\nTodos os itens atuais serão removidos.`)) {
      // Remover itens existentes desta lista
      this.modalUIManager.allItems = this.modalUIManager.allItems.filter(item => item.listaMaterial !== listaMaterial);
      this.modalUIManager.loadedFiles.delete(listaMaterial);
      
      // Resetar zona
      this.resetUploadZone(zone, `Carregar nova lista para substituir "${listaMaterial}"`);
      
      // Atualizar pré-visualização
      this.modalUIManager.updateModalPreview();
    }
  }

  // Remover lista existente
  removeExistingList(listaMaterial, zone) {
    if (confirm(`Tem certeza que deseja remover completamente a lista "${listaMaterial}"?\n\nTodos os itens desta lista serão excluídos.`)) {
      // Remover itens desta lista
      this.modalUIManager.allItems = this.modalUIManager.allItems.filter(item => item.listaMaterial !== listaMaterial);
      this.modalUIManager.loadedFiles.delete(listaMaterial);
      
      // Resetar zona para estado inicial
      this.resetUploadZone(zone, `Lista de ${listaMaterial}`);
      
      // Atualizar pré-visualização
      this.modalUIManager.updateModalPreview();
    }
  }

  // Resetar zona de upload
  resetUploadZone(zone, title) {
    const content = zone.querySelector('.upload-content');
    const success = zone.querySelector('.upload-success');
    const error = zone.querySelector('.upload-error');
    
    // Mostrar área de upload
    if (content) {
      content.classList.remove('hidden');
      // Atualizar título se fornecido
      const titleElement = content.querySelector('h3');
      if (titleElement && title) {
        titleElement.textContent = title;
      }
    }
    
    // Esconder outros estados
    if (success) success.classList.add('hidden');
    if (error) error.classList.add('hidden');
    
    // Limpar input de arquivo
    const fileInput = zone.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // Processar salvamento do modal
  async handleModalSave(pedidoData = null) {
    try {
      // Usar a lógica existente do UIManager adaptada para o modal
      const formData = this.collectModalFormData();
      
      // Validar dados
      const errors = this.validateModalForm();
      if (errors.length > 0) {
        this.showNotification('Erro na validação:\n' + errors.join('\n'), 'error');
        return;
      }

      let pedidoId;
      let novasListasAdicionadas = false;
      let listasAnteriores = new Set();
      
      if (pedidoData && pedidoData.id) {
        // Modo edição - atualizar pedido existente
        pedidoId = pedidoData.id;
        
        // Verificar se existem novas listas sendo adicionadas
        if (pedidoData.itensExistentes && this.modalUIManager && this.modalUIManager.allItems) {
          // Obter listas existentes
          pedidoData.itensExistentes.forEach(item => {
            if (item.listaMaterial) {
              listasAnteriores.add(item.listaMaterial);
            }
          });
          
          // Verificar se há novas listas nos itens atuais
          this.modalUIManager.allItems.forEach(item => {
            if (item.listaMaterial && !listasAnteriores.has(item.listaMaterial)) {
              novasListasAdicionadas = true;
              console.log(`🔍 Nova lista detectada: ${item.listaMaterial}`);
            }
          });
        }
        
        // Verificar se o pedido estava em um estado finalizado e agora tem novas listas
        if (novasListasAdicionadas) {
          console.log('🔄 Novas listas adicionadas a um pedido existente, atualizando status...');
          formData.statusGeral = 'Pendente de Análise';
        }
        
        await FirebaseService.atualizarPedido(pedidoId, formData);
        
        // 🔧 REGRA SIMPLES: EDITAR = NUNCA mexer em listas existentes, SEMPRE preservar tudo
        // SÓ adicionar novas listas, NUNCA excluir nada automaticamente
        
        console.log('✅ EDITAR: Preservando TODAS as listas existentes intactas');
        
        // ZERO lógica de exclusão automática - deixar tudo como está
        const itensParaPreservar = pedidoData.itensExistentes || [];
        const itensParaExcluir = []; // NUNCA excluir automaticamente
        
        console.log(`✅ Preservando ${itensParaPreservar.length} itens existentes (todos inalterados)`);
        console.log('📁 Nenhuma lista será excluída automaticamente - apenas novas listas serão adicionadas');
        
        // 🔧 NOTIFICAÇÃO SIMPLES: Informar que listas existentes foram preservadas
        let mensagem = 'Pedido atualizado com sucesso!';
        if (pedidoData && pedidoData.id && itensParaPreservar.length > 0) {
          mensagem += `\n✅ ${itensParaPreservar.length} itens existentes preservados inalterados`;
        }
        
        this.showNotification(mensagem, 'success');
      } else {
        // Modo criação - criar novo pedido
        // Sempre definir o status como Pendente de Análise para pedidos novos
        formData.statusGeral = 'Pendente de Análise';
        pedidoId = await FirebaseService.salvarPedido(formData);
        this.showNotification('Pedido cadastrado com sucesso!', 'success');
      }
      
      // Salvar itens (novos ou atualizados) se não for terceirizado
      if (!formData.ehTerceirizado && this.modalUIManager && this.modalUIManager.allItems && this.modalUIManager.allItems.length > 0) {
        // 🔧 CORREÇÃO REAL: IGNORAR COMPLETAMENTE listas existentes - salvar APENAS listas genuinamente novas
        const itensParaSalvar = this.modalUIManager.allItems.filter(item => {
          // REGRA SIMPLES: Se é dado existente (vindo do banco), NÃO salvar
          if (item.isExistingData === true) {
            console.log(`🚫 IGNORANDO item existente (só visualização): ${item.codigo} - ${item.descricao}`);
            return false;
          }
          
          // SALVAR apenas se:
          // 1. É genuinamente novo (sem ID)
          // 2. Foi explicitamente marcado como novo pelo usuário
          // 3. Não é dado existente
          const ehNovoItem = !item.id && !item.isExistingData;
          
          if (ehNovoItem) {
            console.log(`💾 Salvando item GENUINAMENTE NOVO: ${item.codigo} - ${item.descricao} (Lista: ${item.listaMaterial})`);
          }
          
          return ehNovoItem;
        });
        
        if (itensParaSalvar.length > 0) {
          console.log(`💾 Salvando ${itensParaSalvar.length} novos itens...`);
          await FirebaseService.salvarItens(pedidoId, itensParaSalvar);
          
          // 🔧 NOTIFICAÇÃO ADICIONAL: Informar sobre novos itens salvos
          if (pedidoData && pedidoData.id) {
            this.showNotification(`💾 ${itensParaSalvar.length} novos itens adicionados ao pedido`, 'info');
          }
        } else {
          console.log('ℹ️ Nenhum item novo para salvar');
        }
      }
      
      // Fechar modal e atualizar lista
      this.closeModal();
      await this.refreshData();
      
    } catch (error) {
      console.error('Erro ao salvar pedido:', error);
      this.showNotification('Erro ao salvar pedido: ' + error.message, 'error');
    }
  }

  // Coletar dados do formulário modal
  collectModalFormData() {
    const terceirizado = document.getElementById('terceirizadoModal').checked;
    const possuiFechadura = document.getElementById('possuiFechaduraModal').checked;
    
    const dados = {
      clienteNome: document.getElementById('nomeClienteModal').value.trim(),
      numeroPedido: document.getElementById('numeroPedidoModal').value.trim(),
      tipoProjeto: document.getElementById('tipoProjetoModal').value,
      ehTerceirizado: terceirizado,
      possuiFechadura: possuiFechadura
    };
    
    if (terceirizado) {
      dados.nomeFornecedor = document.getElementById('nomeFornecedorModal').value.trim();
      dados.prazoEntrega = document.getElementById('prazoEntregaModal').value.trim();
    }
    
    if (possuiFechadura) {
      dados.modeloFechadura = document.getElementById('modeloFechaduraModal').value.trim();
    }
    
    return dados;
  }

  // Validar formulário modal
  validateModalForm() {
    const errors = [];
    
    const nomeCliente = document.getElementById('nomeClienteModal').value.trim();
    const numeroPedido = document.getElementById('numeroPedidoModal').value.trim();
    const tipoProjeto = document.getElementById('tipoProjetoModal').value;
    
    if (!nomeCliente) errors.push('Nome do cliente é obrigatório');
    if (!numeroPedido) errors.push('Número do pedido é obrigatório');
    if (!tipoProjeto) errors.push('Tipo de projeto é obrigatório');
    
    const terceirizado = document.getElementById('terceirizadoModal').checked;
    if (terceirizado) {
      const nomeFornecedor = document.getElementById('nomeFornecedorModal').value.trim();
      const prazoEntrega = document.getElementById('prazoEntregaModal').value.trim();
      
      if (!nomeFornecedor) errors.push('Nome do fornecedor é obrigatório');
      if (!prazoEntrega) errors.push('Prazo de entrega é obrigatório');
    } else {
      if (!this.modalUIManager || !this.modalUIManager.allItems || this.modalUIManager.allItems.length === 0) {
        errors.push('Pelo menos uma lista de materiais deve ser carregada');
      }
    }
    
    const possuiFechadura = document.getElementById('possuiFechaduraModal').checked;
    if (possuiFechadura) {
      const modeloFechadura = document.getElementById('modeloFechaduraModal').value.trim();
      if (!modeloFechadura) errors.push('Modelo da fechadura é obrigatório');
    }
    
    return errors;
  }

  // Mostrar notificação
  showNotification(message, type = 'info') {
    // Reutilizar função do UIManager se disponível
    if (window.PedidosApp && window.PedidosApp.uiManager) {
      window.PedidosApp.uiManager.showNotification(message, type);
    } else {
      // Fallback simples
      alert(message);
    }
  }

  // Mostrar erro
  showError(message) {
    this.showNotification(message, 'error');
  }
}

export default DashboardManager;