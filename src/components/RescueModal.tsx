import React, { useState } from 'react';
import type { Player } from '../types';

interface RescueModalProps {
  deadPlayers: Player[];
  onRescue: (ids: number[]) => void;
  onClose: () => void;
}

export const RescueModal: React.FC<RescueModalProps> = ({
  deadPlayers,
  onRescue,
  onClose
}) => {
  const [selectedIds, setSelectedIds] = useState<number[]>(deadPlayers.map(p => p.id));

  const toggle = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === deadPlayers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(deadPlayers.map(p => p.id));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="ndh-box p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b-2 border-black pb-2">
          <h2 className="text-2xl font-black">Cứu hộ học sinh</h2>
          <button className="ndh-btn text-sm py-1 px-3" onClick={onClose}>
            ✕
          </button>
        </div>

        {deadPlayers.length === 0 ? (
          <p className="text-neutral-600 py-4 text-center font-semibold">
            Hiện không có học sinh nào bị loại.
          </p>
        ) : (
          <>
            <div className="flex justify-between items-center text-sm font-semibold">
              <span>{deadPlayers.length} học sinh đang bị loại</span>
              <button
                className="text-[#2F54D0] hover:underline"
                onClick={selectAll}
              >
                {selectedIds.length === deadPlayers.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto border-2 border-black p-3 space-y-2 bg-neutral-50">
              {deadPlayers.map(p => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 p-2 bg-white border border-neutral-300 font-semibold cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-[#2F54D0]"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span className="font-mono text-neutral-500">#{String(p.id).padStart(2, '0')}</span>
                  <span>{p.name}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                className="ndh-btn ndh-btn-pri"
                disabled={selectedIds.length === 0}
                onClick={() => {
                  onRescue(selectedIds);
                  onClose();
                }}
              >
                Cứu những em đã chọn ({selectedIds.length})
              </button>
              <button className="ndh-btn" onClick={onClose}>
                Đóng
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
