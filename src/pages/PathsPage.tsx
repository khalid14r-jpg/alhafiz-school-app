import React, { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import type { Path } from '../types';
import CategoryBar from '../components/CategoryBar';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const PathsPage = () => {
  const [paths, setPaths] = useState<Path[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('الكل');

  useEffect(() => {
    const fetchPaths = async () => {
      try {
        const pathsRef = collection(db, 'paths');
        const querySnapshot = await getDocs(pathsRef);
        
        const pathsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Path));
        const sortedPaths = pathsData.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

        // Fetch lesson counts for each path in parallel
        const finalPathsData = await Promise.all(sortedPaths.map(async (path) => {
          const lessonsSnap = await getDocs(collection(db, 'paths', path.id, 'lessons'));
          return { 
            ...path, 
            lesson_count: lessonsSnap.size
          } as Path;
        }));
        
        setPaths(finalPathsData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching paths:", err);
        setIsLoading(false);
      }
    };

    fetchPaths();
  }, []);

  if (isLoading) return <div className="p-12 text-center">جاري تحميل المسارات...</div>;

  return (
    <div className="p-4 md:p-8 transition-colors duration-300">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">المسارات التعليمية</h1>
        <p className="text-slate-500">استكشف جميع المسارات التعليمية المتاحة وابدأ رحلة التعلم.</p>
      </div>

      <CategoryBar activeCategory={activeCategory} setActiveCategory={setActiveCategory} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
        {paths
          .filter(p => activeCategory === 'الكل' || p.category === activeCategory)
          .map((path) => (
          <Link key={path.id} to={`/path/${path.id}`} className="group">
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 group-hover:shadow-xl transition-all h-full flex flex-col"
            >
              <div className="aspect-video relative">
                <img src={path.image_url || undefined} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {path.lesson_count || 0}
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-base font-bold text-slate-800 mb-4 group-hover:text-violet-600 transition-colors text-center">{path.title}</h3>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-[10px] text-violet-600 font-bold px-2 py-1 bg-violet-50 rounded-lg">{path.category}</span>
                </div>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
      
      {paths.filter(p => activeCategory === 'الكل' || p.category === activeCategory).length === 0 && (
        <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-200 mt-8">
          <BookOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400">لا توجد مسارات تعليمية متاحة في هذا القسم حالياً.</p>
        </div>
      )}
    </div>
  );
};

export default PathsPage;
