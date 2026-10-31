# NDH · Tương tác giấy (React + TypeScript + Vite)

Ứng dụng trắc nghiệm tương tác lớp học bằng thẻ giấy ArUco và camera, được chuyển đổi và xây dựng lại từ nền tảng gốc sang React + TypeScript + Tailwind CSS.

## Tính năng chính

- **Quản lý giáo viên và lớp học:**
  - Nhập danh sách học sinh theo thứ tự số thẻ (hỗ trợ tối đa 250 học sinh/lớp).
  - Soạn câu hỏi trắc nghiệm (MCQ A–D hoặc Đúng/Sai A–B) bằng cú pháp Markdown đơn giản, hỗ trợ hình ảnh và video.
  - Tự động kiểm tra cú pháp câu hỏi trước khi bắt đầu.
  - Lưu trữ kết quả các lần kiểm tra theo lớp.
  - Sao lưu và khôi phục dữ liệu toàn bộ ứng dụng dưới dạng file JSON.
  - Xuất báo cáo điểm số chi tiết ra file Excel (`.xlsx`).

- **Bộ thẻ ArUco chuẩn hoá:**
  - Tạo và in thẻ tương tác chuẩn `ARUCO_MIP_36h12` cho từng học sinh.
  - Mỗi thẻ in kèm tên học sinh, số thẻ và 4 hướng lựa chọn A (trên), B (phải), C (dưới), D (trái).
  - Hỗ trợ chế độ in tiết kiệm (3 thẻ/hàng) hoặc in thẻ lớn (1 thẻ/trang).

- **Sân khấu trình chiếu (Host Gameshow Arena):**
  - Giao diện trình chiếu trực quan trên máy tính hoặc máy chiếu.
  - Đếm ngược thời gian, cảnh báo khi sắp hết giờ.
  - Hiển thị tiến độ nhận đáp án thời gian thực (`X / Y thẻ đã nhận`).
  - Chế độ loại trừ người chơi trả lời sai với chức năng **Cứu hộ học sinh**.
  - Hiệu ứng âm thanh điện tử mô phỏng gameshow và pháo hoa ăn mừng khi công bố đáp án.
  - Tùy chỉnh chế độ nền Sáng (kem) hoặc Tối (đen).

- **Máy quét thẻ đồng hành (Companion Scanner):**
  - Sử dụng camera điện thoại hoặc webcam để quét thẻ học sinh đồng thời.
  - Nhận diện tức thì góc xoay của thẻ để chốt đáp án học sinh chọn.
  - Đồng bộ hai chiều với máy chủ trình chiếu qua WebRTC (PeerJS) hoặc mã phòng / PIN.

## Cài đặt & Khởi chạy

```bash
npm install
npm run dev
```

Ứng dụng chạy trên cổng 3000 (`http://localhost:3000`).