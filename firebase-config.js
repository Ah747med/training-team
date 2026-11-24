// Firebase Configuration & Realtime Synchronization Helper
(function () {
    const firebaseConfig = {
        apiKey: "AIzaSyDsAi7LUXRXgkQn6ZHvNjRFv2vEZ0JJd3s",
        authDomain: "cars-system-14762.firebaseapp.com",
        databaseURL: "https://cars-system-14762-default-rtdb.firebaseio.com",
        projectId: "cars-system-14762",
        storageBucket: "cars-system-14762.firebasestorage.app",
        messagingSenderId: "559208143453",
        appId: "1:559208143453:web:70e81c7af902cee921cbb4",
        measurementId: "G-PNPL952C14"
    };

    let fbApp = null;
    let fbDB = null;
    let isInitialized = false;
    let isSyncingFromCloud = false;

    try {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
                fbApp = firebase.initializeApp(firebaseConfig);
            } else {
                fbApp = firebase.app();
            }
            fbDB = firebase.database();
            isInitialized = true;
            console.log("✅ Firebase Database connected successfully:", firebaseConfig.databaseURL);
        } else {
            console.warn("⚠️ Firebase SDK not loaded, working in offline/localStorage mode.");
        }
    } catch (e) {
        console.error("❌ Firebase init error:", e);
    }

    window.TrainingFirebase = {
        isAvailable() {
            return isInitialized && fbDB !== null;
        },

        getDB() {
            return fbDB;
        },

        // Save a single collection
        async saveCollection(collectionKey, data) {
            if (!this.isAvailable()) return;
            try {
                const cleanData = JSON.parse(JSON.stringify(data));
                await fbDB.ref(collectionKey).set(cleanData);
            } catch (err) {
                console.error(`Error saving ${collectionKey} to Firebase:`, err);
            }
        },

        // Save custom key-value (e.g. updata_account_1, schedule_img_account_1, etc.)
        async saveCustomKey(key, data) {
            if (!this.isAvailable()) return;
            try {
                const safeKey = key.replace(/[.#$[\]]/g, '_');
                const cleanData = data !== undefined && data !== null ? JSON.parse(JSON.stringify(data)) : null;
                await fbDB.ref('customData/' + safeKey).set(cleanData);
            } catch (err) {
                console.error(`Error saving custom key ${key} to Firebase:`, err);
            }
        },

        async removeCustomKey(key) {
            if (!this.isAvailable()) return;
            try {
                const safeKey = key.replace(/[.#$[\]]/g, '_');
                await fbDB.ref('customData/' + safeKey).remove();
            } catch (err) {
                console.error(`Error removing custom key ${key} from Firebase:`, err);
            }
        },

        // Save all core system collections to Firebase
        async saveAll(appInstance) {
            if (!this.isAvailable() || isSyncingFromCloud) return;
            try {
                const payload = {
                    trainers: JSON.parse(JSON.stringify(appInstance.trainers || [])),
                    accounts: JSON.parse(JSON.stringify(appInstance.accounts || [])),
                    leaders: JSON.parse(JSON.stringify(appInstance.leaders || [])),
                    managers: JSON.parse(JSON.stringify(appInstance.managers || [])),
                    videos: JSON.parse(JSON.stringify(appInstance.videos || [])),
                    exams: JSON.parse(JSON.stringify(appInstance.exams || [])),
                    materials: JSON.parse(JSON.stringify(appInstance.materials || [])),
                    adminCreds: JSON.parse(JSON.stringify(appInstance.adminCreds || { user: '0', pass: '0' })),
                    lastUpdated: Date.now()
                };

                await fbDB.ref('systemData').set(payload);
            } catch (err) {
                console.error("Error syncing systemData to Firebase:", err);
            }
        },

        // Initialize Realtime Listeners
        initRealtimeSync(appInstance) {
            if (!this.isAvailable()) return;

            let refreshTimeout = null;
            const debouncedRefresh = () => {
                if (refreshTimeout) clearTimeout(refreshTimeout);
                refreshTimeout = setTimeout(() => {
                    if (typeof appInstance.refreshCurrentView === 'function') {
                        appInstance.refreshCurrentView();
                    }
                }, 80);
            };

            const systemRef = fbDB.ref('systemData');

            // 1. Listen for core system data changes
            systemRef.on('value', (snapshot) => {
                const cloudData = snapshot.val();
                if (!cloudData) {
                    // Cloud is empty on first setup -> auto-migrate existing local data
                    console.log("☁️ First time setup: Migrating local data to Firebase...");
                    this.saveAll(appInstance);
                    return;
                }

                isSyncingFromCloud = true;
                try {
                    let hasChanges = false;

                    if (cloudData.trainers) {
                        const rawTrainers = Array.isArray(cloudData.trainers) ? cloudData.trainers : Object.values(cloudData.trainers);
                        appInstance.trainers = rawTrainers.filter(t => t && typeof t === 'object' && t.name);
                        if (typeof appInstance.cleanupSystemBatches === 'function') {
                            appInstance.cleanupSystemBatches();
                        } else if (typeof appInstance.ensureTrainerBatches === 'function') {
                            appInstance.ensureTrainerBatches();
                        }
                        localStorage.setItem('trainers', JSON.stringify(appInstance.trainers));
                        hasChanges = true;
                    }
                    if (cloudData.accounts) {
                        const rawAccounts = Array.isArray(cloudData.accounts) ? cloudData.accounts : Object.values(cloudData.accounts);
                        appInstance.accounts = rawAccounts.filter(a => a && typeof a === 'object' && a.name);
                        localStorage.setItem('accounts', JSON.stringify(appInstance.accounts));
                        hasChanges = true;
                    }
                    if (cloudData.leaders) {
                        const rawLeaders = Array.isArray(cloudData.leaders) ? cloudData.leaders : Object.values(cloudData.leaders);
                        appInstance.leaders = rawLeaders.filter(l => l && typeof l === 'object' && l.name);
                        localStorage.setItem('leaders', JSON.stringify(appInstance.leaders));
                        hasChanges = true;
                    }
                    if (cloudData.managers) {
                        const rawManagers = Array.isArray(cloudData.managers) ? cloudData.managers : Object.values(cloudData.managers);
                        appInstance.managers = rawManagers.filter(m => m && typeof m === 'object');
                        localStorage.setItem('managers', JSON.stringify(appInstance.managers));
                        hasChanges = true;
                    }
                    if (cloudData.videos) {
                        const rawVideos = Array.isArray(cloudData.videos) ? cloudData.videos : Object.values(cloudData.videos);
                        appInstance.videos = rawVideos.filter(v => v && typeof v === 'object');
                        localStorage.setItem('videos', JSON.stringify(appInstance.videos));
                        hasChanges = true;
                    }
                    if (cloudData.exams) {
                        const rawExams = Array.isArray(cloudData.exams) ? cloudData.exams : Object.values(cloudData.exams);
                        appInstance.exams = rawExams.filter(e => e && typeof e === 'object');
                        localStorage.setItem('exams', JSON.stringify(appInstance.exams));
                        hasChanges = true;
                    }
                    if (cloudData.materials) {
                        const rawMaterials = Array.isArray(cloudData.materials) ? cloudData.materials : Object.values(cloudData.materials);
                        appInstance.materials = rawMaterials.filter(m => m && typeof m === 'object');
                        localStorage.setItem('materials', JSON.stringify(appInstance.materials));
                        hasChanges = true;
                    }
                    if (cloudData.adminCreds) {
                        appInstance.adminCreds = cloudData.adminCreds;
                        localStorage.setItem('adminCreds', JSON.stringify(appInstance.adminCreds));
                    }

                    // Refresh current UI if active (debounced to avoid multiple rapid rerenders)
                    if (hasChanges) {
                        debouncedRefresh();
                    }
                } catch (e) {
                    console.error("Error processing cloud update:", e);
                } finally {
                    setTimeout(() => { isSyncingFromCloud = false; }, 300);
                }
            });

            // 2. Listen for customData changes (updata, schedules, etc.)
            const customDataRef = fbDB.ref('customData');
            customDataRef.on('value', (snapshot) => {
                const val = snapshot.val();
                if (val && typeof val === 'object') {
                    for (const safeKey of Object.keys(val)) {
                        localStorage.setItem(safeKey, JSON.stringify(val[safeKey]));
                    }
                    debouncedRefresh();
                }
            });
        }
    };
})();
