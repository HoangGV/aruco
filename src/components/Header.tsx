import React from 'react';

interface HeaderProps {
  subtitle?: string;
  activeTab?: 'classes' | 'quizBanks';
  onNavigateTab?: (tab: 'classes' | 'quizBanks') => void;
  onHomeClick?: () => void;
  children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  subtitle,
  activeTab,
  onNavigateTab,
  onHomeClick,
  children
}) => {
  return (
    <header className="flex items-center gap-3 px-4 md:px-6 py-2.5 border-b-4 border-black bg-white flex-wrap no-print">
      {/* Brand logo & title */}
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

      {/* Main navigation tabs: Lớp học vs Kho đề thi */}
      {onNavigateTab && (
        <nav className="flex items-center gap-1.5 ml-2 md:ml-6">
          <button
            className={`ndh-btn py-1 px-3 text-xs md:text-sm font-black flex items-center gap-1.5 transition ${
              activeTab === 'classes' ? 'ndh-btn-pri' : 'bg-neutral-100 hover:bg-neutral-200 text-black'
            }`}
            onClick={() => onNavigateTab('classes')}
          >
            🏫 Danh sách lớp
          </button>
          <button
            className={`ndh-btn py-1 px-3 text-xs md:text-sm font-black flex items-center gap-1.5 transition ${
              activeTab === 'quizBanks' ? 'ndh-btn-pri' : 'bg-neutral-100 hover:bg-neutral-200 text-black'
            }`}
            onClick={() => onNavigateTab('quizBanks')}
            title="Đường dẫn: /bo-cau-hoi"
          >
            📚 Kho đề thi
          </button>
        </nav>
      )}

      <div className="flex-1" />

      {/* Action buttons on the right */}
      <div className="flex items-center gap-2 flex-wrap">
        {children}
      </div>
    </header>
  );
};
