import React from 'react';
import { Stethoscope, GraduationCap, Wrench, Code2, Palette, Utensils, User, Briefcase } from 'lucide-react';

interface UserAvatarProps {
  pfp?: string;
  name?: string;
  profession?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  pfp,
  name = 'User',
  profession = '',
  size = 'md',
  className = ''
}) => {
  const normProf = (profession || '').trim().toLowerCase();

  // Avatar size configs
  const sizeMap = {
    xs: { container: 'w-6 h-6', border: 'border', badgeSize: 'w-2.5 h-2.5', badgeIconSize: 6, initials: 'text-[9px]', hatSize: 'text-[8px]', hatOffset: '-top-1.5 -left-1', stethStroke: 1.5 },
    sm: { container: 'w-8 h-8', border: 'border-2', badgeSize: 'w-3.5 h-3.5', badgeIconSize: 8, initials: 'text-xs', hatSize: 'text-[11px]', hatOffset: '-top-2 -left-1.5', stethStroke: 1.5 },
    md: { container: 'w-10 h-10', border: 'border-2', badgeSize: 'w-4.5 h-4.5', badgeIconSize: 10, initials: 'text-sm', hatSize: 'text-[14px]', hatOffset: '-top-2.5 -left-2', stethStroke: 1.5 },
    lg: { container: 'w-16 h-16', border: 'border-[3px]', badgeSize: 'w-6 h-6', badgeIconSize: 13, initials: 'text-xl', hatSize: 'text-[22px]', hatOffset: '-top-4 -left-3', stethStroke: 2 },
    xl: { container: 'w-24 h-24', border: 'border-4', badgeSize: 'w-8 h-8', badgeIconSize: 16, initials: 'text-3xl', hatSize: 'text-[32px]', hatOffset: '-top-6 -left-4', stethStroke: 2.5 },
    '2xl': { container: 'w-32 h-32', border: 'border-4', badgeSize: 'w-10 h-10', badgeIconSize: 20, initials: 'text-4xl', hatSize: 'text-[44px]', hatOffset: '-top-8 -left-5', stethStroke: 3 }
  };

  const config = sizeMap[size] || sizeMap.md;

  // Choose style colors and badges based on profession
  let themeColor = 'border-slate-200';
  let badgeBg = 'bg-slate-500';
  let badgeIcon = <Briefcase size={config.badgeIconSize} className="text-white" />;
  let overlayElement: React.ReactNode = null;
  let hasStethoscope = false;

  if (normProf.includes('doctor') || normProf.includes('medical') || normProf.includes('nurse') || normProf.includes('physician')) {
    themeColor = 'border-rose-400 ring-rose-100';
    badgeBg = 'bg-rose-500';
    badgeIcon = <Stethoscope size={config.badgeIconSize} className="text-white" />;
    hasStethoscope = true;
    
    // Stethoscope loop around pfp - SVG overlay draping around the avatar circle
    overlayElement = (
      <svg 
        className="absolute inset-0 w-full h-full pointer-events-none scale-[1.12] z-10 overflow-visible text-rose-500"
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Stethoscope tubings hanging from the top-left and top-right down along sides */}
        <path 
          d="M 15,20 C 5,45 10,75 50,92 C 90,75 95,45 85,20" 
          stroke="currentColor" 
          strokeWidth={config.stethStroke} 
          strokeLinecap="round" 
          fill="none" 
        />
        {/* Stethoscope chestpiece at the bottom middle */}
        <circle 
          cx="50" 
          cy="92" 
          r={size === 'xs' ? '3' : size === 'sm' ? '4' : '6'} 
          fill="#334155" 
          stroke="currentColor" 
          strokeWidth={config.stethStroke * 0.7} 
        />
        {/* Inner diaphragm detail */}
        <circle 
          cx="50" 
          cy="92" 
          r={size === 'xs' ? '1' : size === 'sm' ? '1.5' : '2.5'} 
          fill="#f1f5f9" 
        />
      </svg>
    );
  } else if (normProf.includes('teacher') || normProf.includes('professor') || normProf.includes('educator') || normProf.includes('academic') || normProf.includes('tutor')) {
    themeColor = 'border-amber-400 ring-amber-100';
    badgeBg = 'bg-amber-500';
    badgeIcon = <GraduationCap size={config.badgeIconSize} className="text-white" />;
  } else if (normProf.includes('engineer') || normProf.includes('architect') || normProf.includes('builder') || normProf.includes('contractor') || normProf.includes('mechanic')) {
    themeColor = 'border-orange-400 ring-orange-100';
    badgeBg = 'bg-orange-500';
    badgeIcon = <Wrench size={config.badgeIconSize} className="text-white" />;
  } else if (normProf.includes('developer') || normProf.includes('coder') || normProf.includes('programmer') || normProf.includes('software') || normProf.includes('tech') || normProf.includes('analyst')) {
    themeColor = 'border-cyan-400 ring-cyan-100';
    badgeBg = 'bg-cyan-500';
    badgeIcon = <Code2 size={config.badgeIconSize} className="text-white" />;
  } else if (normProf.includes('designer') || normProf.includes('artist') || normProf.includes('creative') || normProf.includes('illustrator')) {
    themeColor = 'border-purple-400 ring-purple-100';
    badgeBg = 'bg-purple-500';
    badgeIcon = <Palette size={config.badgeIconSize} className="text-white" />;
  } else if (normProf.includes('chef') || normProf.includes('cook') || normProf.includes('baker') || normProf.includes('culinary')) {
    themeColor = 'border-emerald-400 ring-emerald-100';
    badgeBg = 'bg-emerald-500';
    badgeIcon = <Utensils size={config.badgeIconSize} className="text-white" />;
  }

  const initials = name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className={`relative shrink-0 flex items-center justify-center select-none ${className}`}>
      {/* Stethoscope or background drapes */}
      {hasStethoscope && overlayElement}

      {/* Main Avatar Circle */}
      <div 
        className={`relative rounded-full overflow-hidden ${config.container} ${config.border} ${themeColor} bg-slate-100 shadow-sm flex items-center justify-center transition-all group-hover:scale-105 duration-300 ring-4 ring-transparent`}
      >
        {pfp ? (
          <img 
            src={pfp} 
            alt={name} 
            className="w-full h-full object-cover rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className={`font-black text-slate-600 tracking-tight ${config.initials}`}>
            {initials || <User size={config.badgeIconSize * 1.5} />}
          </span>
        )}

        {/* Doctor Lab-coat white overlay laying over the bottom edge of pfp */}
        {hasStethoscope && size !== 'xs' && (
          <div className="absolute bottom-0 inset-x-0 h-1/4 bg-white/90 border-t border-slate-100/50 flex items-center justify-center z-[5]">
            {/* Split lapel visual lines */}
            <div className="w-0.5 h-full bg-slate-200" />
          </div>
        )}
      </div>

      {/* Accessories (Hats / Glasses) */}
      {!hasStethoscope && overlayElement}

      {/* Floating Badge (Bottom Right) */}
      {profession && size !== 'xs' && (
        <div 
          className={`absolute bottom-0 right-0 ${config.badgeSize} ${badgeBg} rounded-full border border-white shadow-md flex items-center justify-center z-20 animate-in zoom-in-50 duration-300`}
        >
          {badgeIcon}
        </div>
      )}
    </div>
  );
};
