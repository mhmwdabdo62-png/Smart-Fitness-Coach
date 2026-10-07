/**
 * Smart-Fitness-Coach - Core Application & State Architecture
 * Supports Google Firebase (Auth, Firestore, Storage) with live cloud sync,
 * Dynamic Real-Time Onboarding Intake Form, Mifflin-St Jeor Macro Engine,
 * Arabic/English Localization, and Gemini AI Interactions.
 */

import { geminiService } from './gemini.js';
import { fbManager, localDB, COLLECTIONS, getFirebaseConfig } from './firebase-config.js';

// Default / Benchmark Test Profile for Mahmoud
export const MAHMOUD_TEST_PROFILE = {
  uid: "test_mahmoud_22",
  name: "محمود",
  nameEn: "Mahmoud",
  age: 22,
  gender: "male",
  height: 178, // cm
  weight: 75.0, // kg
  trainingDays: 5,
  goal: "Lean Bulk",
  hasSupplements: true,
  supplements: ["Creatine", "Citrulline"],
  targetCalories: 3100,
  targetProtein: 165, // 2.2g / kg (ISSN Gold Standard)
  targetCarbs: 432,   // Remainder glycogen fuel
  targetFat: 79,      // 23% hormonal baseline
  targetWaterMl: 3675,
  targetSleepHours: 8.0,
  onboarded: true
};

export const I18N = {
  ar: {
    langIndicator: "عربي 🇪🇬",
    headerGoal: "تضخيم نظيف",
    avatarFallback: "م",
    navHome: "الرئيسية",
    navWorkout: "التمارين",
    navDiet: "الدايت",
    navProgress: "التطور",
    navCoach: "المدرب الذكي",
    trainingDay: "يوم تمرين 4 من 5",
    greetingPrefix: "عاش يا بطل، ",
    goalSubtag: "بناء عضلي",
    calUnit: "سعرة",
    toastWorkoutSaved: "🏆 تم حفظ جلسة التمرين في Firestore بنجاح!",
    toastPresetLoaded: "⚡ تم تفعيل بروفايل محمود (22 سنة - تضخيم نظيف) بنجاح!",
    toastSettingsSaved: "✅ تم تحديث بياناتك والسعرات المستهدفة!",
    toastAnalyzingMeal: "📸 جاري فحص الوجبة بالذكاء الاصطناعي...",
    toastMealAdded: "🔥 تم إضافة الوجبة وحساب الماكروز!",
    toastAnalyzingOverload: "🤖 جاري تحليل أوزان الأسبوع الماضي مع Gemini...",
    toastOverloadDone: "✅ تم تحديث أوزان وتكرارات الزيادة التدريجية!",
    toastAnalyzingPhysique: "🧠 جاري تحليل صورة الفورمة ومسار الوزن...",
    toastPhysiqueDone: "✅ تم اعتماد تقرير الأسبوع وتعديل السعرات!"
  },
  en: {
    langIndicator: "English 🇺🇸",
    headerGoal: "LEAN BULK",
    avatarFallback: "M",
    navHome: "Home",
    navWorkout: "Workout",
    navDiet: "Diet",
    navProgress: "Progress",
    navCoach: "AI Coach",
    trainingDay: "TRAINING DAY 4 OF 5",
    greetingPrefix: "LET'S GROW, ",
    goalSubtag: "HYPERTROPHY",
    calUnit: "kcal",
    toastWorkoutSaved: "🏆 Workout Session Saved to Firestore!",
    toastPresetLoaded: "⚡ Loaded Mahmoud's 22yo Lean Bulk Preset!",
    toastSettingsSaved: "✅ Profile & Caloric Targets Updated!",
    toastAnalyzingMeal: "📸 Processing food photo with Gemini Vision...",
    toastMealAdded: "🔥 Meal added & macros deducted!",
    toastAnalyzingOverload: "🤖 Analyzing last week's logs with Gemini...",
    toastOverloadDone: "✅ Progressive Overload synced for current session!",
    toastAnalyzingPhysique: "🧠 Gemini Vision analyzing physique leanness & scale trajectory...",
    toastPhysiqueDone: "✅ Weekly Check-in finalized & new macro plan applied!"
  }
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
    const dict = I18N[this.lang] || I18N.ar;
    return dict[key] || key;
  }

  async init() {
    console.log("⚡ Initializing Smart-Fitness-Coach App...");
    geminiService.setLanguage(this.lang);
    await fbManager.initialize();

    // Check if user has an existing saved profile
    const stored = localStorage.getItem('sfc_user_profile');
    if (stored) {
      try {
        this.user = JSON.parse(stored);
      } catch (e) {
        this.user = null;
      }
    }

    // Check Authentication & Onboarding status
    if (!this.user || !this.user.onboarded) {
      this.user = { ...MAHMOUD_TEST_PROFILE };
      this.user.name = this.lang === 'ar' ? 'محمود' : 'Mahmoud';
      localStorage.setItem('sfc_user_profile', JSON.stringify(this.user));
    }

    // Load daily log - fresh day starts at 0 consumed macros!
    const savedLog = localStorage.getItem(`sfc_log_${this.dailyLog.date}`);
    if (savedLog) {
      try {
        this.dailyLog = { ...this.dailyLog, ...JSON.parse(savedLog) };
      } catch (e) {}
    } else {
      this.dailyLog.meals = [];
      this.calculateDailyMacroTotals();
    }

    this.initDefaultWorkoutSession();
    this.bindEvents();
    this.onUserReady();

    // PWA Service Worker
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
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
        coachNote: isAr 
          ? "وجبة إفطار عالية الكارب والبروتين لبدء تخليق البروتين العضلي وتعبئة الجليكوجين."
          : "High carb & fast leucine kick for protein synthesis initiation."
      },
      {
        id: "m_2",
        mealName: isAr ? "زبادي يوناني مع عسل وتوت بري" : "Greek Yogurt, Honey & Blueberries",
        time: "11:45 AM",
        calories: 320,
        protein: 26,
        carbs: 45,
        fat: 4,
        coachNote: isAr
          ? "كازين بطيء الامتصاص للحفاظ على توازن النيتروجين الإيجابي."
          : "Slow digesting micellar casein for nitrogen balance."
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

    // Header greeting
    const userNameEl = document.getElementById('header-user-name');
    if (userNameEl) userNameEl.textContent = this.user.name;

    // Header Goal Badge
    const badgeGoal = document.getElementById('badge-header-goal');
    if (badgeGoal) badgeGoal.textContent = this.user.goal;

    // Header Avatar
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

    // User summary text in greeting card
    const summaryEl = document.getElementById('lbl-user-summary');
    if (summaryEl) {
      const isAr = this.lang === 'ar';
      summaryEl.textContent = isAr 
        ? `${this.user.age} سنة • ${this.user.height} سم • ${this.user.weight.toFixed(1)} كجم • ${this.user.trainingDays} أيام تمرين • هدف: ${this.user.goal}.`
        : `${this.user.age} yrs • ${this.user.height} cm • ${this.user.weight.toFixed(1)} kg • ${this.user.trainingDays} days/wk • Goal: ${this.user.goal}.`;
    }

    // Update settings modal user card
    const setDisplay = document.getElementById('settings-user-display');
    const setEmail = document.getElementById('settings-user-email');
    if (setDisplay) setDisplay.textContent = this.user.name;
    if (setEmail) setEmail.textContent = this.user.email || 'offline_user@gym.app';

    // Update Firebase connection status badge in settings
    const fbBadge = document.getElementById('badge-firebase-status');
    if (fbBadge) {
      if (fbManager.isLiveFirebase) {
        fbBadge.textContent = "🟢 متصل بـ Firebase السحابي";
        fbBadge.className = "badge badge-green";
      } else {
        fbBadge.textContent = "🟡 وضع أوفلاين محلي (Local)";
        fbBadge.className = "badge badge-gold";
      }
    }

    // Supplement visibility
    const suppCreatineBox = document.getElementById('supp-box-creatine');
    const suppCitrullineBox = document.getElementById('supp-box-citrulline');
    const hasCreatine = this.user.supplements?.includes('Creatine');
    const hasCitrulline = this.user.supplements?.includes('Citrulline');

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
          text: `أهلاً بيك في صالة الحديد يا ${name}!\nالبيانات: ${this.user.age} سنة، طولك ${this.user.height} سم، وزنك ${this.user.weight} كجم، تمرين ${this.user.trainingDays} أيام في الأسبوع.\nهدفك: ${this.user.goal} بسعرات مستهدفة ${this.user.targetCalories} سعرة.\nمتنساش: خد جرعة الإل-سيترولين قبل تمرينك بـ 35 دقيقة لأقصى بمب وتدفق دم!`
        }
      ];
    } else {
      this.chatHistory = [
        {
          role: "coach",
          text: `Welcome to the iron sanctuary, ${name}!\nStats: ${this.user.age}yo, ${this.user.height}cm, ${this.user.weight}kg, ${this.user.trainingDays} days/wk split.\nGoal: ${this.user.goal} targeting ${this.user.targetCalories} kcal.\nDon't forget: take your L-Citrulline 35 minutes before training for maximal vasodilation!`
        }
      ];
    }
  }

  // ==========================================
  // NUTRITION & MACRO ENGINE (Mifflin-St Jeor)
  // ==========================================
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

    if (goal === 'Lean Bulk' || goal === 'تضخيم نظيف') {
      surplus = 288; // ~+10% lean surplus for muscle protein synthesis without adiposity
      targetCalories = tdee + surplus;
      proteinFactor = 2.2; // ISSN optimal for hypertrophy
      fatPct = 0.23;
    } else if (goal === 'Heavy Bulk') {
      surplus = 500;
      targetCalories = tdee + surplus;
      proteinFactor = 2.0;
      fatPct = 0.25;
    } else if (goal === 'Cutting' || goal === 'تنشيف') {
      surplus = -500; // Deficit for fat loss
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

  // ==========================================
  // ONBOARDING FORM LIVE PREVIEW
  // ==========================================
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

    // Save to LocalStorage & Firestore
    localStorage.setItem('sfc_user_profile', JSON.stringify(this.user));
    fbManager.saveUserProfile(this.user.uid, this.user);

    this.closeModal('modal-onboarding');
    this.closeModal('modal-auth');
    this.onUserReady();
    this.showToast(this.lang === 'ar' ? "🔥 تم إعداد خطتك الرياضية بنجاح! جاهز للتمرين." : "🔥 Profile setup complete! Ready to lift.");
  }

  // ==========================================
  // EVENT BINDINGS
  // ==========================================
  bindEvents() {
    // 1. Language Toggle
    const langBtn = document.getElementById('btn-toggle-lang');
    if (langBtn) {
      langBtn.addEventListener('click', () => this.toggleLanguage());
    }

    // 2. Auth Modal Triggers
    const btnAuthGoogle = document.getElementById('btn-auth-google');
    if (btnAuthGoogle) {
      btnAuthGoogle.addEventListener('click', async () => {
        this.showToast(this.lang === 'ar' ? "جاري الاتصال بـ Google Sign-In..." : "Connecting to Google...");
        try {
          const authUser = await fbManager.signInWithGoogle();
          this.user = {
            ...MAHMOUD_TEST_PROFILE,
            uid: authUser.uid,
            name: authUser.name || "محمود",
            email: authUser.email,
            photoURL: authUser.photoURL || "",
            onboarded: false // Trigger onboarding form to review their stats
          };

          // Fill into onboarding form
          document.getElementById('onboard-name').value = this.user.name;
          this.closeModal('modal-auth');
          this.openModal('modal-onboarding');
          this.updateOnboardingLivePreview();
        } catch (err) {
          console.error("Google sign in failed:", err);
          this.showToast("Google Sign-In demo mode activated.");
        }
      });
    }

    const btnAuthGuest = document.getElementById('btn-auth-guest');
    if (btnAuthGuest) {
      btnAuthGuest.addEventListener('click', () => {
        const guest = fbManager.signInAsGuest("كابتن");
        this.user = {
          ...MAHMOUD_TEST_PROFILE,
          uid: guest.uid,
          name: "كابتن",
          email: guest.email,
          onboarded: false
        };
        document.getElementById('onboard-name').value = "كابتن";
        this.closeModal('modal-auth');
        this.openModal('modal-onboarding');
        this.updateOnboardingLivePreview();
      });
    }

    const btnAuthMahmoud = document.getElementById('btn-auth-preset-mahmoud');
    if (btnAuthMahmoud) {
      btnAuthMahmoud.addEventListener('click', () => {
        this.user = { ...MAHMOUD_TEST_PROFILE };
        this.user.name = this.lang === 'ar' ? 'محمود' : 'Mahmoud';
        localStorage.setItem('sfc_user_profile', JSON.stringify(this.user));
        fbManager.saveUserProfile(this.user.uid, this.user);
        this.closeModal('modal-auth');
        this.onUserReady();
        this.showToast(this.t('toastPresetLoaded'));
      });
    }

    // 3. Onboarding Live Listeners
    ['onboard-age', 'onboard-height', 'onboard-weight', 'onboard-days', 'onboard-goal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateOnboardingLivePreview());
        el.addEventListener('change', () => this.updateOnboardingLivePreview());
      }
    });

    const suppToggle = document.getElementById('onboard-has-supplements');
    const suppPicker = document.getElementById('onboard-supplements-picker');
    if (suppToggle && suppPicker) {
      suppToggle.addEventListener('change', () => {
        suppPicker.style.display = suppToggle.checked ? 'block' : 'none';
      });
    }

    const btnSaveOnboard = document.getElementById('btn-save-onboarding');
    if (btnSaveOnboard) {
      btnSaveOnboard.addEventListener('click', () => this.saveOnboardingData());
    }

    // 4. Settings Re-open Onboarding
    const btnReopenOnboard = document.getElementById('btn-reopen-onboarding');
    if (btnReopenOnboard) {
      btnReopenOnboard.addEventListener('click', () => {
        this.closeModal('modal-settings');
        // Pre-fill with current stats
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
      });
    }

    // 5. Firebase Credentials Save Button
    const btnSaveFb = document.getElementById('btn-save-firebase-config');
    if (btnSaveFb) {
      btnSaveFb.addEventListener('click', async () => {
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
      });
    }

    // 6. Gemini Key Save
    const btnSaveGemini = document.getElementById('btn-save-gemini-key');
    if (btnSaveGemini) {
      btnSaveGemini.addEventListener('click', () => {
        const key = document.getElementById('input-gemini-key')?.value.trim();
        if (key) {
          geminiService.setApiKey(key);
          this.showToast(this.lang === 'ar' ? "✅ تم حفظ مفتاح Google Gemini بنجاح!" : "✅ Gemini API Key saved!");
        }
      });
    }

    // 7. Logout Button
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        fbManager.signOut();
        localStorage.removeItem('sfc_user_profile');
        this.user = null;
        this.closeModal('modal-settings');
        this.openModal('modal-auth');
        this.showToast(this.lang === 'ar' ? "تم تسجيل الخروج." : "Logged out.");
      });
    }

    // 8. Bottom Nav Tabs
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        this.navigateTo(view);
      });
    });

    // 9. Supplement Checkboxes
    const suppCitrulline = document.getElementById('supp-check-citrulline');
    const suppCreatine = document.getElementById('supp-check-creatine');
    
    if (suppCitrulline) {
      suppCitrulline.addEventListener('click', () => {
        this.dailyLog.supplementsTaken.citrulline = !this.dailyLog.supplementsTaken.citrulline;
        this.updateSupplementsUI();
        this.saveDailyLog();
        this.showToast(this.dailyLog.supplementsTaken.citrulline 
          ? (this.lang === 'ar' ? "🔥 تم تسجيل الإل-سيترولين! بدأ عد تنازلي 35 دقيقة للتمرين." : "🔥 L-Citrulline logged! 35m countdown active.")
          : (this.lang === 'ar' ? "تم إلغاء السيترولين" : "Citrulline unchecked"));
      });
    }

    if (suppCreatine) {
      suppCreatine.addEventListener('click', () => {
        this.dailyLog.supplementsTaken.creatine = !this.dailyLog.supplementsTaken.creatine;
        this.updateSupplementsUI();
        this.saveDailyLog();
        this.showToast(this.dailyLog.supplementsTaken.creatine 
          ? (this.lang === 'ar' ? "✅ تم تسجيل الكرياتين (5 جم)! الخلايا العضلية في أقصى تشبع." : "✅ Daily Creatine (5g) checked! Intramuscular stores saturated.")
          : (this.lang === 'ar' ? "تم إلغاء الكرياتين" : "Creatine unchecked"));
      });
    }

    // 10. Hydration buttons
    const waterPlus = document.getElementById('btn-water-plus');
    const waterMinus = document.getElementById('btn-water-minus');
    if (waterPlus) {
      waterPlus.addEventListener('click', () => {
        this.dailyLog.waterMl += 250;
        this.updateDashboardCounters();
        this.saveDailyLog();
      });
    }
    if (waterMinus) {
      waterMinus.addEventListener('click', () => {
        this.dailyLog.waterMl = Math.max(0, this.dailyLog.waterMl - 250);
        this.updateDashboardCounters();
        this.saveDailyLog();
      });
    }

    // 11. Sleep buttons
    const sleepPlus = document.getElementById('btn-sleep-plus');
    const sleepMinus = document.getElementById('btn-sleep-minus');
    if (sleepPlus) {
      sleepPlus.addEventListener('click', () => {
        this.dailyLog.sleepHours = Number((this.dailyLog.sleepHours + 0.5).toFixed(1));
        this.updateDashboardCounters();
        this.saveDailyLog();
      });
    }
    if (sleepMinus) {
      sleepMinus.addEventListener('click', () => {
        this.dailyLog.sleepHours = Math.max(0, Number((this.dailyLog.sleepHours - 0.5).toFixed(1)));
        this.updateDashboardCounters();
        this.saveDailyLog();
      });
    }

    // 12. Profile settings trigger in header
    const profileBtn = document.getElementById('btn-profile-settings');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => this.openSettingsModal());
    }

    // 13. Meal add & edit
    const snapMealBtn = document.getElementById('btn-snap-meal');
    const mealFileInput = document.getElementById('meal-file-input');
    if (snapMealBtn && mealFileInput) {
      snapMealBtn.addEventListener('click', () => mealFileInput.click());
      mealFileInput.addEventListener('change', (e) => this.handleMealPhotoUpload(e));
    }

    const btnAddMealManual = document.getElementById('btn-add-meal-manual');
    if (btnAddMealManual) {
      btnAddMealManual.addEventListener('click', () => this.openAddMealModal());
    }
    const btnQuickAddMeal = document.getElementById('btn-quick-add-meal-header');
    if (btnQuickAddMeal) {
      btnQuickAddMeal.addEventListener('click', () => this.openAddMealModal());
    }
    const btnSaveMealForm = document.getElementById('btn-save-meal-form');
    if (btnSaveMealForm) {
      btnSaveMealForm.addEventListener('click', () => this.saveMealFromForm());
    }
    const btnCalcMealCals = document.getElementById('btn-calc-meal-cals');
    if (btnCalcMealCals) {
      btnCalcMealCals.addEventListener('click', () => this.calcCaloriesFromForm());
    }
    ['meal-input-protein', 'meal-input-carbs', 'meal-input-fat'].forEach(id => {
      const inp = document.getElementById(id);
      if (inp) {
        inp.addEventListener('input', () => {
          const calInput = document.getElementById('meal-input-calories');
          if (calInput && (!calInput.value || calInput.value === '0')) {
            this.calcCaloriesFromForm();
          }
        });
      }
    });

    // Workout Controls & Custom Exercises
    const btnShowAddEx = document.getElementById('btn-show-add-exercise');
    if (btnShowAddEx) {
      btnShowAddEx.addEventListener('click', () => this.toggleAddExerciseBox());
    }
    const btnConfirmAddEx = document.getElementById('btn-confirm-add-exercise');
    if (btnConfirmAddEx) {
      btnConfirmAddEx.addEventListener('click', () => this.addCustomExercise());
    }
    const inputNewEx = document.getElementById('input-new-exercise-name');
    if (inputNewEx) {
      inputNewEx.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.addCustomExercise();
      });
    }
    document.querySelectorAll('.quick-ex-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const exName = tag.dataset.name;
        if (exName) this.addCustomExercise(exName);
      });
    });
    const btnClearWorkout = document.getElementById('btn-clear-workout');
    if (btnClearWorkout) {
      btnClearWorkout.addEventListener('click', () => this.clearWorkout());
    }
    const btnLoadWorkoutPreset = document.getElementById('btn-load-workout-preset');
    if (btnLoadWorkoutPreset) {
      btnLoadWorkoutPreset.addEventListener('click', () => this.loadDefaultWorkoutTemplate());
    }
    const btnFinishWorkout = document.getElementById('btn-finish-workout');
    if (btnFinishWorkout) {
      btnFinishWorkout.addEventListener('click', () => this.handleFinishWorkout());
    }

    // Close modals when clicking overlay background
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    // 14. Physique checkin trigger
    const snapPhysiqueBtn = document.getElementById('btn-snap-physique');
    const physiqueFileInput = document.getElementById('physique-file-input');
    if (snapPhysiqueBtn && physiqueFileInput) {
      snapPhysiqueBtn.addEventListener('click', () => physiqueFileInput.click());
      physiqueFileInput.addEventListener('change', (e) => this.handlePhysiquePhotoUpload(e));
    }

    const btnSubmitCheckin = document.getElementById('btn-submit-checkin');
    if (btnSubmitCheckin) {
      btnSubmitCheckin.addEventListener('click', () => this.handlePhysiqueCheckinSubmit());
    }

    // 15. AI Chat input
    const chatSendBtn = document.getElementById('btn-chat-send');
    const chatInput = document.getElementById('chat-text-input');
    if (chatSendBtn && chatInput) {
      chatSendBtn.addEventListener('click', () => this.sendChatMessage());
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sendChatMessage();
      });
    }

    // 16. Chat chips
    document.querySelectorAll('.coach-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.dataset.prompt;
        const input = document.getElementById('chat-text-input');
        if (input) {
          input.value = text;
          this.sendChatMessage();
        }
      });
    });

    // 17. AI Overload refresh
    const btnAiOverload = document.getElementById('btn-ai-overload-refresh');
    if (btnAiOverload) {
      btnAiOverload.addEventListener('click', () => this.refreshAiWorkoutGuidance());
    }

    // 18. Settings preset button
    const btnPresetMahmoud = document.getElementById('btn-preset-mahmoud');
    if (btnPresetMahmoud) {
      btnPresetMahmoud.addEventListener('click', () => {
        this.user = { ...MAHMOUD_TEST_PROFILE };
        this.user.name = this.lang === 'ar' ? 'محمود' : 'Mahmoud';
        localStorage.setItem('sfc_user_profile', JSON.stringify(this.user));
        fbManager.saveUserProfile(this.user.uid, this.user);
        this.onUserReady();
        this.showToast(this.t('toastPresetLoaded'));
        this.closeModal('modal-settings');
      });
    }
  }

  // ==========================================
  // PROGRESSIVE OVERLOAD & WORKOUT SESSION
  // ==========================================
  initDefaultWorkoutSession() {
    const isAr = this.lang === 'ar';
    this.currentWorkout = [
      {
        id: "ex_bench",
        name: isAr ? "بنش برس بار مستوي (Barbell Bench Press)" : "Barbell Bench Press",
        lastWeek: isAr ? "80.0 كجم × 10، 10، 10 عدات" : "80.0 kg x 10, 10, 10 reps",
        recommendation: isAr ? "زود إلى 82.5 كجم! قفلت كل العداد الأسبوع اللي فات." : "Increase to 82.5 kg! You hit all 10s last week.",
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
        recommendation: isAr ? "زود إلى 77.5 كجم. توجيه الأداء: اسحب بكوعك لأسفل الضلوع." : "Increase to 77.5 kg. Form cue: pull with elbows.",
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

  saveDailyLog() {
    localStorage.setItem(`sfc_log_${this.dailyLog.date}`, JSON.stringify(this.dailyLog));
    if (this.user) {
      localDB.setDoc(COLLECTIONS.DAILY_LOGS, `${this.user.uid}_${this.dailyLog.date}`, {
        userId: this.user.uid,
        ...this.dailyLog
      });
    }
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
        <div class="gym-card" style="text-align: center; padding: 30px 14px; border: 1px dashed var(--border-highlight);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">🏋️</div>
          <h4 style="font-size: 1.05rem; font-weight: 800; margin-bottom: 6px;">${isAr ? 'لا توجد تمارين مسجلة حالياً' : 'No exercises in current session'}</h4>
          <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 16px;">
            ${isAr ? 'أضف تمارينك المخصصة وحدد أوزانك ومجموعاتك بنفسك بكل حرية، أو حمّل جدول التضخيم الافتراضي.' : 'Add custom exercises, sets, reps, and weights or load default template.'}
          </p>
          <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" onclick="window.coachApp.toggleAddExerciseBox(true)" style="width: auto;">
              ➕ ${isAr ? 'إضافة تمرينك الآن' : 'Add Custom Exercise'}
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.coachApp.loadDefaultWorkoutTemplate()" style="width: auto; border-color: var(--border-highlight);">
              ⚡ ${isAr ? 'تحميل جدول مقترح' : 'Load Template'}
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.currentWorkout.map((ex, exIdx) => `
      <div class="exercise-card">
        <div class="exercise-header">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <div class="exercise-name" style="font-size: 1.05rem; font-weight: 800;">${ex.name}</div>
            <span class="badge ${ex.action === 'WEIGHT_INCREASE' ? 'badge-red' : (ex.action === 'NEW_EXERCISE' ? 'badge-green' : 'badge-gold')}">${ex.delta}</span>
          </div>
          <button class="exercise-delete-btn" onclick="window.coachApp.deleteExercise(${exIdx})" title="${isAr ? 'حذف التمرين' : 'Delete exercise'}">
            🗑️
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

  // ==========================================
  // AI MULTIMODAL VISION HANDLERS
  // ==========================================
  async handleMealPhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    this.showToast(this.t('toastAnalyzingMeal'));
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
          this.showToast(`${this.t('toastMealAdded')} (+${newMeal.protein}g Protein)`);
          this.navigateTo('diet');
        }
      } catch (err) {
        console.error("AI Photo error:", err);
        this.showToast(this.lang === 'ar' ? "تعذر تحليل صورة الوجبة، حاول مرة أخرى." : "Failed to analyze meal image.");
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

    this.showToast(this.t('toastAnalyzingMeal'));
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
      this.showToast(this.t('toastMealAdded'));
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

    this.showToast(this.t('toastAnalyzingPhysique'));

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
      this.showToast(this.t('toastPhysiqueDone'));
    }
  }

  async sendChatMessage() {
    const input = document.getElementById('chat-text-input');
    const text = input?.value?.trim();
    if (!text) return;

    this.chatHistory.push({ role: 'user', text });
    input.value = '';
    this.renderChatView();

    this.showToast(this.lang === 'ar' ? "الكابتن بيفكر..." : "Coach is thinking...");
    const reply = await geminiService.chatWithCoach(text, this.chatHistory, this.user, this.dailyLog, this.currentWorkout);
    this.chatHistory.push({ role: 'coach', text: reply });
    this.renderChatView();
  }

  // ==========================================
  // MODALS & HELPERS
  // ==========================================
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
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  window.coachApp = new SmartCoachApp();
  window.coachApp.init();
});
