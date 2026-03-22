import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  BookOpen, ChevronLeft, CheckCircle2, Grid, FlaskConical, Users, 
  Calculator, Languages, Cpu, Palette, HeartHandshake, Sparkles, FileCheck 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Path, Lesson } from '../types';
import { collection, query, getDocs, onSnapshot, doc, getDoc, collectionGroup, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

const CategoryBar = ({ activeCategory, setActiveCategory }: { activeCategory: string, setActiveCategory: (cat: string) => void }) => {
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
    <div className="bg-white rounded-2xl border border-slate-100 p-2 flex items-center gap-2 mb-8 shadow-sm overflow-x-auto no-scrollbar transition-colors duration-300">
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

const HomePage = () => {
  const [paths, setPaths] = useState<Path[]>([]);
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [myLessons, setMyLessons] = useState<(Lesson & { created_at?: any, completed?: boolean, path_id?: string })[]>([]);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'not_completed'>('all');
  const { user } = useAuth();

  useEffect(() => {
    // Fetch all paths and their lesson counts
    const unsubscribePaths = onSnapshot(collection(db, 'paths'), async (snapshot) => {
      const pathsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Path));
      const sortedPaths = pathsData.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

      const pathsPromises = sortedPaths.map(async (path) => {
        // Fetch actual lesson count
        const lessonsSnap = await getDocs(collection(db, 'paths', path.id, 'lessons'));
        const lessonCount = lessonsSnap.size;

        return { 
          ...path,
          lesson_count: lessonCount 
        } as Path;
      });

      const resolvedPaths = await Promise.all(pathsPromises);
      setPaths(resolvedPaths);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'paths');
    });

    return () => unsubscribePaths();
  }, []);

  useEffect(() => {
    if (!user) {
      setMyLessons([]);
      setCompletedLessons(new Set());
      return;
    }

    // Fetch user progress
    const unsubscribeProgress = onSnapshot(collection(db, 'users', user.id, 'progress'), async (snapshot) => {
      const completed = new Set<string>();
      const lessons: any[] = [];
      
      const lessonPromises = snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        if (data.completed) completed.add(docSnap.id);
        
        let actualPageCount = data.page_count || 0;
        
        // If page_count is missing or 0, try to fetch it from the actual lesson pages
        if (!actualPageCount && data.path_id && data.path_id !== 'undefined') {
          try {
            const pagesSnap = await getDocs(collection(db, 'paths', data.path_id, 'lessons', docSnap.id, 'pages'));
            actualPageCount = pagesSnap.size;
          } catch (e) {
            console.error("Error fetching actual page count:", e);
          }
        }
        
        return {
          id: docSnap.id,
          path_id: data.path_id,
          title: data.lesson_title,
          path_title: data.path_title,
          category: data.category,
          image_url: data.image_url || `https://picsum.photos/seed/lesson-${docSnap.id}/800/450`,
          source: 'منصة الرياضيات',
          duration: '10 دقائق',
          page_count: actualPageCount,
          created_at: data.registered_at,
          last_accessed_at: data.last_accessed_at,
          completed: !!data.completed
        };
      });

      const resolvedLessons = await Promise.all(lessonPromises);
      
      setCompletedLessons(completed);
      setMyLessons(resolvedLessons);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.id}/progress`);
    });

    return () => unsubscribeProgress();
  }, [user]);

  const pathsWithProgress = useMemo(() => {
    return paths.map(path => {
      const completedInPath = myLessons.filter(l => l.path_id === path.id && l.completed).length;
      return {
        ...path,
        completed_count: completedInPath
      };
    });
  }, [paths, myLessons]);

  const filteredAndSortedLessons = useMemo(() => {
    let result = [...myLessons];

    // Filter
    if (filterStatus === 'completed') {
      result = result.filter(l => l.completed);
    } else if (filterStatus === 'not_completed') {
      result = result.filter(l => !l.completed);
    }

    // Sort
    result.sort((a, b) => {
      const dateA = a.last_accessed_at?.toDate?.()?.getTime() || a.last_accessed_at?.seconds * 1000 || 0;
      const dateB = b.last_accessed_at?.toDate?.()?.getTime() || b.last_accessed_at?.seconds * 1000 || 0;
      
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [myLessons, sortBy, filterStatus]);

  return (
    <div className="p-4 md:p-8">
      {/* My Lessons Section */}
      <section className="mb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h2 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
            دروسي
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </h2>

          {user && myLessons.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" dir="rtl">
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-100 shadow-sm transition-colors duration-300">
                <button 
                  onClick={() => setSortBy('newest')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${sortBy === 'newest' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  الأحدث
                </button>
                <button 
                  onClick={() => setSortBy('oldest')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${sortBy === 'oldest' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  الأقدم
                </button>
              </div>

              <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block" />

              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-100 shadow-sm transition-colors duration-300">
                <button 
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${filterStatus === 'all' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  الكل
                </button>
                <button 
                  onClick={() => setFilterStatus('completed')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${filterStatus === 'completed' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  مكتمل
                </button>
                <button 
                  onClick={() => setFilterStatus('not_completed')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${filterStatus === 'not_completed' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  قيد الدراسة
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredAndSortedLessons.map(lesson => (
            <Link key={lesson.id} to={`/path/${lesson.path_id}/lesson/${lesson.id}`} className="group">
              <motion.div whileHover={{ y: -5 }} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 group-hover:shadow-xl transition-all duration-300">
                <div className="aspect-video relative">
                  <img src={lesson.image_url || undefined} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {lesson.page_count || 0} صفحة
                  </div>
                  {completedLessons.has(lesson.id) ? (
                    <div className="absolute top-3 left-3 bg-emerald-500 text-white px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="text-[8px] font-bold">مكتمل</span>
                    </div>
                  ) : (
                    <div className="absolute top-3 left-3 bg-amber-500 text-white px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      <span className="text-[8px] font-bold">قيد الدراسة</span>
                    </div>
                  )}
                </div>
                <div className="p-4 md:p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-violet-50 text-violet-600 px-2 py-0.5 rounded-md text-[8px] font-bold">
                      {lesson.category || 'رياضيات'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">{lesson.path_title || 'الأعداد والعمليات'}</span>
                  </div>
                  <h3 className="text-sm md:text-base font-bold text-slate-800 mb-1 group-hover:text-violet-600 transition-colors truncate">{lesson.title}</h3>
                </div>
              </motion.div>
            </Link>
          ))}
          {user && myLessons.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200 transition-colors duration-300">
              <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400">لم تبدأ أي دروس بعد. استكشف المسارات التعليمية وابدأ التعلم!</p>
            </div>
          )}
        </div>
      </section>

      {/* Category Filter */}
      <CategoryBar activeCategory={activeCategory} setActiveCategory={setActiveCategory} />

      {/* Lesson Library Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
            المسارات التعليمية
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {pathsWithProgress
            .filter(p => activeCategory === 'الكل' || p.category === activeCategory)
            .map((path) => (
            <Link key={path.id} to={`/path/${path.id}`} className="group">
              <motion.div 
                whileHover={{ y: -5 }}
                className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 group-hover:shadow-xl transition-all duration-300 h-full flex flex-col"
              >
                <div className="aspect-video relative">
                  <img src={path.image_url || undefined} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {path.lesson_count || 0} درس
                  </div>
                </div>
                <div className="p-4 md:p-5 flex-1 flex flex-col">
                  <h3 className="text-sm md:text-base font-bold text-slate-800 mb-4 group-hover:text-violet-600 transition-colors text-center">{path.title}</h3>
                  
                  {user && user.role === 'student' && (
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-slate-400 font-bold">التقدم</span>
                        <span className="text-[10px] text-violet-600 font-bold">
                          {Math.min(100, Math.round(((path.completed_count || 0) / (path.lesson_count || 1)) * 100))}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, ((path.completed_count || 0) / (path.lesson_count || 1)) * 100)}%` }}
                          className="h-full bg-violet-500 rounded-full"
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-[10px] text-violet-600 font-bold">{path.category}</span>
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
