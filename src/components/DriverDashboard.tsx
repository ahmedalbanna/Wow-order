import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Play, Power, Navigation, Phone, MapPin, Droplets, Star, Clock } from 'lucide-react';

interface DriverDashboardProps {
  user: User;
  profile: any;
}

export default function DriverDashboard({ user, profile }: DriverDashboardProps) {
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Listen for available pending orders
    const qPending = query(
      collection(db, 'orders'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubPending = onSnapshot(qPending, (snapshot) => {
      setAvailableOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders'));

    // Listen for active job for this driver
    const qActive = query(
      collection(db, 'orders'),
      where('driverId', '==', user.uid),
      where('status', 'in', ['accepted', 'delivering'])
    );

    const unsubActive = onSnapshot(qActive, (snapshot) => {
      if (!snapshot.empty) {
        setActiveJob({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setActiveJob(null);
      }
    });

    return () => {
      unsubPending();
      unsubActive();
    };
  }, [user.uid]);

  const toggleOnline = async () => {
    try {
      await updateDoc(doc(db, 'drivers', user.uid), {
        isOnline: !isOnline,
        updatedAt: serverTimestamp()
      });
      setIsOnline(!isOnline);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `drivers/${user.uid}`);
    }
  };

  const acceptOrder = async (orderId: string) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'accepted',
        driverId: user.uid,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    } finally {
      setLoading(false);
    }
  };

  const completeOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'completed',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Driver Stats & Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-brand-primary/10 rounded-2xl flex items-center justify-center">
              <Droplets className="w-8 h-8 text-brand-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">أهلاً بك، {profile.name}</h2>
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-bold">4.9 / 5</span>
              </div>
            </div>
          </div>
          <button 
            onClick={toggleOnline}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
          >
            <Power className="w-5 h-5" />
            {isOnline ? 'متصل' : 'غير متصل'}
          </button>
        </div>
        
        <div className="bg-brand-secondary p-6 rounded-3xl text-white shadow-xl shadow-brand-secondary/20">
          <span className="text-white/60 text-sm font-bold block mb-1">الرصيد التقديري</span>
          <h3 className="text-3xl font-bold">45,000 ريال</h3>
        </div>
      </div>

      {/* Active Job Section */}
      <AnimatePresence>
        {activeJob && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-3xl border-2 border-brand-primary shadow-xl"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="bg-brand-primary/10 text-brand-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 inline-block">مهمة نشطة</span>
                <h3 className="text-2xl font-bold">توصيل لحي المطار</h3>
              </div>
              <div className="bg-brand-primary/10 p-3 rounded-2xl">
                <Navigation className="text-brand-primary animate-pulse" />
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 text-gray-600">
                <MapPin className="w-5 h-5" />
                <p>{activeJob.locationDescription}</p>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <Droplets className="w-5 h-5" />
                <p>{activeJob.capacity} لتر</p>
              </div>
              <div className="flex items-center gap-3 text-brand-secondary">
                <Phone className="w-5 h-5" />
                <p className="font-bold">تواصل مع الزبون</p>
              </div>
            </div>

            <button
              onClick={() => completeOrder(activeJob.id)}
              className="w-full bg-brand-primary text-white py-4 rounded-2xl text-xl font-bold shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <CheckCircle2 className="w-6 h-6" />
              تأكيد إكمال التعبئة
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Available Orders List */}
      {!activeJob && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold px-2">طلبات متاحة قريبة منك</h3>
          {!isOnline ? (
            <div className="p-12 bg-gray-50 rounded-3xl text-center">
              <p className="text-gray-500">أنت حالياً "غير متصل". فعل الاتصال لاستقبال الطلبات.</p>
            </div>
          ) : availableOrders.length === 0 ? (
            <div className="p-12 border-2 border-dashed border-gray-100 rounded-3xl text-center text-gray-400">
              لا توجد طلبات جديدة حالياً
            </div>
          ) : (
            <div className="grid gap-4">
              {availableOrders.map(order => (
                <motion.div 
                  key={order.id}
                  layout
                  className="bg-white p-6 rounded-2xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-4">
                    <div className="bg-brand-secondary/10 p-4 rounded-xl flex flex-col items-center justify-center min-w-[80px]">
                      <span className="text-xs text-brand-secondary uppercase font-bold">الكمية</span>
                      <span className="text-xl font-bold text-brand-secondary">{order.capacity}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-lg mb-1">{order.locationDescription}</h4>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> منذ ٥ دقائق</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> تبعد ٢ كم</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => acceptOrder(order.id)}
                    disabled={loading}
                    className="bg-brand-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-primary/90 transition-all flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    قبول الطلب
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
