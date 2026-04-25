import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, orderBy, getDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Play, Power, Navigation, Phone, MapPin, Droplets, Star, MessageSquare } from 'lucide-react';
import Chat from './Chat';

interface DriverDashboardProps {
  user: User;
  profile: any;
}

export default function DriverDashboard({ user, profile }: DriverDashboardProps) {
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [consumerInfo, setConsumerInfo] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    const qPending = query(
      collection(db, 'orders'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubPending = onSnapshot(qPending, (snapshot) => {
      setAvailableOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders'));

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

  useEffect(() => {
    if (activeJob?.consumerId) {
      getDoc(doc(db, 'users', activeJob.consumerId)).then(u => {
        if (u.exists()) setConsumerInfo(u.data());
      }).catch((err) => handleFirestoreError(err, OperationType.GET, `users/${activeJob.consumerId}`));
    } else {
      setConsumerInfo(null);
    }
  }, [activeJob?.consumerId]);

  const toggleOnline = async () => {
    try {
      await updateDoc(doc(db, 'drivers', user.uid), {
        isAvailable: !isOnline,
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
    <div className="space-y-6">
      {/* Driver Stats & Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-brand-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-surface rounded-2xl flex items-center justify-center">
              <Droplets className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">أهلاً بك، {profile.name}</h2>
              <div className="flex items-center gap-1 text-yellow-500 text-sm">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-bold">4.9 / 5</span>
              </div>
            </div>
          </div>
          <button 
            onClick={toggleOnline}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
          >
            <Power className="w-5 h-5" />
            {isOnline ? 'متصل' : 'غير متصل'}
          </button>
        </div>
        
        <div className="bg-brand-secondary p-6 rounded-3xl text-white shadow-xl shadow-brand-secondary/20">
          <span className="text-white/60 text-xs font-bold block mb-1">الرصيد التقديري</span>
          <h3 className="text-2xl font-bold">45,000 ريال</h3>
        </div>
      </div>

      {/* Active Job Section */}
      <AnimatePresence>
        {activeJob && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row gap-6"
          >
            <div className="flex-[1.5] bg-white p-8 rounded-[32px] border-2 border-brand-primary shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="bg-brand-primary/10 text-brand-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">مهمة نشطة</span>
                  <h3 className="text-xl font-bold">توصيل لحي المطار</h3>
                </div>
                <div className="bg-brand-primary/10 p-3 rounded-2xl">
                  <Navigation className="text-brand-primary animate-pulse" />
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-brand-text">
                  <MapPin className="w-5 h-5 text-brand-muted" />
                  <p className="text-sm">{activeJob.locationDescription}</p>
                </div>
                <div className="flex items-center gap-3 text-brand-text">
                  <Droplets className="w-5 h-5 text-brand-muted" />
                  <p className="text-sm font-bold">{activeJob.capacity} لتر</p>
                </div>
                
                {consumerInfo && (
                  <div className="mt-6 pt-6 border-t border-brand-border">
                    <p className="text-xs font-bold text-brand-muted mb-2">بيانات الزبون</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold">{consumerInfo.name}</p>
                        <p className="text-xs text-brand-muted dir-ltr text-right">{consumerInfo.phone}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowChat(!showChat)} className="p-3 bg-brand-surface text-brand-primary rounded-xl hover:bg-brand-primary/10">
                          <MessageSquare className="w-5 h-5"/>
                        </button>
                        <a href={`tel:${consumerInfo.phone}`} className="p-3 bg-brand-secondary/10 text-brand-secondary rounded-xl hover:bg-brand-secondary/20">
                          <Phone className="w-5 h-5" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-4">
                {activeJob.status === 'accepted' && (
                  <button
                    onClick={async () => {
                      await updateDoc(doc(db, 'orders', activeJob.id), { status: 'delivering' });
                    }}
                    className="flex-1 bg-brand-surface text-brand-primary py-4 rounded-2xl text-sm font-bold hover:bg-brand-surface/80"
                  >
                    بدء التحرك
                  </button>
                )}
                <button
                  onClick={() => completeOrder(activeJob.id)}
                  className="flex-[2] bg-brand-primary text-white py-4 rounded-2xl text-sm font-bold shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  تأكيد إكمال التعبئة
                </button>
              </div>
            </div>
            
            {showChat && consumerInfo && (
              <div className="flex-1 h-full min-h-[400px]">
                <Chat orderId={activeJob.id} currentUserId={user.uid} otherPartyName={consumerInfo.name} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Available Orders List */}
      {!activeJob && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold px-2">طلبات متاحة قريبة منك</h3>
          {!isOnline ? (
            <div className="p-12 bg-white border border-brand-border rounded-[32px] text-center">
              <p className="text-brand-muted text-sm border-2 border-dashed border-brand-border p-6 rounded-2xl">أنت حالياً "غير متصل". فعل الاتصال لاستقبال الطلبات.</p>
            </div>
          ) : availableOrders.length === 0 ? (
            <div className="p-12 border-2 border-dashed border-brand-border rounded-[32px] text-center text-brand-muted text-sm">
              لا توجد طلبات جديدة حالياً
            </div>
          ) : (
            <div className="grid gap-4">
              {availableOrders.map(order => (
                <motion.div 
                  key={order.id}
                  layout
                  className="bg-white p-6 rounded-[24px] border border-brand-border flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:border-brand-primary/50 transition-colors shadow-sm"
                >
                  <div className="flex gap-4 items-center">
                    <div className="bg-brand-surface p-3 rounded-2xl flex flex-col items-center justify-center min-w-[70px]">
                      <span className="text-[10px] text-brand-muted uppercase font-bold">الكمية</span>
                      <span className="text-lg font-bold text-brand-primary">{order.capacity}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm mb-1">{order.locationDescription}</h4>
                      <div className="flex items-center gap-3 text-[10px] text-brand-muted">
                        <span className="flex items-center gap-1">⌚ منذ ٥ دقائق</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> تبعد ٢ كم</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => acceptOrder(order.id)}
                    disabled={loading}
                    className="bg-brand-primary text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-brand-primary/90 transition-all flex items-center justify-center gap-2"
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
