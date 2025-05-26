// src/components/LayoutWithSidebar.jsx
import React from 'react';
import SideNav from './SideNav';
import '../styles/SideNav.css';

export default function LayoutWithSidebar({ children }) {
  return (
    <div className="app-layout">
      <SideNav />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
}
