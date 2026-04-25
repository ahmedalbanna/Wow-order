import { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, orderBy } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Square, Loader2, MapPin, CheckCircle2, Clock, XCircle, Droplets } from 'lucide-react';
import { processVoiceOrder } from '../services/geminiService';

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
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        // 1. Process with Gemini
        const aiResult = await processVoiceOrder(base64Audio);
        
        // 2. Create order in Firestore
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
      console.error(err);
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
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const activeOrder = orders.find(o => ['pending', 'accepted', 'delivering'].includes(o.status));

  return (
    <div className="space-y-8">
      {/* Active Order Highlight */}
      <AnimatePresence>
        {activeOrder && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-brand-primary p-6 rounded-3xl text-white shadow-xl shadow-brand-primary/20"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-white/80 text-sm font-bold uppercase tracking-wider">طلب نشط</span>
                <h3 className="text-2xl font-bold">جاري {activeOrder.status === 'pending' ? 'البحث عن سائق' : activeOrder.status === 'accepted' ? 'تجهيز الوايت' : 'التوصيل'}</h3>
              </div>
              <div className="bg-white/20 p-3 rounded-2xl">
                {activeOrder.status === 'pending' ? <Clock className="animate-pulse" /> : <Droplets className="animate-bounce" />}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/10 p-4 rounded-2xl">
                <span className="text-xs text-white/60 block mb-1">الكمية</span>
                <span className="font-bold">{activeOrder.capacity} لتر</span>
              </div>
              <div className="bg-white/10 p-4 rounded-2xl">
                <span className="text-xs text-white/60 block mb-1">الموقع</span>
                <span className="font-bold truncate">{activeOrder.locationDescription}</span>
              </div>
            </div>

            {activeOrder.status === 'pending' && (
              <button 
                onClick={() => cancelOrder(activeOrder.id)}
                className="w-full bg-white/20 hover:bg-white/30 text-white py-3 rounded-xl font-bold transition-all"
              >
                إلغاء الطلب
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Action Card */}
      {!activeOrder && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-brand-secondary/10 rounded-full flex items-center justify-center">
              <Mic className="w-10 h-10 text-brand-secondary" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2">اطلب وايت مياه الحين</h2>
          <p className="text-gray-500 mb-8">سجل بصوتك الموقع والكمية، والذكاء الاصطناعي بيشوف الباقي.</p>

          <div className="flex flex-col items-center gap-4">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={loading}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 shadow-lg shadow-red-500/40 animate-pulse' : 'bg-brand-primary shadow-lg shadow-brand-primary/40'}`}
            >
              {loading ? (
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              ) : isRecording ? (
                <Square className="w-10 h-10 text-white fill-current" />
              ) : (
                <Mic className="w-10 h-10 text-white" />
              )}
            </motion.button>
            <span className={`font-bold transition-colors ${isRecording ? 'text-red-500' : 'text-brand-primary'}`}>
              {loading ? 'جاري معالجة طلبك...' : isRecording ? 'جاري التسجيل... اضغط للتوقف' : 'اضغط زر الميكروفون للطلب'}
            </span>
          </div>

          {error && <p className="mt-4 text-red-500 text-sm font-bold bg-red-50 p-2 rounded-lg">{error}</p>}
        </div>
      )}

      {/* Order History */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold px-2">تاريخ الطلبات</h3>
        {orders.length === 0 ? (
          <div className="p-12 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-3xl">
            لا توجد طلبات سابقة
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white p-6 rounded-2xl border border-gray-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${order.status === 'completed' ? 'bg-green-50 text-green-600' : order.status === 'cancelled' ? 'bg-gray-50 text-gray-400' : 'bg-blue-50 text-blue-600'}`}>
                    {order.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : order.status === 'cancelled' ? <XCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="font-bold">{order.capacity} لتر</h4>
                    <p className="text-sm text-gray-500 truncate max-w-[150px]">{order.locationDescription}</p>
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-xs text-gray-400 block mb-1">
                    {new Date(order.createdAt?.seconds * 1000).toLocaleDateString('ar-YE', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                    order.status === 'completed' ? 'bg-green-100 text-green-700' : 
                    order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {order.status === 'completed' ? 'تم التوصيل' : order.status === 'cancelled' ? 'ملغي' : 'قيد التنفيذ'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
