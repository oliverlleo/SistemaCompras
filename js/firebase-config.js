import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyC2Zi40wsyBoTeXb2syXvrogTb56lAVjk0",
    authDomain: "pcp-2e388.firebaseapp.com",
    databaseURL: "https://pcp-2e388-default-rtdb.firebaseio.com",
    projectId: "pcp-2e388",
    storageBucket: "pcp-2e388.firebasestorage.app",
    messagingSenderId: "725540904176",
    appId: "1:725540904176:web:5b60009763c36bb12d7635"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);