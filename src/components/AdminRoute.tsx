import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) return <Navigate to="/" />;
  return <>{children}</>;
};

export default AdminRoute;
