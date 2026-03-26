import React, { useState, useEffect } from 'react';
import { 
  BookOpen, ChevronRight, ChevronLeft, 
  CheckCircle2, Circle, Trophy, Sparkles, 
  ArrowRight, PlayCircle, FileText, HelpCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { Path, Lesson } from '../types';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

const PathDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [path, setPath] = useState<Path | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const pathDocRef = doc(db, 'paths', id);
        const pathSnap = await getDoc(pathDocRef);
        
        if (pathSnap.exists()) {
          setPath({ id: pathSnap.id, ...pathSnap.data() } as Path);
          
          // Fetch lessons
          try {
            const lessonsRef = collection(db, 'paths', id, 'lessons');
            const lessonsQuery = query(lessonsRef, orderBy('order_index', 'asc'));
            const lessonsSnap = await getDocs(lessonsQuery);
            
            // Fetch page counts for each lesson in parallel
            const lessonsData = await Promise.all(lessonsSnap.docs.map(async (docSnap) => {
              try {
                const pagesSnap = await getDocs(collection(db, 'paths', id, 'lessons', docSnap.id, 'pages'));
                return { 
                  id: docSnap.id, 
                  page_count: pagesSnap.size,
                  ...docSnap.data() 
                } as Lesson;
              } catch (pageErr) {
                console.error(`Error fetching pages for lesson ${docSnap.id}:`, pageErr);
                return {
                  id: docSnap.id,
                  page_count: 0,
                  ...docSnap.data()
                } as Lesson;
              }
            }));
            
            setLessons(lessonsData);
          } catch (lessonErr) {
            console.error("Error fetching lessons:", lessonErr);
            handleFirestoreError(lessonErr, OperationType.LIST, `paths/${id}/lessons`);
          }
        }

        if (user) {
          try {
            const progressRef = collection(db, 'users', user.id, 'progress');
            const progressSnap = await getDocs(progressRef);
            const completed = new Set<string>();
            progressSnap.forEach((doc) => {
              if (doc.data().completed) completed.add(doc.id);
            });
            setCompletedLessons(completed);
          } catch (progressErr) {
            console.error("Error fetching progress:", progressErr);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `paths/${id}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, user]);

  if (isLoading) return <div className="p-12 text-center">جاري تحميل المسار...</div>;
  if (!path) return <div className="p-12 text-center">المسار غير موجود.</div>;

  const completedInThisPath = lessons.filter(l => completedLessons.has(l.id)).length;
  const progress = lessons.length > 0 ? Math.min(100, Math.round((completedInThisPath / lessons.length) * 100)) : 0;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto transition-colors duration-300">
      {/* Hero Section */}
      <div className="relative h-64 md:h-80 rounded-[40px] overflow-hidden mb-12 shadow-2xl">
        <img src={path.image_url || `https://picsum.photos/seed/path-${path.id}/1200/400`} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-8 md:p-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-violet-600 text-white px-4 py-1 rounded-full text-xs font-bold">{path.category}</span>
            <span className="bg-white/20 backdrop-blur-md text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-2">
              <BookOpen className="w-3 h-3" />
              {lessons.length} دروس
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">{path.title}</h1>
          {path.description && (
            <p className="text-white/80 text-sm md:text-base mb-6 max-w-2xl line-clamp-2">{path.description}</p>
          )}
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-emerald-400"
              />
            </div>
            <span className="text-white text-sm font-bold">{progress}% مكتمل</span>
          </div>
        </div>
      </div>

      {/* Lessons List */}
      <div className="space-y-12">
        <h2 className="text-2xl font-bold text-slate-800 px-4">محتوى المسار</h2>
        
        <div className="grid grid-cols-1 gap-4">
          {lessons.map((lesson, idx) => {
            const isCompleted = completedLessons.has(lesson.id);
            return (
              <motion.div 
                key={lesson.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-violet-100 transition-all group"
              >
                <div className="flex items-center gap-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 transition-colors ${
                    isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:bg-violet-100 group-hover:text-violet-600'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : idx + 1}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-violet-600 transition-colors">{lesson.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {lesson.page_count || 0} صفحات
                      </span>
                      <span className="flex items-center gap-1">
                        <PlayCircle className="w-3 h-3" />
                        {lesson.source}
                      </span>
                    </div>
                  </div>

                  <Link 
                    to={`/path/${path.id}/lesson/${lesson.id}`}
                    className={`px-8 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 ${
                      isCompleted 
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                        : 'bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-100'
                    }`}
                  >
                    {isCompleted ? 'مراجعة الدرس' : 'ابدأ التعلم'}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PathDetails;
