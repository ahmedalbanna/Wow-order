import React, { useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { X, User as UserIcon, Truck, Phone, ChevronLeft } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: any) => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [step, setStep] = useState<'login' | 'profile'>('login');
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    phone: '',
    role: 'consumer' as 'consumer' | 'driver',
    truckCapacity: 3000,
    waterSource: ''
  });

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (userDoc.exists()) {
        onSuccess(userDoc.data());
      } else {
        setProfileData(prev => ({ ...prev, name: result.user.displayName || '' }));
        setStep('profile');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);
    
    try {
      const userData = {
        uid: auth.currentUser.uid,
        name: profileData.name,
        phone: profileData.phone,
        role: profileData.role,
        createdAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'users', auth.currentUser.uid), userData);
      
      if (profileData.role === 'driver') {
        const driverData = {
          uid: auth.currentUser.uid,
          truckCapacity: profileData.truckCapacity,
          waterSource: profileData.waterSource,
          isAvailable: true,
          rating: 5,
          location: { lat: 15.3694, lng: 44.1910 }, // Default Sanaa location
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'drivers', auth.currentUser.uid), driverData);
      }
      
      onSuccess(userData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 left-6 p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {step === 'login' ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center pt-8"
              >
                <h2 className="text-3xl font-bold mb-4">أهلاً بك في واو</h2>
                <p className="text-gray-500 mb-8">سجل دخولك لتتمكن من طلب الماي أو العمل كسائق.</p>
                
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full bg-white border-2 border-gray-100 py-4 rounded-2xl flex items-center justify-center gap-3 font-bold hover:bg-gray-50 transition-all mb-4"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
                  تسجيل الدخول عبر جوجل
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="pt-8"
              >
                <h2 className="text-2xl font-bold mb-6 text-center">أكمل بياناتك</h2>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">الاسم الكامل</label>
                    <input 
                      required
                      value={profileData.name}
                      onChange={e => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full p-4 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-brand-primary border-2 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">رقم الهاتف</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input 
                        required
                        type="tel"
                        dir="ltr"
                        placeholder="7XXXXXXXX"
                        value={profileData.phone}
                        onChange={e => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full p-4 pl-12 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-brand-primary border-2 transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">نوع الحساب</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setProfileData(prev => ({ ...prev, role: 'consumer' }))}
                        className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${profileData.role === 'consumer' ? 'border-brand-primary bg-brand-primary/5 text-brand-primary' : 'border-gray-100 opacity-60'}`}
                      >
                        <UserIcon className="w-8 h-8" />
                        <span className="font-bold">مستهلك</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfileData(prev => ({ ...prev, role: 'driver' }))}
                        className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${profileData.role === 'driver' ? 'border-brand-primary bg-brand-primary/5 text-brand-primary' : 'border-gray-100 opacity-60'}`}
                      >
                        <Truck className="w-8 h-8" />
                        <span className="font-bold">سائق وايت</span>
                      </button>
                    </div>
                  </div>

                  {profileData.role === 'driver' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 pt-4 border-t border-dashed">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">سعة الصهريج (لتر)</label>
                        <select 
                          value={profileData.truckCapacity}
                          onChange={e => setProfileData(prev => ({ ...prev, truckCapacity: parseInt(e.target.value) }))}
                          className="w-full p-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-brand-primary' transition-all outline-none"
                        >
                          <option value="3000">3000 لتر</option>
                          <option value="5000">5000 لتر</option>
                          <option value="8000">8000 لتر</option>
                          <option value="12000">12000 لتر</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">مصدر المياه الرئيسي</label>
                        <input 
                          placeholder="مثلاً: بئر القاع، محطة تحلية..."
                          value={profileData.waterSource}
                          onChange={e => setProfileData(prev => ({ ...prev, waterSource: e.target.value }))}
                          className="w-full p-4 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:border-brand-primary border-2 transition-all outline-none"
                        />
                      </div>
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    حفظ ومتابعة
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
