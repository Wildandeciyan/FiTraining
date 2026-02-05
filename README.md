# 🏋️ FitTraining - Personal Workout Tracker

FitTraining is a comprehensive, offline-first fitness tracking application built with **React Native (Expo)**. Unlike generic trackers, it focuses on detailed progression visualization, featuring a dynamic **Muscle Heatmap** and deep analytics to track strength gains over time.

Designed for serious lifters who need granular control over their workout data without relying on internet connectivity.

## ✨ Key Features

* **🔥 Dynamic Muscle Heatmap:** A custom-built SVG visualization that highlights trained muscle groups (Front & Back) in real-time based on your daily workout history.
* **📊 Advanced Analytics:** Interactive line charts to track volume (Weight, Reps, Sets) progression for every exercise.
* **💾 Offline-First Architecture:** Powered by **SQLite**, ensuring your data stays on your device and loads instantly without API delays.
* **👻 Ghost Sets:** Smart input system that pre-fills your next set with previous data for faster logging.
* **🏆 PR Tracking:** Automatically tracks and highlights Personal Records (1RM, Max Weight) with pagination.
* **🌗 Adaptive UI:** Fully supports System Dark Mode and Light Mode for comfortable viewing in any environment.

## 🛠️ Tech Stack

* **Framework:** React Native (Expo SDK)
* **Database:** SQLite (expo-sqlite)
* **Visualization:** react-native-svg, react-native-chart-kit
* **Navigation:** Expo Router (Stack & Tabs)
* **State Management:** React Context API

## 📱 Screenshots

| Dashboard (Heatmap) | Progress Charts | Exercise Library |
|:---:|:---:|:---:|
| <img src="./screenshots/heatmap.png" width="200" /> | <img src="./screenshots/chart.png" width="200" /> | <img src="./screenshots/library.png" width="200" /> |

*(Note: Don't forget to upload your screenshots to a folder named 'screenshots' in your repo)*

## 🚀 Getting Started

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/yourusername/FitTraining.git](https://github.com/yourusername/FitTraining.git)
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the app:**
    ```bash
    npx expo start
    ```

## 🤝 Contribution
This project is currently for personal use, but suggestions and pull requests are welcome!

---
Developed with ❤️ using React Native.
