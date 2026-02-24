interface LogGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LogGuideModal({ isOpen, onClose }: LogGuideModalProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/45 px-3">
      <div className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-amber-900">Huong dan log bu</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-amber-700 hover:bg-amber-100 hover:text-amber-900"
            aria-label="Close guide"
          >
            X
          </button>
        </div>

        <div className="space-y-3 text-xs text-amber-950">
          <section>
            <p className="font-semibold">1. Log qua CLI</p>
            <p className="mt-1">
              Dung cong cu CLI de them worklog cho ngay bi thieu thoi gian, sau do sync lai trong app.
            </p>
          </section>

          <section>
            <p className="font-semibold">2. Log tren Clockwork Web</p>
            <p className="mt-1">
              Mo Clockwork tren web, chon dung issue va ngay, nhap so gio con thieu, sau do luu.
            </p>
          </section>

          <section>
            <p className="font-semibold">3. Quay lai menubar app</p>
            <p className="mt-1">
              Dung nut reload hoac stop/start timer de app refetch worklogs va cap nhat canh bao.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
