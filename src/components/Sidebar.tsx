
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Users, 
  FileCheck, 
  CalendarClock, 
  DollarSign, 
  FileBarChart, 
  BarChart2,
  Pencil,
  HelpCircle,
  Book,
  Activity,
  Bot,
  AlarmClock,
  FlaskConical,
  ScanLine,
  LogOut,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import bgImage from '@/assets/profile-bg.png';
import { AboutModal } from '@/components/ui/about-modal';
import { dispatchCloseAllMedicalRecordTabs } from '@/lib/medical-record-tabs';

interface SidebarProps {
  doctorName: string;
  doctorId: string;
  gender: 'L' | 'P'; 
  canViewAuditHistory?: boolean;
  canAccessLaboratorium?: boolean;
  canAccessRadiologi?: boolean;
  onClose?: () => void;
  onLogout?: () => void;
}

interface SubmenuItem {
  name: string;
  path: string;
  exact?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  doctorName,
  doctorId,
  gender,
  canViewAuditHistory = false,
  canAccessLaboratorium = false,
  canAccessRadiologi = false,
  onClose,
  onLogout
}) => {
  const location = useLocation();
  const [pasienOpen, setPasienOpen] = useState(true);
  const [statistikOpen, setStatistikOpen] = useState(true);
  
  const [aboutOpen, setAboutOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };
  
  const isPasienActive = () => {
    return location.pathname.startsWith('/pasien');
  };

  const isStatistikActive = () => {
    return location.pathname.startsWith('/statistik');
  };
  
  const menuItems = [
    { name: 'Dashboard', path: '/', icon: <BarChart2 className="h-5 w-5" /> },
    ...(canAccessLaboratorium ? [{ name: 'Laboratorium', path: '/laboratorium', icon: <FlaskConical className="h-5 w-5" /> }] : []),
    ...(canAccessRadiologi ? [{ name: 'Radiologi', path: '/radiologi', icon: <ScanLine className="h-5 w-5" /> }] : []),
    { name: 'AI Asisten', path: '/ai-assistant', icon: <Bot className="h-5 w-5" />, badge: 'Beta' },
    ...(canViewAuditHistory ? [{ name: 'Riwayat Audit', path: '/riwayat-audit', icon: <Book className="h-5 w-5" /> }] : []),
    { name: 'Presensi', path: '/presensi', icon: <FileCheck className="h-5 w-5" /> },
    { name: 'Booking Operasi', path: '/booking', icon: <CalendarClock className="h-5 w-5" /> },
    { name: 'Tarif INA-CBGs', path: '/tarif', icon: <DollarSign className="h-5 w-5" /> },
    { name: 'Kode Medis', path: '/icd', icon: <FileBarChart className="h-5 w-5" /> },
    // { name: 'TTD Elektronik', path: '/signature', icon: <Pencil className="h-5 w-5" /> },
    // { name: 'SRQ', path: '/srq', icon: <HelpCircle className="h-5 w-5" /> },
    // { name: 'E-Book', path: '/ebook', icon: <Book className="h-5 w-5" /> },
    // { name: 'IGD', path: '/igd', icon: <AlarmClock className="h-5 w-5" /> },
  ];

  const pasienSubmenuItems: SubmenuItem[] = [
    { name: 'Booking', path: '/pasien/booking' },
    { name: 'IGD', path: '/pasien/igd' },
    { name: 'Rawat Jalan', path: '/pasien/rawat-jalan' },
    { name: 'Rawat Inap', path: '/pasien/rawat-inap' },
    { name: 'Hemodialisa', path: '/pasien/hemodialisa' },
  ];

  const statistikSubmenuItems: SubmenuItem[] = [
    { name: 'Statistik Pasien', path: '/statistik', exact: true },
    { name: 'Statistik Rawat Jalan', path: '/statistik/rawat-jalan' },
    { name: 'Statistik Rawat Inap', path: '/statistik/rawat-inap' },
  ];

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    if (onClose) {
      onClose();
    }
  };

  const handlePatientsMenuClick = () => {
    dispatchCloseAllMedicalRecordTabs();
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside className="fixed left-0 top-0 sm:top-16 h-[calc(100vh)] sm:h-[calc(100vh-4rem)] w-64 bg-white shadow-sm flex flex-col z-30">
        <div 
          className="p-4 border-b relative"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
        <div>
          <div className="flex">
            <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center">
              {gender === 'P' ? (
                <svg viewBox="0 0 24 24" className="h-12 w-12 text-primary">
                  <path fill="currentColor" d="M12 2a2 2 0 0 1 2 2a2 2 0 0 1-2 2a2 2 0 0 1-2-2a2 2 0 0 1 2-2m-1.5 20v-6h-3l2.59-7.59C10.34 7.59 11.1 7 12 7c.9 0 1.66.59 1.91 1.41L16.5 16h-3v6h-3Z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-12 w-12 text-primary">
                  <path fill="currentColor" d="M12 4a4 4 0 014 4 4 4 0 01-4 4 4 4 0 01-4-4 4 4 0 014-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4z"/>
                </svg>
              )}
            </div>
          </div>
          <h3 className="mt-2 font-semibold text-white">{doctorName}</h3>
          <p className="text-xs text-white">{doctorId}</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="px-2 space-y-1">
          <Link
            to="/"
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive('/')
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={onClose}
          >
            <span className={`mr-3 ${isActive('/') ? 'text-primary' : 'text-gray-500'}`}>
              <BarChart2 className="h-5 w-5" />
            </span>
            Dashboard
          </Link>

          <div>
            <Collapsible
              open={pasienOpen}
              onOpenChange={setPasienOpen}
              className="w-full"
            >
              <CollapsibleTrigger
                className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isPasienActive()
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={handlePatientsMenuClick}
              >
                <div className="flex items-center">
                  <span className={`mr-3 ${isPasienActive() ? 'text-primary' : 'text-gray-500'}`}>
                    <Users className="h-5 w-5" />
                  </span>
                  Pasien
                </div>
                <span className="text-gray-500">
                  {pasienOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-8 mt-1 space-y-1">
                {pasienSubmenuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      item.exact 
                        ? (location.pathname === item.path ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100')
                        : (location.pathname.startsWith(item.path) ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100')
                    }`}
                    onClick={handlePatientsMenuClick}
                  >
                    {item.name}
                  </Link>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>

          {menuItems.slice(1).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={onClose}
            >
              <span className={`mr-3 ${isActive(item.path) ? 'text-primary' : 'text-gray-500'}`}>
                {item.icon}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span>{item.name}</span>
                {item.badge ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    {item.badge}
                  </span>
                ) : null}
              </span>
            </Link>
          ))}

          <div>
            <Collapsible
              open={statistikOpen}
              onOpenChange={setStatistikOpen}
              className="w-full"
            >
              <CollapsibleTrigger
                className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isStatistikActive()
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center">
                  <span className={`mr-3 ${isStatistikActive() ? 'text-primary' : 'text-gray-500'}`}>
                    <Activity className="h-5 w-5" />
                  </span>
                  Statistik
                </div>
                <span className="text-gray-500">
                  {statistikOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-8 mt-1 space-y-1">
                {statistikSubmenuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      item.exact
                        ? (location.pathname === item.path ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100')
                        : (location.pathname.startsWith(item.path) ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100')
                    }`}
                    onClick={onClose}
                  >
                    {item.name}
                  </Link>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>

          <Link
            to="/panduan"
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive('/panduan')
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            onClick={onClose}
          >
            <span className={`mr-3 ${isActive('/panduan') ? 'text-primary' : 'text-gray-500'}`}>
              <HelpCircle className="h-5 w-5" />
            </span>
            Panduan
          </Link>

        </nav>
      </div>
      
      <div className="p-4 border-t mt-auto bg-white">
        <p className="text-sm">
          © 2017 - {new Date().getFullYear()}{" "}
          <button 
            onClick={() => setAboutOpen(true)}
            className="text-primary hover:none focus:outline-none"
          >
            ICT RSHD Barabai
          </button>
        </p>
      </div>
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </aside>
  );
};

export default Sidebar;
