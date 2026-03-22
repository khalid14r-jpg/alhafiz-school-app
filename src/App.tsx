import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import React, { useState, useEffect, createContext, useContext, useRef, Fragment, useMemo } from 'react';
import { 
  Layout, BookOpen, Trophy, Settings, Home as HomeIcon, 
  ChevronRight, ChevronLeft, Sparkles, Plus, Trash2, 
  Search, Bell, User, Grid, Compass, BarChart3, AppWindow, Clock,
  FlaskConical, Globe, Users, Landmark, Cpu, Palette, HeartHandshake, Languages,
  LogIn, LogOut, UserPlus, ShieldCheck, GraduationCap, Calculator,
  X, Edit3, Play, Save, Image as ImageIcon, Video, Type, ListChecks, 
  CheckCircle2, TextCursorInput, Columns2, ThumbsUp,
  ChevronsLeft, ChevronsRight, Maximize2, ZoomIn,
  ArrowUp, ArrowDown, ChevronDown, Circle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Path, Lesson, LessonPage, UserProgress } from './types';
import LessonViewer from './components/LessonViewer';
import LessonEditor from './components/LessonEditor';

import { AuthProvider, useAuth } from './context/AuthContext';
import type { UserData } from './context/AuthContext';

import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import { auth, db } from './firebase';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminDashboard from './pages/AdminDashboard';
import PathsPage from './pages/PathsPage';
import ExplorePage from './pages/ExplorePage';
import ProfilePage from './pages/ProfilePage';
import ReportsPage from './pages/ReportsPage';
import PathDetails from './pages/PathDetails';
import AppsPage from './pages/AppsPage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';

const MockPage = ({ title }: { title: string }) => (
  <div className="p-12 text-center">
    <h1 className="text-3xl font-bold text-slate-800 mb-4">{title}</h1>
    <p className="text-slate-500">هذه الصفحة قيد التطوير حالياً... 🚧</p>
  </div>
);

const LessonRouteWrapper = () => {
  const { id } = useParams();
  return <PathDetails id={id!} />;
};

const LessonRedirect = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    const findPath = async () => {
      try {
        const lessonsQuery = query(collectionGroup(db, 'lessons'));
        const querySnapshot = await getDocs(lessonsQuery);
        const lessonDoc = querySnapshot.docs.find(doc => doc.id === id);
        
        if (lessonDoc) {
          const pathId = lessonDoc.ref.parent.parent?.id;
          if (pathId) {
            navigate(`/path/${pathId}/lesson/${id}`, { replace: true });
            return;
          }
        }
        setError(true);
      } catch (err) {
        console.error("Error finding lesson path:", err);
        setError(true);
      }
    };
    findPath();
  }, [id, navigate]);

  if (error) return <div className="p-12 text-center text-slate-500">عذراً، لم نتمكن من العثور على هذا الدرس.</div>;
  return <div className="p-12 text-center text-slate-500">جاري توجيهك إلى الدرس...</div>;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <div className="min-h-screen flex font-sans bg-[#F8F9FD] flex-col md:flex-row" dir="rtl">
                <Sidebar />
                <div className="flex-1 flex flex-col mr-0 md:mr-24 pb-16 md:pb-0 md:h-screen overflow-hidden">
                  <Topbar />
                  <main className="flex-1 overflow-y-auto">
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/path/:id" element={<LessonRouteWrapper />} />
                      <Route path="/path/:pathId/lesson/:id" element={<LessonViewer />} />
                      <Route path="/lesson/:id" element={<LessonRedirect />} />
                      <Route path="/admin" element={
                        <AdminRoute>
                          <AdminDashboard />
                        </AdminRoute>
                      } />
                      <Route path="/lessons" element={<PathsPage />} />
                      <Route path="/explore" element={<ExplorePage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/apps" element={<AppsPage />} />
                    </Routes>
                    <footer className="py-8 text-center text-slate-400 text-[10px]">
                      <p>© 2026 مدرسة الحافظ بن عساكر بأملج - جميع الحقوق محفوظة</p>
                    </footer>
                  </main>
                </div>
              </div>
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
