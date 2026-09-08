import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

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

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const userNameDisplay = document.getElementById('user-name');
const saveDataBtn = document.getElementById('save-data-btn');
const dietResult = document.getElementById('diet-result');

loginBtn.addEventListener('click', () => signInWithPopup(auth, provider));
logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        userNameDisplay.innerText = `أهلاً، ${user.displayName}`;
    } else {
        currentUser = null;
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
});

// خوارزمية الحساب والحفظ
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

    // 1. حساب BMR
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr = gender === 'male' ? bmr + 5 : bmr - 161;

    // 2. حساب TDEE (إجمالي الحرق)
    const tdee = Math.round(bmr * activity);

    // 3. تحديد السعرات المستهدفة (عجز 500 سعرة للنزول أو العكس)
    let targetCalories = tdee;
    if (weight > targetWeight) targetCalories -= 500;
    else if (weight < targetWeight) targetCalories += 500;

    // 4. توزيع الماكروز (بروتين عالي للحفاظ على العضلات)
    const protein = Math.round(weight * 2.2); // جرام بروتين
    const fats = Math.round((targetCalories * 0.25) / 9); // 25% دهون
    const remainingCalories = targetCalories - ((protein * 4) + (fats * 9));
    const carbs = Math.round(remainingCalories / 4); // باقي السعرات كارب

    // 5. حفظ البيانات في Realtime Database
    set(ref(db, 'users/' + currentUser.uid), {
        name: currentUser.displayName,
        metrics: { weight, targetWeight, height, age, gender, activity },
        macros: { calories: targetCalories, protein, fats, carbs },
        lastUpdated: new Date().toISOString()
    }).then(() => {
        // 6. عرض النتيجة للمستخدم
        dietResult.innerHTML = `
            <h3>نظامك المحسوب:</h3>
            <p><strong>السعرات اليومية:</strong> ${targetCalories} kcal</p>
            <p><strong>البروتين:</strong> ${protein}g</p>
            <p><strong>الكاربوهيدرات:</strong> ${carbs}g</p>
            <p><strong>الدهون:</strong> ${fats}g</p>
            <p style="color: green;">تم حفظ البيانات بنجاح في قاعدة البيانات!</p>
        `;
    }).catch((error) => {
        console.error("Error saving data: ", error);
        alert("حدث خطأ أثناء الحفظ");
    });
});
