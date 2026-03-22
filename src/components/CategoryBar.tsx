import React from 'react';
import { 
  FlaskConical, Users, Calculator, Languages, Cpu, Palette, HeartHandshake, Sparkles, Grid, FileCheck
} from 'lucide-react';

interface CategoryBarProps {
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
}

const CategoryBar = ({ activeCategory, setActiveCategory }: CategoryBarProps) => {
  const categories = [
    { icon: Calculator, label: 'الرياضيات' },
    { icon: FlaskConical, label: 'العلوم' },
    { icon: Languages, label: 'اللغة الانجليزية' },
    { icon: Cpu, label: 'المهارات الرقمية' },
    { icon: Users, label: 'الدراسات الاجتماعية' },
    { icon: HeartHandshake, label: 'مهارات الحياة' },
    { icon: Palette, label: 'الفن والتصميم' },
    { icon: FileCheck, label: 'اختبار نافس' },
    { icon: Sparkles, label: 'الموهوبين' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-2 flex items-center gap-2 mb-8 shadow-sm overflow-x-auto no-scrollbar">
      <button 
        onClick={() => setActiveCategory('الكل')}
        className={`flex flex-col items-center gap-2 px-4 md:px-6 py-3 rounded-xl transition-colors group min-w-[100px] md:min-w-fit ${activeCategory === 'الكل' ? 'bg-violet-600 text-white' : 'hover:bg-violet-50 text-slate-600'}`}
      >
        <Grid className={`w-5 h-5 ${activeCategory === 'الكل' ? 'text-white' : 'text-slate-400 group-hover:text-violet-500'}`} />
        <span className={`text-[10px] md:text-xs font-bold whitespace-nowrap ${activeCategory === 'الكل' ? 'text-white' : 'group-hover:text-violet-700'}`}>الكل</span>
      </button>
      {categories.map((cat) => (
        <button 
          key={cat.label} 
          onClick={() => setActiveCategory(cat.label)}
          className={`flex flex-col items-center gap-2 px-4 md:px-6 py-3 rounded-xl transition-colors group min-w-[100px] md:min-w-fit ${activeCategory === cat.label ? 'bg-violet-600 text-white' : 'hover:bg-violet-50 text-slate-600'}`}
        >
          <cat.icon className={`w-5 h-5 ${activeCategory === cat.label ? 'text-white' : 'text-slate-400 group-hover:text-violet-500'}`} />
          <span className={`text-[10px] md:text-xs font-bold whitespace-nowrap ${activeCategory === cat.label ? 'text-white' : 'group-hover:text-violet-700'}`}>{cat.label}</span>
        </button>
      ))}
    </div>
  );
};

export default CategoryBar;
