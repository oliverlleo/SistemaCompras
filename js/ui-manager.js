// Gerenciador de Interface do Usuário
class UIManager {
  constructor() {
    this.materialCategories = {
      'PVC': ['Perfil', 'Reforço', 'Aço', 'Ferragens', 'Vidros', 'Esteira', 'Tela Retrátil', 'Motor'],
      'Alumínio': ['Perfil', 'Acessórios', 'Ferragens', 'Vidros', 'Esteira', 'Motor'],
      'Brise': ['Perfil', 'Lâminas', 'Ferragens', 'Acessórios'],
      'ACM': ['Placas ACM', 'Perfis', 'Fixação', 'Acessórios'],
      'Outros': ['Materiais Diversos']
    };
    
    // Flag para controlar se já temos uma categoria personalizada
    this.hasCustomCategory = false;
    
    this.loadedFiles = new Map(); // Armazenar arquivos carregados
    this.allItems = []; // Todos os itens processados
    this.initTooltips(); // Inicializar sistema de tooltips
  }

  // 🔧 NOVA FUNÇÃO: Inicializar sistema de tooltips
  initTooltips() {
    // Criar container do tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'material-tooltip';
    tooltip.className = 'absolute z-50 bg-gray-900 text-white text-xs rounded py-2 px-3 pointer-events-none opacity-0 transition-opacity duration-200';
    tooltip.style.transform = 'translateX(-50%)';
    document.body.appendChild(tooltip);
  }

  // Inicializar eventos da interface
  init() {
    this.setupEventListeners();
    this.updateMaterialCategories();
  }

  // Configurar eventos específicos para o modal
  setupModalEvents() {
    this.setupModalEventListeners();
    this.updateModalMaterialCategories();
  }

  // Configurar eventos específicos para o modal
  setupModalEventListeners() {
    // Mudança no tipo de projeto no modal
    const tipoProjetoModalSelect = document.getElementById('tipoProjetoModal');
    if (tipoProjetoModalSelect) {
      tipoProjetoModalSelect.addEventListener('change', () => {
        this.updateModalMaterialCategories();
        this.updateModalAdditionalOptions();
      });
    }

    // Mudança em serviço terceirizado no modal
    const terceirizadoModalToggle = document.getElementById('terceirizadoModal');
    if (terceirizadoModalToggle) {
      terceirizadoModalToggle.addEventListener('change', () => {
        this.toggleModalTerceirizadoFields();
      });
    }

    // Eventos para campos de fechadura no modal
    const possuiFechaduraModal = document.getElementById('possuiFechaduraModal');
    if (possuiFechaduraModal) {
      possuiFechaduraModal.addEventListener('change', () => {
        this.toggleModalFechaduraModel();
      });
    }
  }

  // Atualizar categorias de materiais baseado no tipo de projeto (MODAL)
  updateModalMaterialCategories() {
    const tipoProjeto = document.getElementById('tipoProjetoModal').value;
    const materiaisContainer = document.getElementById('materiaisContainerModal');
    
    if (!tipoProjeto || !materiaisContainer) return;

    // Limpar container anterior
    materiaisContainer.innerHTML = '';
    this.loadedFiles.clear();
    this.allItems = [];
    this.updateModalPreview();
    this.hasCustomCategory = false; // Resetar flag de categoria personalizada

    const categories = this.materialCategories[tipoProjeto] || [];
    
    // Adiciona um container que envolve todas as zonas de upload
    const uploadZonesWrapper = document.createElement('div');
    uploadZonesWrapper.className = 'upload-zones-wrapper';
    uploadZonesWrapper.style.display = 'grid';
    uploadZonesWrapper.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    uploadZonesWrapper.style.gap = '1rem';
    uploadZonesWrapper.style.width = '100%';
    uploadZonesWrapper.style.minHeight = '800px'; // Força altura mínima para garantir scroll SEMPRE
    uploadZonesWrapper.style.padding = '1rem';
    
    // Criar zonas para categorias padrão
    categories.forEach(category => {
      const uploadZone = this.createModalUploadZone(category);
      uploadZonesWrapper.appendChild(uploadZone);
    });
    
    // Adicionar o botão para criar categoria personalizada (para todos os tipos)
    const customCategoryZone = this.createCustomCategoryZone(true); // true indica que é para o modal
    uploadZonesWrapper.appendChild(customCategoryZone);
    
    materiaisContainer.appendChild(uploadZonesWrapper);
  }

  // Criar zona de upload para uma categoria (MODAL)
  createModalUploadZone(category) {
    const div = document.createElement('div');
    div.className = 'upload-zone bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-all duration-300 hover:border-blue-400 hover:bg-blue-50 relative';
    div.id = `upload-modal-${category.replace(/\s+/g, '-').toLowerCase()}`;
    
    div.innerHTML = `
      <div class="upload-content">
        <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">Lista de ${category}</h3>
        <p class="mt-1 text-sm text-gray-500">Clique para selecionar arquivo CSV ou XLSX</p>
        <button type="button" class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200">
          Carregar Arquivo
        </button>
        <input type="file" class="hidden" accept=".csv,.xls,.xlsx" data-category="${category}">
      </div>
      <div class="upload-success hidden">
        <svg class="mx-auto h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="mt-1 text-sm font-medium text-green-900">Arquivo Carregado</h3>
        <p class="text-xs text-green-700 file-info max-w-[90%] truncate"></p>
        <button type="button" class="mt-1 text-xs text-blue-600 hover:text-blue-800 change-file">Alterar arquivo</button>
      </div>
      <div class="upload-error hidden">
        <svg class="mx-auto h-10 w-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="mt-1 text-sm font-medium text-red-900">Erro no Arquivo</h3>
        <p class="text-xs text-red-700 error-message max-w-[90%] truncate"></p>
        <button type="button" class="mt-1 text-xs text-blue-600 hover:text-blue-800 retry-upload">Tentar novamente</button>
      </div>
    `;

    // Eventos para esta zona de upload
    this.setupModalUploadZoneEvents(div, category);
    
    return div;
  }

  // Configurar eventos para zona de upload (MODAL)
  setupModalUploadZoneEvents(zone, category) {
    const button = zone.querySelector('button');
    const input = zone.querySelector('input[type="file"]');
    const changeFileBtn = zone.querySelector('.change-file');
    const retryBtn = zone.querySelector('.retry-upload');

    // Click no botão ou zona
    const handleClick = () => input.click();
    button.addEventListener('click', handleClick);
    
    // Mudança no input de arquivo
    input.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileUpload(e.target.files[0], category, zone);
      }
    });

    // Botão de alterar arquivo
    if (changeFileBtn) {
      changeFileBtn.addEventListener('click', handleClick);
    }

    // Botão de tentar novamente
    if (retryBtn) {
      retryBtn.addEventListener('click', handleClick);
    }

    // Drag and drop
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('border-blue-400', 'bg-blue-50');
    });

    zone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      zone.classList.remove('border-blue-400', 'bg-blue-50');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('border-blue-400', 'bg-blue-50');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileUpload(files[0], category, zone);
      }
    });
  }

  // Atualizar opções adicionais baseado no tipo de projeto (MODAL)
  updateModalAdditionalOptions() {
    const tipoProjeto = document.getElementById('tipoProjetoModal').value;
    const opcoesAdicionais = document.getElementById('opcoesAdicionaisModal');
    
    if (!opcoesAdicionais) return;

    if (tipoProjeto === 'Brise' || tipoProjeto === 'ACM') {
      opcoesAdicionais.classList.remove('hidden');
    } else {
      opcoesAdicionais.classList.add('hidden');
    }
  }

  // Alternar campos de terceirizado (MODAL)
  toggleModalTerceirizadoFields() {
    const terceirizado = document.getElementById('terceirizadoModal').checked;
    const camposTerceirizado = document.getElementById('camposTerceirizadoModal');
    const materiaisSection = document.getElementById('materiaisSectionModal');
    
    if (terceirizado) {
      camposTerceirizado.classList.remove('hidden');
      materiaisSection.classList.add('hidden');
    } else {
      camposTerceirizado.classList.add('hidden');
      materiaisSection.classList.remove('hidden');
    }
  }

  // Alternar campo modelo da fechadura (MODAL)
  toggleModalFechaduraModel() {
    const possuiFechadura = document.getElementById('possuiFechaduraModal').checked;
    const modeloFechaduraGroup = document.getElementById('modeloFechaduraGroupModal');
    
    if (possuiFechadura) {
      modeloFechaduraGroup.classList.remove('hidden');
    } else {
      modeloFechaduraGroup.classList.add('hidden');
    }
  }
  
  // Criar zona para adicionar categoria personalizada
  createCustomCategoryZone(isModal = false) {
    const prefix = isModal ? 'modal-' : '';
    const div = document.createElement('div');
    div.className = 'upload-zone bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-6 text-center transition-all duration-300 hover:border-blue-500 hover:bg-blue-100 relative';
    div.id = `upload-${prefix}custom-category`;
    
    div.innerHTML = `
      <div class="custom-category-form">
        <svg class="mx-auto h-12 w-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">Adicionar Nova Lista</h3>
        <p class="mt-1 text-sm text-gray-600">Defina um nome personalizado para uma nova lista de materiais</p>
        <div class="mt-4">
          <input 
            type="text" 
            id="${prefix}custom-category-name" 
            class="form-input py-2 px-3 block w-full border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
            placeholder="Nome da lista (ex: Outros, Personalizada)"
          >
          <button 
            type="button" 
            id="${prefix}add-custom-category" 
            class="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 w-full justify-center"
          >
            Adicionar Lista Personalizada
          </button>
        </div>
      </div>
    `;
    
    // Adicionar evento ao botão e Enter key
    setTimeout(() => {
      const addButton = document.getElementById(`${prefix}add-custom-category`);
      const inputField = document.getElementById(`${prefix}custom-category-name`);
      
      if (addButton) {
        addButton.addEventListener('click', () => {
          this.addCustomCategory(isModal);
        });
      }
      
      if (inputField) {
        inputField.addEventListener('keypress', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            this.addCustomCategory(isModal);
          }
        });
      }
    }, 100);
    
    return div;
  }
  
  // Adicionar categoria personalizada
  addCustomCategory(isModal = false) {
    const prefix = isModal ? 'modal-' : '';
    const customNameInput = document.getElementById(`${prefix}custom-category-name`);
    
    if (!customNameInput || !customNameInput.value.trim()) {
      alert('Por favor, insira um nome para a lista personalizada.');
      return;
    }
    
    // Obter o nome da categoria personalizada
    const customCategoryName = customNameInput.value.trim();
    
    // Verificar se já existe essa categoria
    const tipoProjeto = document.getElementById(isModal ? 'tipoProjetoModal' : 'tipoProjeto').value;
    const existingCategories = this.materialCategories[tipoProjeto] || [];
    
    if (existingCategories.includes(customCategoryName)) {
      alert(`Já existe uma lista chamada "${customCategoryName}". Por favor, escolha outro nome.`);
      return;
    }
    
    // Verificar se já temos uma categoria personalizada (limitar a uma)
    if (this.hasCustomCategory && customCategoryName !== 'Outros') {
      alert('Você já adicionou uma lista personalizada. Apenas uma lista adicional é permitida.');
      return;
    }
    
    // Adicionar a nova categoria
    const materiaisContainer = document.getElementById(isModal ? 'materiaisContainerModal' : 'materiaisContainer');
    const uploadZonesWrapper = materiaisContainer.querySelector('.upload-zones-wrapper');
    
    if (!uploadZonesWrapper) return;
    
    // Criar nova zona de upload
    const newUploadZone = isModal 
      ? this.createModalUploadZone(customCategoryName)
      : this.createUploadZone(customCategoryName);
    
    // Substituir a zona de categoria personalizada
    const customCategoryZone = document.getElementById(`upload-${prefix}custom-category`);
    
    if (customCategoryZone) {
      uploadZonesWrapper.insertBefore(newUploadZone, customCategoryZone);
      
      // Se não for a categoria "Outros", marcar que já temos uma categoria personalizada
      if (customCategoryName !== 'Outros') {
        this.hasCustomCategory = true;
        // Remover a zona de categoria personalizada se não for "Outros"
        uploadZonesWrapper.removeChild(customCategoryZone);
      } else {
        // Limpar o campo para permitir adicionar outra categoria
        customNameInput.value = '';
      }
    }
  }

  // Atualizar pré-visualização (MODAL)
  updateModalPreview() {
    const previewContainer = document.getElementById('previewContainerModal');
    const previewTable = document.getElementById('previewTableModal');
    const previewEmpty = document.getElementById('previewEmptyModal');
    const itemsCounter = document.getElementById('itemsCounterModal');
    
    if (this.allItems.length === 0) {
      if (previewTable) previewTable.classList.add('hidden');
      if (previewEmpty) previewEmpty.classList.remove('hidden');
      if (itemsCounter) itemsCounter.textContent = '0 itens';
      return;
    }

    if (previewEmpty) previewEmpty.classList.add('hidden');
    if (previewTable) previewTable.classList.remove('hidden');
    if (itemsCounter) itemsCounter.textContent = `${this.allItems.length} itens`;
    
    const tbody = document.getElementById('previewTableBodyModal');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Agrupar por categoria
    const groupedItems = this.allItems.reduce((groups, item) => {
      const category = item.listaMaterial;
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
      return groups;
    }, {});

    // Renderizar itens agrupados
    Object.keys(groupedItems).forEach(category => {
      // Cabeçalho da categoria
      const headerRow = document.createElement('tr');
      headerRow.className = 'bg-gray-100';
      headerRow.innerHTML = `
        <td colspan="9" class="px-6 py-3 text-left text-sm font-semibold text-gray-900">
          ${category} (${groupedItems[category].length} itens)
        </td>
      `;
      tbody.appendChild(headerRow);

      // Itens da categoria
      groupedItems[category].forEach((item, itemIndex) => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 hover:bg-gray-50';
        
        // Verificar se há erros
        const hasError = !item.codigo || !item.descricao || item.quantidade <= 0;
        if (hasError) {
          row.className += ' bg-red-50 border-red-200';
        }
        
        // Criar ID único para o item
        const itemId = `item-${category.replace(/\s+/g, '-').toLowerCase()}-${itemIndex}`;
        row.setAttribute('data-item-id', itemId);
        row.setAttribute('data-category', category);
        row.setAttribute('data-item-index', itemIndex);
        
        row.innerHTML = `
          <td class="px-6 py-4 text-sm text-gray-900">${item.codigo || '<span class="text-red-500">Faltando</span>'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.descricao || '<span class="text-red-500">Faltando</span>'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.quantidade || '<span class="text-red-500">0</span>'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.altura || '-'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.largura || '-'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.cor || '-'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.medida || '-'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.observacoes || '-'}</td>
          <td class="px-6 py-4 text-sm text-center">
            <button 
              onclick="window.uiManager.deleteItem('${itemId}', '${category}', ${itemIndex})"
              class="inline-flex items-center px-2 py-1 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
              title="Remover este item da prévisualização"
            >
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Deletar
            </button>
          </td>
        `;
        tbody.appendChild(row);
      });
    });
  }

  // 🎯 NOVA FUNÇÃO: Deletar item da prévisualização
  deleteItem(itemId, category, itemIndex) {
    try {
      console.log(`🗑️ Deletando item: ${itemId} da categoria ${category}, índice ${itemIndex}`);
      
      // Encontrar o item na lista allItems
      const allItemIndex = this.allItems.findIndex((item, index) => {
        return item.listaMaterial === category && 
               this.allItems.filter(i => i.listaMaterial === category).indexOf(item) === itemIndex;
      });
      
      if (allItemIndex === -1) {
        console.error('Item não encontrado para deletar');
        return;
      }
      
      // Obter dados do item antes de deletar para log
      const itemToDelete = this.allItems[allItemIndex];
      console.log(`🗑️ Removendo item: ${itemToDelete.codigo} - ${itemToDelete.descricao}`);
      
      // Remover o item da lista
      this.allItems.splice(allItemIndex, 1);
      
      // Atualizar a prévisualização
      this.updateModalPreview();
      
      // Mostrar mensagem de sucesso
      this.showSuccessMessage(`Item "${itemToDelete.codigo}" removido da prévisualização`);
      
      console.log(`✅ Item deletado com sucesso. Total de itens restantes: ${this.allItems.length}`);
      
    } catch (error) {
      console.error('Erro ao deletar item:', error);
      this.showErrorMessage('Erro ao remover item da prévisualização');
    }
  }

  // Função para mostrar mensagem de sucesso
  showSuccessMessage(message) {
    // Procurar por elemento de toast existente ou criar um novo
    let toast = document.getElementById('delete-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'delete-toast';
      toast.className = 'fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300';
      document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.className = 'fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg transform transition-transform duration-300';
    
    // Mostrar o toast
    setTimeout(() => {
      toast.classList.remove('translate-x-full');
    }, 100);
    
    // Esconder o toast após 3 segundos
    setTimeout(() => {
      toast.classList.add('translate-x-full');
    }, 3000);
  }

  // Função para mostrar mensagem de erro
  showErrorMessage(message) {
    // Procurar por elemento de toast existente ou criar um novo
    let toast = document.getElementById('delete-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'delete-toast';
      toast.className = 'fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300';
      document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.className = 'fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg transform transition-transform duration-300';
    
    // Mostrar o toast
    setTimeout(() => {
      toast.classList.remove('translate-x-full');
    }, 100);
    
    // Esconder o toast após 3 segundos
    setTimeout(() => {
      toast.classList.add('translate-x-full');
    }, 3000);
  }

  // Configurar eventos
  setupEventListeners() {
    // Mudança no tipo de projeto
    const tipoProjetoSelect = document.getElementById('tipoProjeto');
    if (tipoProjetoSelect) {
      tipoProjetoSelect.addEventListener('change', () => {
        this.updateMaterialCategories();
        this.updateAdditionalOptions();
      });
    }

    // Mudança em serviço terceirizado
    const terceirizadoToggle = document.getElementById('terceirizado');
    if (terceirizadoToggle) {
      terceirizadoToggle.addEventListener('change', () => {
        this.toggleTerceirizadoFields();
      });
    }

    // Evento do botão salvar
    const salvarBtn = document.getElementById('salvarPedido');
    if (salvarBtn) {
      salvarBtn.addEventListener('click', () => {
        this.handleSalvarPedido();
      });
    }

    // Eventos para campos de fechadura
    const possuiFechadura = document.getElementById('possuiFechadura');
    if (possuiFechadura) {
      possuiFechadura.addEventListener('change', () => {
        this.toggleFechaduraModel();
      });
    }
  }

  // Atualizar categorias de materiais baseado no tipo de projeto
  updateMaterialCategories() {
    const tipoProjeto = document.getElementById('tipoProjeto').value;
    const materiaisContainer = document.getElementById('materiaisContainer');
    
    if (!tipoProjeto || !materiaisContainer) return;

    // Limpar container anterior
    materiaisContainer.innerHTML = '';
    this.loadedFiles.clear();
    this.allItems = [];
    this.updatePreview();
    this.hasCustomCategory = false; // Resetar flag de categoria personalizada

    const categories = this.materialCategories[tipoProjeto] || [];
    
    // Adiciona um container que envolve todas as zonas de upload
    const uploadZonesWrapper = document.createElement('div');
    uploadZonesWrapper.className = 'upload-zones-wrapper';
    uploadZonesWrapper.style.display = 'grid';
    uploadZonesWrapper.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    uploadZonesWrapper.style.gap = '1rem';
    uploadZonesWrapper.style.width = '100%';
    uploadZonesWrapper.style.minHeight = '600px'; // Força altura mínima para garantir scroll
    uploadZonesWrapper.style.padding = '1rem';
    
    // Criar zonas para categorias padrão
    categories.forEach(category => {
      const uploadZone = this.createUploadZone(category);
      uploadZonesWrapper.appendChild(uploadZone);
    });
    
    // Adicionar o botão para criar categoria personalizada (para todos os tipos)
    const customCategoryZone = this.createCustomCategoryZone();
    uploadZonesWrapper.appendChild(customCategoryZone);
    
    // Adiciona um título e o wrapper ao container principal
    const titleElement = document.createElement('h3');
    titleElement.className = 'text-sm font-medium text-gray-900 mb-3';
    titleElement.textContent = 'Listas de Materiais';
    
    materiaisContainer.appendChild(titleElement);
    materiaisContainer.appendChild(uploadZonesWrapper);
  }

  // Criar zona de upload para uma categoria
  createUploadZone(category) {
    const div = document.createElement('div');
    div.className = 'upload-zone bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-all duration-300 hover:border-blue-400 hover:bg-blue-50 relative';
    div.id = `upload-${category.replace(/\s+/g, '-').toLowerCase()}`;
    
    div.innerHTML = `
      <div class="upload-content">
        <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">Lista de ${category}</h3>
        <p class="mt-1 text-sm text-gray-500">Clique para selecionar arquivo CSV ou XLSX</p>
        <button type="button" class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200">
          Carregar Arquivo
        </button>
        <input type="file" class="hidden" accept=".csv,.xls,.xlsx" data-category="${category}">
      </div>
      <div class="upload-success hidden">
        <svg class="mx-auto h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="mt-1 text-sm font-medium text-green-900">Arquivo Carregado</h3>
        <p class="text-xs text-green-700 file-info max-w-[90%] truncate"></p>
        <button type="button" class="mt-1 text-xs text-blue-600 hover:text-blue-800 change-file">Alterar arquivo</button>
      </div>
      <div class="upload-error hidden">
        <svg class="mx-auto h-10 w-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="mt-1 text-sm font-medium text-red-900">Erro no Arquivo</h3>
        <p class="text-xs text-red-700 error-message max-w-[90%] truncate"></p>
        <button type="button" class="mt-1 text-xs text-blue-600 hover:text-blue-800 retry-upload">Tentar novamente</button>
      </div>
    `;

    // Eventos para esta zona de upload
    this.setupUploadZoneEvents(div, category);
    
    return div;
  }

  // Configurar eventos para zona de upload
  setupUploadZoneEvents(zone, category) {
    const button = zone.querySelector('button');
    const input = zone.querySelector('input[type="file"]');
    const changeFileBtn = zone.querySelector('.change-file');
    const retryBtn = zone.querySelector('.retry-upload');

    // Click no botão ou zona
    const handleClick = () => input.click();
    button.addEventListener('click', handleClick);
    
    // Mudança no input de arquivo
    input.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileUpload(e.target.files[0], category, zone);
      }
    });

    // Botão de alterar arquivo
    if (changeFileBtn) {
      changeFileBtn.addEventListener('click', handleClick);
    }

    // Botão de tentar novamente
    if (retryBtn) {
      retryBtn.addEventListener('click', handleClick);
    }

    // Drag and drop
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('border-blue-400', 'bg-blue-50');
    });

    zone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      zone.classList.remove('border-blue-400', 'bg-blue-50');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('border-blue-400', 'bg-blue-50');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileUpload(files[0], category, zone);
      }
    });
  }

  // Função para consolidar itens duplicados
  consolidateItems(items) {
    const consolidated = new Map();
    
    items.forEach(item => {
      // Criar chave única baseada em código e descrição normalizada
      const key = this.createItemKey(item);
      
      if (consolidated.has(key)) {
        // Item já existe, somar a quantidade
        const existingItem = consolidated.get(key);
        existingItem.quantidade += item.quantidade;
        
        // Manter informações adicionais do item mais recente se existirem
        if (item.altura && !existingItem.altura) existingItem.altura = item.altura;
        if (item.largura && !existingItem.largura) existingItem.largura = item.largura;
        if (item.cor && !existingItem.cor) existingItem.cor = item.cor;
        if (item.medida && !existingItem.medida) existingItem.medida = item.medida;
        if (item.observacoes && !existingItem.observacoes) existingItem.observacoes = item.observacoes;
        if (item.preco) existingItem.preco = item.preco; // Usar preço mais recente
        if (item.fornecedor && !existingItem.fornecedor) existingItem.fornecedor = item.fornecedor;
        
        // Marcar como consolidado
        existingItem.wasConsolidated = true;
        existingItem.consolidatedCount = (existingItem.consolidatedCount || 1) + 1;
      } else {
        // Item novo, adicionar ao mapa
        const newItem = { ...item };
        newItem.consolidatedCount = 1;
        consolidated.set(key, newItem);
      }
    });
    
    return Array.from(consolidated.values());
  }

  // Criar chave única para um item
  createItemKey(item) {
    // Normalizar código e descrição para comparação
    const codigo = (item.codigo || '').toString().trim().toLowerCase();
    const descricao = (item.descricao || '').toString().trim().toLowerCase();
    
    // Remover caracteres especiais e espaços extras para uma comparação mais robusta
    const codigoNorm = codigo.replace(/[^a-z0-9]/g, '');
    const descricaoNorm = descricao.replace(/[^a-z0-9]/g, '');
    
    return `${codigoNorm}|${descricaoNorm}`;
  }

  // Processar upload de arquivo
  async handleFileUpload(file, category, zone) {
    const fileProcessor = new FileProcessor();
    
    // Validar tipo de arquivo
    if (!fileProcessor.validateFileType(file)) {
      this.showUploadError(zone, 'Tipo de arquivo não suportado. Use CSV, XLS ou XLSX.');
      return;
    }

    // Mostrar loading
    this.showUploadLoading(zone);

    try {
      // Processar arquivo
      const result = await fileProcessor.processFile(file, category);
      
      if (result.success) {
        // Verificar se há dados existentes para esta categoria
        const existingItems = this.allItems.filter(item => item.listaMaterial === category);
        const hasExistingData = existingItems.length > 0;
        
        // Marcar novos itens como modificados
        result.items.forEach(item => {
          item.isModified = true;
          item.isNewItem = true;
        });
        
        if (hasExistingData) {
          // Consolidar automaticamente
          const otherItems = this.allItems.filter(item => item.listaMaterial !== category);
          const allCategoryItems = [...existingItems, ...result.items];
          const consolidatedItems = this.consolidateItems(allCategoryItems);
          
          this.allItems = [...otherItems, ...consolidatedItems];
          
          // Atualizar resultado para mostrar consolidação
          const originalCount = allCategoryItems.length;
          const finalCount = consolidatedItems.length;
          const consolidatedCount = originalCount - finalCount;
          
          result.totalItemsAfterMerge = finalCount;
          result.consolidatedItems = consolidatedCount;
          
          if (consolidatedCount > 0) {
            result.consolidationMessage = `${consolidatedCount} itens duplicados foram consolidados`;
          }
        } else {
          // Primeira vez carregando esta categoria
          this.allItems = this.allItems.filter(item => item.listaMaterial !== category);
          this.allItems.push(...result.items);
        }
        
        // Armazenar dados
        this.loadedFiles.set(category, result);
        
        // Mostrar sucesso
        this.showUploadSuccess(zone, result, hasExistingData ? 'consolidate' : 'replace');
        
        // Atualizar pré-visualização
        this.updatePreview();
        
      } else {
        this.showUploadError(zone, result.error);
      }
      
    } catch (error) {
      this.showUploadError(zone, error.error || 'Erro ao processar arquivo');
    }
  }

  // Mostrar estado de loading
  showUploadLoading(zone) {
    const content = zone.querySelector('.upload-content');
    const success = zone.querySelector('.upload-success');
    const error = zone.querySelector('.upload-error');
    
    content.classList.add('hidden');
    success.classList.add('hidden');
    error.classList.add('hidden');
    
    // Adicionar spinner
    if (!zone.querySelector('.upload-loading')) {
      const loading = document.createElement('div');
      loading.className = 'upload-loading text-center';
      loading.innerHTML = `
        <div class="animate-spin mx-auto h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <p class="mt-2 text-sm text-gray-600">Processando arquivo...</p>
      `;
      zone.appendChild(loading);
    }
  }

  // Mostrar sucesso no upload
  showUploadSuccess(zone, result, actionChoice = 'replace') {
    const content = zone.querySelector('.upload-content');
    const success = zone.querySelector('.upload-success');
    const error = zone.querySelector('.upload-error');
    const loading = zone.querySelector('.upload-loading');
    
    content.classList.add('hidden');
    error.classList.add('hidden');
    if (loading) loading.remove();
    
    success.classList.remove('hidden');
    
    let message = `${result.fileName} - ${result.processedRows} itens carregados`;
    
    if (actionChoice === 'consolidate' && result.totalItemsAfterMerge) {
      message = `${result.fileName} - ${result.processedRows} itens processados`;
      if (result.consolidatedItems && result.consolidatedItems > 0) {
        message += ` (${result.consolidatedItems} duplicados consolidados)`;
      }
      message += ` - Total: ${result.totalItemsAfterMerge}`;
    } else if (actionChoice === 'add' && result.totalItemsAfterMerge) {
      message = `${result.fileName} - ${result.processedRows} itens adicionados (Total: ${result.totalItemsAfterMerge})`;
    }
    
    const fileInfo = success.querySelector('.file-info');
    fileInfo.textContent = message;
    
    // Adicionar informação de consolidação se existir
    if (result.consolidationMessage) {
      const consolidationInfo = document.createElement('p');
      consolidationInfo.className = 'mt-1 text-xs text-green-600';
      consolidationInfo.textContent = result.consolidationMessage;
      
      // Remover mensagem anterior se existir
      const oldInfo = success.querySelector('.consolidation-info');
      if (oldInfo) oldInfo.remove();
      
      consolidationInfo.className += ' consolidation-info';
      fileInfo.parentNode.insertBefore(consolidationInfo, fileInfo.nextSibling);
    }
  }

  // Mostrar erro no upload
  showUploadError(zone, errorMessage) {
    const content = zone.querySelector('.upload-content');
    const success = zone.querySelector('.upload-success');
    const error = zone.querySelector('.upload-error');
    const loading = zone.querySelector('.upload-loading');
    
    content.classList.add('hidden');
    success.classList.add('hidden');
    if (loading) loading.remove();
    
    error.classList.remove('hidden');
    error.querySelector('.error-message').textContent = errorMessage;
  }

  // Atualizar opções adicionais baseado no tipo de projeto
  updateAdditionalOptions() {
    const tipoProjeto = document.getElementById('tipoProjeto').value;
    const opcoesAdicionais = document.getElementById('opcoesAdicionais');
    
    if (!opcoesAdicionais) return;

    if (tipoProjeto === 'Brise' || tipoProjeto === 'ACM') {
      opcoesAdicionais.classList.remove('hidden');
    } else {
      opcoesAdicionais.classList.add('hidden');
    }
  }

  // Alternar campos de terceirizado
  toggleTerceirizadoFields() {
    const terceirizado = document.getElementById('terceirizado').checked;
    const camposTerceirizado = document.getElementById('camposTerceirizado');
    const materiaisSection = document.getElementById('materiaisSection');
    
    if (terceirizado) {
      camposTerceirizado.classList.remove('hidden');
      materiaisSection.classList.add('hidden');
    } else {
      camposTerceirizado.classList.add('hidden');
      materiaisSection.classList.remove('hidden');
    }
  }

  // Alternar campo modelo da fechadura
  toggleFechaduraModel() {
    const possuiFechadura = document.getElementById('possuiFechadura').checked;
    const modeloFechaduraGroup = document.getElementById('modeloFechaduraGroup');
    
    if (possuiFechadura) {
      modeloFechaduraGroup.classList.remove('hidden');
    } else {
      modeloFechaduraGroup.classList.add('hidden');
    }
  }

  // Atualizar pré-visualização
  updatePreview() {
    const previewContainer = document.getElementById('previewContainer');
    const previewTable = document.getElementById('previewTable');
    const previewEmpty = document.getElementById('previewEmpty');
    
    if (this.allItems.length === 0) {
      previewTable.classList.add('hidden');
      previewEmpty.classList.remove('hidden');
      return;
    }

    previewEmpty.classList.add('hidden');
    previewTable.classList.remove('hidden');
    
    const tbody = previewTable.querySelector('tbody');
    tbody.innerHTML = '';
    
    // Agrupar por categoria
    const groupedItems = this.allItems.reduce((groups, item) => {
      const category = item.listaMaterial;
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
      return groups;
    }, {});

    // Renderizar itens agrupados
    Object.keys(groupedItems).forEach(category => {
      // Cabeçalho da categoria
      const headerRow = document.createElement('tr');
      headerRow.className = 'bg-gray-100';
      headerRow.innerHTML = `
        <td colspan="8" class="px-6 py-3 text-left text-sm font-semibold text-gray-900">
          ${category} (${groupedItems[category].length} itens)
        </td>
      `;
      tbody.appendChild(headerRow);

      // Itens da categoria
      groupedItems[category].forEach(item => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 hover:bg-gray-50';
        
        // Verificar se há erros
        const hasError = !item.codigo || !item.descricao || item.quantidade <= 0;
        if (hasError) {
          row.className += ' bg-red-50 border-red-200';
        }
        
        row.innerHTML = `
          <td class="px-6 py-4 text-sm text-gray-900">${item.codigo || '<span class="text-red-500">Faltando</span>'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.descricao || '<span class="text-red-500">Faltando</span>'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.quantidade || '<span class="text-red-500">0</span>'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.altura || '-'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.largura || '-'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.cor || '-'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.medida || '-'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.observacoes || '-'}</td>
        `;
        
        tbody.appendChild(row);
      });
    });
  }

  // Validar formulário
  validateForm() {
    const errors = [];
    
    // Campos obrigatórios
    const nomeCliente = document.getElementById('nomeCliente').value.trim();
    const numeroPedido = document.getElementById('numeroPedido').value.trim();
    const tipoProjeto = document.getElementById('tipoProjeto').value;
    
    if (!nomeCliente) errors.push('Nome do cliente é obrigatório');
    if (!numeroPedido) errors.push('Número do pedido é obrigatório');
    if (!tipoProjeto) errors.push('Tipo de projeto é obrigatório');
    
    // Se terceirizado, validar campos específicos
    const terceirizado = document.getElementById('terceirizado').checked;
    if (terceirizado) {
      const nomeFornecedor = document.getElementById('nomeFornecedor').value.trim();
      const prazoEntrega = document.getElementById('prazoEntrega').value.trim();
      
      if (!nomeFornecedor) errors.push('Nome do fornecedor é obrigatório');
      if (!prazoEntrega) errors.push('Prazo de entrega é obrigatório');
    } else {
      // Se não terceirizado, deve ter pelo menos uma lista carregada
      if (this.allItems.length === 0) {
        errors.push('Pelo menos uma lista de materiais deve ser carregada');
      }
    }
    
    // Validar se há fechadura sem modelo
    const possuiFechadura = document.getElementById('possuiFechadura').checked;
    if (possuiFechadura) {
      const modeloFechadura = document.getElementById('modeloFechadura').value.trim();
      if (!modeloFechadura) errors.push('Modelo da fechadura é obrigatório');
    }
    
    return errors;
  }

  // Coletar dados do formulário
  collectFormData() {
    const terceirizado = document.getElementById('terceirizado').checked;
    const possuiFechadura = document.getElementById('possuiFechadura').checked;
    
    const dados = {
      clienteNome: document.getElementById('nomeCliente').value.trim(),
      numeroPedido: document.getElementById('numeroPedido').value.trim(),
      tipoProjeto: document.getElementById('tipoProjeto').value,
      ehTerceirizado: terceirizado,
      possuiFechadura: possuiFechadura
    };
    
    if (terceirizado) {
      dados.nomeFornecedor = document.getElementById('nomeFornecedor').value.trim();
      dados.prazoEntrega = document.getElementById('prazoEntrega').value.trim();
    }
    
    if (possuiFechadura) {
      dados.modeloFechadura = document.getElementById('modeloFechadura').value.trim();
    }
    
    return dados;
  }

  // Processar salvamento do pedido
  async handleSalvarPedido() {
    try {
      // Validar formulário
      const errors = this.validateForm();
      if (errors.length > 0) {
        this.showNotification('Erro na validação:\n' + errors.join('\n'), 'error');
        return;
      }

      // Mostrar loading
      const salvarBtn = document.getElementById('salvarPedido');
      const originalText = salvarBtn.textContent;
      salvarBtn.disabled = true;
      salvarBtn.textContent = 'Salvando...';

      // Coletar dados
      const dadosPedido = this.collectFormData();
      
      // Salvar pedido e itens no Firebase (agora em uma única chamada)
      // A função salvarPedido foi refatorada para aceitar os itens e usar o Realtime Database
      const pedidoId = await FirebaseService.salvarPedido(dadosPedido, this.allItems);

      // Mostrar sucesso
      this.showNotification('Pedido cadastrado com sucesso!', 'success');
      
      // Limpar formulário
      this.resetForm();
      
    } catch (error) {
      console.error('Erro ao salvar pedido:', error);
      this.showNotification('Erro ao salvar pedido: ' + error.message, 'error');
    } finally {
      // Restaurar botão
      const salvarBtn = document.getElementById('salvarPedido');
      salvarBtn.disabled = false;
      salvarBtn.textContent = 'Salvar Pedido';
    }
  }

  // Mostrar notificação
  showNotification(message, type = 'info') {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 max-w-md p-4 rounded-md shadow-lg z-50 transition-all duration-300 ${
      type === 'success' ? 'bg-green-500 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      type === 'info' ? 'bg-blue-500 text-white' :
      'bg-gray-500 text-white'
    }`;
    
    notification.innerHTML = `
      <div class="flex items-center">
        <div class="flex-1">
          <p class="text-sm font-medium">${message.replace(/\n/g, '<br>')}</p>
        </div>
        <button class="ml-4 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  // Configurar eventos específicos para modal
  setupModalEventListeners() {
    // Mudança no tipo de projeto
    const tipoProjetoSelect = document.getElementById('tipoProjetoModal');
    if (tipoProjetoSelect) {
      tipoProjetoSelect.addEventListener('change', () => {
        this.updateModalMaterialCategories();
        this.updateModalAdditionalOptions();
      });
    }

    // Mudança em serviço terceirizado
    const terceirizadoToggle = document.getElementById('terceirizadoModal');
    if (terceirizadoToggle) {
      terceirizadoToggle.addEventListener('change', () => {
        this.toggleModalTerceirizadoFields();
      });
    }

    // Eventos para campos de fechadura
    const possuiFechadura = document.getElementById('possuiFechaduraModal');
    if (possuiFechadura) {
      possuiFechadura.addEventListener('change', () => {
        this.toggleModalFechaduraModel();
      });
    }
  }

  // Atualizar categorias de materiais do modal
  updateModalMaterialCategories() {
    const tipoProjeto = document.getElementById('tipoProjetoModal').value;
    const materiaisContainer = document.getElementById('materiaisContainerModal');
    
    if (!tipoProjeto || !materiaisContainer) return;

    // Limpar container anterior
    materiaisContainer.innerHTML = '';
    this.loadedFiles.clear();
    this.allItems = [];
    this.updateModalPreview();

    const categories = this.materialCategories[tipoProjeto] || [];
    
    // Adiciona um container que envolve todas as zonas de upload
    const uploadZonesWrapper = document.createElement('div');
    uploadZonesWrapper.className = 'upload-zones-wrapper';
    uploadZonesWrapper.style.display = 'grid';
    uploadZonesWrapper.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    uploadZonesWrapper.style.gap = '1rem';
    uploadZonesWrapper.style.width = '100%';
    uploadZonesWrapper.style.minHeight = '600px'; // Força altura mínima para garantir scroll
    uploadZonesWrapper.style.padding = '1rem';
    
    categories.forEach(category => {
      const uploadZone = this.createModalUploadZone(category);
      uploadZonesWrapper.appendChild(uploadZone);
    });
    
    // Adicionar o botão para criar categoria personalizada (para todos os tipos)
    const customCategoryZone = this.createCustomCategoryZone(true); // true indica que é para o modal
    uploadZonesWrapper.appendChild(customCategoryZone);
    
    // Adiciona um título e o wrapper ao container principal
    const titleElement = document.createElement('h3');
    titleElement.className = 'text-sm font-medium text-gray-900 mb-3';
    titleElement.textContent = 'Listas de Materiais';
    
    materiaisContainer.appendChild(titleElement);
    materiaisContainer.appendChild(uploadZonesWrapper);
    
    // Rolagem automática para as categorias após atualização
    setTimeout(() => {
      const formSection = document.querySelector('.form-section-modal');
      const materiaisSection = document.getElementById('materiaisSectionModal');
      if (formSection && materiaisSection) {
        // Calcula a posição de rolagem para exibir as categorias
        const sectionTop = materiaisSection.offsetTop;
        formSection.scrollTo({
          top: sectionTop - 20, // 20px de margem para melhor visualização
          behavior: 'smooth'
        });
      }
    }, 100); // Pequeno atraso para garantir que o DOM foi atualizado
  }

  // Criar zona de upload para modal
  createModalUploadZone(category) {
    const div = document.createElement('div');
    div.className = 'upload-zone bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-all duration-300 hover:border-blue-400 hover:bg-blue-50 relative';
    div.id = `upload-modal-${category.replace(/\s+/g, '-').toLowerCase()}`;
    
    div.innerHTML = `
      <div class="upload-content">
        <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">Lista de ${category}</h3>
        <p class="mt-1 text-sm text-gray-500">Clique para selecionar arquivo CSV ou XLSX</p>
        <button type="button" class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200">
          Carregar Arquivo
        </button>
        <input type="file" class="hidden" accept=".csv,.xls,.xlsx" data-category="${category}">
      </div>
      <div class="upload-success hidden tooltip-trigger" data-tooltip="">
        <svg class="mx-auto h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="mt-1 text-sm font-medium text-green-900">Arquivo Carregado</h3>
        <p class="text-xs text-green-700 file-info max-w-[90%] truncate"></p>
        <button type="button" class="mt-1 text-xs text-blue-600 hover:text-blue-800 change-file">Alterar arquivo</button>
      </div>
      <div class="upload-error hidden">
        <svg class="mx-auto h-10 w-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="mt-1 text-sm font-medium text-red-900">Erro no Arquivo</h3>
        <p class="text-xs text-red-700 error-message max-w-[90%] truncate"></p>
        <button type="button" class="mt-1 text-xs text-blue-600 hover:text-blue-800 retry-upload">Tentar novamente</button>
      </div>
    `;

    // Eventos para esta zona de upload modal
    this.setupModalUploadZoneEvents(div, category);
    
    return div;
  }

  // Configurar eventos para zona de upload do modal
  setupModalUploadZoneEvents(zone, category) {
    const button = zone.querySelector('button');
    const input = zone.querySelector('input[type="file"]');
    const changeFileBtn = zone.querySelector('.change-file');
    const retryBtn = zone.querySelector('.retry-upload');

    // Click no botão ou zona
    const handleClick = () => input.click();
    button.addEventListener('click', handleClick);
    
    // Mudança no input de arquivo
    input.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileUpload(e.target.files[0], category, zone, true); // true para modal
      }
    });

    // Botão de alterar arquivo
    if (changeFileBtn) {
      changeFileBtn.addEventListener('click', handleClick);
    }

    // Botão de tentar novamente
    if (retryBtn) {
      retryBtn.addEventListener('click', handleClick);
    }

    // Drag and drop
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('border-blue-400', 'bg-blue-50');
    });

    zone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      zone.classList.remove('border-blue-400', 'bg-blue-50');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('border-blue-400', 'bg-blue-50');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFileUpload(files[0], category, zone, true); // true para modal
      }
    });
  }

  // Atualizar opções adicionais do modal
  updateModalAdditionalOptions() {
    const tipoProjeto = document.getElementById('tipoProjetoModal').value;
    const opcoesAdicionais = document.getElementById('opcoesAdicionaisModal');
    
    if (!opcoesAdicionais) return;

    if (tipoProjeto === 'Brise' || tipoProjeto === 'ACM') {
      opcoesAdicionais.classList.remove('hidden');
    } else {
      opcoesAdicionais.classList.add('hidden');
    }
  }

  // Alternar campos de terceirizado do modal
  toggleModalTerceirizadoFields() {
    const terceirizado = document.getElementById('terceirizadoModal').checked;
    const camposTerceirizado = document.getElementById('camposTerceirizadoModal');
    const materiaisSection = document.getElementById('materiaisSectionModal');
    
    if (terceirizado) {
      camposTerceirizado.classList.remove('hidden');
      materiaisSection.classList.add('hidden');
    } else {
      camposTerceirizado.classList.add('hidden');
      materiaisSection.classList.remove('hidden');
    }
  }

  // Alternar campo modelo da fechadura do modal
  toggleModalFechaduraModel() {
    const possuiFechadura = document.getElementById('possuiFechaduraModal').checked;
    const modeloFechaduraGroup = document.getElementById('modeloFechaduraGroupModal');
    
    if (possuiFechadura) {
      modeloFechaduraGroup.classList.remove('hidden');
    } else {
      modeloFechaduraGroup.classList.add('hidden');
    }
  }

  // Atualizar pré-visualização do modal
  updateModalPreview() {
    const previewTable = document.getElementById('previewTableModal');
    const previewEmpty = document.getElementById('previewEmptyModal');
    
    if (this.allItems.length === 0) {
      previewTable.classList.add('hidden');
      previewEmpty.classList.remove('hidden');
      return;
    }

    previewEmpty.classList.add('hidden');
    previewTable.classList.remove('hidden');
    
    const tbody = document.getElementById('previewTableBodyModal');
    tbody.innerHTML = '';
    
    // Agrupar por categoria
    const groupedItems = this.allItems.reduce((groups, item) => {
      const category = item.listaMaterial;
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
      return groups;
    }, {});

    // Renderizar itens agrupados
    Object.keys(groupedItems).forEach(category => {
      // Cabeçalho da categoria
      const headerRow = document.createElement('tr');
      headerRow.className = 'bg-gray-100';
      headerRow.innerHTML = `
        <td colspan="9" class="px-6 py-3 text-left text-sm font-semibold text-gray-900">
          ${category} (${groupedItems[category].length} itens)
        </td>
      `;
      tbody.appendChild(headerRow);

      // Itens da categoria
      groupedItems[category].forEach((item, itemIndex) => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 hover:bg-gray-50';
        
        // Verificar se há erros
        const hasError = !item.codigo || !item.descricao || item.quantidade <= 0;
        if (hasError) {
          row.className += ' bg-red-50 border-red-200';
        }
        
        row.innerHTML = `
          <td class="px-6 py-4 text-sm text-gray-900">${item.codigo || '<span class="text-red-500">Faltando</span>'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.descricao || '<span class="text-red-500">Faltando</span>'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.quantidade || '<span class="text-red-500">0</span>'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.altura || '-'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.largura || '-'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.cor || '-'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.medida || '-'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">${item.observacoes || '-'}</td>
          <td class="px-6 py-4 text-sm text-gray-900">
            <button 
              onclick="window.dashboardManager?.modalUIManager?.deleteItem?.('${item.id || ''}', '${category}', ${itemIndex})" 
              class="text-red-600 hover:text-red-800 transition-colors duration-200"
              title="Remover item"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </td>
        `;
        
        tbody.appendChild(row);
      });
    });

    // Atualizar contador
    const counter = document.getElementById('itemsCounterModal');
    if (counter) {
      counter.textContent = `${this.allItems.length} itens`;
    }
  }

  // Processar upload de arquivo (adaptado para modal)
  async handleFileUpload(file, category, zone, isModal = false) {
    const fileProcessor = new FileProcessor();
    
    // Validar tipo de arquivo
    if (!fileProcessor.validateFileType(file)) {
      this.showUploadError(zone, 'Tipo de arquivo não suportado. Use CSV, XLS ou XLSX.');
      return;
    }

    // Mostrar loading
    this.showUploadLoading(zone);

    try {
      // Processar arquivo
      const result = await fileProcessor.processFile(file, category);
      
      if (result.success) {
        // Verificar se há dados existentes para esta categoria
        const existingItems = this.allItems.filter(item => item.listaMaterial === category);
        const hasExistingData = existingItems.length > 0;
        
        // 🔧 REGRA SIMPLES: Se não tem dados existentes, só adicionar. Se tem, perguntar ao usuário.
        let actionChoice = hasExistingData ? 'consolidate' : 'add'; // padrão: consolidar se existe, adicionar se não existe
        
        if (hasExistingData && isModal) {
          // Oferecer opções claras ao usuário quando há dados existentes
          const choice = confirm(
            `Já existem ${existingItems.length} itens na lista "${category}".\n\n` +
            `Clique "OK" para ADICIONAR/CONSOLIDAR: manter itens existentes + adicionar novos.\n` +
            `Clique "Cancelar" para SUBSTITUIR: remover todos os existentes e usar apenas os novos.`
          );
          actionChoice = choice ? 'consolidate' : 'replace';
        }
        
        // 🔧 CORREÇÃO: Marcar itens carregados de arquivo como GENUINAMENTE NOVOS
        result.items.forEach(item => {
          item.isModified = true;
          item.isNewItem = true;
          item.isExistingData = false; // CRUCIAL: Marcar como NÃO sendo dado existente
          item.fromUserUpload = true; // Marcar que veio de upload do usuário
          // Garantir que não tem ID (é novo)
          delete item.id;
          console.log(`📁 Item de arquivo marcado como NOVO: ${item.codigo} - ${item.descricao}`);
        });
        
        if (actionChoice === 'consolidate') {
          // 🔧 CONSOLIDAR: Manter existentes + adicionar novos (sem excluir nada do banco)
          const otherItems = this.allItems.filter(item => item.listaMaterial !== category);
          
          // Manter existentes como visualização (não salvar novamente)
          existingItems.forEach(item => {
            item.isExistingData = true; // CRUCIAL: manter como existente (não salvar)
            item.isNewItem = false;
            console.log(`👁️ Item existente PRESERVADO: ${item.codigo}`);
          });
          
          // Consolidar itens duplicados
          const consolidatedItems = this.consolidateItems([...existingItems, ...result.items]);
          
          // Atualizar lista completa
          this.allItems = [...otherItems, ...consolidatedItems];
          
          console.log(`🔄 Lista ${category} CONSOLIDADA - existentes preservados, novos adicionados`);
          
        } else {
          // 🔧 SUBSTITUIR: Só neste caso remove existentes e adiciona novos
          this.allItems = this.allItems.filter(item => item.listaMaterial !== category);
          this.allItems.push(...result.items);
          
          // Marcar que esta lista foi explicitamente substituída
          result.items.forEach(item => {
            item.isReplacingExisting = true; // Para indicar que substitui lista existente
          });
          
          console.log(`🔄 Lista ${category} SUBSTITUÍDA explicitamente pelo usuário`);
        }
        
        // Armazenar dados
        this.loadedFiles.set(category, result);
        
        // Mostrar sucesso com tooltip
        this.showUploadSuccess(zone, result, actionChoice, category);
        
        // Atualizar pré-visualização
        if (isModal) {
          this.updateModalPreview();
        } else {
          this.updatePreview();
        }
        
      } else {
        this.showUploadError(zone, result.error);
      }
      
    } catch (error) {
      this.showUploadError(zone, error.error || 'Erro ao processar arquivo');
    }
  }

  // Resetar formulário
  resetForm() {
    // Limpar campos de texto
    document.getElementById('nomeCliente').value = '';
    document.getElementById('numeroPedido').value = '';
    document.getElementById('tipoProjeto').selectedIndex = 0;
    document.getElementById('terceirizado').checked = false;
    document.getElementById('nomeFornecedor').value = '';
    document.getElementById('prazoEntrega').value = '';
    document.getElementById('possuiFechadura').checked = false;
    document.getElementById('modeloFechadura').value = '';
    
    // Limpar dados carregados
    this.loadedFiles.clear();
    this.allItems = [];
    
    // Atualizar interface
    this.updateMaterialCategories();
    this.updateAdditionalOptions();
    this.toggleTerceirizadoFields();
    this.toggleFechaduraModel();
    this.updatePreview();
  }

  // 🔧 NOVA FUNÇÃO: Consolidar itens duplicados
  consolidateItems(items) {
    const consolidatedMap = new Map();
    
    items.forEach(item => {
      // Criar chave única baseada em código e descrição (normalizada)
      const key = `${item.codigo || ''}_${(item.descricao || '').toLowerCase().trim()}`.replace(/\s+/g, '_');
      
      if (consolidatedMap.has(key)) {
        // Item já existe, somar quantidades e preservar outros dados
        const existingItem = consolidatedMap.get(key);
        existingItem.quantidade = (existingItem.quantidade || 0) + (item.quantidade || 0);
        
        // 🔧 IMPORTANTE: Preservar flags de dados existentes vs novos
        // Se qualquer item na consolidação é novo, o resultado deve ser marcado como modificado
        if (item.fromUserUpload === true || !item.isExistingData) {
          existingItem.isNewItem = true;
          existingItem.isExistingData = false;
          existingItem.fromUserUpload = true;
          console.log(`🔄 Consolidação resultou em item NOVO (tem dados do usuário): ${item.codigo}`);
        }
        
        // Preservar dados adicionais se não existirem no item consolidado
        ['altura', 'largura', 'cor', 'medida', 'preco', 'fornecedor', 'observacoes'].forEach(field => {
          if (!existingItem[field] && item[field]) {
            existingItem[field] = item[field];
          }
        });
        
        // Marcar que houve consolidação
        existingItem.isConsolidated = true;
        existingItem.consolidatedCount = (existingItem.consolidatedCount || 1) + 1;
        
        console.log(`🔄 Consolidando item: ${item.codigo} - ${item.descricao} (quantidade: ${item.quantidade})`);
      } else {
        // Primeiro item com essa chave
        const newItem = { ...item };
        newItem.consolidatedCount = 1;
        consolidatedMap.set(key, newItem);
      }
    });
    
    const consolidatedItems = Array.from(consolidatedMap.values());
    
    console.log(`📊 Consolidação concluída: ${items.length} itens originais → ${consolidatedItems.length} itens finais`);
    
    return consolidatedItems;
  }

  // 🔧 NOVA FUNÇÃO: Mostrar sucesso do upload com tooltip
  showUploadSuccess(zone, result, actionChoice, category) {
    const content = zone.querySelector('.upload-content');
    const success = zone.querySelector('.upload-success');
    const error = zone.querySelector('.upload-error');
    
    // Esconder outros estados
    content.classList.add('hidden');
    error.classList.add('hidden');
    success.classList.remove('hidden');
    
    // Atualizar informações do arquivo
    const fileInfo = success.querySelector('.file-info');
    if (fileInfo) {
      let infoText = `${result.fileName} - ${result.processedRows} itens`;
      if (result.consolidatedItems > 0) {
        infoText += ` (${result.consolidatedItems} consolidados)`;
      }
      fileInfo.textContent = infoText;
    }
    
    // 🔧 CALCULAR E CONFIGURAR TOOLTIP
    const items = this.allItems.filter(item => item.listaMaterial === category);
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantidade || 0), 0);
    
    const tooltipText = `${totalItems} itens\nQuantidade total: ${totalQuantity}`;
    success.setAttribute('data-tooltip', tooltipText);
    
    // Configurar eventos do tooltip
    this.setupTooltipEvents(success);
    
    console.log(`✅ Upload de ${category} concluído: ${totalItems} itens, quantidade total: ${totalQuantity}`);
    
    // IMPORTANTE: Garantir que a área ainda está rolável após o upload
    this.ensureScrollabilityAfterUpload();
  }
  
  // NOVA FUNÇÃO: Garante que a área de rolagem continua funcional após uploads
  ensureScrollabilityAfterUpload() {
    // Atraso pequeno para garantir que o DOM foi atualizado
    setTimeout(() => {
      const formSection = document.querySelector('.form-section-modal');
      if (formSection) {
        // Força uma atualização do scroll aplicando uma pequena rolagem
        const currentScroll = formSection.scrollTop;
        formSection.scrollTop = currentScroll + 1;
        
        // Verifica se todas as categorias estão visíveis
        const uploadZones = formSection.querySelectorAll('.upload-zone');
        if (uploadZones.length > 0) {
          const lastZone = uploadZones[uploadZones.length - 1];
          const lastZoneRect = lastZone.getBoundingClientRect();
          const formSectionRect = formSection.getBoundingClientRect();
          
          // Se o último elemento estiver fora da visualização, rolamos para ele
          if (lastZoneRect.bottom > formSectionRect.bottom) {
            lastZone.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        }
      }
    }, 300);
  }

  // 🔧 NOVA FUNÇÃO: Configurar eventos do tooltip
  setupTooltipEvents(element) {
    const tooltip = document.getElementById('material-tooltip');
    
    element.addEventListener('mouseenter', (e) => {
      const tooltipText = element.getAttribute('data-tooltip');
      if (tooltipText) {
        tooltip.innerHTML = tooltipText.replace(/\n/g, '<br>');
        tooltip.style.opacity = '1';
        this.positionTooltip(tooltip, e.target);
      }
    });
    
    element.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
    
    element.addEventListener('mousemove', (e) => {
      this.positionTooltip(tooltip, e.target);
    });
  }

  // 🔧 NOVA FUNÇÃO: Posicionar tooltip
  positionTooltip(tooltip, target) {
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Posicionar acima do elemento
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.top - tooltipRect.height - 8) + 'px';
  }
}

// Exportar para uso global
window.UIManager = UIManager;