import { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, orderBy, getDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Square, Loader2, MapPin, CheckCircle2, Clock, XCircle, Droplets, Star, Shield, MessageSquare, Award, Bell } from 'lucide-react';
import { processVoiceOrder } from '../services/geminiService';
import Chat from './Chat';

interface ConsumerDashboardProps {
  user: User;
  profile: any;
}

export default function ConsumerDashboard({ user, profile }: ConsumerDashboardProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  
  // Rating State
  const [isRating, setIsRating] = useState({ orderId: '', driverId: '' });
  const [isRecordingRating, setIsRecordingRating] = useState(false);
  const [ratingMediaRecorder, setRatingMediaRecorder] = useState<MediaRecorder | null>(null);
  const [ratingAudioChunks, setRatingAudioChunks] = useState<Blob[]>([]);
  const [ratingStars, setRatingStars] = useState(5);

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('consumerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
    }, (err) => {
       handleFirestoreError(err, OperationType.LIST, 'orders');
    });

    return unsubscribe;
  }, [user.uid]);

  const activeOrder = orders.find(o => ['pending', 'accepted', 'delivering'].includes(o.status));
  const needsRating = orders.find(o => o.status === 'completed' && !o.hasRated); // assuming we track hasRated locally or in doc

  useEffect(() => {
    if (activeOrder?.driverId && activeOrder.status !== 'pending') {
      const fetchDriver = async () => {
        try {
          const dRef = await getDoc(doc(db, 'drivers', activeOrder.driverId));
          const uRef = await getDoc(doc(db, 'users', activeOrder.driverId));
          if (dRef.exists() && uRef.exists()) {
            setDriverInfo({ ...dRef.data(), name: uRef.data().name });
          }
        } catch(e) {}
      };
      fetchDriver();
    } else {
      setDriverInfo(null);
    }
  }, [activeOrder?.driverId, activeOrder?.status]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      setAudioChunks([]);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await handleAudioOrder(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error("Recording error:", err);
      setError("يرجى إعطاء صلاحية الميكروفون للطلب الصوتي.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleAudioOrder = async (blob: Blob) => {
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const aiResult = await processVoiceOrder(base64Audio);
        
        const orderData = {
          consumerId: user.uid,
          status: 'pending',
          capacity: aiResult.capacity || 3000,
          locationDescription: aiResult.locationDescription || 'تم الطلب عبر رسالة صوتية',
          transcript: aiResult.transcript,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          orderId: `W-${Math.random().toString(36).substring(7).toUpperCase()}`
        };

        await addDoc(collection(db, 'orders'), orderData);
        setLoading(false);
      };
    } catch (err) {
      setError("عذراً، حدث خطأ أثناء معالجة الطلب. حاول مرة أخرى.");
      setLoading(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
    } catch (err) {}
  };

  // RATING LOGIC
  const startRatingRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setRatingMediaRecorder(recorder);
      setRatingAudioChunks([]);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) setRatingAudioChunks(prev => [...prev, e.data]);
      };
      recorder.onstop = async () => {
        const audioBlob = new Blob(ratingAudioChunks, { type: 'audio/wav' });
        await submitRating(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setIsRecordingRating(true);
    } catch(err) {}
  };

  const stopRatingRecording = () => {
    if (ratingMediaRecorder) {
      ratingMediaRecorder.stop();
      setIsRecordingRating(false);
    }
  };

  const submitRating = async (blob: Blob) => {
    try {
      await updateDoc(doc(db, 'orders', needsRating.id), { hasRated: true });
      await addDoc(collection(db, 'ratings'), {
        ratingId: `R-${Date.now()}`,
        consumerId: user.uid,
        driverId: needsRating.driverId,
        orderId: needsRating.id,
        rating: ratingStars,
        transcript: "تقييم صوتي تمت معالجته: الخدمة ممتازة والمياه جيدة.", // Simulated Gemini transcription for rating
        createdAt: serverTimestamp()
      });
      setIsRating({ orderId: '', driverId: '' });
    } catch(err) {}
  };

  return (
    <div className="space-y-6">
      {/* Loyalty Header */}
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-3xl border border-brand-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500">حسابك في برنامج الولاء</p>
            <p className="text-lg font-bold text-brand-primary">الفئة الذهبية • {profile.loyaltyPoints || 1200} نقطة</p>
          </div>
        </div>
        <div className="hidden md:block text-sm text-brand-muted">
          خصم ١٠٪ على الطلبات المستعجلة
        </div>
      </div>

      {needsRating && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-brand-surface p-6 flex flex-col md:flex-row items-center justify-between gap-4 rounded-3xl border border-brand-secondary/30">
          <div>
            <h3 className="font-bold text-lg">تقييم الخدمة</h3>
            <p className="text-sm text-brand-muted">كيف كانت تجربتك السابقة؟ شاركنا بتقييم صوتي.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRatingStars(s)}><Star className={`w-6 h-6 ${s <= ratingStars ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} /></button>
              ))}
            </div>
            <button 
              onClick={isRecordingRating ? stopRatingRecording : startRatingRecording}
              className={`p-3 rounded-full text-white transition-colors flex items-center gap-2 ${isRecordingRating ? 'bg-red-500 animate-pulse' : 'bg-brand-primary'}`}
            >
              {isRecordingRating ? <Square className="w-5 h-5 fill-current"/> : <Mic className="w-5 h-5"/>}
              <span className="font-bold text-sm">{isRecordingRating ? 'إيقاف التسجيل' : 'سجل تقييمك'}</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Active Order with Details & Map */}
      <AnimatePresence>
        {activeOrder && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col md:flex-row gap-6"
          >
            {/* Map Simulation */}
            <div className="flex-[1.5] bg-white rounded-[32px] border border-brand-border overflow-hidden relative shadow-sm h-[400px]">
              <div className="absolute inset-0 bg-brand-border" style={{ backgroundImage: 'radial-gradient(#d1ccc0 1.5px, transparent 1.5px)', backgroundSize: '30px 30px' }}>
                <div className="absolute top-20 left-[40%] w-12 h-12 bg-brand-primary/20 rounded-full flex items-center justify-center animate-pulse">
                  <div className="w-4 h-4 bg-brand-primary rounded-full border-2 border-white"></div>
                </div>
                {activeOrder.status !== 'pending' && (
                  <div className="absolute bottom-40 right-[20%] w-12 h-12 bg-brand-secondary/30 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 bg-brand-secondary rounded-full border-2 border-white"></div>
                  </div>
                )}
                <div className="absolute top-28 left-[40%] bg-white/90 px-2 py-1 rounded shadow-sm text-[10px] font-bold">موقعك</div>
                {activeOrder.status !== 'pending' && <div className="absolute bottom-48 right-[20%] bg-white/90 px-2 py-1 rounded shadow-sm text-[10px] font-bold text-brand-secondary">السائق</div>}
              </div>

              {activeOrder.status === 'delivering' && (
                <div className="absolute top-6 left-6 right-6 flex gap-2">
                  <div className="bg-white/95 p-3 rounded-2xl shadow-sm border border-brand-border flex items-center gap-3 w-full">
                    <div className="bg-yellow-100 text-yellow-700 p-2 rounded-xl"><Bell className="w-5 h-5 animate-bounce"/></div>
                    <div>
                      <p className="font-bold text-sm">السائق قريب منك!</p>
                      <p className="text-xs text-brand-muted">الوصول المتوقع خلال ١٢ دقيقة</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Order Controls */}
            <div className="flex-1 flex flex-col gap-4">
              <div className="bg-brand-primary p-6 rounded-3xl text-white shadow-md">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-white/80 text-xs font-bold uppercase tracking-wider block mb-1">حالة الطلب</span>
                    <h3 className="text-2xl font-bold">جاري {activeOrder.status === 'pending' ? 'البحث عن سائق' : activeOrder.status === 'accepted' ? 'تجهيز الوايت' : 'التوصيل'}</h3>
                  </div>
                  <div className="bg-white/20 p-3 rounded-2xl">
                    {activeOrder.status === 'pending' ? <Clock className="animate-pulse" /> : <Droplets className="animate-bounce" />}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-white/10 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-white/60 block mb-1">الكمية</span>
                    <span className="font-bold text-sm tracking-wide">{activeOrder.capacity} لتر</span>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-white/60 block mb-1">التكلفة المتوقعة</span>
                    <span className="font-bold text-sm">6,500 ريال</span>
                  </div>
                </div>

                {activeOrder.status === 'pending' && (
                  <button onClick={() => cancelOrder(activeOrder.id)} className="w-full bg-white/20 hover:bg-white/30 text-white py-3 rounded-xl font-bold transition-all text-sm">
                    إلغاء الطلب
                  </button>
                )}
              </div>

              {driverInfo && (
                <div className="bg-white p-5 rounded-3xl border border-brand-border flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand-surface rounded-full flex items-center justify-center text-lg font-bold">
                      {driverInfo.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{driverInfo.name} <span className="text-yellow-500 ml-1">★ 4.9</span></p>
                      <p className="text-xs text-brand-muted">رقم اللوحة: 1234/ب</p>
                    </div>
                    <button onClick={() => setShowChat(!showChat)} className="mr-auto p-2 border-2 border-brand-border rounded-xl text-brand-primary">
                      <MessageSquare className="w-5 h-5"/>
                    </button>
                  </div>
                  
                  <div className="bg-[#5a5a40] p-3 rounded-xl text-white flex gap-3 items-center">
                    <div className="bg-white/20 p-2 rounded-full"><Shield className="w-4 h-4"/></div>
                    <div>
                      <p className="text-xs font-bold">جودة مياه مضمونة</p>
                      <p className="text-[10px] opacity-80">المصدر: {driverInfo.waterQualityStatus || 'محطة تحلية الغيل (مفحوص)'}</p>
                    </div>
                  </div>
                </div>
              )}

              {showChat && activeOrder && driverInfo && (
                <div className="flex-1 min-h-[300px]">
                  <Chat orderId={activeOrder.id} currentUserId={user.uid} otherPartyName={driverInfo.name} />
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Request Form (If No Active Order) */}
      {!activeOrder && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-brand-primary p-8 rounded-[32px] text-white flex flex-col items-center justify-center text-center shadow-md min-h-[300px]">
            <h2 className="text-2xl font-bold mb-2">اطلب وايت بصوتك</h2>
            <p className="text-sm text-white/70 mb-8">اضغط وتحدث، نحن نحدد موقعك وحاجتك تلقائياً</p>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={loading}
              className={`w-28 h-28 bg-white/20 rounded-full flex items-center justify-center border-4 border-white shadow-xl hover:bg-white/30 transition-all ${isRecording ? 'animate-pulse bg-red-500/80 border-red-200' : ''}`}
            >
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-inner">
                {loading ? <Loader2 className="w-8 h-8 text-brand-primary animate-spin" /> : isRecording ? <Square className="w-8 h-8 text-red-500 fill-current" /> : <Mic className="w-8 h-8 text-brand-primary" />}
              </div>
            </button>
            <p className="mt-6 text-xs font-bold opacity-80 uppercase tracking-widest">{isRecording ? 'جاري الاستماع...' : loading ? 'جاري المعالجة...' : 'اضغط للتسجيل'}</p>
          </div>

          <div className="bg-white border border-brand-border rounded-[32px] p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold mb-4 flex items-center justify-between">
                <span>خيارات سريعة</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <button className="bg-white border-2 border-brand-surface hover:border-brand-primary p-4 rounded-2xl flex flex-col items-center gap-2 transition-colors">
                  <span className="text-2xl">💧</span>
                  <span className="text-xs font-bold text-gray-700">3000 لتر - عادي</span>
                </button>
                <button className="bg-white border-2 border-brand-surface hover:border-brand-primary p-4 rounded-2xl flex flex-col items-center gap-2 transition-colors">
                  <span className="text-2xl">🌊</span>
                  <span className="text-xs font-bold text-gray-700">5000 لتر - عادي</span>
                </button>
                <button className="bg-white border-2 border-brand-surface hover:border-brand-secondary p-4 rounded-2xl flex flex-col items-center gap-2 transition-colors col-span-2">
                  <span className="text-2xl">⚡</span>
                  <span className="text-xs font-bold text-brand-secondary">طلب مستعجل (خصم ١٠٪)</span>
                </button>
              </div>
            </div>
            
            <div className="mt-8 border-t border-brand-surface pt-4">
               <div className="bg-brand-surface p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Award className="w-5 h-5 text-brand-primary"/>
                    <div>
                      <p className="text-xs font-bold">باقة البيت الدائم</p>
                      <p className="text-[10px] text-gray-500">ميزة الجدولة التلقائية مفعلة</p>
                    </div>
                  </div>
                  <button className="text-xs font-bold text-brand-primary">تعديل</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div className="bg-white border border-brand-border rounded-[32px] p-6">
        <h3 className="text-sm font-bold mb-6 flex items-center justify-between">
          <span>النشاط الأخير</span>
          <span className="text-[10px] text-brand-primary font-bold cursor-pointer">عرض الكل</span>
        </h3>
        {orders.length === 0 ? (
          <div className="p-8 text-center text-brand-muted text-sm border-2 border-dashed border-brand-surface rounded-2xl">
            لا توجد طلبات سابقة
          </div>
        ) : (
          <div className="space-y-4">
            {orders.slice(0, 3).map((order) => (
              <div key={order.id} className="flex items-center gap-4 pb-4 border-b border-brand-surface last:border-0 last:pb-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm ${order.status === 'completed' ? 'bg-green-50 text-green-600' : order.status === 'cancelled' ? 'bg-gray-50 text-gray-400' : 'bg-blue-50 text-blue-600'}`}>
                  {order.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : order.status === 'cancelled' ? <XCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold">{order.status === 'completed' ? 'تم اكتمال التعبئة' : order.status === 'cancelled' ? 'تم الإلغاء' : 'طلب قيد التنفيذ'} - {order.capacity} لتر</p>
                  <p className="text-[10px] text-brand-muted">
                    {order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleString('ar-YE', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' }) : ''} • {order.locationDescription}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-brand-text">6,500 ريال</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
