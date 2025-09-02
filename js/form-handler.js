import { database } from './firebase-config.js';
import { ref, push, set } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// ... (o resto do seu código de file-processor, se houver, continua aqui) ...

// Função para salvar dados com a nova estrutura e SDK
function saveDataToFirebase(clienteNome, tipoProjeto, formData, allItems) {
    if (!clienteNome || !tipoProjeto) {
        console.error("Nome do cliente ou tipo de projeto não pode estar vazio.");
        alert("Erro: O nome do cliente e o tipo de projeto são obrigatórios.");
        return;
    }

    // A referência agora começa DIRETAMENTE com o nome do cliente
    const projectRef = ref(database, `${clienteNome}/${tipoProjeto}`);

    const dadosDoPedido = {
        dataPedido: formData.data,
        observacoes: formData.observacoes,
        itens: allItems,
        status: "Novo"
    };

    const novoPedidoRef = push(projectRef); // Cria um novo nó com ID único na referência

    set(novoPedidoRef, dadosDoPedido)
        .then(() => {
            console.log("Dados salvos com sucesso na estrutura correta!");
            alert("Pedido enviado com sucesso!");
            document.getElementById('uploadForm').reset();
            document.getElementById('output').innerHTML = '';
            document.getElementById('fileInput').value = '';
        })
        .catch((error) => {
            console.error("Erro ao salvar dados: ", error);
            alert("Ocorreu um erro ao enviar o pedido.");
        });
}

// A lógica do handleFormSubmission que chama saveDataToFirebase permanece a mesma
// ...