import React from 'react';
import { motion } from 'motion/react';
import { Droplet, Mic, Shield, Zap } from 'lucide-react';

interface HeroProps {
  onOrderClick: () => void;
  key?: string;
}

export default function Hero({ onOrderClick }: HeroProps) {
  return (
    <div className="relative isolate">
      {/* Decorative background blobs */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div className="relative left-[calc(50%-11rem)] aspect-1155/678 w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-10 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
      </div>

      <div className="px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-8"
          >
            <div className="bg-brand-secondary/10 p-4 rounded-3xl">
              <Droplet className="w-16 h-16 text-brand-secondary fill-current animate-bounce" />
            </div>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl font-bold tracking-tight text-gray-900 sm:text-7xl mb-6"
          >
            الماي يوصلك... <br/>
            <span className="text-brand-primary">بضغطة زر</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg leading-8 text-gray-600 mb-10"
          >
            أزمة المياه في اليمن حلها صار بسيط. اطلب وايت الماي بصوتك أو عبر التطبيق، واحصل عليه بأسرع وقت وبسعر عادل.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={onOrderClick}
              className="w-full sm:w-auto bg-brand-primary text-white text-xl px-12 py-4 rounded-2xl font-bold shadow-2xl shadow-brand-primary/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <Droplet className="w-6 h-6" />
              اطلب واو الحين
            </button>
            <button
              className="w-full sm:w-auto bg-white text-gray-700 text-xl px-12 py-4 rounded-2xl font-bold border-2 border-gray-100 hover:bg-gray-50 flex items-center justify-center gap-3"
            >
              <Zap className="w-6 h-6 text-brand-primary" />
              كيف يعمل؟
            </button>
          </motion.div>
        </div>

        {/* Features Section */}
        <div className="mx-auto mt-32 max-w-7xl px-6 lg:px-8">
          <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-3">
            <Feature 
              icon={<Mic className="w-6 h-6 text-white"/>} 
              title="الطلب الصوتي" 
              desc="ما يحتاج تكتب، بس سجل بصوتك وين بيتكم وكم تبي ماي والباقي علينا."
              color="bg-purple-500"
            />
            <Feature 
              icon={<Shield className="w-6 h-6 text-white"/>} 
              title="مياه مضمونة" 
              desc="نتعامل مع أفضل السائقين ونراقب مصادر المياه لضمان جودتها ونظافتها."
              color="bg-brand-secondary"
            />
            <Feature 
              icon={<Zap className="w-6 h-6 text-white"/>} 
              title="سرعة في الفزعة" 
              desc="خوارزمية ذكية تربطك بأقرب سائق متاح في منطقتك لتوفير الوقت والجهد."
              color="bg-brand-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc, color }: { icon: React.ReactNode, title: string, desc: string, color: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="flex flex-col items-start p-8 rounded-3xl bg-white border border-gray-100 shadow-sm"
    >
      <div className={`rounded-2xl p-3 mb-6 ${color} shadow-lg shadow-${color}/20`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{desc}</p>
    </motion.div>
  );
}
