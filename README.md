# Báo giá Sùng Tuyến

Bản bàn giao mã nguồn của ứng dụng báo giá vật liệu xây dựng đang sử dụng.

- **Bản ứng dụng:** Sites 44, ngày 23/09/2026.
- **Commit nguồn:** `7d75bce9b3c00816c5d7a89218e7a8f076987cf6`.
- **Web hiện tại:** https://bao-gia-sung-tuyen.dongxuan-093003.chatgpt.site
- **Trạng thái:** mã ứng dụng giữ nguyên bản đang chạy; bổ sung tài liệu bàn giao và cấu hình khôi phục mẫu.

## Dành cho chủ cửa hàng

Kho mã nguồn công khai của chủ cửa hàng: https://github.com/dongxuan093003-ai/App-bao-gia
GitHub giữ mã nguồn; file `Baogia_HHmm_dd-MM-yyyy.json` đã tải từ ứng dụng giữ dữ liệu.
Kho này không chứa dữ liệu khách hàng thật, mật khẩu tài khoản, cookie hay bản cơ sở dữ liệu đang chạy.

Khi cần chuyển người sửa, gửi quyền truy cập kho và yêu cầu đọc [hướng dẫn khôi phục](docs/RECOVERY.md).
Chỉ cung cấp bản JSON riêng khi cần nhập lại dữ liệu.
Sau mỗi đợt nâng cấp, cần đẩy phiên bản mới lên GitHub; thao tác đưa mã nguồn lần này không tự tạo đồng bộ liên tục giữa Sites và GitHub.

## Tính năng hiện có

- Đăng ký/đăng nhập bằng số điện thoại và PIN 3 chữ số; mỗi tài khoản có dữ liệu riêng.
- Quản lý mặt hàng, nhóm hàng, nhiều bảng giá; nhập giá trực tiếp, dán Excel và sắp xếp.
- Tạo/sửa/lưu báo giá; cho phép chưa có tên khách; lưu xong trở về danh sách.
- Mẫu báo giá riêng, dùng lại nguyên giá đã lưu; sửa bản sao không thay đổi mẫu gốc.
- Xuất PNG, chia sẻ qua menu hệ thống, in A5 bằng chữ và bảng HTML.
- Xem ảnh chung toàn app: khung sát đáy, nút cố định, kéo xuống đóng khi ảnh ở đầu, vẫn có nút ×.
- Khách hàng, số điện thoại gọi được, lịch chăm sóc và ghi chú theo thời gian.
- Tiêu đề cửa hàng, mẫu ghi chú bật/tắt, chia sẻ ứng dụng.
- Sao lưu trên máy chủ khoảng 7 ngày khi có sử dụng/thay đổi, giữ tối đa 8 bản; tải JSON và khôi phục qua giao diện.

## Tài liệu quan trọng

| Tệp | Nội dung |
| --- | --- |
| [docs/RECOVERY.md](docs/RECOVERY.md) | Dựng lại trên Sites hoặc Cloudflare Workers + D1, nhập JSON, kiểm tra sau khôi phục |
| [docs/VERIFICATION.md](docs/VERIFICATION.md) | Các kiểm tra đã thực hiện và giới hạn của bản bàn giao |
| [SOURCE-MANIFEST.json](SOURCE-MANIFEST.json) | Mốc commit và SHA-256 của 173 tệp nguồn gốc |
| [recovery/wrangler.example.jsonc](recovery/wrangler.example.jsonc) | Cấu hình triển khai độc lập mẫu; phải điền D1 của tài khoản mới |
| [.env.example](.env.example) | Giải thích cấu hình; không có khóa bí mật |

## Công nghệ và chạy mã nguồn

Node.js >=22.13.0; Vinext 0.0.50; React 19.2.6; Vite 8.0.13; Cloudflare Workers + D1; Drizzle.
Các phiên bản chính xác và kiểm tra toàn vẹn nằm trong `package-lock.json`.
Giữ lockfile, dùng `npm ci`; chưa nâng cấp thư viện trong lần khôi phục đầu tiên.

Trên Linux hoặc WSL2 có Node.js, npm, bash, GNU timeout, flock, curl và sha256sum:

```bash
npm ci
npx tsc --noEmit
npm run build
```

Kết quả gồm `dist/server/index.js` và `dist/client/`. Đây là ứng dụng có máy chủ và cơ sở dữ liệu, **không chạy đầy đủ bằng GitHub Pages**.
`npm run dev` phục vụ phát triển; đọc phần HTTPS và D1 trong hướng dẫn trước khi thử đăng nhập.

## Cấu trúc

- `app/`: giao diện và API; `app/workspace.tsx` phối hợp dữ liệu và màn hình.
- `lib/`: xác thực, schema JSON, sao lưu, nghiệp vụ, xuất ảnh/in.
- `db/`: schema và binding D1 tên `DB`.
- `drizzle/`: ba migration SQL, metadata đi kèm; không sửa migration đã áp dụng.
- `worker/`, `build/`, `vite.config.ts`: máy chủ Cloudflare và đóng gói.
- `components/`, `hooks/`, `public/`, `vendor/`: giao diện và tài nguyên cần thiết.
- `tests/`: kiểm thử tự động; xem hướng dẫn về nhóm kiểm thử phù hợp.

## Quy tắc khi tiếp tục sửa

1. Báo giá/mẫu đã lưu là bản chụp giá, tên, đơn vị, tiêu đề, ghi chú; cập nhật danh mục không làm đổi báo giá cũ.
2. Không bỏ kiểm tra tài khoản, nguồn yêu cầu, schema dữ liệu và số phiên bản chống ghi đè giữa các thiết bị.
3. Ghi chú chăm sóc nội bộ không xuất lên ảnh/in gửi khách.
4. Không tự chuyển dữ liệu của tài khoản này sang tài khoản khác.
5. Không dùng D1 hoặc tên miền đang chạy để thử một bản khôi phục.
6. Không đưa `.env`, `.dev.vars`, token, cookie, SQLite hay file JSON khách hàng lên GitHub.
