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

const GEMINI_API_KEY = "AQ.Ab8RN6I2UAg4Dntub48zXzJwXE5nluqLvp2_7JbtlF57U2AwGw";

// دوال تسجيل الدخول
document.getElementById('login-btn').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('dashboard-section').style.display = 'block';
        document.getElementById('user-name').innerText = `أهلاً يا كابتن ${user.displayName}`;
        loadUserData(user.uid); // تحميل بيانات المستخدم والجداول المحفوظة
    } else {
        currentUser = null;
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('dashboard-section').style.display = 'none';
    }
});

// تحميل البيانات المحفوظة مسبقاً
function loadUserData(uid) {
    get(child(ref(db), `users/${uid}`)).then((snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            if(data.macros) {
                currentMacros = data.macros;
                displayMacros(data.macros);
                document.getElementById('diet-plan-section').style.display = 'block';
                document.getElementById('workout-plan-section').style.display = 'block';
            }
            if(data.dietTableHTML) {
                document.getElementById('diet-table-container').innerHTML = data.dietTableHTML;
                document.getElementById('save-diet-btn').style.display = 'block';
            }
            if(data.workoutTableHTML) {
                document.getElementById('workout-table-container').innerHTML = data.workoutTableHTML;
                document.getElementById('save-workout-btn').style.display = 'block';
            }
        }
    });
}

function displayMacros(macros) {
    const resultDiv = document.getElementById('diet-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <h3 style="margin-top:0;">الماكروز المحسوبة:</h3>
        <p>🔥 السعرات: <strong>${macros.calories}</strong> | 🥩 بروتين: <strong>${macros.protein}g</strong> | 🍚 كارب: <strong>${macros.carbs}g</strong> | 🥑 دهون: <strong>${macros.fats}g</strong></p>
    `;
}

// 1. حساب السعرات والماكروز
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

    const protein = Math.round(weight * 2.2); 
    const fats = Math.round((targetCalories * 0.25) / 9); 
    const carbs = Math.round((targetCalories - ((protein * 4) + (fats * 9))) / 4);

    currentMacros = { calories: targetCalories, protein, fats, carbs };
    displayMacros(currentMacros);
    document.getElementById('diet-plan-section').style.display = 'block';
    document.getElementById('workout-plan-section').style.display = 'block';

    set(ref(db, `users/${currentUser.uid}/metrics`), { weight, targetWeight, height, age, activity, gender });
    set(ref(db, `users/${currentUser.uid}/macros`), currentMacros);
});

// 2. توليد جدول التغذية بالذكاء الاصطناعي
document.getElementById('generate-diet-btn').addEventListener('click', async () => {
    if(!currentMacros) return alert("احسب السعرات أولاً");
    const favFoods = document.getElementById('favorite-foods').value || "أكلات صحية متنوعة";
    const loading = document.getElementById('diet-loading');
    loading.style.display = 'block';

    const prompt = `
    أنت خبير تغذية. صمم جدول وجبات يومي مكون من 3 وجبات بناءً على:
    سعرات: ${currentMacros.calories}، بروتين: ${currentMacros.protein}g، كارب: ${currentMacros.carbs}g، دهون: ${currentMacros.fats}g.
    أدخل هذه الأكلات إن أمكن: ${favFoods}.
    أخرج النتيجة حصرياً ككود HTML لجدول (<table>) يحتوي على أعمدة: الوجبة، الأصناف والكميات، السعرات، البروتين.
    اجعل جميع خلايا <td> تحتوي على الخاصية contenteditable="true" لكي يستطيع المستخدم تعديلها.
    لا تكتب أي نصوص أخرى غير كود الجدول.
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        let aiHtml = data.candidates[0].content.parts[0].text;
        
        // تنظيف مخرجات AI من علامات الـ Markdown
        aiHtml = aiHtml.replace(/```html/g, '').replace(/```/g, '');
        
        document.getElementById('diet-table-container').innerHTML = aiHtml;
        document.getElementById('save-diet-btn').style.display = 'block';
        loading.style.display = 'none';
    } catch (error) {
        loading.style.display = 'none';
        alert("حدث خطأ في تصميم الجدول، جرب مرة أخرى.");
    }
});

// حفظ جدول الأكل (بعد أو قبل التعديل اليدوي)
document.getElementById('save-diet-btn').addEventListener('click', () => {
    const tableHTML = document.getElementById('diet-table-container').innerHTML;
    set(ref(db, `users/${currentUser.uid}/dietTableHTML`), tableHTML)
        .then(() => alert("تم حفظ جدول الأكل بنجاح! ✔️"));
});

// 3. توليد جدول التمرين
document.getElementById('generate-workout-btn').addEventListener('click', () => {
    const type = document.getElementById('workout-type').value;
    let tableHtml = `<table><tr><th>اليوم</th><th>العضلة</th><th>التمارين (اضغط للتعديل)</th><th>المجاميع x العدادات</th></tr>`;
    
    if (type === "3") {
        tableHtml += `
            <tr><td contenteditable="true">اليوم 1</td><td contenteditable="true">Push (صدر، كتف، تراي)</td><td contenteditable="true">بنش برس، تجميع دمبل، رفرفة جانبي، دفع تراي</td><td contenteditable="true">3 x 10-12</td></tr>
            <tr><td contenteditable="true">اليوم 2</td><td contenteditable="true">Pull (ظهر، باي)</td><td contenteditable="true">سحب أرضي، سحب عالي، باربيل رو، تبادل باي</td><td contenteditable="true">3 x 10-12</td></tr>
            <tr><td contenteditable="true">اليوم 3</td><td contenteditable="true">Legs (أرجل، بطن)</td><td contenteditable="true">سكوات، طعن، دفع أوزان، بطن</td><td contenteditable="true">4 x 10</td></tr>
        `;
    } else if (type === "4") {
        tableHtml += `
            <tr><td contenteditable="true">اليوم 1</td><td contenteditable="true">علوي (Upper)</td><td contenteditable="true">بنش برس، سحب ظهر، كتف، باي وتراي</td><td contenteditable="true">3 x 10</td></tr>
            <tr><td contenteditable="true">اليوم 2</td><td contenteditable="true">سفلي (Lower)</td><td contenteditable="true">سكوات، رفرفة أمامي، خلفي، سمانة</td><td contenteditable="true">4 x 12</td></tr>
            <tr><td contenteditable="true">اليوم 3</td><td contenteditable="true">علوي (Upper)</td><td contenteditable="true">تجميع دمبل صدر، سحب أرضي، كتف رفرفة</td><td contenteditable="true">3 x 12</td></tr>
            <tr><td contenteditable="true">اليوم 4</td><td contenteditable="true">سفلي (Lower)</td><td contenteditable="true">ليج بريس، ديد لفت روماني، طعن</td><td contenteditable="true">4 x 10</td></tr>
        `;
    } else {
        tableHtml += `
            <tr><td contenteditable="true">اليوم 1</td><td contenteditable="true">صدر (Chest)</td><td contenteditable="true">بنش برس، تجميع عالي، تفتيح، كروس أوفر</td><td contenteditable="true">4 x 10-12</td></tr>
            <tr><td contenteditable="true">اليوم 2</td><td contenteditable="true">ظهر (Back)</td><td contenteditable="true">عقلة، سحب أرضي، ديدليفت، طرمبة</td><td contenteditable="true">4 x 10-12</td></tr>
            <tr><td contenteditable="true">اليوم 3</td><td contenteditable="true">كتف (Shoulders)</td><td contenteditable="true">دفع أوزان، رفرفة جانبي، رفرفة خلفي، ترابيس</td><td contenteditable="true">4 x 12-15</td></tr>
            <tr><td contenteditable="true">اليوم 4</td><td contenteditable="true">أرجل (Legs)</td><td contenteditable="true">سكوات، ليج بريس، أمامي، خلفي، سمانة</td><td contenteditable="true">4 x 10</td></tr>
            <tr><td contenteditable="true">اليوم 5</td><td contenteditable="true">ذراع (Arms)</td><td contenteditable="true">بايسيبس بار، تبادل دمبل، دفع تراي، فرنسي</td><td contenteditable="true">3 x 12</td></tr>
        `;
    }
    tableHtml += `</table>`;
    
    document.getElementById('workout-table-container').innerHTML = tableHtml;
    document.getElementById('save-workout-btn').style.display = 'block';
});

// حفظ جدول التمرين
document.getElementById('save-workout-btn').addEventListener('click', () => {
    const tableHTML = document.getElementById('workout-table-container').innerHTML;
    set(ref(db, `users/${currentUser.uid}/workoutTableHTML`), tableHTML)
        .then(() => alert("تم حفظ جدول التمرين بنجاح! ✔️"));
});

// 4. المساعد الذكي
const aiInput = document.getElementById('ai-input');
const aiChatBox = document.getElementById('ai-chat-box');
document.getElementById('ai-send-btn').addEventListener('click', async () => {
    const msg = aiInput.value.trim();
    if (!msg) return;

    aiChatBox.innerHTML += `<p class="user-msg"><strong>أنت:</strong> ${msg}</p>`;
    aiInput.value = '';
    
    const prompt = `أنت مدرب تغذية وتمرين. أجب باختصار على هذا السؤال: ${msg}`;
    
    try {
        const loadingId = "loading-" + Date.now();
        aiChatBox.innerHTML += `<p id="${loadingId}" style="color: gray;">الكابتن بيكتب...</p>`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        document.getElementById(loadingId).remove();
        
        const reply = data.candidates[0].content.parts[0].text;
        aiChatBox.innerHTML += `<p class="ai-msg"><strong>الكابتن:</strong> ${reply}</p>`;
        aiChatBox.scrollTop = aiChatBox.scrollHeight;
    } catch (e) {
        aiChatBox.innerHTML += `<p style="color: red;">خطأ في الاتصال بالإنترنت.</p>`;
    }
});
