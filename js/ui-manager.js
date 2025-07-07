// Gerenciador de Interface do Usuário
class UIManager {
  constructor() {
    this.materialCategories = {
      'PVC': ['Perfil', 'Reforço', 'Aço', 'Ferragens', 'Vidros', 'Vedação'],
      'Alumínio': ['Perfil', 'Acessórios', 'Ferragens', 'Vidros', 'Vedação'],
      'Brise': ['Perfil', 'Lâminas', 'Ferragens', 'Acessórios'],
      'ACM': ['Placas ACM', 'Perfis', 'Fixação', 'Acessórios'],
      'Outros': ['Materiais Diversos']
    };
    
    this.loadedFiles = new Map(); // Armazenar arquivos carregados
    this.allItems = []; // Todos os itens processados
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

    const categories = this.materialCategories[tipoProjeto] || [];
    
    categories.forEach(category => {
      const uploadZone = this.createUploadZone(category);
      materiaisContainer.appendChild(uploadZone);
    });
  }

  // Criar zona de upload para uma categoria
  createUploadZone(category) {
    const div = document.createElement('div');
    div.className = 'upload-zone bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-all duration-300 hover:border-blue-400 hover:bg-blue-50';
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
        <svg class="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="mt-2 text-sm font-medium text-green-900">Arquivo Carregado</h3>
        <p class="mt-1 text-sm text-green-700 file-info"></p>
        <button type="button" class="mt-2 text-sm text-blue-600 hover:text-blue-800 change-file">Alterar arquivo</button>
      </div>
      <div class="upload-error hidden">
        <svg class="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="mt-2 text-sm font-medium text-red-900">Erro no Arquivo</h3>
        <p class="mt-1 text-sm text-red-700 error-message"></p>
        <button type="button" class="mt-2 text-sm text-blue-600 hover:text-blue-800 retry-upload">Tentar novamente</button>
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
        // Armazenar dados
        this.loadedFiles.set(category, result);
        
        // Adicionar itens à lista geral
        this.allItems = this.allItems.filter(item => item.listaMaterial !== category);
        this.allItems.push(...result.items);
        
        // Mostrar sucesso
        this.showUploadSuccess(zone, result);
        
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
    
    if (actionChoice === 'add' && result.totalItemsAfterMerge) {
      message = `${result.fileName} - ${result.processedRows} itens adicionados (Total: ${result.totalItemsAfterMerge})`;
    }
    
    success.querySelector('.file-info').textContent = message;
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
      
      // Salvar pedido no Firebase
      const pedidoId = await FirebaseService.salvarPedido(dadosPedido);
      
      // Salvar itens se não for terceirizado
      if (!dadosPedido.ehTerceirizado && this.allItems.length > 0) {
        await FirebaseService.salvarItens(pedidoId, this.allItems);
      }

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
      'bg-blue-500 text-white'
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
    
    categories.forEach(category => {
      const uploadZone = this.createModalUploadZone(category);
      materiaisContainer.appendChild(uploadZone);
    });
  }

  // Criar zona de upload para modal
  createModalUploadZone(category) {
    const div = document.createElement('div');
    div.className = 'upload-zone bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-all duration-300 hover:border-blue-400 hover:bg-blue-50';
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
        <svg class="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="mt-2 text-sm font-medium text-green-900">Arquivo Carregado</h3>
        <p class="mt-1 text-sm text-green-700 file-info"></p>
        <button type="button" class="mt-2 text-sm text-blue-600 hover:text-blue-800 change-file">Alterar arquivo</button>
      </div>
      <div class="upload-error hidden">
        <svg class="mx-auto h-12 w-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="mt-2 text-sm font-medium text-red-900">Erro no Arquivo</h3>
        <p class="mt-1 text-sm text-red-700 error-message"></p>
        <button type="button" class="mt-2 text-sm text-blue-600 hover:text-blue-800 retry-upload">Tentar novamente</button>
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
        
        let actionChoice = 'replace'; // padrão
        
        if (hasExistingData && isModal) {
          // Perguntar ao usuário o que fazer com os dados existentes
          const choice = confirm(
            `Já existem ${existingItems.length} itens na lista "${category}".\n\n` +
            `Clique "OK" para ADICIONAR os novos itens à lista existente.\n` +
            `Clique "Cancelar" para SUBSTITUIR completamente a lista.`
          );
          actionChoice = choice ? 'add' : 'replace';
        }
        
        // Marcar novos itens como modificados (para o sistema de edição)
        result.items.forEach(item => {
          item.isModified = true;
          item.isNewItem = true;
        });
        
        if (actionChoice === 'add') {
          // Adicionar aos itens existentes
          this.allItems.push(...result.items);
          
          // Atualizar o resultado para refletir o total
          const totalItems = this.allItems.filter(item => item.listaMaterial === category);
          result.totalItemsAfterMerge = totalItems.length;
        } else {
          // Substituir completamente
          this.allItems = this.allItems.filter(item => item.listaMaterial !== category);
          this.allItems.push(...result.items);
        }
        
        // Armazenar dados
        this.loadedFiles.set(category, result);
        
        // Mostrar sucesso
        this.showUploadSuccess(zone, result, actionChoice);
        
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
}

// Exportar para uso global
window.UIManager = UIManager;