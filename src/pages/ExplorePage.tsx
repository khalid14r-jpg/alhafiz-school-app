import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle2, Plus, Compass, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import type { Lesson } from '../types';
import { useAuth } from '../context/AuthContext';
import { collectionGroup, getDocs, doc, setDoc, onSnapshot, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

const ExplorePage = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [registeredLessons, setRegisteredLessons] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        // Fetch all paths first to get categories and titles
        const pathsSnap = await getDocs(collection(db, 'paths'));
        const pathsMap: Record<string, { title: string, category: string, order_index: number }> = {};
        pathsSnap.forEach(doc => {
          const data = doc.data();
          pathsMap[doc.id] = { 
            title: data.title, 
            category: data.category,
            order_index: data.order_index ?? 0
          };
        });

        const lessonsQuery = collectionGroup(db, 'lessons');
        const querySnapshot = await getDocs(lessonsQuery);
        
        // Use Promise.all to fetch page counts in parallel
        const lessonsWithCounts = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
          const pathId = docSnap.ref.parent.parent?.id || '';
          const pathInfo = pathsMap[pathId] || { title: 'الأعداد والعمليات', category: 'رياضيات', order_index: 0 };
          
          // Fetch page count dynamically
          const pagesSnap = await getDocs(collection(db, 'paths', pathId, 'lessons', docSnap.id, 'pages'));
          const pageCount = pagesSnap.size;

          return { 
            id: docSnap.id, 
            path_id: pathId,
            path_title: pathInfo.title,
            category: pathInfo.category,
            page_count: pageCount,
            ...docSnap.data() 
          } as Lesson;
        }));

        // Sort lessons by path order_index and then by lesson order_index
        const sortedLessons = lessonsWithCounts.sort((a, b) => {
          const pathA = pathsMap[a.path_id] || { order_index: 0 };
          const pathB = pathsMap[b.path_id] || { order_index: 0 };
          
          if (pathA.order_index !== pathB.order_index) {
            return pathA.order_index - pathB.order_index;
          }
          return (a.order_index ?? 0) - (b.order_index ?? 0);
        });

        setLessons(sortedLessons);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching lessons:", err);
        setIsLoading(false);
      }
    };

    fetchLessons();

    if (user) {
      const progressRef = collection(db, 'users', user.id, 'progress');
      const unsubscribe = onSnapshot(progressRef, (snapshot) => {
        const completed = new Set<string>();
        const registered = new Set<string>();
        snapshot.forEach(doc => {
          const data = doc.data();
          registered.add(doc.id);
          if (data.completed) completed.add(doc.id);
        });
        setCompletedLessons(completed);
        setRegisteredLessons(registered);
      }, (err) => console.error("Error fetching progress:", err));

      return () => unsubscribe();
    }
  }, [user]);

  const handleRegister = async (e: React.MouseEvent, lesson: Lesson) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      const progressDocRef = doc(db, 'users', user.id, 'progress', lesson.id);
      await setDoc(progressDocRef, {
        lesson_id: lesson.id,
        path_id: lesson.path_id,
        lesson_title: lesson.title,
        path_title: lesson.path_title || 'مسار تعليمي',
        category: lesson.category || 'عام',
        image_url: lesson.image_url || '',
        page_count: lesson.page_count || 0,
        completed: false,
        correct_answers: 0,
        total_questions: 0,
        registered_at: serverTimestamp(),
        last_accessed_at: serverTimestamp(),
        updated_at: new Date().toISOString()
      });
      setRegisteredLessons(prev => new Set(prev).add(lesson.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.id}/progress/${lesson.id}`);
    }
  };

  if (isLoading) return <div className="p-12 text-center">جاري تحميل الدروس...</div>;

  return (
    <div className="p-4 md:p-8 transition-colors duration-300">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">اكتشف الدروس</h1>
        <p className="text-slate-500">استكشف جميع الدروس المتاحة في المنصة وابدأ التعلم الآن.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {lessons.map((lesson) => (
          <Link key={lesson.id} to={`/path/${lesson.path_id}/lesson/${lesson.id}`} className="group">
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 group-hover:shadow-xl transition-all h-full flex flex-col"
            >
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
                ) : registeredLessons.has(lesson.id) && (
                  <div className="absolute top-3 left-3 bg-amber-500 text-white px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    <span className="text-[8px] font-bold">قيد الدراسة</span>
                  </div>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-violet-50 text-violet-600 px-2 py-0.5 rounded-md text-[8px] font-bold">
                    {lesson.category || 'رياضيات'}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">{lesson.path_title || 'الأعداد والعمليات'}</span>
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-2 group-hover:text-violet-600 transition-colors">{lesson.title}</h3>
                <div className="mt-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">{lesson.source}</span>
                    <div className="flex items-center gap-1 text-violet-600 font-bold text-[10px]">
                      <span>ابدأ الآن</span>
                      <ChevronLeft className="w-3 h-3" />
                    </div>
                  </div>

                  {user && user.role === 'student' && (
                    <button
                      onClick={(e) => handleRegister(e, lesson)}
                      disabled={registeredLessons.has(lesson.id)}
                      className={`w-full py-2 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-2 ${
                        registeredLessons.has(lesson.id)
                          ? 'bg-slate-50 text-slate-400 cursor-default'
                          : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
                      }`}
                    >
                      {registeredLessons.has(lesson.id) ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          مسجل في دروسي
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          تسجيل في الدرس
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
      
      {lessons.length === 0 && (
        <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-200">
          <Compass className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400">لا توجد دروس متاحة حالياً.</p>
        </div>
      )}
    </div>
  );
};

export default ExplorePage;
