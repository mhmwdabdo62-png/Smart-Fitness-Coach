import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

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
let currentMacros = null;
let userMetrics = null;
let weightChartInstance = null;

const GEMINI_API_KEY = "AQ.Ab8RN6KMkyoaJhs86DU1Jx0hIhDuEr2Z2YYem2bC0xCN3bgvog";

// تبديل المظهر (Theme Switcher)
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    if (html.getAttribute('data-theme') === 'dark') {
        html.setAttribute('data-theme', 'light');
        themeToggle.innerText = '☀️ الوضع';
    } else {
        html.setAttribute('data-theme', 'dark');
        themeToggle.innerText = '🌙 الوضع';
    }
});

// المصادقة
document.getElementById('login-btn').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('dashboard-section').style.display = 'block';
        document.getElementById('user-name').innerText = `ك. ${user.displayName.split(' ')[0]}`;
        loadUserData(user.uid);
    } else {
        currentUser = null;
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('dashboard-section').style.display = 'none';
    }
});

function loadUserData(uid) {
    get(child(ref(db), `users/${uid}`)).then((snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            if(data.metrics) {
                userMetrics = data.metrics;
                fillMetricsForm(data.metrics);
                document.getElementById('setup-card').style.display = 'none';
            } else {
                document.getElementById('setup-card').style.display = 'block';
            }

            if(data.macros) {
                currentMacros = data.macros;
                displayMacros(data.macros);
                document.getElementById('diet-plan-section').style.display = 'block';
                document.getElementById('workout-plan-section').style.display = 'block';
                document.getElementById('progress-section').style.display = 'block';
                renderWeightChart(data.weightHistory || []);
            }
            if(data.dietTableHTML) {
                document.getElementById('diet-table-container').innerHTML = data.dietTableHTML;
                document.getElementById('save-diet-btn').style.display = 'block';
                document.getElementById('reset-diet-btn').style.display = 'block';
            }
            if(data.workoutTableHTML) {
                document.getElementById('workout-table-container').innerHTML = data.workoutTableHTML;
                document.getElementById('save-workout-btn').style.display = 'block';
                document.getElementById('reset-workout-btn').style.display = 'block';
            }
        } else {
            document.getElementById('setup-card').style.display = 'block';
        }
    });
}

function fillMetricsForm(metrics) {
    document.getElementById('weight-input').value = metrics.weight || '';
    document.getElementById('target-weight-input').value = metrics.targetWeight || '';
    document.getElementById('height-input').value = metrics.height || '';
    document.getElementById('age-input').value = metrics.age || '';
    document.getElementById('activity-level').value = metrics.activity || '1.2';
    document.getElementById('gender').value = metrics.gender || 'male';
}

function displayMacros(macros) {
    const resultDiv = document.getElementById('diet-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <h3 style="margin-top:0;">الماكروز المحسوبة لجسمك:</h3>
        <p style="margin:5px 0;">🔥 السعرات: <strong>${macros.calories}</strong> | 🥩 بروتين: <strong>${macros.protein}g</strong> | 🍚 كارب: <strong>${macros.carbs}g</strong> | 🥑 دهون: <strong>${macros.fats}g</strong></p>
    `;
}

// رسم تطور الوزن
function renderWeightChart(history) {
    const ctx = document.getElementById('weightChart').getContext('2d');
    if (weightChartInstance) weightChartInstance.destroy();

    const labels = history.map(h => h.date);
    const weights = history.map(h => h.weight);

    weightChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['اليوم'],
            datasets: [{
                label: 'الوزن (كجم)',
                data: weights.length ? weights : [userMetrics?.weight || 0],
                borderColor: '#e50914',
                backgroundColor: 'rgba(229, 9, 20, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: '#aaa' }, grid: { color: '#333' } },
                x: { ticks: { color: '#aaa' }, grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// زر الإعدادات
document.getElementById('edit-profile-btn').addEventListener('click', () => {
    const card = document.getElementById('setup-card');
    card.style.display = card.style.display === 'none' ? 'block' : 'none';
    document.getElementById('cancel-edit-btn').style.display = 'block';
});
document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    document.getElementById('setup-card').style.display = 'none';
});

// حفظ البيانات وتحديث السجل
document.getElementById('save-data-btn').addEventListener('click', () => {
    const weight = parseFloat(document.getElementById('weight-input').value);
    const targetWeight = parseFloat(document.getElementById('target-weight-input').value);
    const height = parseFloat(document.getElementById('height-input').value);
    const age = parseFloat(document.getElementById('age-input').value);
    const activity = parseFloat(document.getElementById('activity-level').value);
    const gender = document.getElementById('gender').value;

    if (!weight || !height || !age || !targetWeight) return alert("أدخل البيانات كاملة!");

    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr = gender === 'male' ? bmr + 5 : bmr - 161;

    const tdee = Math.round(bmr * activity);
    let targetCalories = tdee;
    if (weight > targetWeight) targetCalories -= 500;
    else if (weight < targetWeight) targetCalories += 500;

    const protein = Math.round(weight * 2); 
    const fats = Math.round((targetCalories * 0.20) / 9); 
    const carbs = Math.round((targetCalories - ((protein * 4) + (fats * 9))) / 4);

    currentMacros = { calories: targetCalories, protein, fats, carbs };
    userMetrics = { weight, targetWeight, height, age, activity, gender };

    displayMacros(currentMacros);
    document.getElementById('diet-plan-section').style.display = 'block';
    document.getElementById('workout-plan-section').style.display = 'block';
    document.getElementById('progress-section').style.display = 'block';
    document.getElementById('setup-card').style.display = 'none';

    // تحديث سجل الأوزان
    get(child(ref(db), `users/${currentUser.uid}/weightHistory`)).then((snapshot) => {
        let history = snapshot.exists() ? snapshot.val() : [];
        const today = new Date().toISOString().split('T')[0];
        const lastEntry = history[history.length - 1];
        if (lastEntry && lastEntry.date === today) {
            lastEntry.weight = weight;
        } else {
            history.push({ date: today, weight: weight });
        }
        set(ref(db, `users/${currentUser.uid}/weightHistory`), history);
        renderWeightChart(history);
    });

    set(ref(db, `users/${currentUser.uid}/metrics`), userMetrics);
    set(ref(db, `users/${currentUser.uid}/macros`), currentMacros);
    alert("تم حفظ وتحديث البيانات بنجاح! ✔️");
});

// توليد جدول الأكل باستخدام الموديل المستقر (gemini-pro)
document.getElementById('generate-diet-btn').addEventListener('click', async () => {
    if(!currentMacros) return alert("احسب السعرات أولاً");
    const favFoods = document.getElementById('favorite-foods').value || "أكلات صحية متنوعة";
    const btn = document.getElementById('generate-diet-btn');
    btn.disabled = true;
    btn.innerText = "جاري تصميم الجدول... ⏳";

    const prompt = `أنت خبير تغذية رياضي. صمم جدول وجبات يومي مكون من 3 وجبات بناءً على: سعرات: ${currentMacros.calories}، بروتين: ${currentMacros.protein}g، كارب: ${currentMacros.carbs}g، دهون: ${currentMacros.fats}g. الأكلات: ${favFoods}. أخرج النتيجة حصرياً ككود HTML لجدول (<table>) يحتوي على أعمدة: الوجبة، الأصناف والكميات، السعرات، البروتين. اجعل جميع خلايا <td> تحتوي على contenteditable="true". لا تكتب أي نصوص أخرى.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        btn.disabled = false;
        btn.innerText = "توليد جدول الأكل";

        if (data.error) return alert("خطأ: " + data.error.message);

        let aiHtml = data.candidates[0].content.parts[0].text;
        const tableMatch = aiHtml.match(/<table[\s\S]*?<\/table>/i);
        if (tableMatch) aiHtml = tableMatch[0];
        else aiHtml = aiHtml.replace(/```html/g, '').replace(/```/g, '');
        
        document.getElementById('diet-table-container').innerHTML = aiHtml;
        document.getElementById('save-diet-btn').style.display = 'block';
        document.getElementById('reset-diet-btn').style.display = 'block';
    } catch (error) {
        btn.disabled = false;
        btn.innerText = "توليد جدول الأكل";
        alert("خطأ في الاتصال.");
    }
});

document.getElementById('save-diet-btn').addEventListener('click', () => {
    const tableHTML = document.getElementById('diet-table-container').innerHTML;
    set(ref(db, `users/${currentUser.uid}/dietTableHTML`), tableHTML)
        .then(() => alert("تم حفظ الجدول! ✔️"));
});

document.getElementById('reset-diet-btn').addEventListener('click', () => {
    if(confirm("هل أنت متأكد من حذف الجدول؟")) {
        document.getElementById('diet-table-container').innerHTML = '';
        document.getElementById('save-diet-btn').style.display = 'none';
        document.getElementById('reset-diet-btn').style.display = 'none';
        set(ref(db, `users/${currentUser.uid}/dietTableHTML`), null);
    }
});

// جدول التمرين
document.getElementById('generate-workout-btn').addEventListener('click', () => {
    const type = document.getElementById('workout-type').value;
    let tableHtml = `<table><tr><th>اليوم</th><th>العضلة</th><th>التمارين (اضغط للتعديل)</th><th>المجاميع x العدادات</th></tr>`;
    
    if (type === "3") {
        tableHtml += `
            <tr><td contenteditable="true">اليوم 1</td><td contenteditable="true">Push</td><td contenteditable="true">بنش برس، تجميع دمبل، رفرفة</td><td contenteditable="true">3 x 10</td></tr>
            <tr><td contenteditable="true">اليوم 2</td><td contenteditable="true">Pull</td><td contenteditable="true">سحب أرضي، عالي، تبادل باي</td><td contenteditable="true">3 x 10</td></tr>
            <tr><td contenteditable="true">اليوم 3</td><td contenteditable="true">Legs</td><td contenteditable="true">سكوات، ليج بريس، بطن</td><td contenteditable="true">4 x 10</td></tr>
        `;
    } else if (type === "4") {
        tableHtml += `
            <tr><td contenteditable="true">اليوم 1</td><td contenteditable="true">علوي</td><td contenteditable="true">بنش برس، سحب ظهر، كتف</td><td contenteditable="true">3 x 10</td></tr>
            <tr><td contenteditable="true">اليوم 2</td><td contenteditable="true">سفلي</td><td contenteditable="true">سكوات، رفرفة أمامي، سمانة</td><td contenteditable="true">4 x 12</td></tr>
            <tr><td contenteditable="true">اليوم 3</td><td contenteditable="true">علوي</td><td contenteditable="true">تجميع دمبل، سحب أرضي</td><td contenteditable="true">3 x 12</td></tr>
            <tr><td contenteditable="true">اليوم 4</td><td contenteditable="true">سفلي</td><td contenteditable="true">ليج بريس، ديدليفت روماني</td><td contenteditable="true">4 x 10</td></tr>
        `;
    } else {
        tableHtml += `
            <tr><td contenteditable="true">اليوم 1</td><td contenteditable="true">صدر</td><td contenteditable="true">بنش برس، عالي، تفتيح</td><td contenteditable="true">4 x 10</td></tr>
            <tr><td contenteditable="true">اليوم 2</td><td contenteditable="true">ظهر</td><td contenteditable="true">عقلة، سحب أرضي، ديدليفت</td><td contenteditable="true">4 x 10</td></tr>
            <tr><td contenteditable="true">اليوم 3</td><td contenteditable="true">كتف</td><td contenteditable="true">دفع، رفرفة جانبي وخلفي</td><td contenteditable="true">4 x 12</td></tr>
            <tr><td contenteditable="true">اليوم 4</td><td contenteditable="true">أرجل</td><td contenteditable="true">سكوات، أمامي وخلفي</td><td contenteditable="true">4 x 10</td></tr>
            <tr><td contenteditable="true">اليوم 5</td><td contenteditable="true">ذراع</td><td contenteditable="true">بايسبس، تراسبس</td><td contenteditable="true">3 x 12</td></tr>
        `;
    }
    tableHtml += `</table>`;
    
    document.getElementById('workout-table-container').innerHTML = tableHtml;
    document.getElementById('save-workout-btn').style.display = 'block';
    document.getElementById('reset-workout-btn').style.display = 'block';
});

document.getElementById('save-workout-btn').addEventListener('click', () => {
    const tableHTML = document.getElementById('workout-table-container').innerHTML;
    set(ref(db, `users/${currentUser.uid}/workoutTableHTML`), tableHTML)
        .then(() => alert("تم حفظ جدول التمرين! ✔️"));
});

document.getElementById('reset-workout-btn').addEventListener('click', () => {
    if(confirm("هل أنت متأكد من حذف الجدول؟")) {
        document.getElementById('workout-table-container').innerHTML = '';
        document.getElementById('save-workout-btn').style.display = 'none';
        document.getElementById('reset-workout-btn').style.display = 'none';
        set(ref(db, `users/${currentUser.uid}/workoutTableHTML`), null);
    }
});

// المساعد الذكي باستخدام الموديل المستقر (gemini-pro)
const aiInput = document.getElementById('ai-input');
const aiChatBox = document.getElementById('ai-chat-box');

document.getElementById('ai-send-btn').addEventListener('click', async () => {
    const msg = aiInput.value.trim();
    if (!msg) return;

    aiChatBox.innerHTML += `<p class="user-msg"><strong>أنت:</strong> ${msg}</p>`;
    aiInput.value = '';
    
    const loadingId = "loading-" + Date.now();
    try {
        aiChatBox.innerHTML += `<p id="${loadingId}" style="color: gray; font-size: 13px;">الكابتن بيفكر...</p>`;
        aiChatBox.scrollTop = aiChatBox.scrollHeight;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: `أنت مدرب تغذية وتمرين. أجب باختصار وعملي: ${msg}` }] }] })
        });
        
        const data = await response.json();
        document.getElementById(loadingId)?.remove();
        
        if (data.error) return aiChatBox.innerHTML += `<p style="color: red;">خطأ من السيرفر.</p>`;
        
        const reply = data.candidates[0].content.parts[0].text;
        aiChatBox.innerHTML += `<p class="ai-msg"><strong>الكابتن:</strong> ${reply}</p>`;
        aiChatBox.scrollTop = aiChatBox.scrollHeight;
    } catch (e) {
        document.getElementById(loadingId)?.remove();
    }
});
