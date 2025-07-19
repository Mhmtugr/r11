import { ref, computed } from 'vue';
import { auth as firebaseAuth, db as firestoreDB } from '@/services/firebase-service';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from "firebase/firestore";
import logger from '@/utils/logger';

const authState = ref({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isProcessing: false,
  lastError: null,
  checkedSession: false,
});

const loadUserData = async (firebaseUser) => {
  if (!firebaseUser || !firestoreDB) return null;
  logger.info(`[useAuthService] loadUserData: Kullanıcı verisi yükleniyor: ${firebaseUser.uid}`);
  try {
    const userDocRef = doc(firestoreDB, 'users', firebaseUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      logger.info(`[useAuthService] loadUserData: Kullanıcı verisi bulundu:`, userDocSnap.data());
      return userDocSnap.data();
    } else {
      logger.warn(`[useAuthService] loadUserData: Kullanıcı veritabanında bulunamadı: ${firebaseUser.uid}`);
      return null;
    }
  } catch (error) {
    logger.error("[useAuthService] loadUserData: Kullanıcı verisi yüklenirken hata:", error);
    authState.value.lastError = error;
    return null;
  }
};

const loadOrCreateUserData = async (firebaseUser) => {
  if (!firebaseUser || !firestoreDB) return null;
  let userData = await loadUserData(firebaseUser);

  if (!userData) {
    logger.info(`[useAuthService] loadOrCreateUserData: Kullanıcı için Firestore'da kayıt bulunamadı. Yeni kayıt oluşturuluyor: ${firebaseUser.uid}`);
    const newUserRecord = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
      photoURL: firebaseUser.photoURL || null,
      role: 'user',
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    };
    try {
      const userDocRef = doc(firestoreDB, 'users', firebaseUser.uid);
      await setDoc(userDocRef, newUserRecord);
      logger.info(`[useAuthService] loadOrCreateUserData: Yeni kullanıcı kaydı Firestore'a eklendi: ${firebaseUser.uid}`);
      userData = newUserRecord;
    } catch (error) {
      logger.error("[useAuthService] loadOrCreateUserData: Yeni kullanıcı kaydı oluşturulurken hata:", error);
      authState.value.lastError = error;
      return null;
    }
  } else {
    try {
      const userDocRef = doc(firestoreDB, 'users', firebaseUser.uid);
      await updateDoc(userDocRef, {
        lastLoginAt: serverTimestamp()
      });
      logger.info(`[useAuthService] loadOrCreateUserData: Kullanıcının son giriş zamanı güncellendi: ${firebaseUser.uid}`);
    } catch (error) {
      logger.error("[useAuthService] loadOrCreateUserData: Kullanıcı son giriş zamanı güncellenirken hata:", error);
    }
  }
  return userData;
};

const login = async (credentials) => {
  logger.info(`[useAuthService] login: called with credentials:`, JSON.stringify(credentials));
  authState.value.isProcessing = true;
  authState.value.lastError = null;
  const { email, password } = credentials;

  if (!email || !password) {
    logger.warn('[useAuthService] login: Email or password missing');
    authState.value.isProcessing = false;
    return { success: false, error: 'E-posta ve şifre giriniz' };
  }

  logger.info('[useAuthService] login: Proceeding to Firebase login.');
  if (firebaseAuth) {
    try {
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const user = userCredential.user;
      const userData = await loadOrCreateUserData(user);
      
      authState.value.user = { ...user, ...userData, isMockUser: false };
      authState.value.isAuthenticated = true;
      authState.value.isProcessing = false;
      logger.info(`[useAuthService] login: Successful for ${user.uid}`);
      return { success: true, user: authState.value.user };
    } catch (authError) {
      logger.error("Firebase giriş hatası:", authError);
      let errorMessage = 'Giriş yapılırken bir hata oluştu.';
      if (authError.code) {
        switch(authError.code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-email':
            errorMessage = 'E-posta adresi veya şifre hatalı.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'Bu hesap devre dışı bırakıldı.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Çok fazla başarısız giriş denemesi. Lütfen daha sonra tekrar deneyin.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Ağ hatası. İnternet bağlantınızı kontrol edin.';
            break;
        }
      }
      authState.value.lastError = { message: errorMessage, code: authError.code };
      authState.value.isProcessing = false;
      return { success: false, error: errorMessage, code: authError.code };
    }
  } else {
    logger.error("Firebase Auth başlatılamadı, giriş yapılamıyor.");
    authState.value.lastError = { message: "Firebase Auth başlatılamadı." };
    authState.value.isProcessing = false;
    return { success: false, error: "Giriş altyapısı hazır değil." };
  }
};

const register = async (credentials) => {
  logger.info('[useAuthService] register: called with credentials', credentials);
  authState.value.isProcessing = true;
  authState.value.lastError = null;
  const { email, password, displayName } = credentials;

  if (!email || !password) {
    logger.warn('[useAuthService] register: Email or password missing');
    authState.value.isProcessing = false;
    return { success: false, error: 'E-posta ve şifre giriniz.' };
  }

  if (firebaseAuth && firestoreDB) {
    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const user = userCredential.user;

      if (displayName) {
        await firebaseUpdateProfile(user, { displayName });
      }
      
      const newUserRecord = {
        uid: user.uid,
        email: user.email,
        displayName: displayName || user.email.split('@')[0],
        role: 'user',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      };
      const userDocRef = doc(firestoreDB, 'users', user.uid);
      await setDoc(userDocRef, newUserRecord);
      
      authState.value.user = { ...user, ...newUserRecord, isMockUser: false };
      authState.value.isAuthenticated = true;
      authState.value.isProcessing = false;
      logger.info(`[useAuthService] register: Successful for ${user.uid}`);
      return { success: true, user: authState.value.user };
    } catch (authError) {
      logger.error("Firebase kayıt hatası:", authError);
      let errorMessage = 'Kayıt sırasında bir hata oluştu.';
      if (authError.code === 'auth/email-already-in-use') {
        errorMessage = 'Bu e-posta adresi zaten kayıtlı.';
      } else if (authError.code === 'auth/weak-password') {
        errorMessage = 'Şifre çok zayıf. Lütfen daha güçlü bir şifre seçin.';
      }
      authState.value.lastError = { message: errorMessage, code: authError.code };
      authState.value.isProcessing = false;
      return { success: false, error: errorMessage, code: authError.code };
    }
  } else {
    logger.error("Firebase Auth veya Firestore başlatılamadı, kayıt yapılamıyor.");
    authState.value.lastError = { message: "Firebase Auth veya Firestore başlatılamadı." };
    authState.value.isProcessing = false;
    return { success: false, error: "Kayıt altyapısı hazır değil." };
  }
};

const logout = async () => {
  logger.info('[useAuthService] logout: called');
  authState.value.isProcessing = true;
  authState.value.lastError = null;
  try {
    if (firebaseAuth) {
      await firebaseSignOut(firebaseAuth);
    }
    authState.value.user = null;
    authState.value.isAuthenticated = false;
    logger.info('[useAuthService] logout: Successful');
  } catch (error) {
    logger.error("Firebase çıkış hatası:", error);
    authState.value.lastError = error;
  } finally {
    authState.value.isProcessing = false;
  }
};

const checkAuth = async () => {
  logger.info('[useAuthService] checkAuth: called');
  authState.value.isLoading = true;
  authState.value.checkedSession = false;

  return new Promise((resolve) => {
    if (firebaseAuth) {
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        unsubscribe(); // Unsubscribe after the first callback to avoid memory leaks
        logger.info("[useAuthService] onAuthStateChanged: user status changed", user ? user.uid : 'no user');
        let userDataResolved = null;
        let isAuthenticatedResolved = false;

        if (user) {
          const loadedUser = await loadOrCreateUserData(user);
          userDataResolved = { ...user, ...loadedUser, isMockUser: false };
          isAuthenticatedResolved = true;
          
          authState.value.user = userDataResolved;
          authState.value.isAuthenticated = true;
        } else {
          authState.value.user = null;
          authState.value.isAuthenticated = false;
        }
        authState.value.isLoading = false;
        authState.value.checkedSession = true;
        logger.info("[useAuthService] onAuthStateChanged: authState güncellendi", JSON.parse(JSON.stringify(authState.value)));
        resolve({ isAuthenticated: isAuthenticatedResolved, user: userDataResolved, demo: false }); // Assuming no demo mode for Firebase auth
      }, (error) => {
        unsubscribe(); // Unsubscribe on error too
        logger.error("[useAuthService] onAuthStateChanged error:", error);
        authState.value.isLoading = false;
        authState.value.checkedSession = true;
        authState.value.lastError = error;
        resolve({ isAuthenticated: false, user: null, demo: false, error: error });
      });
    } else {
      logger.warn("Firebase Auth başlatılamadı, oturum kontrol edilemiyor.");
      authState.value.isLoading = false;
      authState.value.checkedSession = true;
      resolve({ isAuthenticated: false, user: null, demo: false, error: "Firebase Auth not initialized" });
    }
  });
};

const updateUserProfile = async (profileData) => {
  if (!authState.value.user || !firebaseAuth || !firestoreDB) {
    return { success: false, error: "Kullanıcı girişi yapılmamış veya Firebase başlatılamamış." };
  }
  authState.value.isProcessing = true;
  authState.value.lastError = null;
  try {
    const user = firebaseAuth.currentUser;
    if (profileData.displayName && profileData.displayName !== user.displayName) {
      await firebaseUpdateProfile(user, { displayName: profileData.displayName });
    }
    const userDocRef = doc(firestoreDB, 'users', user.uid);
    await updateDoc(userDocRef, {
      displayName: profileData.displayName,
      ...(profileData.photoURL && { photoURL: profileData.photoURL })
    });
    authState.value.user = { ...authState.value.user, ...profileData };
    authState.value.isProcessing = false;
    return { success: true };
  } catch (error) {
    logger.error("Profil güncelleme hatası:", error);
    authState.value.lastError = error;
    authState.value.isProcessing = false;
    return { success: false, error: error.message };
  }
};

export function useAuthService() {
  return {
    authState: computed(() => authState.value),
    login,
    logout,
    register,
    checkAuth,
    loadOrCreateUserData,
    updateUserProfile,
  };
}