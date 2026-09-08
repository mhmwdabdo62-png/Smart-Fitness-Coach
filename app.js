import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// إعدادات Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAlKAsDcsEQwWpYe6vxMltFg8qhsgvvwBM",
  authDomain: "smart-fitness-coach-44f1e.firebaseapp.com",
  databaseURL: "https://smart-fitness-coach-44f1e-default-rtdb.firebaseio.com",
  projectId: "smart-fitness-coach-44f1e",
  storageBucket: "smart-fitness-coach-44f1e.firebasestorage.app",
  messagingSenderId: "1045195098266",
  appId: "1:1045195098266:web:7591eb12fcce8fe61f3723"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

// عناصر الواجهة
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const userNameDisplay = document.getElementById('user-name');
const saveDataBtn = document.getElementById('save-data-btn');
const dietResult = document.getElementById('diet-result');
const aiInput = document.getElementById('ai-input');
const aiSendBtn = document.getElementById('ai-send-btn');
const aiChatBox = document.getElementById('ai-chat-box');

// مفتاح Gemini
const GEMINI_API_KEY = "AQ.Ab8RN6I2UAg4Dntub48zXzJwXE5nluqLvp2_7JbtlF57U2AwGw";

// دوال الدخول والخروج
loginBtn.addEventListener('click', () => signInWithPopup(auth, provider));
logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        userNameDisplay.innerText = `أهلاً يا كابتن ${user.displayName}`;
    } else {
        currentUser = null;
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
});

// حفظ البيانات وحساب النظام
saveDataBtn.addEventListener('click', () => {
    if (!currentUser) return;

    const weight = parseFloat(document.getElementById('weight-input').value);
    const targetWeight = parseFloat(document.getElementById('target-weight-input').value);
    const height = parseFloat(document.getElementById('height-input').value);
    const age = parseFloat(document.getElementById('age-input').value);
    const activity = parseFloat(document.getElementById('activity-level').value);
    const gender = document.getElementById('gender').value;

    if (!weight || !height || !age || !targetWeight) {
        alert("برجاء إدخال جميع البيانات");
        return;
    }

    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr = gender === 'male' ? bmr + 5 : bmr - 161;

    const tdee = Math.round(bmr * activity);
    let targetCalories = tdee;
    
    if (weight > targetWeight) targetCalories -= 500;
    else if (weight < targetWeight) targetCalories += 500;

    const protein = Math.round(weight * 2.2); 
    const fats = Math.round((targetCalories * 0.25) / 9); 
    const carbs = Math.round((targetCalories - ((protein * 4) + (fats * 9))) / 4);

    set(ref(db, 'users/' + currentUser.uid), {
        name: currentUser.displayName,
        metrics: { weight, targetWeight, height, age, gender, activity },
        macros: { calories: targetCalories, protein, fats, carbs },
        lastUpdated: new Date().toISOString()
    }).then(() => {
        dietResult.style.display = 'block';
        dietResult.innerHTML = `
            <h3 style="margin-top:0;">نظامك المحسوب:</h3>
            <p>🔥 <strong>السعرات اليومية:</strong> ${targetCalories} سعرة</p>
            <p>🥩 <strong>البروتين:</strong> ${protein} جرام</p>
            <p>🍚 <strong>الكاربوهيدرات:</strong> ${carbs} جرام</p>
            <p>🥑 <strong>الدهون:</strong> ${fats} جرام</p>
            <p style="color: #27ae60; font-weight: bold; font-size: 14px; text-align: center; margin-top: 15px;">تم الحفظ في قاعدة البيانات بنجاح ✔️</p>
        `;
    }).catch((error) => console.error("Error:", error));
});

// المساعد الذكي
aiSendBtn.addEventListener('click', async () => {
    const userMessage = aiInput.value.trim();
    if (!userMessage) return;

    aiChatBox.innerHTML += `<p class="user-msg"><strong>أنت:</strong> ${userMessage}</p>`;
    aiInput.value = '';
    aiChatBox.scrollTop = aiChatBox.scrollHeight;

    const currentWeight = document.getElementById('weight-input').value || "غير محدد";
    const targetWeight = document.getElementById('target-weight-input').value || "غير محدد";
    
    const prompt = `
    أنت مدرب لياقة بدنية وتغذية. 
    بيانات العميل الحالية: وزنه ${currentWeight} كجم، وهدفه الوصول لـ ${targetWeight} كجم.
    أجب على سؤاله التالي بشكل مختصر وعملي.
    سؤال العميل: ${userMessage}
    `;

    const loadingId = "loading-" + Date.now();
    aiChatBox.innerHTML += `<p id="${loadingId}" style="color: gray; font-size: 13px;">الكابتن بيكتب...</p>`;
    aiChatBox.scrollTop = aiChatBox.scrollHeight;
    
    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY 
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        document.getElementById(loadingId).remove();

        if(data.error) {
            aiChatBox.innerHTML += `<p style="color: red;">خطأ في الـ API: ${data.error.message}</p>`;
        } else {
            const aiReply = data.candidates[0].content.parts[0].text;
            aiChatBox.innerHTML += `<p class="ai-msg"><strong>الكابتن:</strong> ${aiReply}</p>`;
        }
        
        aiChatBox.scrollTop = aiChatBox.scrollHeight;

    } catch (error) {
        document.getElementById(loadingId).remove();
        aiChatBox.innerHTML += `<p style="color: red;">مشكلة في الاتصال بالإنترنت.</p>`;
    }
});
