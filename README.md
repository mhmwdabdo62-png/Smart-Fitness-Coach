# Smart-Fitness-Coach 🏋️‍♂️🤖

> **Elite Real-Time AI Fitness, Nutrition & Progressive Overload Progressive Web App (PWA)**  
> Engineered with Vanilla JavaScript, CSS3 Design System, Firebase (Firestore, Auth, Storage), and Google Gemini 3.8 Flash (Multimodal Vision & Interactions API).

---

## ⚡ Overview & Architectural Highlights

**Smart-Fitness-Coach** is built specifically for high-intensity gym environments. It solves the real-world problems of mobile fitness apps:
- **Sweaty-Hands UX:** Strict 52px+ touch targets, high contrast neon-red accents on deep pitch-black (`#0d0d0d`), and zero-page-reload Single Page Application (SPA) navigation.
- **Gym Basement Connectivity:** PWA Service Worker caching app shell assets so tracking never stutters when cellular reception drops inside gym basements.
- **Scientifically Grounded Hypertrophy:** Automated Mifflin-St Jeor TDEE calculations, double progression overload engine, and exact supplement nutrient timing.

---

## 👤 Test Case: Mahmoud's Profile Specification

The application comes pre-calibrated with the exact user profile required:
- **Name:** Mahmoud
- **Age:** 22 years old
- **Height:** 178 cm
- **Current Weight:** 75.0 kg
- **Training Frequency:** 5 days/week (Upper / Lower / Push / Pull / Legs Hypertrophy split)
- **Goal:** **Lean Bulk** (+275 kcal surplus targeting ~0.25 - 0.35 kg/week gain with minimal adiposity)
- **Supplements:** Active (Creatine Monohydrate & L-Citrulline Malate)

### Exact Caloric & Macro Breakdown
- **BMR (Mifflin-St Jeor):** $10(75) + 6.25(178) - 5(22) + 5 = 1,757.5 \text{ kcal}$
- **TDEE (1.55 Activity Factor):** $1,757.5 \times 1.55 = 2,724 \text{ kcal}$
- **Target Calories:** **3,000 kcal/day** ($2,724 + 276 \text{ surplus}$)
- **Protein (2.26g/kg):** **170g** (680 kcal)
- **Carbohydrates:** **400g** (1,600 kcal)
- **Fats (25% total kcal):** **80g** (720 kcal)
- **Hydration Minimum:** **3.5 Liters / day** (increased for Creatine saturation)

### Supplement Timing Protocol
- **L-Citrulline Malate (6g - 8g):** Scheduled strictly **30 to 45 minutes pre-workout** to drive nitric oxide vasodilation, intra-set muscular endurance, and pump.
- **Creatine Monohydrate (5g):** Scheduled **daily post-workout** with high-glycemic carbohydrates/protein to maximize muscle uptake via insulin spike.

---

## 🗄️ Firestore Database Architecture

```json
{
  "users": {
    "{userId}": {
      "uid": "test_mahmoud_22",
      "email": "mahmoud@gym.com",
      "displayName": "Mahmoud",
      "photoURL": "https://...",
      "age": 22,
      "heightCm": 178,
      "weightKg": 75.0,
      "trainingDaysPerWeek": 5,
      "goal": "Lean Bulk",
      "hasSupplements": true,
      "supplementsList": ["Creatine", "Citrulline"],
      "caloricTargets": {
        "calories": 3000,
        "proteinGrams": 170,
        "carbGrams": 400,
        "fatGrams": 80,
        "waterTargetMl": 3500,
        "sleepTargetHours": 8.0
      },
      "createdAt": "2026-10-07T05:00:00Z",
      "updatedAt": "2026-10-07T05:15:00Z"
    }
  },
  "workouts": {
    "{workoutId}": {
      "userId": "test_mahmoud_22",
      "date": "2026-10-07",
      "splitName": "Upper Body Hypertrophy",
      "exercises": [
        {
          "exerciseName": "Barbell Bench Press",
          "targetScheme": "3 sets x 8-10 reps",
          "prescribedWeightKg": 82.5,
          "overloadAction": "WEIGHT_INCREASE",
          "coachCue": "Drive heels into the floor; explode on concentric",
          "completedSets": [
            { "setNumber": 1, "weightKg": 82.5, "reps": 10, "completed": true },
            { "setNumber": 2, "weightKg": 82.5, "reps": 9, "completed": true },
            { "setNumber": 3, "weightKg": 82.5, "reps": 8, "completed": true }
          ]
        }
      ],
      "sessionVolumeKg": 6125.0
    }
  },
  "meals": {
    "{mealId}": {
      "userId": "test_mahmoud_22",
      "timestamp": "2026-10-07T08:30:00Z",
      "mealName": "Grilled Chicken Breast with Jasmine Rice & Steamed Broccoli",
      "photoStorageUrl": "gs://smart-fitness-coach.appspot.com/meals/...",
      "calories": 680,
      "macros": {
        "protein": 52,
        "carbs": 78,
        "fat": 14
      },
      "aiConfidence": 0.94,
      "coachNote": "Clean lean-bulk meal replenishing intramuscular glycogen."
    }
  },
  "physique_logs": {
    "{checkinId}": {
      "userId": "test_mahmoud_22",
      "weekNumber": 4,
      "date": "2026-10-07",
      "scaleWeightKg": 75.1,
      "weightDeltaKg": 0.30,
      "photoStorageUrl": "gs://smart-fitness-coach.appspot.com/physique/...",
      "aiVisionAnalysis": {
        "fullnessAssessment": "Noticeable increase in upper chest fullness and lateral deltoid definition.",
        "weightVerdict": "+0.30 kg aligns perfectly with 0.25-0.35kg/wk lean bulk target.",
        "adjustedMacrosNextWeek": {
          "calories": 3050,
          "protein": 170,
          "carbs": 410,
          "fat": 82
        },
        "trainingVolumeTweak": "Add 1 drop set to dumbbell lateral raises."
      }
    }
  }
}
```

---

## 🚀 How to Run Locally or Deploy to GitHub Pages

### Running Locally
Simply open `index.html` in any modern web browser or serve via any static HTTP server (e.g., Python `python -m http.server 8080` or VS Code Live Server).

### Deploying to GitHub Pages
1. Push this directory to your GitHub repository (e.g. `smart-fitness-coach`).
2. Go to **Repository Settings** > **Pages**.
3. Under **Branch**, select `main` (or `master`) and directory `/ (root)`.
4. Click **Save**. Your app will be live with HTTPS and full PWA installation support!
