import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Droplet, LogOut } from 'lucide-react';

// Components
import Hero from './components/Hero';
import ConsumerDashboard from './components/ConsumerDashboard';
import DriverDashboard from './components/DriverDashboard';
import AuthModal from './components/AuthModal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [view, setView] = useState<'hero' | 'dashboard'>('hero');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data());
            setView('dashboard');
          } else {
            // Need to complete profile
            setIsAuthModalOpen(true);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setUserProfile(null);
        setView('hero');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Droplet className="w-12 h-12 text-brand-secondary fill-current" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen arabic overflow-x-hidden">
      <nav className="fixed top-0 w-full z-50 bg-brand-bg/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('hero')}>
          <Droplet className="w-8 h-8 text-brand-secondary fill-current" />
          <span className="text-2xl font-bold text-brand-primary tracking-tighter">طلبيّة واو</span>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-bold">{userProfile?.name}</span>
                <span className="text-xs text-gray-500">{userProfile?.role === 'driver' ? 'سائق وايت' : 'مستهلك'}</span>
              </div>
              <button 
                onClick={() => auth.signOut()}
                className="p-2 rounded-full hover:bg-red-50 text-red-500 transition-colors"
                title="تسجيل الخروج"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-brand-primary text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              دخول / تسجيل
            </button>
          )}
        </div>
      </nav>

      <main className="pt-20">
        <AnimatePresence mode="wait">
          {view === 'hero' ? (
            <Hero key="hero" onOrderClick={() => user ? setView('dashboard') : setIsAuthModalOpen(true)} />
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto p-6"
            >
              {userProfile?.role === 'driver' ? (
                <DriverDashboard user={user!} profile={userProfile} />
              ) : (
                <ConsumerDashboard user={user!} profile={userProfile} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={(profile) => {
          setUserProfile(profile);
          setView('dashboard');
          setIsAuthModalOpen(false);
        }}
      />
      
      <footer className="py-12 bg-gray-50 border-t border-gray-100 px-6 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-right">
            <span className="text-xl font-bold text-brand-primary">طلبيّة واو</span>
            <p className="text-gray-500 mt-2">اطلب واو... الماي يوصل لباب بيتك.</p>
          </div>
          <div className="flex gap-8 text-gray-400">
            <a href="#" className="hover:text-brand-primary transition-colors">عن الخدمة</a>
            <a href="#" className="hover:text-brand-primary transition-colors">شروط الاستخدام</a>
            <a href="#" className="hover:text-brand-primary transition-colors">الدعم الفني</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
