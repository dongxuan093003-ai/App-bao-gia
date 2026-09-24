# Khôi phục Báo giá Sùng Tuyến

Mốc nguồn: Sites 44, commit `7d75bce9b3c00816c5d7a89218e7a8f076987cf6`, ngày 23/09/2026.
Ứng dụng và dữ liệu đang chạy không bị thay đổi khi chuẩn bị bộ bàn giao này.

## 1. Cần giữ những gì?

1. Toàn bộ kho mã nguồn, gồm cả `package-lock.json`, `.openai/hosting.json`, `vendor/` và `drizzle/meta/`.
2. Bản `Baogia_HHmm_dd-MM-yyyy.json` mới nhất của từng tài khoản cần khôi phục.
3. Quyền truy cập nơi chạy web: Sites hiện tại, hoặc tài khoản Cloudflare do chủ cửa hàng quản lý.

JSON từ ứng dụng chứa dữ liệu nghiệp vụ của một tài khoản, không chứa danh sách tài khoản, hash PIN, phiên đăng nhập hoặc toàn bộ lịch sử sao lưu trên máy chủ.
Nếu dựng D1 mới, đăng ký tài khoản mới trong ứng dụng rồi nhập JSON vào tài khoản đó.
Muốn giữ toàn bộ tài khoản/lịch sử máy chủ phải xuất D1 riêng bằng quyền quản trị; bộ bàn giao này không phải bản xuất D1.

## 2. Xác nhận đúng phiên bản

Đọc `SOURCE-MANIFEST.json`: 173 tệp nguồn gốc và checksum của chúng.
Các thay đổi của bản bàn giao chỉ là tài liệu, mẫu cấu hình và quy tắc bỏ qua file; mã trong `app/`, `lib/`, `db/`, `drizzle/`, `worker/` giữ nguyên bản đang chạy.
Không dùng thư mục build cũ để suy ra nguồn; build lại từ source và lockfile.

## 3. Giữ hoặc dựng lại trên Sites

- Nếu dự án hiện tại còn truy cập được: project ID là `appgprj_6a9fe3f70fd08191b2433287a0a63070`. Mở đúng dự án, xem phiên bản đang chạy và giữ nguyên binding `DB`.
- Có thể dùng lại nguồn từ GitHub để tiếp tục sửa qua công cụ Sites. Xác nhận bản hiện hành trước khi thay thế để tránh lùi mất các sửa đổi mới hơn.
- Khi tạo một Sites mới để thử phục hồi, lấy project ID mới do Sites cấp và đổi `.openai/hosting.json` theo dự án mới; giữ `d1: "DB"`, `r2: null`.
- Sites đóng gói và áp dụng migration trong `drizzle/`; không thay bằng database ID giả trong `vite.config.ts`.
- Import JSON chỉ sau khi web mới hoạt động và đăng nhập được. Mỗi tài khoản nhập bản của chính mình.

## 4. Dựng độc lập trên Cloudflare Workers + D1

Đây là cấu hình phục hồi mẫu dành cho người tiếp nhận kỹ thuật. Phải điền tài nguyên Cloudflare thật; chưa có lần triển khai thử lên tài khoản Cloudflare riêng trong đợt bàn giao.
Không cần một tài khoản ChatGPT để khách sử dụng đăng nhập số điện thoại trên bản mới.
GitHub chỉ lưu mã nguồn; GitHub Pages không cung cấp Worker/D1 cho app này.

### Cài đặt và build

Dùng Linux/WSL2 và Node.js >=22.13.0. Các script của repo dùng bash/GNU timeout; không chạy nguyên trạng bằng Windows PowerShell.

```bash
npm ci
npx tsc --noEmit
npm run build
cp recovery/wrangler.example.jsonc recovery/wrangler.local.jsonc
```

`npm ci` cài theo lockfile. Không xóa lockfile hoặc đổi sang phiên bản Vinext/React mới trong lần khôi phục đầu.
`dist/server/index.js` là Worker; `dist/client` là tài nguyên trình duyệt.

### Tạo D1 dành riêng cho bản phục hồi

Sau khi đăng nhập Cloudflare bằng tài khoản của chủ sở hữu:

```bash
npx wrangler login
npx wrangler d1 create bao-gia-khoi-phuc
```

Sao chép `database_id` trả về vào `recovery/wrangler.local.jsonc`; thay `database_name` nếu đặt tên khác. `binding` phải giữ là `DB`.
Đổi `name` của Worker cho riêng bản mới. Không đặt database ID hoặc Worker name trùng bản đang dùng để thử.
File `recovery/wrangler.local.jsonc` đã nằm trong `.gitignore`.

Chỉ đối với D1 mới/trống dành riêng cho phục hồi:

```bash
npx wrangler d1 migrations list DB --config recovery/wrangler.local.jsonc --remote
npx wrangler d1 migrations apply DB --config recovery/wrangler.local.jsonc --remote
```

Ba migration đã có sẵn, theo thứ tự `0000`, `0001`, `0002`:

| Bảng | Vai trò |
| --- | --- |
| `quote_workspaces` | Một JSON nghiệp vụ mỗi tài khoản, kèm `version` chống ghi đè |
| `phone_accounts` | Số điện thoại, hash PIN, salt |
| `phone_sessions` | Hash token phiên và thời hạn |
| `quote_backups` | Bản sao lưu theo tài khoản, thời gian, lý do |

Không chạy lại các câu `CREATE TABLE` vào D1 cũ đã có bảng mà chưa đối chiếu migration.

### Kiểm tra gói rồi triển khai bản mới

```bash
npx wrangler deploy --dry-run --config recovery/wrangler.local.jsonc
npx wrangler deploy --config recovery/wrangler.local.jsonc
```

Luôn chỉ rõ file cấu hình này. Cấu hình tự sinh ở `dist/server/wrangler.json` có database ID giả phục vụ build/local; không dùng nguyên trạng để triển khai D1 thật.
Dùng URL HTTPS thực tế do Cloudflare trả về. Cookie có tiền tố `__Host-`, thuộc tính Secure và HttpOnly; trang HTTP thường có thể không giữ được đăng nhập. Không bỏ Secure hoặc kiểm tra nguồn yêu cầu để chữa lỗi đăng nhập.

`ASSETS` phục vụ tài nguyên. `DB` là bắt buộc. Không cần R2 hoặc khóa OpenAI API cho các tính năng đang dùng.
Tuyến tối ưu ảnh `/_vinext/image` trong Worker mẫu cần binding `IMAGES` nếu được sử dụng; hiện xuất PNG và hiển thị báo giá dùng canvas/blob nên không dựa vào tuyến này.
Tính năng nhập dữ liệu ChatGPT đời cũ phụ thuộc hạ tầng xác thực Sites; trên máy chủ riêng hãy dùng JSON trong Cài đặt để phục hồi dữ liệu. Không coi tuyến đời cũ là đường phục hồi bắt buộc.

## 5. Nhập dữ liệu và kiểm tra

1. Mở URL của bản mới, đăng ký một tài khoản và đăng nhập.
2. Vào Cài đặt → Sao lưu và khôi phục → chọn chức năng nhập file JSON.
3. Chọn đúng bản sao, kiểm tra thông tin rồi xác nhận khôi phục. Đây là thay dữ liệu của tài khoản đang đăng nhập, không ghép tự động nhiều file.
4. Đối chiếu bảng giá, khách hàng, báo giá đã lưu, mẫu, ghi chú chăm sóc, tiêu đề cửa hàng và mẫu ghi chú.
5. Mở một báo giá cũ: giá phải giữ đúng bản đã lưu, không bị thay theo danh mục mới.
6. Thử tạo báo giá kiểm tra, lưu rồi đăng nhập lại; thử mở ảnh, tải PNG, in A5, đóng bằng × và vuốt xuống trên điện thoại.
7. Đăng nhập thiết bị thứ hai; thử thay đổi nhỏ và xác nhận đồng bộ. Kiểm tra báo xung đột khi sửa đồng thời.
8. Tải một JSON mới từ bản phục hồi rồi mới cân nhắc chuyển sang sử dụng chính thức.

Không nhập các bản JSON của khách hàng thật lên GitHub.

## 6. Kiểm thử mã nguồn

Nhóm nghiệp vụ dùng Node test runner, không yêu cầu dịch vụ thật:

```bash
node --test tests/backup.test.mjs tests/backup-store.test.mjs tests/customer-book.test.mjs tests/customer-journal.test.mjs tests/price-lists.test.mjs tests/quote-care.test.mjs tests/quote-composition.test.mjs tests/quote-print.test.mjs tests/quote-templates.test.mjs tests/unnamed-quotes.test.mjs
```

`tests/rendered-html.test.mjs` và `tests/ui-components.test.mjs` có kiểm tra đặc thù starter/môi trường build; không dùng riêng kết quả của chúng để kết luận đã khôi phục D1 hoặc dữ liệu khách hàng.
Xem `docs/VERIFICATION.md` để biết đợt bàn giao thực sự đã kiểm tra gì.

## 7. Những quy tắc cần giữ khi sửa tiếp

- Dữ liệu máy chủ theo ID tài khoản được xác thực, không theo số điện thoại tự truyền từ trình duyệt.
- `version` trong mỗi lần ghi là kiểm tra đồng thời, không được bỏ hoặc luôn ép về 0.
- API ghi kiểm tra origin/schema. Phiên đăng nhập riêng của app, không dùng cookie/tài khoản thật trong bài test.
- Báo giá/mẫu lưu snapshot. Dùng mẫu tạo bản sao; tên mẫu không biến thành tên khách.
- Sao lưu tuần là tác vụ khi ứng dụng có yêu cầu đọc/ghi và dữ liệu thay đổi, không phải cron chạy dù tắt app.
- Giá và dữ liệu kinh doanh thực tế chỉ lấy từ JSON/D1 của chủ sở hữu, không điền dữ liệu ví dụ làm thật.
- Mã nguồn GitHub và dữ liệu JSON là hai bản sao khác nhau. Cần cập nhật cả hai theo đợt thay đổi.

## 8. Tài liệu nền tảng

Đối chiếu tại ngày chuẩn bị 23/09/2026:

- https://developers.cloudflare.com/workers/wrangler/commands/workers/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/d1/wrangler-commands/
- https://developers.cloudflare.com/workers/wrangler/configuration/

Giữ phiên bản thư viện trong lockfile của bản bàn giao. Nếu nền tảng thay đổi, người tiếp nhận cần thử trên bản riêng trước.
