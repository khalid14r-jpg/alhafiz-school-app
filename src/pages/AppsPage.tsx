import React from 'react';
import { 
  Sparkles, 
  Gamepad2, 
  Puzzle, 
  BrainCircuit, 
  Rocket,
  FlaskConical,
  Calculator,
  Compass,
  Cpu
} from 'lucide-react';
import { motion } from 'motion/react';

const AppsPage = () => {
  const apps = [
    { title: 'مختبر العلوم الافتراضي', icon: FlaskConical, color: 'bg-blue-100 text-blue-600', description: 'تجارب علمية تفاعلية في بيئة آمنة.' },
    { title: 'تحدي الحساب الذهني', icon: Calculator, color: 'bg-emerald-100 text-emerald-600', description: 'طور مهاراتك الرياضية من خلال ألعاب سريعة.' },
    { title: 'استعداد اختبار نافس', icon: BrainCircuit, color: 'bg-amber-100 text-amber-600', description: 'مسار تعليمي شامل لمراجعة المهارات الأساسية والاستعداد لاختبارات نافس الوطنية.' },
    { title: 'نادي البرمجة', icon: Cpu, color: 'bg-violet-100 text-violet-600', description: 'تعلم أساسيات البرمجة بطريقة ممتعة وبسيطة.' },
  ];

  return (
    <div className="p-4 md:p-8 transition-colors duration-300">
      <div className="mb-12">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">التطبيقات التعليمية</h1>
        <p className="text-slate-500">مجموعة من الأدوات والألعاب التفاعلية لتعزيز تجربة التعلم.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apps.map((app, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-violet-100 transition-all group cursor-pointer"
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${app.color}`}>
              <app.icon className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-violet-600 transition-colors">{app.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">{app.description}</p>
            <div className="flex items-center gap-2 text-violet-600 font-bold text-sm mb-2">
              <span>فتح التطبيق</span>
              <Rocket className="w-4 h-4" />
            </div>
            <p className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-lg inline-block">
              هذه الصفحة قيد التطوير حالياً... 🚧
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 p-12 bg-violet-600 rounded-[40px] text-center text-white relative overflow-hidden shadow-2xl shadow-violet-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="relative z-10">
          <Sparkles className="w-12 h-12 mx-auto mb-6 opacity-50" />
          <h2 className="text-3xl font-bold mb-4">المزيد من التطبيقات قريباً!</h2>
          <p className="text-violet-100 max-w-md mx-auto">نحن نعمل باستمرار على إضافة أدوات تعليمية جديدة ومبتكرة لجعل تعلمك أكثر متعة.</p>
        </div>
      </div>
    </div>
  );
};

export default AppsPage;
