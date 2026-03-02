interface WeekSelectorProps {
  weekOffset: 0 | -1;
  onOffsetChange: (offset: 0 | -1) => void;
}

export function WeekSelector({ weekOffset, onOffsetChange }: WeekSelectorProps) {
  const options: Array<{ label: string; value: 0 | -1 }> = [
    { label: 'Last week', value: -1 },
    { label: 'This week', value: 0 },
  ];

  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onOffsetChange(opt.value)}
          className={`flex-1 text-xs font-medium py-1 rounded-md transition-colors ${
            weekOffset === opt.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
