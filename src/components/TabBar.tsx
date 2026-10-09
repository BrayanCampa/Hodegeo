import type { ReactNode } from 'react';

export type TabId = 'home' | 'sos' | 'cane' | 'history' | 'diag';

interface TabDef {
  id: TabId;
  label: string;
  icon: ReactNode;
}

const iconProps = {
  className: 'tab__icon',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const HomeIcon = (
  <svg {...iconProps}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M10 21v-6h4v6" />
  </svg>
);

const SosIcon = (
  <svg {...iconProps}>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 9v5" />
    <path d="M12 17.5h.01" />
  </svg>
);

const CaneIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="5" r="2.5" />
    <path d="M12 7.5V14" />
    <path d="M8 11h8" />
    <path d="M12 14 9 21" />
    <path d="M12 14l3 7" />
  </svg>
);

const HistoryIcon = (
  <svg {...iconProps}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
    <path d="M12 8v4l3 2" />
  </svg>
);

const DiagIcon = (
  <svg {...iconProps}>
    <path d="M3 12h4l2-6 4 12 2-6h6" />
  </svg>
);

export const TABS: TabDef[] = [
  { id: 'home', label: 'Inicio', icon: HomeIcon },
  { id: 'sos', label: 'S.O.S', icon: SosIcon },
  { id: 'cane', label: 'Bastón', icon: CaneIcon },
  { id: 'history', label: 'Historial', icon: HistoryIcon },
  { id: 'diag', label: 'Diagnóstico', icon: DiagIcon },
];

interface Props {
  current: TabId;
  onChange: (id: TabId) => void;
}

export function TabBar({ current, onChange }: Props) {
  return (
    <nav className="tabbar" aria-label="Navegación principal">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="tab"
          aria-current={current === tab.id ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
