import React, { useState, useEffect, Fragment } from 'react';
import { 
  BookOpen, Trophy, Sparkles, 
  User, GraduationCap, 
  CheckCircle2, Circle, ChevronDown, ListChecks
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Path } from '../types';
import { 
  collection, 
  getDocs, 
  doc, 
  query, 
  where, 
  onSnapshot,
  collectionGroup
} from 'firebase/firestore';
import { db } from '../firebase';

interface ReportData {
  username: string;
  first_name?: string;
  father_name?: string;
  grandfather_name?: string;
  family_name?: string;
  grade?: string;
  school_name?: string;
  path_title: string;
  path_category: string;
  path_id: string;
  total_lessons_in_path: number;
  completed_lessons: number;
  total_correct: number;
  total_questions: number;
}

const ReportsPage = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportData[]>([]);
  const [paths, setPaths] = useState<Path[]>([]);
  const [allLessons, setAllLessons] = useState<any[]>([]);
  const [allProgress, setAllProgress] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [studentFilter, setStudentFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [pathFilter, setPathFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    setIsLoading(true);

    // 1. Fetch Paths
    const unsubscribePaths = onSnapshot(collection(db, 'paths'), (snapshot) => {
      const pathsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Path));
      const sortedPaths = pathsData.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      setPaths(sortedPaths);
    }, (err) => {
      console.error("Error fetching paths:", err);
    });

    // 2. Fetch All Lessons
    const unsubscribeLessons = onSnapshot(collectionGroup(db, 'lessons'), (snapshot) => {
      const lessonsData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        path_id: doc.ref.parent.parent?.id,
        ...doc.data() 
      } as any));
      const sortedLessons = lessonsData.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      setAllLessons(sortedLessons);
    }, (err) => {
      console.error("Error fetching all lessons:", err);
    });

    let unsubscribeUsers = () => {};
    let unsubscribeProgress = () => {};

    if (user.role === 'admin' || user.role === 'teacher') {
      // 3. Fetch All Users
      unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersData);
      }, (err) => {
        console.error("Error fetching all users:", err);
      });

      // 4. Fetch All Progress
      unsubscribeProgress = onSnapshot(collectionGroup(db, 'progress'), (snapshot) => {
        const progressData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          user_id: doc.ref.parent.parent?.id,
          ...doc.data() 
        }));
        setAllProgress(progressData);
        setIsLoading(false);
      }, (err) => {
        console.error("Error fetching all progress:", err);
        setIsLoading(false);
      });
    } else {
      // 3. Fetch Student's Own Progress
      unsubscribeProgress = onSnapshot(collection(db, 'users', user.id, 'progress'), (snapshot) => {
        const progressData = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          user_id: user.id,
          ...doc.data() 
        }));
        setAllProgress(progressData);
        setIsLoading(false);
      }, (err) => {
        console.error("Error fetching own progress:", err);
        setIsLoading(false);
      });
    }

    return () => {
      unsubscribePaths();
      unsubscribeLessons();
      unsubscribeUsers();
      unsubscribeProgress();
    };
  }, [user]);

  useEffect(() => {
    if (paths.length > 0 && allLessons.length > 0 && allProgress.length > 0) {
      const newReports: ReportData[] = [];
      
      const targetUsers = (user?.role === 'admin' || user?.role === 'teacher') 
        ? users.filter(u => u.role === 'student') 
        : users.filter(u => u.id === user?.id);
      
      // If we are a student and users list is empty (because we didn't fetch it), 
      // we need to at least have the current user info.
      const displayUsers = targetUsers.length > 0 ? targetUsers : (user && user.role === 'student' ? [{
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        father_name: user.father_name,
        grandfather_name: user.grandfather_name,
        family_name: user.family_name,
        grade: user.grade,
        school_name: user.school_name
      }] : []);

      displayUsers.forEach(u => {
        paths.forEach(path => {
          const pathLessons = allLessons.filter(l => l.path_id === path.id);
          if (pathLessons.length === 0) return;

          let completedCount = 0;
          let totalCorrect = 0;
          let totalQuestions = 0;
          let hasAnyProgress = false;

          pathLessons.forEach(lesson => {
            const progress = allProgress.find(p => p.user_id === u.id && p.lesson_id === lesson.id);
            if (progress) {
              hasAnyProgress = true;
              if (progress.completed) completedCount++;
              totalCorrect += (progress.correct_answers || 0);
              totalQuestions += (progress.total_questions || 0);
            }
          });

          // Only show in reports if there's some progress or if it's the student looking at their own paths
          if (hasAnyProgress || user?.role === 'student') {
            newReports.push({
              username: u.username,
              first_name: u.first_name,
              father_name: u.father_name,
              grandfather_name: u.grandfather_name,
              family_name: u.family_name,
              grade: u.grade,
              school_name: u.school_name,
              path_title: path.title,
              path_category: path.category || 'عام',
              path_id: path.id,
              total_lessons_in_path: pathLessons.length,
              completed_lessons: completedCount,
              total_correct: totalCorrect,
              total_questions: totalQuestions
            });
          }
        });
      });

      setReports(newReports);
    }
  }, [paths, allLessons, allProgress, users, user]);

  const getFullName = (r: any) => {
    return [r.first_name, r.father_name, r.grandfather_name, r.family_name].filter(Boolean).join(' ') || r.username;
  };

  const filteredReports = reports.filter(report => {
    const fullName = getFullName(report);
    const matchesSearch = searchTerm === '' || fullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStudent = studentFilter === 'all' || fullName === studentFilter;
    const matchesGrade = gradeFilter === 'all' || report.grade === gradeFilter;
    const matchesSchool = schoolFilter === 'all' || report.school_name === schoolFilter;
    const matchesPath = pathFilter === 'all' || report.path_title === pathFilter;
    const matchesCategory = categoryFilter === 'all' || report.path_category === categoryFilter;
    
    const percentage = report.total_questions > 0 
      ? (report.total_correct / report.total_questions) * 100 
      : 0;
    
    let matchesPerformance = true;
    if (performanceFilter === 'excellent') matchesPerformance = percentage >= 80;
    else if (performanceFilter === 'good') matchesPerformance = percentage >= 50 && percentage < 80;
    else if (performanceFilter === 'needs-improvement') matchesPerformance = percentage < 50;

    return matchesSearch && matchesStudent && matchesGrade && matchesSchool && matchesPath && matchesCategory && matchesPerformance;
  });

  const uniquePaths = Array.from(new Set(reports.map(r => r.path_title)));
  const uniqueCategories = Array.from(new Set(reports.map(r => r.path_category)));
  const uniqueStudents = Array.from(new Set(reports.map(r => getFullName(r)))).sort();
  const uniqueGrades = Array.from(new Set(reports.map(r => r.grade).filter(Boolean))).sort();
  const uniqueSchools = Array.from(new Set(reports.map(r => r.school_name).filter(Boolean))).sort();

  const clearFilters = () => {
    setStudentFilter('all');
    setGradeFilter('all');
    setSchoolFilter('all');
    setPathFilter('all');
    setCategoryFilter('all');
    setPerformanceFilter('all');
    setSearchTerm('');
  };

  const toggleRow = (username: string, pathId: string) => {
    const rowId = `${username}-${pathId}`;
    if (expandedRow === rowId) {
      setExpandedRow(null);
      return;
    }
    setExpandedRow(rowId);
  };

  const getRowDetails = (username: string, pathId: string) => {
    const u = users.find(u => u.username === username) || (user?.username === username ? user : null);
    if (!u) return [];

    const pathLessons = allLessons.filter(l => l.path_id === pathId);
    return pathLessons.map(lesson => {
      const progress = allProgress.find(p => p.user_id === u.id && p.lesson_id === lesson.id);
      return {
        lesson_id: lesson.id,
        lesson_title: lesson.title,
        completed: progress?.completed || false,
        correct_answers: progress?.correct_answers || 0,
        total_questions: progress?.total_questions || 0
      };
    });
  };

  if (isLoading) return <div className="p-12 text-center">جاري تحميل البيانات...</div>;

  if (user?.role === 'student') {
    const studentPaths = paths.map(path => {
      const pathLessons = allLessons.filter(l => l.path_id === path.id);
      const completedCount = pathLessons.filter(lesson => {
        const progress = allProgress.find(p => p.user_id === user.id && p.lesson_id === lesson.id);
        return progress?.completed;
      }).length;
      
      return {
        ...path,
        lesson_count: pathLessons.length,
        completed_count: completedCount
      };
    }).filter(p => p.lesson_count > 0);

    const totalLessons = studentPaths.reduce((acc, p) => acc + (p.lesson_count || 0), 0);
    const completedCount = studentPaths.reduce((acc, p) => acc + (p.completed_count || 0), 0);
    const completedPathsCount = studentPaths.filter(p => p.lesson_count > 0 && (p.completed_count || 0) >= p.lesson_count).length;
    const overallProgress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    return (
      <div className="p-4 md:p-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">تقدمي التعليمي</h1>
          <p className="text-slate-500">نظرة شاملة على إنجازاتك ومستوى تقدمك في المسارات.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center text-violet-600">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold">الدروس المكتملة</p>
              <h3 className="text-2xl font-bold text-slate-800">{allProgress.filter(p => p.completed).length}</h3>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold">المسارات النشطة</p>
              <h3 className="text-2xl font-bold text-slate-800">{studentPaths.filter(p => (p.completed_count || 0) > 0).length}</h3>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold">المسارات المكتملة</p>
              <h3 className="text-2xl font-bold text-slate-800">{completedPathsCount}</h3>
            </div>
          </motion.div>
        </div>

        {/* Detailed Path Progress */}
        <h2 className="text-xl font-bold text-slate-800 mb-6">تفاصيل المسارات</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {studentPaths.map(path => {
            const progress = path.lesson_count ? Math.round(((path.completed_count || 0) / path.lesson_count) * 100) : 0;
            return (
              <motion.div 
                key={path.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0">
                    <img src={path.image_url || `https://picsum.photos/seed/path-${path.id}/100/100`} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800">{path.title}</h3>
                    <p className="text-xs text-slate-400">{path.category}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-violet-600">{progress}%</span>
                  </div>
                </div>
                
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-4">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-violet-500 rounded-full"
                  />
                </div>
                
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>{path.completed_count || 0} درس مكتمل</span>
                  <span>من أصل {path.lesson_count || 0}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">تقارير الطلاب</h1>
          <p className="text-slate-500">متابعة تقدم الطلاب في المسارات التعليمية المختلفة.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input 
              type="text" 
              placeholder="بحث عن طالب..." 
              className="px-4 py-2 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-violet-500 outline-none transition-all w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
          <select 
            value={schoolFilter}
            onChange={(e) => setSchoolFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-violet-500 outline-none transition-all"
          >
            <option value="all">جميع المدارس</option>
            {uniqueSchools.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {(searchTerm !== '' || studentFilter !== 'all' || gradeFilter !== 'all' || schoolFilter !== 'all' || pathFilter !== 'all' || categoryFilter !== 'all' || performanceFilter !== 'all') && (
            <button 
              onClick={clearFilters}
              className="text-xs font-bold text-violet-600 hover:text-violet-700 underline"
            >
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right" dir="rtl">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-sm font-bold text-slate-600">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>الطالب</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-slate-400" />
                    <span>المرحلة</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    <span>المسار التعليمي</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">الفئة</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600 text-center">الدروس المكتملة</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600 text-center">الدرجة الإجمالية</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Trophy className="w-4 h-4 text-slate-400" />
                    <span>النسبة المئوية</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600"></th>
              </tr>
              <tr className="bg-slate-50/30 border-b border-slate-100">
                <th className="px-4 py-2">
                  <select 
                    value={studentFilter}
                    onChange={(e) => setStudentFilter(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-[11px] bg-white font-medium"
                  >
                    <option value="all">جميع الطلاب</option>
                    {uniqueStudents.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </th>
                <th className="px-4 py-2">
                  <select 
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-[11px] bg-white font-medium"
                  >
                    <option value="all">جميع المراحل</option>
                    {uniqueGrades.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </th>
                <th className="px-4 py-2">
                  <select 
                    value={pathFilter}
                    onChange={(e) => setPathFilter(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-[11px] bg-white font-medium"
                  >
                    <option value="all">جميع المسارات</option>
                    {uniquePaths.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </th>
                <th className="px-4 py-2">
                  <select 
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-[11px] bg-white font-medium"
                  >
                    <option value="all">جميع الفئات</option>
                    {uniqueCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2"></th>
                <th className="px-4 py-2">
                  <select 
                    value={performanceFilter}
                    onChange={(e) => setPerformanceFilter(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-[11px] bg-white font-medium"
                  >
                    <option value="all">جميع المستويات</option>
                    <option value="excellent">ممتاز (80%+)</option>
                    <option value="good">جيد (50-79%)</option>
                    <option value="needs-improvement">ضعيف (أقل من 50%)</option>
                  </select>
                </th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredReports.length > 0 ? filteredReports.map((report, idx) => {
                const percentage = report.total_questions > 0 
                  ? Math.round((report.total_correct / report.total_questions) * 100) 
                  : 0;
                
                return (
                  <Fragment key={`${report.username}-${report.path_id}`}>
                    <tr className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => toggleRow(report.username, report.path_id)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-violet-600 font-bold text-xs">
                            {(report.first_name || report.username).substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700">
                              {getFullName(report)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {report.school_name || 'مدرسة غير محددة'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-600 font-medium">{report.grade || 'غير محدد'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-600 font-medium">{report.path_title}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] bg-violet-50 text-violet-600 px-2 py-1 rounded-lg font-bold">{report.path_category}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-bold text-slate-800">
                            {report.completed_lessons} / {report.total_lessons_in_path}
                          </span>
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="bg-emerald-500 h-full" 
                              style={{ width: `${(report.completed_lessons / report.total_lessons_in_path) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-bold text-slate-700">
                          {report.total_correct} / {report.total_questions}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          percentage >= 80 ? 'bg-emerald-100 text-emerald-700' :
                          percentage >= 50 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {percentage}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedRow === `${report.username}-${report.path_id}` ? 'rotate-180' : ''}`} />
                      </td>
                    </tr>
                    {expandedRow === `${report.username}-${report.path_id}` && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={8} className="px-8 py-6">
                          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <ListChecks className="w-4 h-4 text-violet-500" />
                                تفاصيل الدروس في {report.path_title}
                              </h3>
                              <span className="text-xs text-slate-500">انقر على الصف لمعرفة حالة كل درس</span>
                            </div>
                            
                            {false ? (
                              <div className="p-12 flex flex-col items-center justify-center gap-4">
                                <div className="w-8 h-8 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
                                <p className="text-sm text-slate-500 font-medium">جاري تحميل تفاصيل الدروس...</p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-right" dir="rtl">
                                  <thead>
                                    <tr className="bg-slate-50/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                      <th className="px-6 py-3">الدرس</th>
                                      <th className="px-6 py-3 text-center">الحالة</th>
                                      <th className="px-6 py-3 text-center">الدرجة</th>
                                      <th className="px-6 py-3 text-center">النسبة</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {getRowDetails(report.username, report.path_id as any)?.map((lesson) => {
                                      const lessonPercentage = lesson.total_questions > 0 
                                        ? Math.round((lesson.correct_answers / lesson.total_questions) * 100) 
                                        : 0;
                                      
                                      return (
                                        <tr key={lesson.lesson_id} className="hover:bg-slate-50/30 transition-colors">
                                          <td className="px-6 py-4">
                                            <span className="text-sm font-medium text-slate-700">{lesson.lesson_title}</span>
                                          </td>
                                          <td className="px-6 py-4 text-center">
                                            {lesson.completed ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-bold">
                                                <CheckCircle2 className="w-3 h-3" />
                                                مكتمل
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold">
                                                <Circle className="w-3 h-3" />
                                                غير مكتمل
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-6 py-4 text-center">
                                            <span className="text-sm font-bold text-slate-600">
                                              {lesson.correct_answers} / {lesson.total_questions}
                                            </span>
                                          </td>
                                          <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                  className={`h-full ${
                                                    lessonPercentage >= 80 ? 'bg-emerald-500' :
                                                    lessonPercentage >= 50 ? 'bg-amber-500' :
                                                    'bg-red-500'
                                                  }`}
                                                  style={{ width: `${lessonPercentage}%` }}
                                                />
                                              </div>
                                              <span className="text-xs font-bold text-slate-500">{lessonPercentage}%</span>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              }) : (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    لا توجد بيانات تقارير متاحة حالياً.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
