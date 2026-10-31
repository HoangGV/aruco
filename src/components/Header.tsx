import React from 'react';

interface HeaderProps {
  subtitle?: string;
  onHomeClick?: () => void;
  children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ subtitle, onHomeClick, children }) => {
  return (
    <header className="flex items-center gap-3 px-5 py-3 border-b-4 border-black bg-white flex-wrap no-print">
      <div
        className="flex items-center gap-2 cursor-pointer select-none"
        onClick={onHomeClick}
        title="Về trang chủ"
      >
        <b className="text-3xl text-[#2F54D0] font-black tracking-wider">NDH</b>
        <span className="text-lg font-bold">
          Tương tác giấy{subtitle ? ` · ${subtitle}` : ''}
        </span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2 flex-wrap">
        {children}
      </div>
    </header>
  );
};
