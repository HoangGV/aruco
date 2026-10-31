import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface PairModalProps {
  className: string;
  roomCode: string;
  pairKey: string;
  pairPin: string;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const PairModal: React.FC<PairModalProps> = ({
  className,
  roomCode,
  pairKey,
  pairPin,
  onClose,
  onShowToast
}) => {
  const [qrSvg, setQrSvg] = useState<string>('');

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '';
  const scanUrl = `${baseUrl}?scan=${roomCode}#pair=${pairKey}`;
  const pinUrl = `${baseUrl}?scan=${roomCode}#pair=${pairPin}`;

  useEffect(() => {
    QRCode.toString(scanUrl, { type: 'svg', margin: 2 }, (err, svg) => {
      if (!err && svg) setQrSvg(svg);
    });
  }, [scanUrl]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(scanUrl);
      onShowToast('Đã sao chép URL kết nối.');
    } catch {
      onShowToast('Không thể sao chép tự động. Hãy sao chép thủ công.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="ndh-box p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b-2 border-black pb-2">
          <h2 className="text-2xl font-black">Ghép nối điện thoại</h2>
          <button className="ndh-btn text-sm py-1 px-3" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="text-sm text-neutral-600 font-semibold text-center">
          Dùng điện thoại quét mã QR để mở trực tiếp màn hình quét thẻ (tự động kết nối, không cần nhập PIN).
        </p>

        {/* QR Code */}
        {qrSvg && (
          <div
            className="flex justify-center p-3 border-2 border-black bg-white mx-auto max-w-xs"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-lg items-center border-t-2 border-b-2 border-black py-3">
          <span className="font-semibold text-neutral-600">Lớp:</span>
          <b className="text-xl">{className}</b>

          <span className="font-semibold text-neutral-600">Mã phòng:</span>
          <b className="text-2xl font-mono tracking-widest text-[#2F54D0]">{roomCode}</b>

          <span className="font-semibold text-neutral-600">Mã PIN:</span>
          <b className="text-2xl font-mono tracking-widest">{pairPin}</b>

          <span className="font-semibold text-neutral-600">Đường dẫn:</span>
          <span className="text-sm font-mono break-all select-all text-neutral-800">
            {scanUrl}
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button className="ndh-btn" onClick={copyUrl}>
            Sao chép URL
          </button>
          <button className="ndh-btn ndh-btn-pri" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
