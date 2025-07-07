// Manipulador de formulários e validações
class FormHandler {
  constructor() {
    this.validators = {
      required: (value) => value && value.trim() !== '',
      email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      phone: (value) => /^[\d\s\-\(\)]+$/.test(value),
      number: (value) => !isNaN(parseFloat(value)) && isFinite(value),
      positiveNumber: (value) => this.validators.number(value) && parseFloat(value) > 0,
      date: (value) => !isNaN(Date.parse(value))
    };
  }

  // Validar campo individual
  validateField(fieldId, rules) {
    const field = document.getElementById(fieldId);
    if (!field) return { valid: true };

    const value = field.value.trim();
    const errors = [];

    rules.forEach(rule => {
      if (typeof rule === 'string') {
        // Regra simples
        if (!this.validators[rule](value)) {
          errors.push(this.getErrorMessage(rule, fieldId));
        }
      } else if (typeof rule === 'object') {
        // Regra com parâmetros
        const { type, condition, message } = rule;
        if (type && !this.validators[type](value)) {
          errors.push(message || this.getErrorMessage(type, fieldId));
        } else if (condition && !condition(value)) {
          errors.push(message || 'Valor inválido');
        }
      }
    });

    const isValid = errors.length === 0;
    this.updateFieldValidation(field, isValid, errors);

    return {
      valid: isValid,
      errors: errors,
      value: value
    };
  }

  // Obter mensagem de erro padrão
  getErrorMessage(ruleType, fieldId) {
    const fieldName = this.getFieldDisplayName(fieldId);
    
    const messages = {
      required: `${fieldName} é obrigatório`,
      email: `${fieldName} deve ser um email válido`,
      phone: `${fieldName} deve ser um telefone válido`,
      number: `${fieldName} deve ser um número válido`,
      positiveNumber: `${fieldName} deve ser um número positivo`,
      date: `${fieldName} deve ser uma data válida`
    };

    return messages[ruleType] || `${fieldName} é inválido`;
  }

  // Obter nome de exibição do campo
  getFieldDisplayName(fieldId) {
    const displayNames = {
      nomeCliente: 'Nome do Cliente',
      numeroPedido: 'Número do Pedido',
      tipoProjeto: 'Tipo de Projeto',
      nomeFornecedor: 'Nome do Fornecedor',
      prazoEntrega: 'Prazo de Entrega',
      modeloFechadura: 'Modelo da Fechadura'
    };

    return displayNames[fieldId] || fieldId;
  }

  // Atualizar visual da validação do campo
  updateFieldValidation(field, isValid, errors = []) {
    const formGroup = field.closest('.form-group') || field.parentElement;
    
    // Remover classes anteriores
    field.classList.remove('border-red-500', 'border-green-500');
    formGroup.querySelectorAll('.field-error').forEach(error => error.remove());

    if (isValid) {
      field.classList.add('border-green-500');
    } else {
      field.classList.add('border-red-500');
      
      // Adicionar mensagens de erro
      errors.forEach(error => {
        const errorElement = document.createElement('p');
        errorElement.className = 'field-error text-red-500 text-xs mt-1';
        errorElement.textContent = error;
        formGroup.appendChild(errorElement);
      });
    }
  }

  // Validar formulário completo
  validateForm(formRules) {
    const results = {};
    let isFormValid = true;

    Object.keys(formRules).forEach(fieldId => {
      const result = this.validateField(fieldId, formRules[fieldId]);
      results[fieldId] = result;
      
      if (!result.valid) {
        isFormValid = false;
      }
    });

    return {
      valid: isFormValid,
      fields: results
    };
  }

  // Configurar validação em tempo real
  setupRealTimeValidation(formRules) {
    Object.keys(formRules).forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (!field) return;

      // Validar ao sair do campo
      field.addEventListener('blur', () => {
        this.validateField(fieldId, formRules[fieldId]);
      });

      // Limpar erros ao digitar
      field.addEventListener('input', () => {
        if (field.classList.contains('border-red-500')) {
          field.classList.remove('border-red-500');
          const formGroup = field.closest('.form-group') || field.parentElement;
          formGroup.querySelectorAll('.field-error').forEach(error => error.remove());
        }
      });
    });
  }

  // Máscara para campos
  applyMask(fieldId, maskType) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    const masks = {
      phone: (value) => {
        return value
          .replace(/\D/g, '')
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4,5})(\d{4})/, '$1-$2')
          .replace(/(-\d{4})\d+?$/, '$1');
      },
      date: (value) => {
        return value
          .replace(/\D/g, '')
          .replace(/(\d{2})(\d)/, '$1/$2')
          .replace(/(\d{2})(\d)/, '$1/$2')
          .replace(/(\d{4})\d+?$/, '$1');
      },
      number: (value) => {
        return value.replace(/[^\d.,]/g, '');
      }
    };

    if (masks[maskType]) {
      field.addEventListener('input', (e) => {
        e.target.value = masks[maskType](e.target.value);
      });
    }
  }

  // Auto-completar com dados salvos
  setupAutoComplete(fieldId, storageKey) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    // Carregar dados salvos
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
      try {
        const options = JSON.parse(savedData);
        this.createDatalist(field, options);
      } catch (e) {
        console.error('Erro ao carregar dados do localStorage:', e);
      }
    }

    // Salvar novos valores
    field.addEventListener('blur', () => {
      const value = field.value.trim();
      if (value) {
        this.saveToAutoComplete(storageKey, value);
      }
    });
  }

  // Criar datalist para auto-completar
  createDatalist(field, options) {
    let datalist = document.getElementById(field.id + '-datalist');
    
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = field.id + '-datalist';
      field.setAttribute('list', datalist.id);
      field.parentElement.appendChild(datalist);
    }

    datalist.innerHTML = '';
    options.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option;
      datalist.appendChild(optionElement);
    });
  }

  // Salvar valor no auto-completar
  saveToAutoComplete(storageKey, value) {
    try {
      let saved = localStorage.getItem(storageKey);
      let options = saved ? JSON.parse(saved) : [];
      
      // Adicionar novo valor se não existir
      if (!options.includes(value)) {
        options.unshift(value);
        
        // Manter apenas os últimos 10 valores
        options = options.slice(0, 10);
        
        localStorage.setItem(storageKey, JSON.stringify(options));
      }
    } catch (e) {
      console.error('Erro ao salvar no localStorage:', e);
    }
  }

  // Limpar validações visuais
  clearValidations(formSelector = 'form') {
    const form = document.querySelector(formSelector);
    if (!form) return;

    // Remover classes de validação
    form.querySelectorAll('input, select, textarea').forEach(field => {
      field.classList.remove('border-red-500', 'border-green-500');
    });

    // Remover mensagens de erro
    form.querySelectorAll('.field-error').forEach(error => error.remove());
  }

  // Desabilitar/habilitar formulário
  toggleFormDisabled(disabled = true, formSelector = 'form') {
    const form = document.querySelector(formSelector);
    if (!form) return;

    const elements = form.querySelectorAll('input, select, textarea, button');
    elements.forEach(element => {
      element.disabled = disabled;
    });
  }

  // Serializar dados do formulário
  serializeForm(formSelector = 'form') {
    const form = document.querySelector(formSelector);
    if (!form) return {};

    const formData = new FormData(form);
    const data = {};

    for (let [key, value] of formData.entries()) {
      // Suporte para múltiplos valores (checkboxes, etc.)
      if (data[key]) {
        if (Array.isArray(data[key])) {
          data[key].push(value);
        } else {
          data[key] = [data[key], value];
        }
      } else {
        data[key] = value;
      }
    }

    return data;
  }

  // Preencher formulário com dados
  populateForm(data, formSelector = 'form') {
    const form = document.querySelector(formSelector);
    if (!form) return;

    Object.keys(data).forEach(key => {
      const field = form.querySelector(`[name="${key}"], #${key}`);
      if (field) {
        if (field.type === 'checkbox' || field.type === 'radio') {
          field.checked = data[key];
        } else {
          field.value = data[key];
        }
      }
    });
  }
}

// Exportar para uso global
window.FormHandler = FormHandler;