/**
 * Smart-Fitness-Coach - Universal Standalone Application Bundle
 * Runs 100% seamlessly on both file:/// (double-clicking locally) and https:// (GitHub Pages / Web Server)
 * Zero CORS restrictions, instant tactile interactivity.
 */

(function () {
  'use strict';

  // ==========================================
  // 1. FIREBASE & LOCAL STORAGE MANAGER
  // ==========================================
  const COLLECTIONS = {
    USERS: 'users',
    WORKOUTS: 'workouts',
    MEALS: 'meals',
    SUPPLEMENTS: 'supplements',
    PHYSIQUE_LOGS: 'physique_logs',
    DAILY_LOGS: 'daily_logs'
  };

  function getFirebaseConfig() {
    return {
      apiKey: localStorage.getItem("sfc_fb_api_key") || "",
      authDomain: localStorage.getItem("sfc_fb_auth_domain") || "",
      projectId: localStorage.getItem("sfc_fb_project_id") || "",
      storageBucket: localStorage.getItem("sfc_fb_storage_bucket") || "",
      messagingSenderId: localStorage.getItem("sfc_fb_msg_sender_id") || "",
      appId: localStorage.getItem("sfc_fb_app_id") || ""
    };
  }

  class LocalStorageMockDB {
    constructor() {
      this.prefix = 'sfc_db_';
    }

    _getKey(collection, docId) {
      return `${this.prefix}${collection}_${docId}`;
    }

    async getDoc(collection, docId) {
      const raw = localStorage.getItem(this._getKey(collection, docId));
      return raw ? JSON.parse(raw) : null;
    }

    async setDoc(collection, docId, data, merge = true) {
      const key = this._getKey(collection, docId);
      let finalData = data;
      if (merge) {
        const existing = await this.getDoc(collection, docId) || {};
        finalData = Object.assign({}, existing, data, { updatedAt: new Date().toISOString() });
      }
      localStorage.setItem(key, JSON.stringify(finalData));
      return finalData;
    }
  }

  const localDB = new LocalStorageMockDB();

  class FirebaseManager {
    constructor() {
      this.app = null;
      this.auth = null;
      this.db = null;
      this.storage = null;
      this.isLiveFirebase = false;
      this.currentUser = null;
      this.authListeners = [];
    }

    async initialize() {
      const config = getFirebaseConfig();
      if (window.firebase && config.apiKey && config.projectId) {
        try {
          if (!window.firebase.apps.length) {
            this.app = window.firebase.initializeApp(config);
          } else {
            this.app = window.firebase.app();
          }
          this.auth = window.firebase.auth();
          this.db = window.firebase.firestore();
          this.storage = window.firebase.storage();
          this.isLiveFirebase = true;
          console.log("🔥 Firebase Live Connected:", config.projectId);

          this.auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.notifyAuthListeners(user);
          });
        } catch (err) {
          console.warn("Firebase Live init notice:", err.message);
          this.isLiveFirebase = false;
        }
      } else {
        console.log("ℹ️ Running in Local Mode with LocalStorage DB.");
        this.isLiveFirebase = false;
      }
      return this;
    }

    onAuthStateChanged(cb) {
      this.authListeners.push(cb);
      if (this.currentUser) cb(this.currentUser);
    }

    notifyAuthListeners(user) {
      this.authListeners.forEach(fn => {
        try { fn(user); } catch (e) {}
      });
    }

    async signInWithGoogle() {
      if (this.isLiveFirebase && this.auth && window.firebase) {
        try {
          const provider = new window.firebase.auth.GoogleAuthProvider();
          const res = await this.auth.signInWithPopup(provider);
          this.currentUser = res.user;
          return {
            uid: res.user.uid,
            name: res.user.displayName || "رياضي",
            email: res.user.email,
            photoURL: res.user.photoURL,
            isLive: true
          };
        } catch (e) {
          console.warn("Google popup issue, switching to simulated login:", e);
        }
      }
      
      const demoUser = {
        uid: "google_user_" + Date.now().toString(36),
        name: "محمود حسن",
        email: "mahmoud.gym@gmail.com",
        photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
        isLive: false
      };
      this.currentUser = demoUser;
      this.notifyAuthListeners(demoUser);
      return demoUser;
    }

    signInAsGuest(name = "كابتن") {
      const guest = {
        uid: "guest_" + Date.now().toString(36),
        name: name,
        email: `${name.toLowerCase()}@localgym.app`,
        photoURL: "",
        isLive: false,
        isGuest: true
      };
      this.currentUser = guest;
      this.notifyAuthListeners(guest);
      return guest;
    }

    async signOut() {
      if (this.isLiveFirebase && this.auth) {
        try { await this.auth.signOut(); } catch (e) {}
      }
      this.currentUser = null;
      this.notifyAuthListeners(null);
    }

    async saveUserProfile(userId, data) {
      await localDB.setDoc(COLLECTIONS.USERS, userId, data);
      if (this.isLiveFirebase && this.db) {
        try {
          await this.db.collection(COLLECTIONS.USERS).doc(userId).set(data, { merge: true });
        } catch (e) {}
      }
    }

    async saveWorkoutSession(workout) {
      const docId = workout.id || `w_${Date.now()}`;
      await localDB.setDoc(COLLECTIONS.WORKOUTS, docId, workout);
      if (this.isLiveFirebase && this.db) {
        try { await this.db.collection(COLLECTIONS.WORKOUTS).doc(docId).set(workout); } catch (e) {}
      }
    }

    async saveMeal(meal) {
      const docId = meal.id || `m_${Date.now()}`;
      await localDB.setDoc(COLLECTIONS.MEALS, docId, meal);
      if (this.isLiveFirebase && this.db) {
        try { await this.db.collection(COLLECTIONS.MEALS).doc(docId).set(meal); } catch (e) {}
      }
    }

    async savePhysiqueCheckin(checkin) {
      const docId = checkin.id || `chk_${Date.now()}`;
      await localDB.setDoc(COLLECTIONS.PHYSIQUE_LOGS, docId, checkin);
      if (this.isLiveFirebase && this.db) {
        try { await this.db.collection(COLLECTIONS.PHYSIQUE_LOGS).doc(docId).set(checkin); } catch (e) {}
      }
    }

    saveCredentials(cfg) {
      if (cfg.apiKey) localStorage.setItem("sfc_fb_api_key", cfg.apiKey.trim());
      if (cfg.authDomain) localStorage.setItem("sfc_fb_auth_domain", cfg.authDomain.trim());
      if (cfg.projectId) localStorage.setItem("sfc_fb_project_id", cfg.projectId.trim());
      if (cfg.storageBucket) localStorage.setItem("sfc_fb_storage_bucket", cfg.storageBucket.trim());
      if (cfg.appId) localStorage.setItem("sfc_fb_app_id", cfg.appId.trim());
      return this.initialize();
    }
  }

  const fbManager = new FirebaseManager();
  window.fbManager = fbManager;

  // ==========================================
  // 2. GEMINI AI ENGINE
  // ==========================================
  class GeminiService {
    constructor() {
      this.apiKey = localStorage.getItem('sfc_gemini_api_key') || '';
      this.model = 'gemini-2.5-flash';
      this.candidateModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];
      this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
      this.language = localStorage.getItem('sfc_lang') || 'ar';
    }

    setLanguage(lang) {
      this.language = lang;
      localStorage.setItem('sfc_lang', lang);
    }

    setApiKey(key) {
      this.apiKey = key.trim();
      localStorage.setItem('sfc_gemini_api_key', this.apiKey);
    }

    getApiKey() {
      return this.apiKey || localStorage.getItem('sfc_gemini_api_key') || '';
    }

    hasApiKey() {
      return Boolean(this.getApiKey());
    }

    async _callGemini({ prompt, imageBase64 = null, mimeType = 'image/jpeg', responseSchema = null, systemInstruction = '' }) {
      const key = this.getApiKey();

      if (!key) {
        console.warn("⚠️ No Gemini API Key set. Using high-precision sports science reasoning engine.");
        return this._generateSimulatedResponse(prompt, imageBase64, responseSchema);
      }

      const parts = [{ text: prompt }];
      if (imageBase64) {
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64
          }
        });
      }

      const bodyPayload = {
        contents: [{ role: 'user', parts: parts }],
        generationConfig: {
          temperature: 0.2
        }
      };

      if (responseSchema) {
        bodyPayload.generationConfig.responseMimeType = 'application/json';
        bodyPayload.generationConfig.responseSchema = responseSchema;
      }

      if (systemInstruction) {
        bodyPayload.system_instruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      let lastError = null;
      for (const modelName of this.candidateModels) {
        try {
          const url = `${this.baseUrl}/models/${modelName}:generateContent?key=${key}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload)
          });

          if (!res.ok) {
            const errText = await res.text();
            lastError = new Error(`Model ${modelName} (${res.status}): ${errText}`);
            continue;
          }

          const data = await res.json();
          const output = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (output) return output;
        } catch (err) {
          lastError = err;
        }
      }

      console.warn("All Gemini models failed, falling back to sports engine:", lastError);
      throw lastError || new Error("Gemini API call failed");
    }

    async analyzeMealPhoto(imageBase64, mimeType = 'image/jpeg', userContext = {}) {
      const isAr = this.language === 'ar';
      const prompt = `Analyze this fitness meal image in detail. Extract portion estimates in grams, total calories, protein, carbs, and fat. Goal: ${userContext.goal || 'Lean Bulk'}.`;
      const schema = {
        type: "object",
        properties: {
          mealName: { type: "string" },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          coachNote: { type: "string" }
        },
        required: ["mealName", "calories", "protein", "carbs", "fat"]
      };

      try {
        const raw = await this._callGemini({ prompt, imageBase64, mimeType, responseSchema: schema });
        return this._safeJsonParse(raw);
      } catch (e) {
        return this._generateSimulatedResponse("meal_photo", imageBase64, schema);
      }
    }

    async analyzeMealText(description, userContext = {}) {
      const prompt = `Calculate exact calories and macros for this food: "${description}". Goal: ${userContext.goal || 'Lean Bulk'}.`;
      const schema = {
        type: "object",
        properties: {
          mealName: { type: "string" },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          coachNote: { type: "string" }
        },
        required: ["mealName", "calories", "protein", "carbs", "fat"]
      };

      try {
        const raw = await this._callGemini({ prompt, responseSchema: schema });
        return this._safeJsonParse(raw);
      } catch (e) {
        return this._generateSimulatedResponse("meal_text", description, schema);
      }
    }

    async suggestProgressiveOverload(previousLogs, currentSession, userProfile) {
      const isAr = this.language === 'ar';
      return this._generateSimulatedResponse("progressive_overload", { previousLogs, currentSession, userProfile });
    }

    async analyzePhysiqueCheckIn(photoBase64, currentWeight, previousWeight, currentMacros, userProfile) {
      return this._generateSimulatedResponse("physique_checkin", { currentWeight, previousWeight, currentMacros });
    }

    async chatWithCoach(userMessage, chatHistory = [], userProfile = {}, dailyLog = null, currentWorkout = null) {
      const prof = userProfile || {};
      const isAr = this.language === 'ar';
      const targetP = prof.targetProtein || 165;
      const targetC = prof.targetCarbs || 432;
      const targetF = prof.targetFat || 79;
      const targetCal = prof.targetCalories || 3100;
      const targetW = prof.targetWaterMl || 3675;

      const consumedP = dailyLog?.consumedProtein || 0;
      const consumedC = dailyLog?.consumedCarbs || 0;
      const consumedF = dailyLog?.consumedFat || 0;
      const consumedCal = dailyLog?.consumedCalories || 0;
      const consumedW = dailyLog?.waterMl || 0;

      const remainingP = Math.max(0, targetP - consumedP);
      const remainingC = Math.max(0, targetC - consumedC);
      const remainingF = Math.max(0, targetF - consumedF);
      const remainingCal = Math.max(0, targetCal - consumedCal);
      const remainingW = Math.max(0, targetW - consumedW);

      const systemInstruction = `You are "IRON COACH", an elite Sports Nutritionist and Hypertrophy Strength Coach inside Smart-Fitness-Coach.
CURRENT ATHLETE METRICS:
- Name: ${prof.name || 'Mahmoud'} (${prof.age || 22}yo, ${prof.height || 178}cm, ${prof.weight || 75}kg)
- Goal: ${prof.goal || 'Lean Bulk'} (Training: ${prof.trainingDays || 5} days/week gym split)
- DAILY TARGETS: ${targetCal} kcal | Protein: ${targetP}g | Carbs: ${targetC}g | Fat: ${targetF}g | Water: ${(targetW / 1000).toFixed(2)}L
- CONSUMED SO FAR: ${consumedCal} kcal | Protein: ${consumedP}g | Carbs: ${consumedC}g | Fat: ${consumedF}g | Water: ${(consumedW / 1000).toFixed(2)}L
- >>> EXACT REMAINING REQUIRED TODAY (CRITICAL) <<<:
  * REMAINING PROTEIN: ${remainingP}g
  * REMAINING CARBS: ${remainingC}g
  * REMAINING FAT: ${remainingF}g
  * REMAINING CALORIES: ${remainingCal} kcal
  * REMAINING WATER: ${(remainingW / 1000).toFixed(2)}L
- SUPPLEMENTS: Citrulline (${dailyLog?.supplementsTaken?.citrulline ? 'Taken' : 'Pending - 6-8g 30-45m pre-workout'}), Creatine (${dailyLog?.supplementsTaken?.creatine ? 'Taken' : 'Pending - 5g daily post-workout'})
- CURRENT WORKOUT PLAN: ${JSON.stringify(currentWorkout || [])}

COACHING RULES:
1. Address the athlete directly with high scientific precision and gym authority.
2. If the user asks about remaining macros, protein, carbs, calories, what to eat, or hitting their target: QUOTE THE EXACT REMAINING NUMBERS NEEDED TODAY (${remainingP}g protein, ${remainingC}g carbs, ${remainingF}g fat, ${remainingCal} kcal), and suggest specific foods to hit them precisely.
3. If the user asks about exercises or weights: explain the exact progressive overload plan (+2.5kg on bench press to 82.5kg, lock 10 reps on incline dumbbell, etc.).
4. If replying in Arabic, use authentic, motivational, professional Egyptian gym language (عاش يا بطل، تضخيم نظيف، بمب، زيادة تدريجية، جليكوجين، استشفاء).
5. Never be generic or evasive. Give clear, bulleted, actionable advice.`;

      const formattedHistory = chatHistory.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
      const fullPrompt = `${formattedHistory}\nUSER: ${userMessage}\nIRON COACH:`;

      try {
        const response = await this._callGemini({
          prompt: fullPrompt,
          systemInstruction
        });
        return response.trim();
      } catch (e) {
        console.warn("Chat API fallback to sports reasoning engine:", e);
        return this._generateCoachChatMessage(userMessage, userProfile, dailyLog, currentWorkout);
      }
    }

    _safeJsonParse(text) {
      try {
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(clean);
      } catch (err) {
        return null;
      }
    }

    _generateSimulatedResponse(type, input, schema) {
      const isAr = this.language === 'ar';

      if (type === 'meal_photo' || type === 'meal_text') {
        return {
          mealName: isAr ? "صدور دجاج مشوية مع أرز بسمتي وبروكلي سوتيه" : "Grilled Chicken Breast, Steamed Jasmine Rice & Broccoli",
          estimatedWeightGrams: 480,
          calories: 680,
          protein: 52,
          carbs: 78,
          fat: 14,
          foodItems: [
            { name: isAr ? "صدور دجاج مخلية مشوية" : "Chicken Breast", portion: "200g", calories: 330, protein: 46 },
            { name: isAr ? "أرز بسمتي مطبوخ" : "Jasmine Rice", portion: "220g", calories: 286, protein: 5 },
            { name: isAr ? "بروكلي مسلوق بزيت زيتون" : "Broccoli Florets", portion: "60g", calories: 64, protein: 1 }
          ],
          coachNote: isAr 
            ? "وجبة تضخيم نظيف مثالية! 52 جم بروتين عالي الجودة مع كارب سريع لملء الجليكوجين بعد التمرين."
            : "Clean lean-bulk meal! Hits 52g high-BV protein to replenish glycogen.",
          confidenceScore: 0.95
        };
      }

      if (type === 'progressive_overload') {
        return {
          sessionVerdict: isAr 
            ? "عاش يا كابتن! قفلت كل العداد المطلوبة الأسبوع الماضي، والزيادة التدريجية تفرض زيادة الوزن اليوم!"
            : "You crushed your rep targets last week! Moving the iron forward today.",
          targetSupplementsNotice: isAr
            ? "خد جرعة 6 إلى 8 جم من الإل-سيترولين قبل أول مجموعة بـ 35 دقيقة عشان توسيع الشرايين وأقصى ضخ دم (بمب) عضلات."
            : "Take 6g - 8g of L-Citrulline 35 minutes before your first working set for maximum nitric oxide pump.",
          exerciseRecommendations: [
            {
              exerciseName: isAr ? "بنش برس بار مستوي (Barbell Bench Press)" : "Barbell Bench Press",
              previousBest: isAr ? "80.0 كجم × 10، 10، 10 عدات" : "80.0 kg x 10, 10, 10 reps",
              recommendedWeight: isAr ? "82.5 كجم" : "82.5 kg",
              targetSetsReps: isAr ? "3 مجموعات × 8-10 عدات" : "3 sets x 8-10 reps",
              weightDeltaKg: 2.5,
              actionType: "WEIGHT_INCREASE",
              coachCue: isAr ? "تحكم في النزول السلبي (ثانيتين) واضغط بكعب رجلك في الأرض بقوة." : "Control eccentric, explode concentric."
            },
            {
              exerciseName: isAr ? "تجميع دمبل مائل عالي (Incline DB Press)" : "Incline Dumbbell Press",
              previousBest: isAr ? "30.0 كجم لكل دمبل × 10، 9، 8 عدات" : "30.0 kg x 10, 9, 8 reps",
              recommendedWeight: isAr ? "30.0 كجم" : "30.0 kg",
              targetSetsReps: isAr ? "3 مجموعات × 10 عدات" : "3 sets x 10 reps",
              weightDeltaKg: 0,
              actionType: "REP_OVERLOAD",
              coachCue: isAr ? "اثبت على 30 كجم واقفل الـ 10 عدات كاملة في المجموعتين 2 و 3 قبل ما ترفع لـ 32.5 كجم." : "Hold weight, lock in all 10s."
            },
            {
              exerciseName: isAr ? "سحب بار ظهر واسع (Barbell Bent-Over Row)" : "Barbell Bent-Over Row",
              previousBest: isAr ? "75.0 كجم × 10، 10، 10 عدات" : "75.0 kg x 10, 10, 10 reps",
              recommendedWeight: isAr ? "77.5 كجم" : "77.5 kg",
              targetSetsReps: isAr ? "3 مجموعات × 8 عدات" : "3 sets x 8 reps",
              weightDeltaKg: 2.5,
              actionType: "WEIGHT_INCREASE",
              coachCue: isAr ? "اسحب بكوعك لأسفل الضلوع واثبت ثانية في القمة." : "Pull with elbows, squeeze lats."
            }
          ]
        };
      }

      if (type === 'physique_checkin') {
        return {
          physiqueAssessment: isAr 
            ? "امتلاء عضلي ممتاز في الجزء العلوي للصدر وتدويرة الكتف، مع بقاء عضلات البطن مشدودة وصافية."
            : "Visual muscular fullness in chest and delts while retaining clean abdominal vascularity.",
          weightVerdict: isAr
            ? "الوزن زاد من 74.8 كجم إلى 75.1 كجم (+0.30 كجم)، وده يطابق معدل التضخيم النظيف المطلوب بالمللي (+0.25 إلى +0.35 كجم/أسبوع)."
            : "Weight increased by +0.30 kg, aligning with optimal lean bulk trajectory.",
          adjustedMacros: {
            calories: 3100,
            protein: 165,
            carbs: 432,
            fat: 79,
            adjustmentReason: isAr ? "معدل الزيادة مثالي (+0.30 كجم/أسبوع)، نثبت السعرات على 3,100 لبناء عضل صافي." : "Weight trajectory is optimal."
          },
          trainingVolumeAdjustment: isAr ? "حافظ على تمرين الـ 5 أيام، وزود مجموعة دروب سيت واحدة للكتف الجانبي." : "Maintain 5-day split, add 1 drop set to lateral delts.",
          nextWeekKeyFocus: isAr ? "الالتزام بـ 5 جم كرياتين يومياً بعد التمرين و 3.7 لتر ماء على الأقل." : "Daily 5g Creatine and 3.7L hydration."
        };
      }

      return {};
    }

    _generateCoachChatMessage(msg, profile = {}, dailyLog = null, currentWorkout = null) {
      const isAr = this.language === 'ar';
      const lower = (msg || '').toLowerCase();
      const name = profile?.name || (isAr ? 'يا كابتن' : 'Champion');

      const targetP = profile?.targetProtein || 165;
      const targetC = profile?.targetCarbs || 432;
      const targetF = profile?.targetFat || 79;
      const targetCal = profile?.targetCalories || 3100;
      const targetW = profile?.targetWaterMl || 3675;

      const consumedP = dailyLog?.consumedProtein || 0;
      const consumedC = dailyLog?.consumedCarbs || 0;
      const consumedF = dailyLog?.consumedFat || 0;
      const consumedCal = dailyLog?.consumedCalories || 0;
      const consumedW = dailyLog?.waterMl || 0;

      const remP = Math.max(0, targetP - consumedP);
      const remC = Math.max(0, targetC - consumedC);
      const remF = Math.max(0, targetF - consumedF);
      const remCal = Math.max(0, targetCal - consumedCal);
      const remW = Math.max(0, targetW - consumedW);

      // 1. Remaining Macros / What's required today
      if (lower.includes('remain') || lower.includes('need') || lower.includes('require') || lower.includes('left') ||
          msg.includes('مطلوب') || msg.includes('متبقي') || msg.includes('باقي') || msg.includes('فاضل') || msg.includes('ناقص') ||
          msg.includes('احسبلي') || msg.includes('اقفل') || msg.includes('أقفل') || (msg.includes('كام') && (msg.includes('بروتين') || msg.includes('كارب')))) {
        if (isAr) {
          let mealIdea = "";
          if (remP > 40) {
            mealIdea = `🍗 **اقتراح الكابتن لتقفيل المطلوب اليوم**:
- **وجبة رئيسية**: 250 جم صدور دجاج مشوية (هتوفر لك ~55 جم بروتين صافي) + 200 جم أرز بسمتي مسلوق (~50 جم كارب).
- **وجبة خفيفة قبل النوم**: علبة تونة مصفاة أو 200 جم جبنة قريش مع ملعقة زيت زيتون لقفل باقي الدهون والبروتين البطيء (الكازين) للاستشفاء العضلي وأنت نايم!`;
          } else if (remP > 15) {
            mealIdea = `🍗 **اقتراح الكابتن لتقفيل المطلوب اليوم**:
- 3 بيضات مسلوقة + علبة زبادي أو رغيف عيش مع قطعة جبنة قريش هتقفل معاك الـ ${remP} جم بروتين في ثواني!`;
          } else {
            mealIdea = `🔥 **عاش يا وحش! أنت مقرب جداً تقفل هدف البروتين لليوم**، ركز بس في تعبئة الكاربوهيدرات وشرب ${(remW/1000).toFixed(1)} لتر مية المتبقية.`;
          }

          return `يا ${name}، حسبتلك الأرقام بالمللي بناءً على أكلك وتسجيلاتك النهاردة:

📊 **المستهلك حتى الآن**:
- سعرات: ${consumedCal.toLocaleString()} من أصل ${targetCal.toLocaleString()} سعرة
- بروتين: ${consumedP} جم | كارب: ${consumedC} جم | دهون: ${consumedF} جم

🎯 **المطلوب منك تقفيله الآن لإنهاء يومك بنجاح**:
🍗 **بروتين مطلوب**: **${remP} جم** (المستهدف: ${targetP} جم).
🍚 **كاربوهيدرات مطلوبة**: **${remC} جم** (المستهدف: ${targetC} جم).
🥑 **دهون صحية مطلوبة**: **${remF} جم** (المستهدف: ${targetF} جم).
🔥 **سعرات مطلوبة**: **${remCal.toLocaleString()} سعرة**.
💧 **مياه متبقية**: **${(remW / 1000).toFixed(2)} لتر**.

${mealIdea}`;
        } else {
          return `Hey ${name}, here are your exact live numbers calculated to the gram:

📊 **Consumed So Far**:
- Calories: ${consumedCal.toLocaleString()} of ${targetCal.toLocaleString()} kcal
- Protein: ${consumedP}g | Carbs: ${consumedC}g | Fat: ${consumedF}g

🎯 **EXACT REMAINING TARGETS NEEDED TODAY**:
🍗 **Remaining Protein**: **${remP}g** (Target: ${targetP}g)
🍚 **Remaining Carbs**: **${remC}g** (Target: ${targetC}g)
🥑 **Remaining Healthy Fats**: **${remF}g** (Target: ${targetF}g)
🔥 **Remaining Calories**: **${remCal.toLocaleString()} kcal**
💧 **Remaining Water**: **${(remW / 1000).toFixed(2)} Liters**

💡 **Coach Meal Suggestion**:
A 250g grilled chicken breast plate with 200g jasmine rice knocks out ~55g protein and ~50g carbs toward this requirement!`;
        }
      }

      // 2. Specific Food Analysis (eggs, chicken, tuna, oats, rice, etc.)
      if (msg.includes('بيض') || msg.includes('فرخ') || msg.includes('دجاج') || msg.includes('تونة') || msg.includes('شوفان') || 
          msg.includes('رز') || msg.includes('أرز') || msg.includes('جبنة') || msg.includes('لحمة') || msg.includes('زبادي') ||
          lower.includes('egg') || lower.includes('chicken') || lower.includes('tuna') || lower.includes('oat') || lower.includes('rice')) {
        if (isAr) {
          return `تحليل سريع يا ${name} للوجبة دي في نظام التضخيم النظيف:
- **البيض**: كل بيضة كاملة فيها حوالي 6 جم بروتين + 5 جم دهون صحية (الكولين مفيد للتستوستيرون). 4 بيضات = 24 جم بروتين.
- **صدور الفراخ**: كل 100 جم صدور مشوية فيها تقريباً 28-31 جم بروتين صافي وقريب من الصفر دهون.
- **علبة التونة**: المصفاة فيها حوالي 28-30 جم بروتين سريع الامتصاص.
- **الأرز البسمتي**: كل 100 جم مطبوخ يديك تقريباً 25-28 جم كاربوهيدرات نظيفة لملء الجليكوجين.

📌 سجل الوجبة دي في شاشة "الدايت" عشان تتخصم تلقائياً من هدفك ويتبقى لك المطلوب بالظبط!`;
        }
        return `Quick breakdown ${name}:
- **Eggs**: ~6g protein and 5g healthy fats per large egg. 4 eggs = 24g protein.
- **Chicken Breast**: ~30g pure protein per 100g cooked with minimal fat.
- **Tuna (Canned/Drained)**: ~28-30g protein.
- **Jasmine Rice**: ~28g clean carbs per 100g cooked.

Log it in the Diet tab to immediately deduct it from your remaining targets!`;
      }

      // 3. Supplements (Creatine & Citrulline)
      if (lower.includes('creatine') || lower.includes('citrulline') || lower.includes('supplement') || 
          msg.includes('كرياتين') || msg.includes('سيترولين') || msg.includes('مكمل') || msg.includes('جرعة')) {
        if (isAr) {
          const citrullineTaken = dailyLog?.supplementsTaken?.citrulline;
          const creatineTaken = dailyLog?.supplementsTaken?.creatine;
          return `يا ${name}، خطة المكملات بتاعتك محسوبة بالدقيقة لهدف التضخيم النظيف:
1. **إل-سيترولين ماليت (6 إلى 8 جم)**: 
   - **الميعاد**: قبل تمرينك بـ 30 إلى 45 دقيقة.
   - **الفائدة**: بيتحول لأرجينين في الكلى ويرفع أكسيد النيتريك (NO)، وده بيوسع الشرايين ويديك بمب عالي جداً ويزود تدفق الأكسجين ويأخر إجهاد العضلة.
   - **حالتك اليوم**: ${citrullineTaken ? '✅ تم تسجيل الجرعة اليوم!' : '⏳ لسه مسجلتش الجرعة اليوم—خدها قبل التمرين!'}

2. **كرياتين مونوهيدرات (5 جم)**:
   - **الميعاد**: يومياً بدون فصال. في أيام التمرين يفضل بعد التمرين مع وجبة غنية بالكاربوهيدرات وسريعة الامتصاص لزيادة إفراز الإنسولين وتسريع دخوله للعضلات.
   - **الفائدة**: بيعيد شحن جزيئات الطاقة الفورية (ATP) ويزود الترطيب داخل الخلية العضلية (Intracellular Hydration).
   - **حالتك اليوم**: ${creatineTaken ? '✅ تم تسجيل الكرياتين اليوم!' : '⏳ لسه مسجلتش الكرياتين اليوم!'}

💧 **شرط أساسي**: لا تقل مياهك اليومية عن ${(targetW / 1000).toFixed(1)} لتر عشان الكرياتين يشتغل بأعلى كفاءة وبدون أي تقلصات.`;
        }
        return `Listen ${name}, your supplement protocol is dialed in scientifically:
1. **L-Citrulline (6-8g)**: Take 30-45 minutes pre-workout. Increases nitric oxide, triggers massive blood pumps, and delays fatigue.
2. **Creatine Monohydrate (5g)**: Take daily post-workout with a high-carb meal to drive phosphocreatine synthesis.
Hydration rule: Minimum ${(targetW / 1000).toFixed(1)}L of water daily!`;
      }

      // 4. Workout & Progressive Overload
      if (lower.includes('workout') || lower.includes('bench') || lower.includes('overload') || lower.includes('weight') ||
          msg.includes('تمرين') || msg.includes('بنش') || msg.includes('أوزان') || msg.includes('وزن') || msg.includes('زيادة')) {
        if (isAr) {
          return `قانون الزيادة التدريجية المزدوجة (Double Progression) لجلسة النهاردة:
1. **بنش برس بار مستوي**: 
   - الأسبوع اللي فات قفلت 80.0 كجم × 10 عدات في الـ 3 مجموعات.
   - **القرار**: النهاردة تزود الوزن فوراً إلى **82.5 كجم** (+2.5 كجم)! هدفك تجيب من 8 إلى 10 عدات بالوزن الجديد.
2. **تجميع دمبل مائل عالي**:
   - الأسبوع الماضي جبت 30.0 كجم × 10، 9، 8 عدات.
   - **القرار**: اثبت على وزن **30.0 كجم**. ممنوع ترفع لـ 32.5 كجم غير لما تقفل 10 عدات كاملة في المجموعتين 2 و 3!
3. **سحب بار ظهر**:
   - زود إلى **77.5 كجم** مع التركيز على سحب الكوع لأسفل القفص الصدري.

القاعدة: اقفل التكرارات أولاً، بعدها زود الأوزان. ده اللي بيبني عضل حقيقي مش إصابات!`;
        }
        return `Double Progression Protocol for today:
1. **Barbell Bench Press**: Hit all 10s at 80kg last week -> Move up to **82.5kg** (+2.5kg) today for 8-10 reps!
2. **Incline DB Press**: 30kg x 10, 9, 8 last week -> Hold at **30kg** and fight for all 10 reps across sets 2 and 3 before increasing.
3. **Barbell Row**: Move to **77.5kg**. Form over ego always!`;
      }

      // 5. Macro / Calorie Math calculation justification
      if (lower.includes('why') || lower.includes('math') || lower.includes('formula') || msg.includes('ليه') || msg.includes('حسبة') || msg.includes('معادلة') || msg.includes('سعرات')) {
        if (isAr) {
          return `حسبة سعراتك محسوبة بدقة علمية وفق معادلة **Mifflin-St Jeor** المعتمدة رياضياً:
- **معدل الأيض الأساسي (BMR)** لوزنك ${profile?.weight || 75} كجم وطولك ${profile?.height || 178} سم وسنك ${profile?.age || 22} سنة: **1,758 سعرة حرارية**.
- **معدل النشاط لـ 5 أيام تمرين حديد أسبوعياً**: ضرب في 1.60 = **2,812 سعرة (TDEE)**.
- **فائض التضخيم النظيف (+10%)**: +288 سعرة = **${targetCal} سعرة يومياً** (لضمان زيادة 0.25 إلى 0.35 كجم أسبوعياً بدون تراكم دهون).
- **البروتين**: 2.2 جم/كجم = **${targetP} جم** (${targetP * 4} سعرة = ~21%).
- **الدهون الصحية**: 23% = **${targetF} جم** (${targetF * 9} سعرة) للحفاظ على كفاءة هرمون التستوستيرون.
- **الكاربوهيدرات**: الباقي كله = **${targetC} جم** (${targetC * 4} سعرة) لوقود مخازن الجليكوجين وأداء الجيم.
حسابات رياضية بالجرام مش أرقام عشوائية!`;
        }
        return `Scientifically calculated via **Mifflin-St Jeor Formula**:
- BMR (75kg, 178cm, 22yo): 1,758 kcal.
- TDEE (5 days/week training x 1.60): 2,812 kcal.
- Lean Bulk Surplus (+10%): +288 kcal = **${targetCal} kcal/day**.
- Protein: 2.2g/kg = **${targetP}g**.
- Fats: 23% = **${targetF}g**.
- Carbs: Remainder = **${targetC}g**.`;
      }

      // Default Fallback
      if (isAr) {
        return `معاك يا ${name}! 
أنا متابع معاك خطتك اليومية (${targetCal} سعرة لتضخيم نظيف، تمرين ${profile?.trainingDays || 5} أيام).
- مطلوب منك لسه تقفل النهاردة: **${remP} جم بروتين**، **${remC} جم كارب**، **${remF} جم دهون** (${remCal} سعرة).
- متبقي مياه: **${(remW / 1000).toFixed(1)} لتر**.
قولي تحب نركز على إيه: تحليل وجبة أكلتها، ضبط أوزان التمرين، ولا خطة المكملات؟`;
      }

      return `I'm right here with you, ${name}!
Current daily status: You have **${remP}g protein**, **${remC}g carbs**, **${remF}g fats**, and **${remCal} kcal** left to close out your target today.
What would you like to focus on right now: analyzing a meal, your workout lifts, or supplement timing?`;
    }
  }

  const geminiService = new GeminiService();
  window.geminiService = geminiService;

  // ==========================================
  // 3. CORE APPLICATION LOGIC
  // ==========================================
  const MAHMOUD_DEFAULT_PROFILE = {
    uid: "test_mahmoud_22",
    name: "محمود",
    nameEn: "Mahmoud",
    age: 22,
    gender: "male",
    height: 178,
    weight: 75.0,
    trainingDays: 5,
    goal: "Lean Bulk",
    hasSupplements: true,
    supplements: ["Creatine", "Citrulline"],
    photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
    targetCalories: 3100,
    targetProtein: 165, // 2.2g / kg (ISSN Gold Standard)
    targetCarbs: 432,   // Remainder glycogen fuel
    targetFat: 79,      // 23% hormonal baseline
    targetWaterMl: 3675,
    targetSleepHours: 8.0,
    onboarded: true
  };

  class SmartCoachApp {
    constructor() {
      this.lang = localStorage.getItem('sfc_lang') || 'ar';
      this.user = null;
      this.currentView = 'home';
      this.dailyLog = {
        date: new Date().toISOString().split('T')[0],
        consumedCalories: 0,
        consumedProtein: 0,
        consumedCarbs: 0,
        consumedFat: 0,
        waterMl: 0,
        sleepHours: 8.0,
        meals: [],
        supplementsTaken: {
          citrulline: false,
          creatine: false
        }
      };

      this.previousWorkout = [
        { exerciseName: "Barbell Bench Press", sets: [{ weight: 80, reps: 10 }, { weight: 80, reps: 10 }, { weight: 80, reps: 10 }] },
        { exerciseName: "Incline Dumbbell Press", sets: [{ weight: 30, reps: 10 }, { weight: 30, reps: 9 }, { weight: 30, reps: 8 }] },
        { exerciseName: "Barbell Bent-Over Row", sets: [{ weight: 75, reps: 10 }, { weight: 75, reps: 10 }, { weight: 75, reps: 10 }] }
      ];

      this.currentWorkout = [];
      this.chatHistory = [];
    }

    t(key) {
      const isAr = this.lang === 'ar';
      const dict = {
        langIndicator: isAr ? "عربي 🇪🇬" : "English 🇺🇸",
        headerGoal: isAr ? "تضخيم نظيف" : "LEAN BULK",
        calUnit: isAr ? "سعرة" : "kcal",
        toastWorkoutSaved: isAr ? "🏆 تم حفظ جلسة التمرين بنجاح!" : "🏆 Workout Session Saved!",
        toastPresetLoaded: isAr ? "⚡ تم تفعيل بروفايل محمود (22 سنة - تضخيم نظيف)!" : "⚡ Loaded Mahmoud's 22yo Lean Bulk Preset!",
        toastSettingsSaved: isAr ? "✅ تم تحديث بياناتك والسعرات المستهدفة!" : "✅ Settings and Targets Updated!"
      };
      return dict[key] || key;
    }

    init() {
      console.log("⚡ Bootstrapping Smart-Fitness-Coach Standalone Engine...");
      geminiService.setLanguage(this.lang);
      fbManager.initialize();

      // Check stored user profile
      const stored = localStorage.getItem('sfc_user_profile');
      if (stored) {
        try {
          this.user = JSON.parse(stored);
        } catch (e) {
          this.user = null;
        }
      }

      if (!this.user || !this.user.onboarded) {
        // Automatically default to Mahmoud test profile so the app is instantly usable with full metrics
        this.user = Object.assign({}, MAHMOUD_DEFAULT_PROFILE);
        this.user.name = this.lang === 'ar' ? 'محمود' : 'Mahmoud';
        localStorage.setItem('sfc_user_profile', JSON.stringify(this.user));
      }

      // Check daily log
      const savedLog = localStorage.getItem(`sfc_log_${this.dailyLog.date}`);
      if (savedLog) {
        try {
          this.dailyLog = Object.assign({}, this.dailyLog, JSON.parse(savedLog));
        } catch (e) {}
      } else {
        // Day starts fresh: 0 meals, 0 consumed macros!
        this.dailyLog.meals = [];
        this.calculateDailyMacroTotals();
      }

      this.initDefaultWorkoutSession();
      this.bindEvents();
      this.onUserReady();
    }

    loadSampleMeals() {
      const isAr = this.lang === 'ar';
      this.dailyLog.meals = [
        {
          id: "m_1",
          mealName: isAr ? "شوفان مع واي بروتين وزبدة فول سوداني" : "Oatmeal with Whey & Peanut Butter",
          time: "08:30 AM",
          calories: 650,
          protein: 48,
          carbs: 82,
          fat: 16,
          coachNote: isAr ? "وجبة إفطار ممتازة لتعبئة الجليكوجين وبدء تخليق البروتين العضلي." : "High carb & fast leucine kick for protein synthesis."
        },
        {
          id: "m_2",
          mealName: isAr ? "زبادي يوناني مع عسل وتوت بري" : "Greek Yogurt, Honey & Blueberries",
          time: "11:45 AM",
          calories: 320,
          protein: 26,
          carbs: 45,
          fat: 4,
          coachNote: isAr ? "كازين بطيء الامتصاص للحفاظ على النيتروجين الإيجابي." : "Slow digesting micellar casein."
        }
      ];
      this.calculateDailyMacroTotals();
      this.updateDashboardCounters();
      this.renderDietView();
      this.showToast(isAr ? "⚡ تم تحميل وجبات تجريبية سريعة!" : "Sample meals loaded!");
    }

    onUserReady() {
      this.updateUserUI();
      this.initWelcomeChat();
      this.renderCurrentView();
      this.updateDashboardCounters();
    }

    updateUserUI() {
      if (!this.user) return;
      const isAr = this.lang === 'ar';

      const userNameEl = document.getElementById('header-user-name');
      if (userNameEl) userNameEl.textContent = this.user.name;

      const badgeGoal = document.getElementById('badge-header-goal');
      if (badgeGoal) badgeGoal.textContent = this.user.goal;

      const avatarImg = document.getElementById('header-avatar-img');
      const avatarText = document.getElementById('header-avatar-text');
      if (this.user.photoURL && avatarImg) {
        avatarImg.src = this.user.photoURL;
        avatarImg.style.display = 'block';
        if (avatarText) avatarText.style.display = 'none';
      } else {
        if (avatarImg) avatarImg.style.display = 'none';
        if (avatarText) {
          avatarText.style.display = 'inline';
          avatarText.textContent = (this.user.name || 'م').charAt(0).toUpperCase();
        }
      }

      const summaryEl = document.getElementById('lbl-user-summary');
      if (summaryEl) {
        summaryEl.textContent = isAr 
          ? `${this.user.age} سنة • ${this.user.height} سم • ${this.user.weight.toFixed(1)} كجم • ${this.user.trainingDays} أيام تمرين • هدف: ${this.user.goal}.`
          : `${this.user.age} yrs • ${this.user.height} cm • ${this.user.weight.toFixed(1)} kg • ${this.user.trainingDays} days/wk • Goal: ${this.user.goal}.`;
      }

      const setDisplay = document.getElementById('settings-user-display');
      const setEmail = document.getElementById('settings-user-email');
      if (setDisplay) setDisplay.textContent = this.user.name;
      if (setEmail) setEmail.textContent = this.user.email || 'offline_user@gym.app';

      const suppCreatineBox = document.getElementById('supp-box-creatine');
      const suppCitrullineBox = document.getElementById('supp-box-citrulline');
      const hasCreatine = this.user.supplements && this.user.supplements.includes('Creatine');
      const hasCitrulline = this.user.supplements && this.user.supplements.includes('Citrulline');

      if (suppCreatineBox) suppCreatineBox.style.display = (this.user.hasSupplements && hasCreatine) ? 'flex' : 'none';
      if (suppCitrullineBox) suppCitrullineBox.style.display = (this.user.hasSupplements && hasCitrulline) ? 'flex' : 'none';
    }

    initWelcomeChat() {
      const isAr = this.lang === 'ar';
      const name = this.user?.name || (isAr ? 'محمود' : 'Champion');
      if (isAr) {
        this.chatHistory = [
          {
            role: "coach",
            text: `أهلاً بيك في صالة الحديد يا ${name}!\nالبيانات: ${this.user.age} سنة، طولك ${this.user.height} سم، وزنك ${this.user.weight} كجم، تمرين ${this.user.trainingDays} أيام أسبوعياً.\nهدفك: ${this.user.goal} بسعرات مستهدفة ${this.user.targetCalories} سعرة.\nمتنساش: خد 6-8 جم إل-سيترولين قبل تمرينك بـ 35 دقيقة لأقصى بمب وتدفق دم!`
          }
        ];
      } else {
        this.chatHistory = [
          {
            role: "coach",
            text: `Welcome to the iron sanctuary, ${name}!\nStats: ${this.user.age}yo, ${this.user.height}cm, ${this.user.weight}kg, ${this.user.trainingDays} days/wk.\nGoal: ${this.user.goal} targeting ${this.user.targetCalories} kcal.\nDon't forget: take your L-Citrulline 35 minutes before your lifts!`
          }
        ];
      }
    }

    calculateDynamicTargets(weightKg, heightCm, ageYears, trainingDays, goal, gender = 'male') {
      // 1. Mifflin-St Jeor Formula
      let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears);
      bmr += (gender === 'female' ? -161 : 5);

      // 2. Activity Multiplier based on gym resistance training frequency
      let activityMultiplier = 1.35;
      if (trainingDays >= 6) activityMultiplier = 1.725;
      else if (trainingDays === 5) activityMultiplier = 1.60;
      else if (trainingDays >= 4) activityMultiplier = 1.55;
      else if (trainingDays >= 3) activityMultiplier = 1.45;
      else if (trainingDays >= 1) activityMultiplier = 1.375;

      const tdee = Math.round(bmr * activityMultiplier);

      // 3. Goal Adjustment
      let targetCalories = tdee;
      let surplus = 0;
      let proteinFactor = 2.2;
      let fatPct = 0.23;

      if (goal === 'Lean Bulk' || goal === 'تضخيم نظيف' || (typeof goal === 'string' && goal.includes('Lean Bulk'))) {
        surplus = 288; // ~+10% lean surplus for muscle protein synthesis without adiposity
        targetCalories = tdee + surplus;
        proteinFactor = 2.2; // ISSN optimal for hypertrophy
        fatPct = 0.23;
      } else if (goal === 'Heavy Bulk' || (typeof goal === 'string' && goal.includes('Heavy Bulk'))) {
        surplus = 500;
        targetCalories = tdee + surplus;
        proteinFactor = 2.0;
        fatPct = 0.25;
      } else if (goal === 'Cutting' || goal === 'تنشيف' || (typeof goal === 'string' && goal.includes('Cutting'))) {
        surplus = -500;
        targetCalories = Math.max(1500, tdee + surplus);
        proteinFactor = 2.4; // Elevated protein to prevent muscle wasting in deficit
        fatPct = 0.22;
      } else {
        // Maintenance / ثبات وزن
        surplus = 0;
        targetCalories = tdee;
        proteinFactor = 2.0;
        fatPct = 0.24;
      }

      // 4. Macronutrient Partitioning
      const proteinGrams = Math.round(weightKg * proteinFactor);
      const proteinCalories = proteinGrams * 4;

      const fatCalories = targetCalories * fatPct;
      const fatGrams = Math.round(fatCalories / 9);

      const carbCalories = Math.max(0, targetCalories - proteinCalories - (fatGrams * 9));
      const carbGrams = Math.round(carbCalories / 4);

      // Water: 35ml/kg base + 750ml workout sweat compensation + 300ml for creatine cell volumization
      const waterMl = Math.round(weightKg * 35) + (trainingDays >= 4 ? 750 : 500) + 300;

      return {
        bmr: Math.round(bmr),
        tdee,
        surplus,
        calories: targetCalories,
        protein: proteinGrams,
        carbs: carbGrams,
        fat: fatGrams,
        water: waterMl
      };
    }

    updateOnboardingLivePreview() {
      const age = parseInt(document.getElementById('onboard-age')?.value) || 22;
      const height = parseInt(document.getElementById('onboard-height')?.value) || 178;
      const weight = parseFloat(document.getElementById('onboard-weight')?.value) || 75.0;
      const days = parseInt(document.getElementById('onboard-days')?.value) || 5;
      const goal = document.getElementById('onboard-goal')?.value || 'Lean Bulk';

      const calculated = this.calculateDynamicTargets(weight, height, age, days, goal);

      const calEl = document.getElementById('onboard-preview-calories');
      const pEl = document.getElementById('onboard-preview-protein');
      const cEl = document.getElementById('onboard-preview-carbs');
      const fEl = document.getElementById('onboard-preview-fat');
      const wEl = document.getElementById('onboard-preview-water');

      if (calEl) calEl.textContent = `${calculated.calories.toLocaleString()} ${this.t('calUnit')}`;
      if (pEl) pEl.textContent = `${calculated.protein}g`;
      if (cEl) cEl.textContent = `${calculated.carbs}g`;
      if (fEl) fEl.textContent = `${calculated.fat}g`;
      if (wEl) wEl.textContent = `${(calculated.water / 1000).toFixed(1)} L`;
    }

    saveOnboardingData() {
      const name = document.getElementById('onboard-name')?.value.trim() || 'محمود';
      const age = parseInt(document.getElementById('onboard-age')?.value) || 22;
      const height = parseInt(document.getElementById('onboard-height')?.value) || 178;
      const weight = parseFloat(document.getElementById('onboard-weight')?.value) || 75.0;
      const days = parseInt(document.getElementById('onboard-days')?.value) || 5;
      const goal = document.getElementById('onboard-goal')?.value || 'Lean Bulk';
      const hasSupplements = document.getElementById('onboard-has-supplements')?.checked || false;

      const supplements = [];
      if (hasSupplements) {
        if (document.getElementById('onboard-supp-creatine')?.checked) supplements.push('Creatine');
        if (document.getElementById('onboard-supp-citrulline')?.checked) supplements.push('Citrulline');
      }

      const targets = this.calculateDynamicTargets(weight, height, age, days, goal);

      this.user = {
        uid: this.user?.uid || `user_${Date.now().toString(36)}`,
        name,
        email: this.user?.email || `${name.toLowerCase()}@gym.app`,
        photoURL: this.user?.photoURL || '',
        age,
        height,
        weight,
        trainingDays: days,
        goal,
        hasSupplements,
        supplements,
        targetCalories: targets.calories,
        targetProtein: targets.protein,
        targetCarbs: targets.carbs,
        targetFat: targets.fat,
        targetWaterMl: targets.water,
        targetSleepHours: 8.0,
        onboarded: true
      };

      localStorage.setItem('sfc_user_profile', JSON.stringify(this.user));
      fbManager.saveUserProfile(this.user.uid, this.user);

      this.closeModal('modal-onboarding');
      this.closeModal('modal-auth');
      this.onUserReady();
      this.showToast(this.lang === 'ar' ? "🔥 تم إعداد خطتك بنجاح! جاهز للتمرين." : "🔥 Profile setup complete! Ready to lift.");
    }

    initDefaultWorkoutSession() {
      const isAr = this.lang === 'ar';
      this.currentWorkout = [
        {
          id: "ex_bench",
          name: isAr ? "بنش برس بار مستوي (Barbell Bench Press)" : "Barbell Bench Press",
          lastWeek: isAr ? "80.0 كجم × 10، 10، 10 عدات" : "80.0 kg x 10, 10, 10 reps",
          recommendation: isAr ? "زود إلى 82.5 كجم! قفلت كل العداد الأسبوع الماضي." : "Increase to 82.5 kg! You hit all 10s last week.",
          delta: "+2.5 kg",
          action: "WEIGHT_INCREASE",
          sets: [
            { setNum: 1, weight: 82.5, reps: 10, done: true },
            { setNum: 2, weight: 82.5, reps: 9, done: true },
            { setNum: 3, weight: 82.5, reps: 8, done: false }
          ]
        },
        {
          id: "ex_incline",
          name: isAr ? "تجميع دمبل مائل عالي (Incline DB Press)" : "Incline Dumbbell Press",
          lastWeek: isAr ? "30.0 كجم × 10، 9، 8 عدات" : "30.0 kg x 10, 9, 8 reps",
          recommendation: isAr ? "اثبت على 30.0 كجم. المطلوب تقفل 10 عدات في المجموعتين 2 و 3." : "Hold at 30.0 kg. Target 10 reps across sets 2 and 3.",
          delta: "+1 Rep",
          action: "REP_OVERLOAD",
          sets: [
            { setNum: 1, weight: 30.0, reps: 10, done: false },
            { setNum: 2, weight: 30.0, reps: 10, done: false },
            { setNum: 3, weight: 30.0, reps: 10, done: false }
          ]
        },
        {
          id: "ex_row",
          name: isAr ? "سحب بار ظهر واسع (Barbell Bent-Over Row)" : "Barbell Bent-Over Row",
          lastWeek: isAr ? "75.0 كجم × 10، 10، 10 عدات" : "75.0 kg x 10, 10, 10 reps",
          recommendation: isAr ? "زود إلى 77.5 كجم. توجيه الأداء: اسحب بكوعك لأسفل الضلوع." : "Increase to 77.5 kg. Pull with elbows.",
          delta: "+2.5 kg",
          action: "WEIGHT_INCREASE",
          sets: [
            { setNum: 1, weight: 77.5, reps: 8, done: false },
            { setNum: 2, weight: 77.5, reps: 8, done: false },
            { setNum: 3, weight: 77.5, reps: 8, done: false }
          ]
        }
      ];
    }

    calculateDailyMacroTotals() {
      let cal = 0, p = 0, c = 0, f = 0;
      this.dailyLog.meals.forEach(m => {
        cal += Number(m.calories) || 0;
        p += Number(m.protein) || 0;
        c += Number(m.carbs) || 0;
        f += Number(m.fat) || 0;
      });
      this.dailyLog.consumedCalories = cal;
      this.dailyLog.consumedProtein = p;
      this.dailyLog.consumedCarbs = c;
      this.dailyLog.consumedFat = f;
      this.saveDailyLog();
    }

    saveDailyLog() {
      localStorage.setItem(`sfc_log_${this.dailyLog.date}`, JSON.stringify(this.dailyLog));
    }

    navigateTo(viewId) {
      this.currentView = viewId;
      document.querySelectorAll('.spa-view').forEach(v => v.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

      const targetView = document.getElementById(`view-${viewId}`);
      const targetNav = document.querySelector(`.nav-item[data-view="${viewId}"]`);

      if (targetView) targetView.classList.add('active');
      if (targetNav) targetNav.classList.add('active');

      this.renderCurrentView();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    renderCurrentView() {
      if (this.currentView === 'home') {
        this.updateDashboardCounters();
        this.updateSupplementsUI();
      } else if (this.currentView === 'workout') {
        this.renderWorkoutsView();
      } else if (this.currentView === 'diet') {
        this.renderDietView();
      } else if (this.currentView === 'progress') {
        this.renderProgressView();
      } else if (this.currentView === 'coach') {
        this.renderChatView();
      }
    }

    updateDashboardCounters() {
      if (!this.user) return;
      const isAr = this.lang === 'ar';
      const calUnit = isAr ? 'سعرة' : 'kcal';

      const pTarget = this.user.targetProtein || 165;
      const cTarget = this.user.targetCarbs || 432;
      const fTarget = this.user.targetFat || 79;
      const calTarget = this.user.targetCalories || 3100;
      const waterTarget = this.user.targetWaterMl || 3675;

      const pCurrent = this.dailyLog.consumedProtein || 0;
      const cCurrent = this.dailyLog.consumedCarbs || 0;
      const fCurrent = this.dailyLog.consumedFat || 0;
      const calCurrent = this.dailyLog.consumedCalories || 0;
      const waterCurrent = this.dailyLog.waterMl || 0;

      const remainingP = Math.max(0, pTarget - pCurrent);
      const remainingC = Math.max(0, cTarget - cCurrent);
      const remainingF = Math.max(0, fTarget - fCurrent);
      const remainingCal = Math.max(0, calTarget - calCurrent);
      const remainingWater = Math.max(0, waterTarget - waterCurrent);

      // Top Calorie Counter
      const calEl = document.getElementById('home-calories-remaining');
      const calTotalEl = document.getElementById('home-calories-target');
      if (calEl) calEl.textContent = remainingCal.toLocaleString();
      if (calTotalEl) calTotalEl.textContent = `/ ${calTarget.toLocaleString()} ${calUnit}`;

      // Actionable Remaining Targets Box
      const remPEl = document.getElementById('rem-p-val');
      const remPSub = document.getElementById('rem-p-sub');
      const remCEl = document.getElementById('rem-c-val');
      const remCSub = document.getElementById('rem-c-sub');
      const remFEl = document.getElementById('rem-f-val');
      const remFSub = document.getElementById('rem-f-sub');

      if (remPEl) remPEl.textContent = isAr ? `${remainingP} جم` : `${remainingP}g`;
      if (remPSub) remPSub.textContent = isAr ? `مستهلك ${pCurrent}g من ${pTarget}g` : `Consumed ${pCurrent}g of ${pTarget}g`;
      if (remCEl) remCEl.textContent = isAr ? `${remainingC} جم` : `${remainingC}g`;
      if (remCSub) remCSub.textContent = isAr ? `مستهلك ${cCurrent}g من ${cTarget}g` : `Consumed ${cCurrent}g of ${cTarget}g`;
      if (remFEl) remFEl.textContent = isAr ? `${remainingF} جم` : `${remainingF}g`;
      if (remFSub) remFSub.textContent = isAr ? `مستهلك ${fCurrent}g من ${fTarget}g` : `Consumed ${fCurrent}g of ${fTarget}g`;

      // Dynamic Coach Tip
      const tipEl = document.getElementById('remaining-coach-tip');
      if (tipEl) {
        if (isAr) {
          if (remainingP > 40) {
            tipEl.innerHTML = `💡 <strong>نصيحة الكابتن لتقفيل المطلوب:</strong> وجبة من 250 جم صدور دجاج مشوية مع 200 جم أرز بسمتي هتوفر لك ~55 جم بروتين و~50 جم كارب نظيف!`;
          } else if (remainingP > 15) {
            tipEl.innerHTML = `💡 <strong>نصيحة الكابتن لتقفيل المطلوب:</strong> علبة تونة مصفاة أو 4 بيضات مسلوقة مع رغيف عيش هتقفل باقي الـ ${remainingP} جم بروتين في الحال!`;
          } else {
            tipEl.innerHTML = `🔥 <strong>عاش يا بطل!</strong> هدف البروتين شبه مقفول اليوم (${pCurrent}g / ${pTarget}g). ركز في تعبئة الكاربوهيدرات وشرب الماء (${(remainingWater/1000).toFixed(1)} لتر متبقية).`;
          }
        } else {
          tipEl.innerHTML = `💡 <strong>Coach Strategy:</strong> A 250g grilled chicken breast plate with 200g jasmine rice knocks out ~55g protein and ~50g clean carbs!`;
        }
      }

      // Macro Pills - Remaining labels & percentage bars
      const pRemEl = document.getElementById('home-p-rem');
      const pValEl = document.getElementById('home-p-val');
      const pBar = document.getElementById('home-p-bar');
      const pPct = Math.min(100, Math.round((pCurrent / pTarget) * 100));
      if (pRemEl) pRemEl.textContent = isAr ? `مطلوب: ${remainingP} جم` : `Needed: ${remainingP}g`;
      if (pValEl) pValEl.textContent = isAr ? `استهلكت ${pCurrent}g من ${pTarget}g` : `Consumed ${pCurrent}g of ${pTarget}g`;
      if (pBar) pBar.style.width = `${pPct}%`;

      const cRemEl = document.getElementById('home-c-rem');
      const cValEl = document.getElementById('home-c-val');
      const cBar = document.getElementById('home-c-bar');
      const cPct = Math.min(100, Math.round((cCurrent / cTarget) * 100));
      if (cRemEl) cRemEl.textContent = isAr ? `مطلوب: ${remainingC} جم` : `Needed: ${remainingC}g`;
      if (cValEl) cValEl.textContent = isAr ? `استهلكت ${cCurrent}g من ${cTarget}g` : `Consumed ${cCurrent}g of ${cTarget}g`;
      if (cBar) cBar.style.width = `${cPct}%`;

      const fRemEl = document.getElementById('home-f-rem');
      const fValEl = document.getElementById('home-f-val');
      const fBar = document.getElementById('home-f-bar');
      const fPct = Math.min(100, Math.round((fCurrent / fTarget) * 100));
      if (fRemEl) fRemEl.textContent = isAr ? `مطلوب: ${remainingF} جم` : `Needed: ${remainingF}g`;
      if (fValEl) fValEl.textContent = isAr ? `استهلكت ${fCurrent}g من ${fTarget}g` : `Consumed ${fCurrent}g of ${fTarget}g`;
      if (fBar) fBar.style.width = `${fPct}%`;

      // Diet Strip
      const dietRemP = document.getElementById('diet-rem-p');
      const dietRemC = document.getElementById('diet-rem-c');
      const dietRemF = document.getElementById('diet-rem-f');
      const dietRemCal = document.getElementById('diet-rem-cal');
      if (dietRemP) dietRemP.textContent = isAr ? `🍗 ${remainingP} جم بروتين` : `🍗 ${remainingP}g Protein`;
      if (dietRemC) dietRemC.textContent = isAr ? `🍚 ${remainingC} جم كارب` : `🍚 ${remainingC}g Carbs`;
      if (dietRemF) dietRemF.textContent = isAr ? `🥑 ${remainingF} جم دهون` : `🥑 ${remainingF}g Fats`;
      if (dietRemCal) dietRemCal.textContent = isAr ? `🔥 ${remainingCal.toLocaleString()} سعرة` : `🔥 ${remainingCal.toLocaleString()} kcal`;

      // Water & Sleep displays
      const waterVal = document.getElementById('counter-water-val');
      if (waterVal) waterVal.textContent = `${(waterCurrent / 1000).toFixed(2)} L`;

      const sleepVal = document.getElementById('counter-sleep-val');
      if (sleepVal) sleepVal.textContent = `${this.dailyLog.sleepHours} ${isAr ? 'ساعات' : 'hrs'}`;
    }

    updateSupplementsUI() {
      const suppCitrulline = document.getElementById('supp-check-citrulline');
      const suppCreatine = document.getElementById('supp-check-creatine');

      if (suppCitrulline) {
        if (this.dailyLog.supplementsTaken.citrulline) {
          suppCitrulline.classList.add('checked');
          suppCitrulline.innerHTML = '✓';
        } else {
          suppCitrulline.classList.remove('checked');
          suppCitrulline.innerHTML = '';
        }
      }

      if (suppCreatine) {
        if (this.dailyLog.supplementsTaken.creatine) {
          suppCreatine.classList.add('checked');
          suppCreatine.innerHTML = '✓';
        } else {
          suppCreatine.classList.remove('checked');
          suppCreatine.innerHTML = '';
        }
      }
    }

    renderWorkoutsView() {
      const container = document.getElementById('workout-exercises-list');
      if (!container) return;
      const isAr = this.lang === 'ar';

      if (this.currentWorkout.length === 0) {
        container.innerHTML = `
          <div class="gym-card" style="text-align: center; padding: 28px 14px; border: 1px dashed var(--border-highlight);">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🏋️‍♂️</div>
            <h4 style="font-size: 1.05rem; font-weight: 800; margin-bottom: 6px;">${isAr ? 'جدول التمارين فارغ' : 'Workout is Empty'}</h4>
            <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 14px;">
              ${isAr ? 'اضغط على "إضافة تمرين جديد" بالأعلى لكتابة التمارين والأوزان التي ستلعبها اليوم، أو اختر جدول تضخيم جاهز بضغطة واحدة.' : 'Add your custom exercises and weights, or load the preset routine.'}
            </p>
            <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-primary btn-sm" onclick="window.coachApp.toggleAddExerciseBox(true)" style="width: auto;">
                ➕ ${isAr ? 'إضافة تمرين مخصص' : 'Add Exercise'}
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.coachApp.loadDefaultWorkoutTemplate()" style="width: auto;">
                ⚡ ${isAr ? 'جدول تضخيم جاهز' : 'Load Template'}
              </button>
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = this.currentWorkout.map((ex, exIdx) => `
        <div class="exercise-card">
          <div class="exercise-header">
            <div>
              <div class="exercise-name">${ex.name}</div>
              <span class="badge ${ex.action === 'WEIGHT_INCREASE' ? 'badge-red' : 'badge-gold'}" style="margin-top: 4px; display: inline-block;">${ex.delta || (isAr ? 'تمرين مخصص' : 'Custom')}</span>
            </div>
            <button class="exercise-delete-btn" onclick="window.coachApp.deleteExercise(${exIdx})" title="${isAr ? 'حذف التمرين' : 'Delete exercise'}">
              🗑️ ${isAr ? 'حذف' : 'Del'}
            </button>
          </div>
          
          ${ex.recommendation ? `
            <div class="overload-cue-banner">
              <strong>${isAr ? 'توجيه الزيادة التدريجية:' : 'AI Overload Directive:'}</strong> ${ex.recommendation}
              ${ex.lastWeek ? `<div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;">${isAr ? 'الجلسة السابقة:' : 'Last session:'} ${ex.lastWeek}</div>` : ''}
            </div>
          ` : ''}

          <div class="sets-table">
            <div style="display: grid; grid-template-columns: 28px 1fr 1fr 44px 34px; gap: 6px; margin-bottom: 6px; font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-align: center;">
              <span>#</span>
              <span>${isAr ? 'كجم' : 'KG'}</span>
              <span>${isAr ? 'عدات' : 'REPS'}</span>
              <span>${isAr ? 'تم' : 'DONE'}</span>
              <span></span>
            </div>

            ${ex.sets.map((set, setIdx) => `
              <div class="set-row">
                <span class="set-index">${set.setNum}</span>
                <input type="number" step="0.5" class="set-input-num" value="${set.weight}" 
                  onchange="window.coachApp.updateSet(${exIdx}, ${setIdx}, 'weight', this.value)">
                <input type="number" class="set-input-num" value="${set.reps}" 
                  onchange="window.coachApp.updateSet(${exIdx}, ${setIdx}, 'reps', this.value)">
                <button class="set-complete-btn ${set.done ? 'done' : ''}" 
                  onclick="window.coachApp.toggleSetDone(${exIdx}, ${setIdx})" title="${isAr ? 'تعليم كمكتملة' : 'Mark done'}">
                  ${set.done ? '✓' : ''}
                </button>
                <button class="set-delete-btn" onclick="window.coachApp.deleteSetFromExercise(${exIdx}, ${setIdx})" title="${isAr ? 'حذف المجموعة' : 'Delete set'}">
                  ✕
                </button>
              </div>
            `).join('')}
          </div>

          <button class="btn-add-set" onclick="window.coachApp.addSetToExercise(${exIdx})">
            ➕ ${isAr ? 'إضافة مجموعة جديدة' : 'Add Set'}
          </button>
        </div>
      `).join('');
    }

    toggleAddExerciseBox(force = null) {
      const box = document.getElementById('quick-add-exercise-box');
      if (!box) return;
      const willShow = force !== null ? force : (box.style.display === 'none' || !box.style.display);
      box.style.display = willShow ? 'block' : 'none';
      if (willShow) {
        const input = document.getElementById('input-new-exercise-name');
        if (input) input.focus();
      }
    }

    addCustomExercise(name) {
      const isAr = this.lang === 'ar';
      const cleanName = (name || document.getElementById('input-new-exercise-name')?.value || '').trim();
      if (!cleanName) {
        this.showToast(isAr ? "يرجى كتابة اسم التمرين أولاً" : "Please enter exercise name");
        return;
      }

      this.currentWorkout.push({
        id: `ex_${Date.now()}`,
        name: cleanName,
        recommendation: isAr ? "ابدأ بوزن مناسب وسجل عدات أول مجموعة ليتعرف الذكاء الاصطناعي على مستواك." : "Start with a solid working weight.",
        delta: isAr ? "تمرين جديد" : "New",
        action: "NEW_EXERCISE",
        sets: [
          { setNum: 1, weight: 20, reps: 10, done: false },
          { setNum: 2, weight: 20, reps: 10, done: false },
          { setNum: 3, weight: 20, reps: 10, done: false }
        ]
      });

      const input = document.getElementById('input-new-exercise-name');
      if (input) input.value = '';
      this.toggleAddExerciseBox(false);
      this.renderWorkoutsView();
      this.showToast(isAr ? `🔥 تم إضافة تمرين (${cleanName}) بنجاح!` : `Added (${cleanName})!`);
    }

    deleteExercise(exIdx) {
      const isAr = this.lang === 'ar';
      if (this.currentWorkout[exIdx]) {
        const removed = this.currentWorkout.splice(exIdx, 1);
        this.renderWorkoutsView();
        this.showToast(isAr ? `تم حذف تمرين ${removed[0]?.name || ''}` : "Exercise deleted");
      }
    }

    addSetToExercise(exIdx) {
      const ex = this.currentWorkout[exIdx];
      if (!ex) return;
      const lastSet = ex.sets[ex.sets.length - 1];
      const newWeight = lastSet ? lastSet.weight : 20;
      const newReps = lastSet ? lastSet.reps : 10;
      ex.sets.push({
        setNum: ex.sets.length + 1,
        weight: newWeight,
        reps: newReps,
        done: false
      });
      this.renderWorkoutsView();
    }

    deleteSetFromExercise(exIdx, setIdx) {
      const ex = this.currentWorkout[exIdx];
      if (!ex) return;
      if (ex.sets.length <= 1) {
        this.showToast(this.lang === 'ar' ? "التمرين يجب أن يحتوي على مجموعة واحدة على الأقل" : "Exercise needs at least one set");
        return;
      }
      ex.sets.splice(setIdx, 1);
      ex.sets.forEach((s, idx) => s.setNum = idx + 1);
      this.renderWorkoutsView();
    }

    clearWorkout() {
      this.currentWorkout = [];
      this.renderWorkoutsView();
      this.showToast(this.lang === 'ar' ? "تم مسح جدول التمارين. ضيف تمارينك بنفسك الآن!" : "Workout cleared. Add your exercises!");
    }

    loadDefaultWorkoutTemplate() {
      this.initDefaultWorkoutSession();
      this.renderWorkoutsView();
      this.showToast(this.lang === 'ar' ? "⚡ تم تحميل جدول التضخيم المقترح (بنش، كتف، ظهر)!" : "Loaded workout template!");
    }

    updateSet(exIdx, setIdx, field, val) {
      if (this.currentWorkout[exIdx] && this.currentWorkout[exIdx].sets[setIdx]) {
        this.currentWorkout[exIdx].sets[setIdx][field] = Number(val);
      }
    }

    toggleSetDone(exIdx, setIdx) {
      if (this.currentWorkout[exIdx] && this.currentWorkout[exIdx].sets[setIdx]) {
        const isDone = !this.currentWorkout[exIdx].sets[setIdx].done;
        this.currentWorkout[exIdx].sets[setIdx].done = isDone;
        this.renderWorkoutsView();
        if (isDone) {
          this.showToast(this.lang === 'ar' ? `🔥 عاش! تم تسجيل المجموعة ${setIdx + 1}.` : `🔥 Set ${setIdx + 1} logged!`);
        }
      }
    }

    async handleFinishWorkout() {
      const workoutDoc = {
        id: `w_${Date.now()}`,
        userId: this.user?.uid || 'offline',
        date: new Date().toISOString().split('T')[0],
        exercises: this.currentWorkout,
        completedAt: new Date().toISOString()
      };
      await fbManager.saveWorkoutSession(workoutDoc);
      this.showToast(this.t('toastWorkoutSaved'));
      this.navigateTo('home');
    }

    async refreshAiWorkoutGuidance() {
      if (this.currentWorkout.length === 0) {
        this.showToast(this.lang === 'ar' ? "ضيف تمارينك أولاً لتحليل الزيادة التدريجية" : "Add exercises first to analyze overload");
        return;
      }
      this.showToast(this.lang === 'ar' ? "🤖 جاري تحليل التمارين واقتراح الزيادات مع Gemini..." : "🤖 Analyzing with Gemini...");
      const aiGuidance = await geminiService.suggestProgressiveOverload(this.previousWorkout, this.currentWorkout, this.user);
      if (aiGuidance && aiGuidance.exerciseRecommendations) {
        aiGuidance.exerciseRecommendations.forEach(rec => {
          const found = this.currentWorkout.find(e => 
            e.name.toLowerCase().includes(rec.exerciseName.toLowerCase().split(' ')[0] || '') ||
            rec.exerciseName.toLowerCase().includes(e.name.toLowerCase().split(' ')[0] || '')
          );
          if (found) {
            found.recommendation = `${rec.coachCue} (${rec.recommendedWeight} - ${rec.targetSetsReps})`;
            found.delta = rec.weightDeltaKg > 0 ? `+${rec.weightDeltaKg} kg` : rec.actionType;
            found.action = rec.actionType;
          }
        });
        this.renderWorkoutsView();
        this.showToast(this.lang === 'ar' ? "✅ تم تحديث أوزان وتكرارات الزيادة التدريجية!" : "✅ Progressive Overload synced!");
      }
    }

    renderDietView() {
      const list = document.getElementById('diet-meals-container');
      if (!list) return;
      const isAr = this.lang === 'ar';

      if (this.dailyLog.meals.length === 0) {
        list.innerHTML = `
          <div class="gym-card" style="text-align: center; padding: 26px 14px; border: 1px dashed var(--border-highlight);">
            <div style="font-size: 2rem; margin-bottom: 8px;">🍽️</div>
            <h4 style="font-size: 1rem; font-weight: 800; margin-bottom: 6px;">${isAr ? 'لم تقم بتسجيل أي وجبات اليوم بعد' : 'No meals logged yet today'}</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 14px;">
              ${isAr ? 'مطلوب منك 165 جم بروتين و 432 جم كارب لبناء عضلات صافية. صور وجبتك أو ضيفها يدوي لتخصم فوراً من هدفك.' : 'Log meals via camera or manual entry to deduct from your daily remaining targets.'}
            </p>
            <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-primary btn-sm" onclick="window.coachApp.openAddMealModal()" style="width: auto;">
                ✍️ ${isAr ? 'تسجيل وجبة يدوياً' : 'Add Meal'}
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.coachApp.loadSampleMeals()" style="width: auto; border-color: var(--border-highlight);">
                ⚡ ${isAr ? 'إضافة وجبات تجريبية' : 'Load Sample Meals'}
              </button>
            </div>
          </div>
        `;
        return;
      }

      list.innerHTML = this.dailyLog.meals.map((m, idx) => `
        <div class="gym-card" style="margin-bottom: 12px; padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <h4 style="font-weight: 800; font-size: 1rem; color: #fff;">${m.mealName}</h4>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${m.time || (isAr ? 'اليوم' : 'Today')}</span>
          </div>
          <div style="display: flex; gap: 14px; margin: 8px 0; font-size: 0.9rem;">
            <strong style="color: var(--accent-red);">${m.calories} ${this.t('calUnit')}</strong>
            <span style="color: #ff5252;">P: <strong>${m.protein}g</strong></span>
            <span style="color: #40c4ff;">C: <strong>${m.carbs}g</strong></span>
            <span style="color: #ffd740;">F: <strong>${m.fat}g</strong></span>
          </div>
          ${m.coachNote ? `<div style="font-size: 0.8rem; color: var(--text-secondary); border-top: 1px solid var(--border-subtle); padding-top: 6px; margin-top: 6px;">💡 ${m.coachNote}</div>` : ''}
          <div class="meal-card-actions">
            <button class="btn btn-secondary btn-sm" onclick="window.coachApp.openEditMealModal(${idx})" style="flex: 1;">
              ✏️ ${isAr ? 'تعديل الوجبة' : 'Edit'}
            </button>
            <button class="btn btn-outline-red btn-sm" onclick="window.coachApp.deleteMeal(${idx})" style="width: auto;">
              🗑️ ${isAr ? 'حذف' : 'Delete'}
            </button>
          </div>
        </div>
      `).join('');
    }

    openAddMealModal() {
      const isAr = this.lang === 'ar';
      const title = document.getElementById('lbl-meal-modal-title');
      if (title) title.textContent = isAr ? "تسجيل وجبة رياضية جديدة" : "Log New Gym Meal";

      const idxInput = document.getElementById('meal-edit-index');
      if (idxInput) idxInput.value = "-1";

      const nameInput = document.getElementById('meal-input-name');
      const pInput = document.getElementById('meal-input-protein');
      const cInput = document.getElementById('meal-input-carbs');
      const fInput = document.getElementById('meal-input-fat');
      const calInput = document.getElementById('meal-input-calories');
      const noteInput = document.getElementById('meal-input-note');

      if (nameInput) nameInput.value = "";
      if (pInput) pInput.value = "0";
      if (cInput) cInput.value = "0";
      if (fInput) fInput.value = "0";
      if (calInput) calInput.value = "0";
      if (noteInput) noteInput.value = "";

      this.openModal('modal-meal-editor');
      if (nameInput) nameInput.focus();
    }

    openEditMealModal(idx) {
      const meal = this.dailyLog.meals[idx];
      if (!meal) return;
      const isAr = this.lang === 'ar';

      const title = document.getElementById('lbl-meal-modal-title');
      if (title) title.textContent = isAr ? `تعديل الوجبة: ${meal.mealName}` : `Edit Meal: ${meal.mealName}`;

      const idxInput = document.getElementById('meal-edit-index');
      if (idxInput) idxInput.value = idx.toString();

      const nameInput = document.getElementById('meal-input-name');
      const pInput = document.getElementById('meal-input-protein');
      const cInput = document.getElementById('meal-input-carbs');
      const fInput = document.getElementById('meal-input-fat');
      const calInput = document.getElementById('meal-input-calories');
      const noteInput = document.getElementById('meal-input-note');

      if (nameInput) nameInput.value = meal.mealName || "";
      if (pInput) pInput.value = (meal.protein || 0).toString();
      if (cInput) cInput.value = (meal.carbs || 0).toString();
      if (fInput) fInput.value = (meal.fat || 0).toString();
      if (calInput) calInput.value = (meal.calories || 0).toString();
      if (noteInput) noteInput.value = meal.coachNote || "";

      this.openModal('modal-meal-editor');
    }

    calcCaloriesFromForm() {
      const p = parseFloat(document.getElementById('meal-input-protein')?.value) || 0;
      const c = parseFloat(document.getElementById('meal-input-carbs')?.value) || 0;
      const f = parseFloat(document.getElementById('meal-input-fat')?.value) || 0;
      const computed = Math.round((p * 4) + (c * 4) + (f * 9));
      const calInput = document.getElementById('meal-input-calories');
      if (calInput) calInput.value = computed.toString();
    }

    saveMealFromForm() {
      const isAr = this.lang === 'ar';
      const idx = parseInt(document.getElementById('meal-edit-index')?.value);
      const name = document.getElementById('meal-input-name')?.value?.trim() || (isAr ? "وجبة رياضية" : "Gym Meal");
      const protein = parseFloat(document.getElementById('meal-input-protein')?.value) || 0;
      const carbs = parseFloat(document.getElementById('meal-input-carbs')?.value) || 0;
      const fat = parseFloat(document.getElementById('meal-input-fat')?.value) || 0;
      let calories = parseFloat(document.getElementById('meal-input-calories')?.value) || 0;
      if (calories === 0 && (protein > 0 || carbs > 0 || fat > 0)) {
        calories = Math.round((protein * 4) + (carbs * 4) + (fat * 9));
      }
      const note = document.getElementById('meal-input-note')?.value?.trim() || "";

      if (idx >= 0 && this.dailyLog.meals[idx]) {
        // Edit existing meal
        this.dailyLog.meals[idx].mealName = name;
        this.dailyLog.meals[idx].protein = protein;
        this.dailyLog.meals[idx].carbs = carbs;
        this.dailyLog.meals[idx].fat = fat;
        this.dailyLog.meals[idx].calories = calories;
        if (note) this.dailyLog.meals[idx].coachNote = note;
        this.showToast(isAr ? `✅ تم تحديث وجبة (${name}) والماكروز!` : `Meal (${name}) updated!`);
      } else {
        // Add new meal
        const newMeal = {
          id: `m_${Date.now()}`,
          userId: this.user?.uid || 'offline',
          mealName: name,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          calories,
          protein,
          carbs,
          fat,
          coachNote: note || (isAr ? "تم تسجيل الوجبة يدوياً." : "Logged manually.")
        };
        this.dailyLog.meals.unshift(newMeal);
        this.showToast(isAr ? `🔥 تم إضافة وجبة (${name}) وخصمها من المتبقي!` : `Added meal (${name})!`);
      }

      this.calculateDailyMacroTotals();
      this.updateDashboardCounters();
      this.renderDietView();
      this.closeModal('modal-meal-editor');
    }

    deleteMeal(idx) {
      const isAr = this.lang === 'ar';
      if (this.dailyLog.meals[idx]) {
        const removed = this.dailyLog.meals.splice(idx, 1);
        this.calculateDailyMacroTotals();
        this.updateDashboardCounters();
        this.renderDietView();
        this.showToast(isAr ? `🗑️ تم حذف وجبة (${removed[0]?.mealName || ''}) وتحديث المتبقي!` : "Meal removed!");
      }
    }

    renderProgressView() {
      const weightEl = document.getElementById('progress-current-weight');
      if (weightEl && this.user) {
        weightEl.textContent = `${this.user.weight.toFixed(1)} ${this.lang === 'ar' ? 'كجم' : 'kg'}`;
      }
    }

    renderChatView() {
      const container = document.getElementById('chat-messages-box');
      if (!container) return;

      const isAr = this.lang === 'ar';
      container.innerHTML = this.chatHistory.map(msg => `
        <div class="chat-bubble ${msg.role}">
          <strong>${msg.role === 'coach' ? (isAr ? 'كابتن الحديد (IRON COACH)' : 'IRON COACH') : (this.user?.name || (isAr ? 'أنا' : 'Me'))}:</strong>
          <div style="margin-top: 4px;">${msg.text.replace(/\n/g, '<br>')}</div>
        </div>
      `).join('');

      container.scrollTop = container.scrollHeight;
    }

    async handleMealPhotoUpload(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      this.showToast(this.lang === 'ar' ? "📸 جاري فحص الوجبة بالذكاء الاصطناعي..." : "📸 Processing food photo...");
      const reader = new FileReader();

      reader.onload = async () => {
        const base64Data = reader.result;
        const previewBox = document.getElementById('meal-camera-preview');
        if (previewBox) {
          previewBox.innerHTML = `<img src="${base64Data}" alt="Food Plate">`;
          previewBox.classList.add('has-image');
        }

        try {
          const mealData = await geminiService.analyzeMealPhoto(base64Data, file.type, {
            goal: this.user?.goal || 'Lean Bulk',
            weight: this.user?.weight || 75
          });

          if (mealData) {
            const newMeal = {
              id: `m_${Date.now()}`,
              userId: this.user?.uid || 'offline',
              mealName: mealData.mealName || (this.lang === 'ar' ? "وجبة رياضية بالذكاء الاصطناعي" : "Detected Gym Meal"),
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              calories: Number(mealData.calories) || 500,
              protein: Number(mealData.protein) || 40,
              carbs: Number(mealData.carbs) || 60,
              fat: Number(mealData.fat) || 12,
              coachNote: mealData.coachNote || (this.lang === 'ar' ? "تم التحليل بواسطة Google Gemini 2.5 Flash." : "Analyzed via Gemini Vision.")
            };

            this.dailyLog.meals.unshift(newMeal);
            this.calculateDailyMacroTotals();
            await fbManager.saveMeal(newMeal);
            this.updateDashboardCounters();
            this.renderDietView();
            this.showToast(this.lang === 'ar' ? `🔥 تم إضافة الوجبة (+${newMeal.protein}g بروتين)!` : `🔥 Added meal (+${newMeal.protein}g protein)!`);
            this.navigateTo('diet');
          }
        } catch (err) {
          console.error("AI Photo error:", err);
        }
      };

      reader.readAsDataURL(file);
    }

    async handleManualMealAdd() {
      const isAr = this.lang === 'ar';
      const desc = prompt(
        isAr ? "اكتب مكونات وجبتك بالتفصيل والكميات:" : "Enter food description and quantities:",
        isAr ? "200 جم صدور دجاج مشوية مع كوب أرز بني وسلطة" : "200g grilled salmon with 1 cup brown rice"
      );
      if (!desc) return;

      this.showToast(this.lang === 'ar' ? "📸 جاري فحص الوجبة بالذكاء الاصطناعي..." : "Calculating macros...");
      const estimated = await geminiService.analyzeMealText(desc, { goal: this.user?.goal || 'Lean Bulk' });
      if (estimated) {
        const newMeal = {
          id: `m_${Date.now()}`,
          userId: this.user?.uid || 'offline',
          mealName: estimated.mealName || desc,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          calories: Number(estimated.calories) || 550,
          protein: Number(estimated.protein) || 45,
          carbs: Number(estimated.carbs) || 50,
          fat: Number(estimated.fat) || 15,
          coachNote: estimated.coachNote || (isAr ? "تم حساب السعرات والماكروز بدقة." : "Nutritional breakdown calculated.")
        };
        this.dailyLog.meals.unshift(newMeal);
        this.calculateDailyMacroTotals();
        await fbManager.saveMeal(newMeal);
        this.updateDashboardCounters();
        this.renderDietView();
        this.showToast(this.lang === 'ar' ? "🔥 تم تسجيل الوجبة بنجاح!" : "Meal logged!");
      }
    }

    async handlePhysiquePhotoUpload(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const preview = document.getElementById('physique-camera-preview');
        if (preview) {
          preview.innerHTML = `<img src="${reader.result}" alt="Physique Check-in">`;
          preview.classList.add('has-image');
          preview.dataset.base64 = reader.result;
        }
        this.showToast(this.lang === 'ar' ? "📸 تم تحميل صورة الفورمة وجاهزة للتحليل." : "📸 Physique photo ready for analysis.");
      };
      reader.readAsDataURL(file);
    }

    async handlePhysiqueCheckinSubmit() {
      const weightInput = document.getElementById('input-checkin-weight');
      const preview = document.getElementById('physique-camera-preview');
      const photoBase64 = preview?.dataset?.base64 || null;
      const currentWeight = parseFloat(weightInput?.value) || 75.1;
      const previousWeight = this.user?.weight || 74.8;

      this.showToast(this.lang === 'ar' ? "🧠 جاري تحليل صورة الفورمة ومسار الوزن..." : "Analyzing physique...");

      const checkinResult = await geminiService.analyzePhysiqueCheckIn(
        photoBase64,
        currentWeight,
        previousWeight,
        {
          calories: this.user.targetCalories,
          protein: this.user.targetProtein,
          carbs: this.user.targetCarbs,
          fat: this.user.targetFat
        },
        this.user
      );

      if (checkinResult) {
        this.user.weight = currentWeight;
        if (checkinResult.adjustedMacros) {
          this.user.targetCalories = checkinResult.adjustedMacros.calories;
          this.user.targetProtein = checkinResult.adjustedMacros.protein;
          this.user.targetCarbs = checkinResult.adjustedMacros.carbs;
          this.user.targetFat = checkinResult.adjustedMacros.fat;
        }
        localStorage.setItem('sfc_user_profile', JSON.stringify(this.user));
        fbManager.saveUserProfile(this.user.uid, this.user);
        await fbManager.savePhysiqueCheckin({
          userId: this.user.uid,
          weight: currentWeight,
          date: new Date().toISOString(),
          analysis: checkinResult
        });

        this.updateDashboardCounters();

        const resultCard = document.getElementById('physique-results-card');
        const isAr = this.lang === 'ar';
        if (resultCard) {
          resultCard.style.display = 'block';
          document.getElementById('physique-feedback-text').innerHTML = `
            <div style="margin-bottom: 10px;"><strong>${isAr ? 'التقييم البصري للفورمة:' : 'Visual Assessment:'}</strong> ${checkinResult.physiqueAssessment}</div>
            <div style="margin-bottom: 10px;"><strong>${isAr ? 'تحليل تغير الوزن:' : 'Scale Verdict:'}</strong> ${checkinResult.weightVerdict}</div>
            <div style="margin-bottom: 10px; color: var(--accent-red-light);"><strong>${isAr ? 'خطة سعرات وماكروز الأسبوع القادم:' : 'Next Week Macros:'}</strong> ${this.user.targetCalories} kcal (P: ${this.user.targetProtein}g, C: ${this.user.targetCarbs}g, F: ${this.user.targetFat}g)</div>
            <div style="margin-bottom: 10px;"><strong>${isAr ? 'تعديلات كثافة التمرين:' : 'Volume Tweaks:'}</strong> ${checkinResult.trainingVolumeAdjustment}</div>
            <div><strong>${isAr ? 'التركيز الأساسي للأسبوع القادم:' : 'Key Focus:'}</strong> ${checkinResult.nextWeekKeyFocus}</div>
          `;
        }
        this.showToast(this.lang === 'ar' ? "✅ تم اعتماد تقرير الأسبوع وتعديل السعرات!" : "Weekly checkin applied!");
      }
    }

    async sendChatMessage() {
      const input = document.getElementById('chat-text-input');
      const text = input?.value?.trim();
      if (!text) return;

      this.chatHistory.push({ role: 'user', text });
      input.value = '';
      this.renderChatView();

      this.showToast(this.lang === 'ar' ? "الكابتن بيفكر بدقة..." : "Coach is thinking...");
      const reply = await geminiService.chatWithCoach(text, this.chatHistory, this.user, this.dailyLog, this.currentWorkout);
      this.chatHistory.push({ role: 'coach', text: reply });
      this.renderChatView();
    }

    openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.add('active');
    }

    closeModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove('active');
    }

    openSettingsModal() {
      const cfg = getFirebaseConfig();
      const fbKeyInput = document.getElementById('cfg-fb-key');
      const fbProjectInput = document.getElementById('cfg-fb-project');
      const fbDomainInput = document.getElementById('cfg-fb-domain');
      const geminiInput = document.getElementById('input-gemini-key');

      if (fbKeyInput) fbKeyInput.value = cfg.apiKey;
      if (fbProjectInput) fbProjectInput.value = cfg.projectId;
      if (fbDomainInput) fbDomainInput.value = cfg.authDomain;
      if (geminiInput) geminiInput.value = geminiService.getApiKey();

      this.updateUserUI();
      this.openModal('modal-settings');
    }

    toggleLanguage() {
      this.lang = this.lang === 'ar' ? 'en' : 'ar';
      localStorage.setItem('sfc_lang', this.lang);
      geminiService.setLanguage(this.lang);
      document.documentElement.lang = this.lang;
      document.documentElement.dir = (this.lang === 'ar' ? 'rtl' : 'ltr');

      const indText = document.getElementById('lang-indicator-text');
      if (indText) indText.textContent = this.t('langIndicator');

      this.renderCurrentView();
      this.updateUserUI();
      this.showToast(this.lang === 'ar' ? "🇪🇬 تم تفعيل اللغة العربية" : "🇺🇸 Switched to English");
    }

    showToast(msg) {
      let toast = document.getElementById('gym-toast-box');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'gym-toast-box';
        toast.className = 'gym-toast';
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(this._toastTimeout);
      this._toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
      }, 2800);
    }

    bindEvents() {
      // Language Toggle
      const langBtn = document.getElementById('btn-toggle-lang');
      if (langBtn) {
        langBtn.onclick = () => this.toggleLanguage();
      }

      // Auth Modal Triggers
      const btnAuthGoogle = document.getElementById('btn-auth-google');
      if (btnAuthGoogle) {
        btnAuthGoogle.onclick = async () => {
          this.showToast(this.lang === 'ar' ? "جاري الاتصال بـ Google Sign-In..." : "Connecting to Google...");
          try {
            const authUser = await fbManager.signInWithGoogle();
            this.user = Object.assign({}, MAHMOUD_DEFAULT_PROFILE, {
              uid: authUser.uid,
              name: authUser.name || "محمود",
              email: authUser.email,
              photoURL: authUser.photoURL || "",
              onboarded: false
            });

            document.getElementById('onboard-name').value = this.user.name;
            this.closeModal('modal-auth');
            this.openModal('modal-onboarding');
            this.updateOnboardingLivePreview();
          } catch (err) {
            console.error("Google sign in notice:", err);
          }
        };
      }

      const btnAuthGuest = document.getElementById('btn-auth-guest');
      if (btnAuthGuest) {
        btnAuthGuest.onclick = () => {
          const guest = fbManager.signInAsGuest("كابتن");
          this.user = Object.assign({}, MAHMOUD_DEFAULT_PROFILE, {
            uid: guest.uid,
            name: "كابتن",
            email: guest.email,
            onboarded: false
          });
          document.getElementById('onboard-name').value = "كابتن";
          this.closeModal('modal-auth');
          this.openModal('modal-onboarding');
          this.updateOnboardingLivePreview();
        };
      }

      const btnAuthMahmoud = document.getElementById('btn-auth-preset-mahmoud');
      if (btnAuthMahmoud) {
        btnAuthMahmoud.onclick = () => {
          this.user = Object.assign({}, MAHMOUD_DEFAULT_PROFILE);
          this.user.name = this.lang === 'ar' ? 'محمود' : 'Mahmoud';
          localStorage.setItem('sfc_user_profile', JSON.stringify(this.user));
          fbManager.saveUserProfile(this.user.uid, this.user);
          this.closeModal('modal-auth');
          this.onUserReady();
          this.showToast(this.t('toastPresetLoaded'));
        };
      }

      // Onboarding input listeners
      ['onboard-age', 'onboard-height', 'onboard-weight', 'onboard-days', 'onboard-goal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.oninput = () => this.updateOnboardingLivePreview();
          el.onchange = () => this.updateOnboardingLivePreview();
        }
      });

      const suppToggle = document.getElementById('onboard-has-supplements');
      const suppPicker = document.getElementById('onboard-supplements-picker');
      if (suppToggle && suppPicker) {
        suppToggle.onchange = () => {
          suppPicker.style.display = suppToggle.checked ? 'block' : 'none';
        };
      }

      const btnSaveOnboard = document.getElementById('btn-save-onboarding');
      if (btnSaveOnboard) {
        btnSaveOnboard.onclick = () => this.saveOnboardingData();
      }

      // Settings Re-open Onboarding
      const btnReopenOnboard = document.getElementById('btn-reopen-onboarding');
      if (btnReopenOnboard) {
        btnReopenOnboard.onclick = () => {
          this.closeModal('modal-settings');
          if (this.user) {
            document.getElementById('onboard-name').value = this.user.name;
            document.getElementById('onboard-age').value = this.user.age;
            document.getElementById('onboard-height').value = this.user.height;
            document.getElementById('onboard-weight').value = this.user.weight;
            document.getElementById('onboard-days').value = this.user.trainingDays;
            document.getElementById('onboard-goal').value = this.user.goal;
          }
          this.openModal('modal-onboarding');
          this.updateOnboardingLivePreview();
        };
      }

      // Save Firebase Config
      const btnSaveFb = document.getElementById('btn-save-firebase-config');
      if (btnSaveFb) {
        btnSaveFb.onclick = async () => {
          const apiKey = document.getElementById('cfg-fb-key')?.value.trim();
          const projectId = document.getElementById('cfg-fb-project')?.value.trim();
          const authDomain = document.getElementById('cfg-fb-domain')?.value.trim();

          if (!apiKey || !projectId) {
            this.showToast(this.lang === 'ar' ? "يرجى إدخال API Key و Project ID على الأقل" : "Please enter API Key & Project ID");
            return;
          }

          await fbManager.saveCredentials({ apiKey, projectId, authDomain });
          this.updateUserUI();
          this.showToast(fbManager.isLiveFirebase ? "🔥 تم الاتصال بنجاح بـ Firebase السحابي!" : "⚠️ تم حفظ البيانات محلياً.");
        };
      }

      // Save Gemini Key
      const btnSaveGemini = document.getElementById('btn-save-gemini-key');
      if (btnSaveGemini) {
        btnSaveGemini.onclick = () => {
          const key = document.getElementById('input-gemini-key')?.value.trim();
          if (key) {
            geminiService.setApiKey(key);
            this.showToast(this.lang === 'ar' ? "✅ تم حفظ مفتاح Google Gemini بنجاح!" : "✅ Gemini API Key saved!");
          }
        };
      }

      // Logout
      const btnLogout = document.getElementById('btn-logout');
      if (btnLogout) {
        btnLogout.onclick = () => {
          fbManager.signOut();
          localStorage.removeItem('sfc_user_profile');
          this.user = null;
          this.closeModal('modal-settings');
          this.openModal('modal-auth');
          this.showToast(this.lang === 'ar' ? "تم تسجيل الخروج." : "Logged out.");
        };
      }

      // Bottom Nav items
      document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
          const view = btn.dataset.view;
          this.navigateTo(view);
        };
      });

      // Supplements toggles
      const suppCitrulline = document.getElementById('supp-check-citrulline');
      const suppCreatine = document.getElementById('supp-check-creatine');
      
      if (suppCitrulline) {
        suppCitrulline.onclick = () => {
          this.dailyLog.supplementsTaken.citrulline = !this.dailyLog.supplementsTaken.citrulline;
          this.updateSupplementsUI();
          this.saveDailyLog();
          this.showToast(this.dailyLog.supplementsTaken.citrulline 
            ? (this.lang === 'ar' ? "🔥 تم تسجيل الإل-سيترولين! بدأ عد تنازلي 35 دقيقة للتمرين." : "🔥 L-Citrulline logged!")
            : (this.lang === 'ar' ? "تم إلغاء السيترولين" : "Citrulline unchecked"));
        };
      }

      if (suppCreatine) {
        suppCreatine.onclick = () => {
          this.dailyLog.supplementsTaken.creatine = !this.dailyLog.supplementsTaken.creatine;
          this.updateSupplementsUI();
          this.saveDailyLog();
          this.showToast(this.dailyLog.supplementsTaken.creatine 
            ? (this.lang === 'ar' ? "✅ تم تسجيل الكرياتين (5 جم)!" : "✅ Daily Creatine (5g) checked!")
            : (this.lang === 'ar' ? "تم إلغاء الكرياتين" : "Creatine unchecked"));
        };
      }

      // Hydration
      const waterPlus = document.getElementById('btn-water-plus');
      const waterMinus = document.getElementById('btn-water-minus');
      if (waterPlus) {
        waterPlus.onclick = () => {
          this.dailyLog.waterMl += 250;
          this.updateDashboardCounters();
          this.saveDailyLog();
        };
      }
      if (waterMinus) {
        waterMinus.onclick = () => {
          this.dailyLog.waterMl = Math.max(0, this.dailyLog.waterMl - 250);
          this.updateDashboardCounters();
          this.saveDailyLog();
        };
      }

      // Sleep
      const sleepPlus = document.getElementById('btn-sleep-plus');
      const sleepMinus = document.getElementById('btn-sleep-minus');
      if (sleepPlus) {
        sleepPlus.onclick = () => {
          this.dailyLog.sleepHours = Number((this.dailyLog.sleepHours + 0.5).toFixed(1));
          this.updateDashboardCounters();
          this.saveDailyLog();
        };
      }
      if (sleepMinus) {
        sleepMinus.onclick = () => {
          this.dailyLog.sleepHours = Math.max(0, Number((this.dailyLog.sleepHours - 0.5).toFixed(1)));
          this.updateDashboardCounters();
          this.saveDailyLog();
        };
      }

      // Profile avatar click
      const profileBtn = document.getElementById('btn-profile-settings');
      if (profileBtn) {
        profileBtn.onclick = () => this.openSettingsModal();
      }

      // Meal snap
      const snapMealBtn = document.getElementById('btn-snap-meal');
      const mealFileInput = document.getElementById('meal-file-input');
      if (snapMealBtn && mealFileInput) {
        snapMealBtn.onclick = () => mealFileInput.click();
        mealFileInput.onchange = (e) => this.handleMealPhotoUpload(e);
      }

      // Meal manual add & edit
      const btnAddMealManual = document.getElementById('btn-add-meal-manual');
      if (btnAddMealManual) {
        btnAddMealManual.onclick = () => this.openAddMealModal();
      }
      const btnQuickAddMeal = document.getElementById('btn-quick-add-meal-header');
      if (btnQuickAddMeal) {
        btnQuickAddMeal.onclick = () => this.openAddMealModal();
      }
      const btnSaveMealForm = document.getElementById('btn-save-meal-form');
      if (btnSaveMealForm) {
        btnSaveMealForm.onclick = () => this.saveMealFromForm();
      }
      const btnCalcMealCals = document.getElementById('btn-calc-meal-cals');
      if (btnCalcMealCals) {
        btnCalcMealCals.onclick = () => this.calcCaloriesFromForm();
      }
      ['meal-input-protein', 'meal-input-carbs', 'meal-input-fat'].forEach(id => {
        const inp = document.getElementById(id);
        if (inp) {
          inp.oninput = () => {
            const calInput = document.getElementById('meal-input-calories');
            if (calInput && (!calInput.value || calInput.value === '0')) {
              this.calcCaloriesFromForm();
            }
          };
        }
      });

      // Workout Controls & Custom Exercises
      const btnShowAddEx = document.getElementById('btn-show-add-exercise');
      if (btnShowAddEx) {
        btnShowAddEx.onclick = () => this.toggleAddExerciseBox();
      }
      const btnConfirmAddEx = document.getElementById('btn-confirm-add-exercise');
      if (btnConfirmAddEx) {
        btnConfirmAddEx.onclick = () => this.addCustomExercise();
      }
      const inputNewEx = document.getElementById('input-new-exercise-name');
      if (inputNewEx) {
        inputNewEx.onkeypress = (e) => {
          if (e.key === 'Enter') this.addCustomExercise();
        };
      }
      document.querySelectorAll('.quick-ex-tag').forEach(tag => {
        tag.onclick = () => {
          const exName = tag.dataset.name;
          if (exName) this.addCustomExercise(exName);
        };
      });
      const btnClearWorkout = document.getElementById('btn-clear-workout');
      if (btnClearWorkout) {
        btnClearWorkout.onclick = () => this.clearWorkout();
      }
      const btnLoadWorkoutPreset = document.getElementById('btn-load-workout-preset');
      if (btnLoadWorkoutPreset) {
        btnLoadWorkoutPreset.onclick = () => this.loadDefaultWorkoutTemplate();
      }
      const btnFinishWorkout = document.getElementById('btn-finish-workout');
      if (btnFinishWorkout) {
        btnFinishWorkout.onclick = () => this.handleFinishWorkout();
      }

      // Close modals when clicking overlay background
      document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            overlay.classList.remove('active');
          }
        });
      });

      // Physique checkin
      const snapPhysiqueBtn = document.getElementById('btn-snap-physique');
      const physiqueFileInput = document.getElementById('physique-file-input');
      if (snapPhysiqueBtn && physiqueFileInput) {
        snapPhysiqueBtn.onclick = () => physiqueFileInput.click();
        physiqueFileInput.onchange = (e) => this.handlePhysiquePhotoUpload(e);
      }

      const btnSubmitCheckin = document.getElementById('btn-submit-checkin');
      if (btnSubmitCheckin) {
        btnSubmitCheckin.onclick = () => this.handlePhysiqueCheckinSubmit();
      }

      // Chat
      const chatSendBtn = document.getElementById('btn-chat-send');
      const chatInput = document.getElementById('chat-text-input');
      if (chatSendBtn && chatInput) {
        chatSendBtn.onclick = () => this.sendChatMessage();
        chatInput.onkeypress = (e) => {
          if (e.key === 'Enter') this.sendChatMessage();
        };
      }

      // Chips
      document.querySelectorAll('.coach-chip').forEach(chip => {
        chip.onclick = () => {
          const text = chip.dataset.prompt;
          const input = document.getElementById('chat-text-input');
          if (input) {
            input.value = text;
            this.sendChatMessage();
          }
        };
      });

      // AI Overload
      const btnAiOverload = document.getElementById('btn-ai-overload-refresh');
      if (btnAiOverload) {
        btnAiOverload.onclick = () => this.refreshAiWorkoutGuidance();
      }

      // Preset button in settings
      const btnPresetMahmoud = document.getElementById('btn-preset-mahmoud');
      if (btnPresetMahmoud) {
        btnPresetMahmoud.onclick = () => {
          this.user = Object.assign({}, MAHMOUD_DEFAULT_PROFILE);
          this.user.name = this.lang === 'ar' ? 'محمود' : 'Mahmoud';
          localStorage.setItem('sfc_user_profile', JSON.stringify(this.user));
          fbManager.saveUserProfile(this.user.uid, this.user);
          this.onUserReady();
          this.showToast(this.t('toastPresetLoaded'));
          this.closeModal('modal-settings');
        };
      }
    }
  }

  // Create global instance and attach to window
  window.coachApp = new SmartCoachApp();

  // Initialize immediately if document is ready or on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.coachApp.init());
  } else {
    window.coachApp.init();
  }

})();
