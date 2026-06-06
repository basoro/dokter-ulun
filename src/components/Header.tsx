
import React from 'react';
import { Bell, Menu, Search, User, LogOut } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import logoImg from '@/assets/logo.png'; // Add this import

interface HeaderProps {
  hospitalName: string;
  isMobile?: boolean;
  onMenuClick?: () => void;
  username?: string;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  hospitalName, 
  isMobile = false, 
  onMenuClick,
  username,
  onLogout 
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 bg-primary h-16 w-full shadow-md z-50">
      <div className="h-full flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center">
          {isMobile && (
            <button 
              onClick={onMenuClick}
              className="mr-3 p-1.5 rounded-full text-white hover:bg-white/20 transition-colors"
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          )}
          <img 
            src={logoImg} 
            alt="Hospital Logo" 
            className="h-10 w-10 mr-3 object-contain"
          />          
          <h1 className="text-white font-bold text-base md:text-lg truncate">{hospitalName}</h1>
        </div>
        
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="relative hidden md:block">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-white/60" />
            </div>
            <input
              type="text"
              placeholder="Cari..."
              className="bg-white/10 text-white placeholder:text-white/60 border-none rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
          
          <button className="relative p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <Bell className="h-5 w-5 text-white" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="h-9 w-9 bg-white/20 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                {!isMobile && username && (
                  <div className="text-white text-sm hidden md:block">{username}</div>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-sm font-medium">
                {username || 'User'}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-red-500 cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
