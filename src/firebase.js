// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAleElDO82oQt9ytZt3CHZ-FX8aHlCb6AM",
    authDomain: "stock-check-11146.firebaseapp.com",
    projectId: "stock-check-11146",
    storageBucket: "stock-check-11146.firebasestorage.app",
    messagingSenderId: "716536270566",
    appId: "1:716536270566:web:765f4d6814371af5ca3527",
    measurementId: "G-WQ6B1CTB9L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics and get a reference to the service
let analytics = null;
if (typeof window !== 'undefined') {
    analytics = getAnalytics(app);
}

export { app, analytics };
