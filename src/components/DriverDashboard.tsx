import { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, orderBy, getDoc, addDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Play, Power, Navigation, Phone, MapPin, Droplets, Star, MessageSquare, Award, Clock, Square, Mic } from 'lucide-react';
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
  const [notification, setNotification] = useState<string | null>(null);
  const prevCountRef = useRef<number>(0);

  // Rating State
  const [completedOrderToRate, setCompletedOrderToRate] = useState<any>(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

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
      where('status', 'in', ['accepted', 'en_route_pickup', 'loading_water', 'delivering'])
    );

    const unsubActive = onSnapshot(qActive, (snapshot) => {
      if (!snapshot.empty) {
        setActiveJob({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setActiveJob(null);
      }
    });

    // Listen for recent completed orders that need driver rating
    const qCompleted = query(
      collection(db, 'orders'),
      where('driverId', '==', user.uid),
      where('status', '==', 'completed'),
      orderBy('updatedAt', 'desc')
    );
    const unsubCompleted = onSnapshot(qCompleted, (snapshot) => {
      const docs = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
      const unrated = docs.find((d: any) => !d.hasDriverRated);
      setCompletedOrderToRate(unrated || null);
    });

    return () => {
      unsubPending();
      unsubActive();
      unsubCompleted();
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
        updatedAt: serverTimestamp(),
        paymentStatus: activeJob.paymentMethod === 'wallet' ? 'paid' : 'pending_cash'
      });
      // Increment completed metrics optionally here (or Cloud Functions)
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const submitDriverRating = async () => {
    if (!completedOrderToRate) return;
    setIsSubmittingRating(true);
    try {
      await updateDoc(doc(db, 'orders', completedOrderToRate.id), { hasDriverRated: true });
      await addDoc(collection(db, 'ratings'), {
        ratingId: `RD-${Date.now()}`,
        driverId: user.uid,
        consumerId: completedOrderToRate.consumerId,
        orderId: completedOrderToRate.id,
        rating: ratingStars,
        createdAt: serverTimestamp()
      });
      setCompletedOrderToRate(null);
    } catch(err) {
    } finally {
      setIsSubmittingRating(false);
    }
  };

  useEffect(() => {
    if (availableOrders.length > prevCountRef.current && prevCountRef.current !== 0) {
      setNotification('متاح طلب جديد بالقرب منك!');
      setTimeout(() => setNotification(null), 5000);
    }
    prevCountRef.current = availableOrders.length;
  }, [availableOrders.length]);

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-brand-primary text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-bold"
          >
            <Clock className="w-5 h-5 animate-pulse"/>
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Driver Stats & Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-brand-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-surface rounded-2xl flex items-center justify-center relative">
              <Droplets className="w-6 h-6 text-brand-primary" />
              {profile.completedOrdersCount > 100 && <Award className="w-4 h-4 text-yellow-500 absolute -top-1 -right-1" />}
            </div>
            <div>
              <h2 className="text-xl font-bold">أهلاً بك، {profile.name}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-brand-muted">
                <div className="flex items-center gap-1 text-yellow-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="font-bold whitespace-nowrap">{profile.rating || 'جديد'} / 5</span>
                </div>
                <span>•</span>
                <span className="whitespace-nowrap">{profile.completedOrdersCount || 0} طلب مكتمل</span>
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
        
        <div className="bg-brand-secondary p-6 rounded-3xl text-white shadow-xl shadow-brand-secondary/20 flex flex-col justify-between">
          <div>
            <span className="text-white/60 text-xs font-bold block mb-1">المحفظة والحوافز</span>
            <h3 className="text-2xl font-bold">45,000 ريال</h3>
          </div>
          <div className="text-xs mt-2 bg-white/20 p-2 rounded-xl flex items-center justify-between">
            <span>مكافأة الجودة:</span>
            <span className="font-bold">+500 ريال</span>
          </div>
        </div>
      </div>

      {completedOrderToRate && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-brand-surface p-6 flex flex-col md:flex-row items-center justify-between gap-4 rounded-3xl border border-brand-primary/30 shadow-sm">
          <div>
            <h3 className="font-bold text-lg">تقييم الزبون</h3>
            <p className="text-sm text-brand-muted">كيف كان تعاملك مع الزبون السابق؟</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRatingStars(s)}><Star className={`w-6 h-6 ${s <= ratingStars ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} /></button>
              ))}
            </div>
            <button 
              onClick={submitDriverRating}
              disabled={isSubmittingRating}
              className={`px-6 py-2 rounded-xl text-white font-bold transition-colors bg-brand-primary hover:bg-brand-primary/90 flex items-center gap-2`}
            >
              {isSubmittingRating ? <Clock className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>}
              تأكيد التقييم
            </button>
          </div>
        </motion.div>
      )}

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
                <div className="flex items-center gap-3 text-brand-text">
                  <span className="w-5 h-5 flex items-center justify-center font-bold text-brand-muted">$</span>
                  <p className="text-sm font-bold">{activeJob.paymentMethod === 'wallet' ? 'دفع عبر محفظة حوّل (تلقائي)' : 'دفع كاش (عند الاستلام)'}</p>
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
                      await updateDoc(doc(db, 'orders', activeJob.id), { status: 'en_route_pickup' });
                    }}
                    className="flex-1 bg-brand-surface text-brand-primary py-4 rounded-2xl text-sm font-bold hover:bg-brand-surface/80"
                  >
                    التوجه للمحطة
                  </button>
                )}
                {activeJob.status === 'en_route_pickup' && (
                  <button
                    onClick={async () => {
                      await updateDoc(doc(db, 'orders', activeJob.id), { status: 'loading_water' });
                    }}
                    className="flex-1 bg-cyan-100 text-cyan-700 py-4 rounded-2xl text-sm font-bold hover:bg-cyan-200"
                  >
                    تعبئة الوايت
                  </button>
                )}
                {activeJob.status === 'loading_water' && (
                  <button
                    onClick={async () => {
                      await updateDoc(doc(db, 'orders', activeJob.id), { status: 'delivering' });
                    }}
                    className="flex-1 bg-brand-secondary text-white py-4 rounded-2xl text-sm font-bold hover:bg-brand-secondary/90"
                  >
                    بدى التوصيل للزبون
                  </button>
                )}
                {activeJob.status === 'delivering' && (
                  <button
                    onClick={() => completeOrder(activeJob.id)}
                    className="flex-1 bg-brand-primary text-white py-4 rounded-2xl text-sm font-bold shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    تأكيد الوصول والتفريغ
                  </button>
                )}
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
