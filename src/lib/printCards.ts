import type { ClassItem } from '../types';
import { CardMarkers } from './markers';
import { getStudentList } from './export';

/**
 * In bộ thẻ của lớp:
 * Xử lý chính xác theo kiến trúc trac_nghiem_the_giay_v1.html:
 * 1. Kiểm tra danh sách học sinh
 * 2. Xóa .print-area cũ nếu có và tạo .print-area mới gắn thẳng vào document.body
 * 3. Mỗi học sinh là 1 phiếu A4 chuẩn (@page size: A4 portrait, margin: 0)
 * 4. Kích thước thẻ cách lề trái-phải 3cm (khung 150mm trên trang A4 210mm)
 * 5. Tên học sinh cỡ ~18px, đáp án A (ĐÚNG), B (SAI), C, D xoay chuẩn 4 hướng
 * 6. Gọi window.print() ngay lập tức để mở cửa sổ in như Windows + P / Ctrl + P
 */
export function printClassCards(cls: ClassItem, showToast?: (msg: string) => void): boolean {
  const students = getStudentList(cls);
  if (!students.length) {
    if (showToast) {
      showToast('Hãy nhập danh sách học sinh trước khi in thẻ.');
    }
    return false;
  }

  // Loại bỏ .print-area cũ nếu có (chuẩn theo trac_nghiem_the_giay_v1.html)
  const existing = document.querySelector('.print-area');
  if (existing) {
    existing.remove();
  }

  const printArea = document.createElement('div');
  printArea.className = 'print-area';

  const cardsHtml = students.map((studentName, i) => {
    const studentId = i + 1;
    const svgCode = CardMarkers.svg(studentId);

    return `
      <article class="a4-card-page">
        <!-- Khung viền thẻ 150mm (cách lề trái - phải mỗi bên 3cm) -->
        <div class="card-border-box">
          <!-- Cạnh trên: A (ĐÚNG) - Hướng thẳng đứng 0° -->
          <div class="card-edge-top">
            <span class="card-letter-a">A</span>
            <span class="card-tag-dung">ĐÚNG</span>
          </div>

          <!-- Hàng giữa: D (Trái, -90°) - Mã ArUco SVG lớn (Giữa) - B (Phải, 90°) -->
          <div class="card-middle-row">
            <div class="card-edge-left">
              <span class="card-letter-d">D</span>
            </div>

            <div class="card-marker-wrap">
              ${svgCode}
            </div>

            <div class="card-edge-right">
              <span class="card-letter-b">B</span>
              <span class="card-tag-sai">SAI</span>
            </div>
          </div>

          <!-- Cạnh dưới: C - Xoay 180° -->
          <div class="card-edge-bottom">
            <span class="card-letter-c">C</span>
          </div>
        </div>

        <!-- Chân thẻ: STT, Họ tên học sinh cỡ ~18px, Lớp, Môn học -->
        <footer class="card-footer-info">
          <div class="card-footer-left">
            <div class="card-student-name">
              #${String(studentId).padStart(2, '0')} · ${escapeHtml(studentName)}
            </div>
            <div class="card-class-info">
              Lớp: ${escapeHtml(cls.name || '---')} ${cls.subject ? '· Môn: ' + escapeHtml(cls.subject) : ''}
            </div>
          </div>
          <div class="card-footer-right">
            <div>Hệ thống tương tác NDH</div>
            <b>Xoay đáp án lên trên để chọn</b>
          </div>
        </footer>
      </article>
    `;
  }).join('');

  printArea.innerHTML = cardsHtml;
  document.body.appendChild(printArea);

  // Mở cửa sổ in của trình duyệt ngay lập tức (như nhấn Windows + P / Ctrl + P)
  window.print();
  return true;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
