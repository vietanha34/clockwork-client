import { open } from '@tauri-apps/plugin-shell';

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
          <h3 className="text-sm font-semibold text-amber-900">Hướng dẫn log bù</h3>
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
          <p>Vui lòng xem hướng dẫn chi tiết tại:</p>
          
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => open('https://drive.google.com/file/d/1fP8sUz6zAjVHbEZnpwS982ERRoXVv2Ld/view?usp=sharing')}
              className="flex items-center justify-between rounded border border-amber-300 bg-white px-3 py-2 hover:bg-amber-50 text-left transition-colors"
            >
              <div>
                <p className="font-semibold text-amber-900">Dành cho Tech (Dev, QC, ...)</p>
                <p className="text-[10px] text-amber-700">Sử dụng CLI tool</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400">
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => open('https://drive.google.com/file/d/1iWE1r7ZXlY_umPXxNJGeq4qI9FCx6H4R/view?usp=drive_link')}
              className="flex items-center justify-between rounded border border-amber-300 bg-white px-3 py-2 hover:bg-amber-50 text-left transition-colors"
            >
              <div>
                <p className="font-semibold text-amber-900">Dành cho Non-Tech (BA, PM, ...)</p>
                <p className="text-[10px] text-amber-700">Thao tác trên Web</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400">
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <section className="pt-2 border-t border-amber-200">
            <p className="font-semibold">Lưu ý:</p>
            <p className="mt-1">
              Sau khi log bù xong, vui lòng nhấn nút <strong>Reload</strong> ở danh sách worklogs để cập nhật lại dữ liệu.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
