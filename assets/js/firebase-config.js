(function () {
  var IndieRanks = (window.IndieRanks = window.IndieRanks || {});

  var fallbackConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: "",
  };

  var embeddedConfig = {
    apiKey: "AIzaSyBixajMdH5thkvpTIyvW0IaqA4plqqPQhw",
    authDomain: "indieranks-681f1.firebaseapp.com",
    projectId: "indieranks-681f1",
    storageBucket: "indieranks-681f1.firebasestorage.app",
    messagingSenderId: "934850574057",
    appId: "1:934850574057:web:066312ac14e26c2279a278",
    measurementId: "G-9QM1ZJRJV1",
  };

  IndieRanks.firebaseConfig = Object.assign({}, fallbackConfig, embeddedConfig, window.INDIERANKS_FIREBASE_CONFIG || {});

  function hasValue(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function isFirebaseConfigured() {
    var config = IndieRanks.firebaseConfig || {};
    return ["apiKey", "authDomain", "projectId", "appId"].every(function (key) {
      return hasValue(config[key]);
    });
  }

  function initFirebase() {
    if (!window.firebase || !isFirebaseConfigured()) {
      return {
        configured: false,
        app: null,
        db: null,
        auth: null,
        analytics: null,
      };
    }

    try {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(IndieRanks.firebaseConfig);
      }

      var analytics = null;
      if (typeof window.firebase.analytics === "function") {
        try {
          analytics = window.firebase.analytics();
        } catch (analyticsError) {
          console.warn("Firebase analytics init skipped", analyticsError);
        }
      }

      return {
        configured: true,
        app: window.firebase.app(),
        db: window.firebase.firestore(),
        auth: window.firebase.auth(),
        analytics: analytics,
      };
    } catch (error) {
      console.error("Firebase init failed", error);
      return {
        configured: false,
        app: null,
        db: null,
        auth: null,
        analytics: null,
        error: error,
      };
    }
  }

  IndieRanks.isFirebaseConfigured = isFirebaseConfigured;
  IndieRanks.getFirebaseServices = function () {
    if (!IndieRanks.firebaseServices) {
      IndieRanks.firebaseServices = initFirebase();
    }
    return IndieRanks.firebaseServices;
  };

  function requireAuthServices() {
    var services = IndieRanks.getFirebaseServices();
    if (!services.auth || !window.firebase || !window.firebase.auth) {
      throw new Error("Firebase Auth is not configured.");
    }
    return services;
  }

  function joinDisplayName(firstName, lastName) {
    return [firstName, lastName]
      .map(function (value) {
        return String(value || "").trim();
      })
      .filter(Boolean)
      .join(" ");
  }

  IndieRanks.authHooks = {
    onChange: function (callback) {
      var services = IndieRanks.getFirebaseServices();
      if (!services.auth || typeof callback !== "function") {
        if (typeof callback === "function") {
          callback(null);
        }
        return function () {};
      }

      return services.auth.onAuthStateChanged(callback);
    },
    signInWithGoogle: async function () {
      var services = requireAuthServices();
      var provider = new window.firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      return services.auth.signInWithPopup(provider);
    },
    signInWithX: async function () {
      var services = requireAuthServices();
      var provider = new window.firebase.auth.TwitterAuthProvider();
      return services.auth.signInWithPopup(provider);
    },
    signInWithEmail: async function (email, password) {
      var services = requireAuthServices();
      return services.auth.signInWithEmailAndPassword(String(email || "").trim(), String(password || ""));
    },
    signUpWithEmail: async function (options) {
      var services = requireAuthServices();
      var nextOptions = options || {};
      var result = await services.auth.createUserWithEmailAndPassword(
        String(nextOptions.email || "").trim(),
        String(nextOptions.password || "")
      );
      var displayName = joinDisplayName(nextOptions.firstName, nextOptions.lastName);
      var user = result && result.user;

      if (displayName && user && typeof user.updateProfile === "function") {
        await user.updateProfile({ displayName: displayName });
        if (typeof user.reload === "function") {
          await user.reload();
        }
      }

      return result;
    },
    signInAnonymously: async function () {
      var services = requireAuthServices();
      return services.auth.signInAnonymously();
    },
    signOut: async function () {
      var services = IndieRanks.getFirebaseServices();
      if (!services.auth) {
        return;
      }
      return services.auth.signOut();
    },
  };
})();
