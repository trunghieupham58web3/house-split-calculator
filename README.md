# 🏠 Tính Tiền Nhà

Web app chia chi phí thuê nhà công bằng cho nhiều người, lưu lịch sử trên **MongoDB Atlas**, deploy bằng **Vercel**. Xuất báo cáo **PDF / JPEG** đẹp để gửi cho mọi người.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/trunghieupham58web3/house-split-calculator&env=MONGODB_URI&envDescription=Connection%20string%20MongoDB%20Atlas)

> Bấm nút trên để clone & deploy nhanh — Vercel sẽ hỏi `MONGODB_URI` khi import.

## ✨ Tính năng
- Danh sách **thành viên động** (thêm/bớt, mỗi người có "số người" riêng — vd vợ chồng = 2)
- Mỗi khoản chọn cách chia: **Chia đều** hoặc **Theo số người**, và chọn ai tham gia
- Ô nhập tiền tự thêm dấu phân cách hàng nghìn (`2.315.131`)
- Lưu **lịch sử** theo tháng trên MongoDB (fallback localStorage khi offline)
- Xuất **PDF / JPEG** thiết kế đẹp
- Giao diện glassmorphism, con trỏ phát sáng, hiệu ứng particle & parallax

## 🗂 Cấu trúc
```
house-split-calculator/
├── index.html          # giao diện
├── style.css
├── app.js              # logic + gọi API (fallback localStorage)
├── api/
│   └── records.js      # Serverless Function (CRUD MongoDB)
├── package.json        # dependency: mongodb
├── vercel.json
├── .env.example        # mẫu biến môi trường
└── .gitignore
```

---

## 🚀 Hướng dẫn deploy (≈ 10 phút)

### Bước 1 — Tạo database MongoDB Atlas (miễn phí)
1. Vào https://www.mongodb.com/cloud/atlas/register → đăng ký (Google/email).
2. **Create a cluster** → chọn gói **M0 FREE** → chọn region gần (Singapore) → **Create**.
3. **Database Access** → *Add New Database User*:
   - Username + Password (ghi nhớ password). Quyền: **Read and write to any database**.
4. **Network Access** → *Add IP Address* → **Allow Access from Anywhere** (`0.0.0.0/0`).
   *(Vercel dùng IP động nên cần mở rộng — chấp nhận được cho app cá nhân.)*
5. **Database** → nút **Connect** → **Drivers** → copy **connection string**, dạng:
   ```
   mongodb+srv://USER:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Thay `<password>` bằng mật khẩu thật ở bước 3.

### Bước 2 — Đẩy code lên GitHub
```bash
cd house-split-calculator
git init
git add .
git commit -m "Tính tiền nhà"
# tạo repo trống trên github.com rồi:
git remote add origin https://github.com/<bạn>/house-split-calculator.git
git branch -M main
git push -u origin main
```

### Bước 3 — Deploy lên Vercel
1. Vào https://vercel.com → đăng nhập bằng GitHub.
2. **Add New… → Project** → chọn repo vừa push → **Import**.
3. Mục **Environment Variables**, thêm:
   | Name | Value |
   |------|-------|
   | `MONGODB_URI` | *(connection string ở Bước 1.5)* |
   | `MONGODB_DB`  | `house_split` *(tùy chọn)* |
4. **Deploy**. Xong → mở link `https://<tên>.vercel.app`.

Khi mục Lịch sử hiện badge **☁️ MongoDB** nghĩa là DB đã chạy. Nếu hiện **💾 Lưu cục bộ** thì kiểm tra lại `MONGODB_URI`.

---

## 💻 Chạy thử ở máy (tùy chọn)
```bash
npm i -g vercel       # cài Vercel CLI 1 lần
npm install           # cài mongodb
cp .env.example .env  # điền MONGODB_URI
vercel dev            # mở http://localhost:3000
```
> Mở thẳng `index.html` (file://) vẫn chạy được nhưng sẽ dùng **localStorage** thay vì MongoDB.

## 🔌 API
| Method | Endpoint | Mô tả |
|--------|----------|------|
| GET | `/api/records` | Lấy danh sách bản ghi (mới nhất trước) |
| POST | `/api/records` | Lưu/cập nhật 1 bản ghi (upsert theo `id`) |
| DELETE | `/api/records` | Xoá tất cả |
| DELETE | `/api/records?id=2026-06` | Xoá 1 bản ghi |

Mỗi bản ghi là 1 document JSON: `{ id, month, year, members[], fixed[], custom[], savedAt }`.
