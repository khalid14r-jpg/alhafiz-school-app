import React from 'react';
import { 
  BookOpen, Compass, BarChart3, AppWindow, Settings, Home as HomeIcon
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const menuItems = [
    { icon: HomeIcon, label: 'الرئيسية', path: '/' },
    { icon: BookOpen, label: 'المسارات', path: '/lessons' },
    { icon: Compass, label: 'اكتشف', path: '/explore' },
    { icon: BarChart3, label: (user?.role === 'teacher' || user?.role === 'admin') ? 'تقارير' : 'إنجازاتي', path: '/reports' },
    { icon: AppWindow, label: 'التطبيقات', path: '/apps' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-24 bg-white border-l border-slate-100 flex-col items-center py-8 gap-8 fixed right-0 h-full z-40 transition-colors duration-300">
        <div className="bg-violet-600 p-3 rounded-2xl shadow-lg shadow-violet-200 mb-4">
          <BookOpen className="text-white w-6 h-6" />
        </div>
        <div className="flex flex-col gap-6">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.label} 
                to={item.path} 
                className={`flex flex-col items-center gap-1 group transition-colors ${isActive ? 'text-violet-600' : 'text-slate-400 hover:text-violet-500'}`}
              >
                <item.icon className={`w-6 h-6 ${isActive ? 'text-violet-600' : 'group-hover:text-violet-500'}`} />
                <span className="text-[10px] font-bold">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-auto flex flex-col gap-6 pb-4">
          {(user?.role === 'teacher' || user?.role === 'admin') && (
            <Link to="/admin" className={`flex flex-col items-center gap-1 transition-colors ${location.pathname === '/admin' ? 'text-violet-600' : 'text-slate-400 hover:text-violet-500'}`}>
              <Settings className="w-6 h-6" />
              <span className="text-[10px] font-bold">الإدارة</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex items-center justify-around py-3 z-40 px-2 transition-colors duration-300">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.label} 
              to={item.path} 
              className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-violet-600' : 'text-slate-400'}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[8px] font-bold">{item.label}</span>
            </Link>
          );
        })}
        {(user?.role === 'teacher' || user?.role === 'admin') && (
          <Link to="/admin" className={`flex flex-col items-center gap-1 transition-colors ${location.pathname === '/admin' ? 'text-violet-600' : 'text-slate-400'}`}>
            <Settings className="w-5 h-5" />
            <span className="text-[8px] font-bold">الإدارة</span>
          </Link>
        )}
      </nav>
    </>
  );
};

export default Sidebar;
