export type WorklogTab = 'list' | 'summary';

interface WorklogTabsProps {
  activeTab: WorklogTab;
  onTabChange: (tab: WorklogTab) => void;
}

export function WorklogTabs({ activeTab, onTabChange }: WorklogTabsProps) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
      {(['list', 'summary'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onTabChange(tab)}
          className={`flex-1 text-xs font-medium py-1 rounded-md transition-colors ${
            activeTab === tab
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab === 'list' ? 'List' : 'Summary'}
        </button>
      ))}
    </div>
  );
}
