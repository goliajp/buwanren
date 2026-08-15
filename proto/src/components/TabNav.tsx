import { NavLink } from 'react-router-dom';
import { Compass, Calendar, Package, User } from 'lucide-react';

const tabs = [
  { to: '/naji',     label: '纳吉', icon: Compass },
  { to: '/activity', label: '活动', icon: Calendar },
  { to: '/product',  label: '商品', icon: Package },
  { to: '/me',       label: '我',   icon: User },
];

export default function TabNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-paper/95 backdrop-blur-sm border-t border-stone-200 z-40">
      <div className="flex justify-around items-center h-16 px-4">
        {tabs.map(({ to, label, icon: Ic }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 ${isActive ? 'text-ink-deep' : 'text-stone-400'}`
            }
          >
            {({ isActive }) => (
              <>
                <Ic size={22} strokeWidth={isActive ? 1.5 : 1} className={isActive ? 'text-gold' : ''} />
                <span className="text-[11px] tracking-wider">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
