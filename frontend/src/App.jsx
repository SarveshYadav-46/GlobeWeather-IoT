import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import DevicePage from './pages/DevicePage';
import './index.css';

export default function App() {
  const [activeSection, setActiveSection] = useState('home');

  return (
    <div className="min-h-screen bg-[#020817] text-slate-100 flex flex-col">
      <Navbar activeSection={activeSection} onNav={setActiveSection} />
      <main className="flex-1">
        {activeSection === 'device' ? (
          <DevicePage />
        ) : (
          <Home onNavigateDevice={() => setActiveSection('device')} />
        )}
      </main>
    </div>
  );
}
