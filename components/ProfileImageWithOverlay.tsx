import React from 'react';
import { 
  HeartPulse, 
  GraduationCap, 
  Wrench, 
  Palette, 
  Utensils, 
  Scale, 
  User,
  Sparkles,
  BookOpen,
  Hammer,
  ChefHat
} from 'lucide-react';

interface ProfileImageWithOverlayProps {
  pfp: string;
  profession?: string;
  userName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const ProfileImageWithOverlay: React.FC<ProfileImageWithOverlayProps> = ({
  pfp,
  profession = '',
  userName = 'User',
  size = 'md',
  className = ''
}) => {
  const normalizedProfession = profession.trim().toLowerCase();

  // Dimension mapping
  const sizeClasses = {
    xs: {
      container: 'w-10 h-10', // slightly larger to accommodate frames
      image: 'w-8 h-8',
      badgeSize: 12,
      badgeContainer: 'w-4 h-4 -right-0.5 -bottom-0.5',
      ringWidth: 'border-2',
      offset: 'p-[2px]',
      textClass: 'text-[7px]'
    },
    sm: {
      container: 'w-12 h-12',
      image: 'w-10 h-10',
      badgeSize: 14,
      badgeContainer: 'w-5 h-5 -right-0.5 -bottom-0.5',
      ringWidth: 'border-2',
      offset: 'p-[2px]',
      textClass: 'text-[8px]'
    },
    md: {
      container: 'w-20 h-20',
      image: 'w-16 h-16',
      badgeSize: 18,
      badgeContainer: 'w-6 h-6 -right-1 -bottom-1',
      ringWidth: 'border-[3px]',
      offset: 'p-[3px]',
      textClass: 'text-[9px]'
    },
    lg: {
      container: 'w-28 h-28',
      image: 'w-24 h-24',
      badgeSize: 22,
      badgeContainer: 'w-8 h-8 -right-1.5 -bottom-1',
      ringWidth: 'border-4',
      offset: 'p-1',
      textClass: 'text-[10px]'
    },
    xl: {
      container: 'w-36 h-36',
      image: 'w-32 h-32',
      badgeSize: 26,
      badgeContainer: 'w-10 h-10 -right-2 -bottom-1',
      ringWidth: 'border-4',
      offset: 'p-1.5',
      textClass: 'text-[11px]'
    }
  }[size];

  // Render overlay specific decorations
  let ringColor = 'border-slate-200';
  let badgeBg = 'bg-slate-500';
  let badgeColor = 'text-white';
  let BadgeIcon = User;
  let decorElement: React.ReactNode = null;
  let layoverBadgeText = '';

  if (normalizedProfession.includes('doctor') || normalizedProfession.includes('nurse') || normalizedProfession.includes('med')) {
    ringColor = 'border-rose-400 animate-pulse';
    badgeBg = 'bg-rose-500 shadow-rose-300 shadow-lg';
    badgeColor = 'text-white';
    BadgeIcon = HeartPulse;
    layoverBadgeText = 'Doctor';

    // Stethoscope around pfp overlay
    decorElement = (
      <svg 
        className="absolute inset-0 w-full h-full text-rose-500 pointer-events-none overflow-visible z-10" 
        viewBox="0 0 100 100"
        fill="none"
      >
        {/* Custom Stethoscope overlay looping around */}
        <path 
          d="M 15 50 A 35 35 0 1 0 85 50" 
          stroke="currentColor" 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeDasharray="4,4"
          className="opacity-80"
        />
        {/* Stethoscope Chestpiece (the metal bell) at bottom left */}
        <circle cx="20" cy="78" r="7" fill="#f43f5e" stroke="white" strokeWidth="1.5" className="shadow-sm" />
        <circle cx="20" cy="78" r="3" fill="white" />
        {/* Stethoscope Eartips at top */}
        <path d="M 32 10 Q 35 15 32 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 68 10 Q 65 15 68 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="32" cy="9" r="2" fill="#e11d48" />
        <circle cx="68" cy="9" r="2" fill="#e11d48" />
      </svg>
    );
  } else if (normalizedProfession.includes('teacher') || normalizedProfession.includes('professor') || normalizedProfession.includes('student') || normalizedProfession.includes('educator')) {
    ringColor = 'border-emerald-400';
    badgeBg = 'bg-emerald-500 shadow-emerald-300 shadow-lg';
    badgeColor = 'text-white';
    BadgeIcon = GraduationCap;
    layoverBadgeText = 'Educator';

    // Graduation cap perched on top
    const capSize = size === 'xs' ? 'w-6 h-6 -top-2' : size === 'sm' ? 'w-7 h-7 -top-2.5' : size === 'md' ? 'w-11 h-11 -top-4.5' : size === 'lg' ? 'w-16 h-16 -top-6' : 'w-20 h-20 -top-8';
    decorElement = (
      <div className={`absolute z-10 ${capSize} -left-1 transform -rotate-12 pointer-events-none drop-shadow-md`}>
        <svg viewBox="0 0 100 100" fill="currentColor" className="text-emerald-700 w-full h-full">
          {/* Graduation Cap shape */}
          <path d="M 50 15 L 90 35 L 50 55 L 10 35 Z" />
          <path d="M 30 45 L 30 70 C 30 78, 70 78, 70 70 L 70 45" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
          {/* Tassel */}
          <path d="M 50 35 L 80 45 L 82 60" fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
          <polygon points="79,60 85,60 82,70" fill="#f59e0b" />
        </svg>
      </div>
    );
  } else if (normalizedProfession.includes('engineer') || normalizedProfession.includes('developer') || normalizedProfession.includes('architect') || normalizedProfession.includes('tech') || normalizedProfession.includes('programmer')) {
    ringColor = 'border-amber-500';
    badgeBg = 'bg-amber-500 shadow-amber-300 shadow-lg';
    badgeColor = 'text-white';
    BadgeIcon = Wrench;
    layoverBadgeText = 'Engineer';

    // Yellow hard hat on top, blueprint grid ring background
    const hatSize = size === 'xs' ? 'w-6 h-6 -top-1.5' : size === 'sm' ? 'w-7 h-7 -top-2' : size === 'md' ? 'w-11 h-11 -top-3.5' : size === 'lg' ? 'w-16 h-16 -top-5.5' : 'w-20 h-20 -top-7';
    decorElement = (
      <>
        {/* Gear overlay on border */}
        <div className={`absolute z-10 ${hatSize} left-1/2 -translate-x-1/2 pointer-events-none drop-shadow-md`}>
          <svg viewBox="0 0 100 100" fill="#f59e0b" className="w-full h-full">
            {/* Hard Hat Shape */}
            <path d="M 20 60 C 20 25, 80 25, 80 60 Z" />
            <path d="M 10 60 L 90 60 C 92 60, 92 65, 90 65 L 10 65 C 8 65, 8 60, 10 60 Z" fill="#d97706" />
            <rect x="44" y="30" width="12" height="30" fill="#d97706" rx="2" />
          </svg>
        </div>
      </>
    );
  } else if (normalizedProfession.includes('artist') || normalizedProfession.includes('designer') || normalizedProfession.includes('creative') || normalizedProfession.includes('painter') || normalizedProfession.includes('illustrator')) {
    ringColor = 'border-purple-400';
    badgeBg = 'bg-purple-500 shadow-purple-300 shadow-lg';
    badgeColor = 'text-white';
    BadgeIcon = Palette;
    layoverBadgeText = 'Creative';

    // Paint splatters on the ring
    decorElement = (
      <div className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
        {/* Dynamic colorful splotches */}
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-pink-500 opacity-80 animate-bounce" style={{ animationDelay: '200ms' }} />
        <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 rounded-full bg-cyan-400 opacity-80" />
        <div className="absolute top-1/2 -left-1.5 w-3 h-3 rounded-full bg-amber-400 opacity-70" />
      </div>
    );
  } else if (normalizedProfession.includes('chef') || normalizedProfession.includes('cook') || normalizedProfession.includes('baker') || normalizedProfession.includes('culinary') || normalizedProfession.includes('food')) {
    ringColor = 'border-orange-400';
    badgeBg = 'bg-orange-500 shadow-orange-300 shadow-lg';
    badgeColor = 'text-white';
    BadgeIcon = ChefHat;
    layoverBadgeText = 'Chef';

    // White Chef Hat overlay
    const hatSize = size === 'xs' ? 'w-6 h-6 -top-2.5' : size === 'sm' ? 'w-7 h-7 -top-3' : size === 'md' ? 'w-12 h-12 -top-5.5' : size === 'lg' ? 'w-16 h-16 -top-8' : 'w-22 h-22 -top-10';
    decorElement = (
      <div className={`absolute z-10 ${hatSize} left-1/2 -translate-x-1/2 pointer-events-none drop-shadow-md`}>
        <svg viewBox="0 0 100 100" fill="white" stroke="#c2410c" strokeWidth="4" className="w-full h-full">
          {/* Chef Hat Shape */}
          <path d="M 30 75 Q 15 50 35 45 Q 50 20 65 45 Q 85 50 70 75 Z" />
          <rect x="32" y="72" width="36" height="12" fill="white" rx="3" stroke="#c2410c" strokeWidth="4" />
        </svg>
      </div>
    );
  } else if (normalizedProfession.includes('lawyer') || normalizedProfession.includes('legal') || normalizedProfession.includes('judge') || normalizedProfession.includes('attorney') || normalizedProfession.includes('advocate')) {
    ringColor = 'border-indigo-400';
    badgeBg = 'bg-indigo-600 shadow-indigo-300 shadow-lg';
    badgeColor = 'text-white';
    BadgeIcon = Scale;
    layoverBadgeText = 'Legal';

    // Laurel Wreath framing
    decorElement = (
      <svg 
        className="absolute inset-0 w-full h-full text-indigo-500/40 pointer-events-none overflow-visible z-10" 
        viewBox="0 0 100 100"
        fill="currentColor"
      >
        {/* Laurel wreath leaves left and right */}
        <path d="M 12,50 C 10,65 18,80 30,85 C 28,80 20,70 20,50 Z" />
        <path d="M 88,50 C 90,65 82,80 70,85 C 72,80 80,70 80,50 Z" />
        <circle cx="15" cy="40" r="2.5" fill="#f59e0b" />
        <circle cx="85" cy="40" r="2.5" fill="#f59e0b" />
      </svg>
    );
  }

  return (
    <div className={`relative flex items-center justify-center shrink-0 select-none ${sizeClasses.container} ${className}`}>
      {/* Decorative Overlays (Cap, hat, stethoscope etc.) */}
      {decorElement}

      {/* Main Avatar Container */}
      <div className={`relative rounded-full ${sizeClasses.ringWidth} ${ringColor} ${sizeClasses.offset} bg-white shadow-inner flex items-center justify-center overflow-visible`}>
        <div className={`relative ${sizeClasses.image} rounded-full overflow-hidden bg-slate-100 flex items-center justify-center`}>
          {pfp ? (
            <img 
              src={pfp} 
              alt={userName} 
              className="w-full h-full object-cover rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <User className="text-slate-400 w-1/2 h-1/2" />
          )}

          {/* Semi-transparent text overlay banner inside the avatar for large sizes */}
          {layoverBadgeText && (size === 'lg' || size === 'xl') && (
            <div className="absolute bottom-0 left-0 right-0 bg-slate-900/75 text-white py-0.5 text-center font-black uppercase tracking-wider text-[8px] z-20">
              {layoverBadgeText}
            </div>
          )}
        </div>
      </div>

      {/* Profession Badge Icon at bottom right */}
      {profession && (
        <div className={`absolute ${sizeClasses.badgeContainer} rounded-full ${badgeBg} flex items-center justify-center border-2 border-white text-white z-20 shadow-md transform hover:scale-110 transition-transform`}>
          <BadgeIcon size={sizeClasses.badgeSize} className={badgeColor} />
        </div>
      )}
    </div>
  );
};
