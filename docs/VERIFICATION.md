# Kiểm tra bản bàn giao — 23/09/2026

## Mốc nguồn

- Web đang chạy: Sites 44.
- Commit nguồn: `7d75bce9b3c00816c5d7a89218e7a8f076987cf6`.
- Sao chép 173 tệp được Git theo dõi ở đúng commit này, gồm đầy đủ nguồn, lockfile, schema và migration.
- Mã ứng dụng không đổi; chỉ sửa hai README, mở rộng `.gitignore`, thêm tài liệu và mẫu cấu hình phục hồi.
- Kho đích: `dongxuan093003-ai/App-bao-gia`, công khai theo lựa chọn của chủ cửa hàng. Đã kiểm tra đúng chủ sở hữu và quyền truy cập ngày 24/09/2026.

## Đã thực hiện

1. So sánh SHA-256 của 173 tệp với snapshot gốc. Ngoài `README.md`, `README-BAO-GIA.md`, `.gitignore`, các tệp gốc đều khớp.
2. Kiểm tra các mẫu private key/GitHub token/AWS access-key phổ biến trong nguồn theo dõi bởi Git: không tìm thấy. Đây là kiểm tra giới hạn theo mẫu, không phải kiểm toán bảo mật toàn diện.
3. Chạy ba migration SQL trên SQLite trống trong bộ nhớ: tạo đủ `quote_workspaces`, `phone_accounts`, `phone_sessions`, `quote_backups` và các chỉ mục.
4. `npx tsc --noEmit` trên bản sao bàn giao: đạt.
5. `npm run build` trên bản sao bàn giao: đạt; có đủ Worker, tài nguyên client và API. Dùng lại bộ thư viện đã cài tương ứng lockfile, chưa cài lại từ Internet trên máy hoàn toàn mới.
6. 53 kiểm thử nghiệp vụ trên đúng nguồn ứng dụng gốc: đạt, 0 lỗi. Gồm sao lưu/khôi phục, phân quyền dữ liệu, xung đột, khách hàng, ghi chú, bảng giá, mẫu, báo giá chưa đặt tên, PNG và in A5.
7. `wrangler deploy --dry-run --config recovery/wrangler.example.jsonc`: đạt. Wrangler 4.92.0 đọc đủ module/tài nguyên và binding `DB`, `ASSETS`; không xuất bản hay ghi cơ sở dữ liệu.

Bài kiểm thử sao lưu cố ý mô phỏng thiếu bảng để kiểm tra khả năng báo lỗi. Dòng log `Automatic backup failed` trong bài test đó là dự kiến; toàn bộ 53 kiểm thử đạt.

## Chưa thực hiện

- Chưa triển khai lên một tài khoản Cloudflare độc lập hoặc nhập dữ liệu kinh doanh thật vào máy chủ khác.
- Chưa kiểm tra đăng nhập/đồng bộ hai thiết bị trên một hệ thống vừa khôi phục.

## Đối chiếu bản GitHub

Bản đưa lên GitHub gồm 178 tệp trong danh sách hợp nhất của `original_files` và `handover_only_changes` ở `SOURCE-MANIFEST.json`. Đối chiếu Git tree SHA của toàn bộ đường dẫn, chế độ tệp và nội dung với bản bàn giao; kiểm tra lại commit đầu nhánh `main` sau khi cập nhật. Commit GitHub mới có thể khác commit nguồn Sites vì bổ sung tài liệu bàn giao và nối tiếp commit khởi tạo kho.

Không gọi bản dry-run là khôi phục thành công trên máy chủ thật. Người tiếp nhận cần làm các bước xác nhận trong `RECOVERY.md`.
