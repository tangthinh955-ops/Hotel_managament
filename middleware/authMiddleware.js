import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET; // Lấy từ file .env

// ============================================================
// MIDDLEWARE: Bảo vệ API - Kiểm tra Token trước khi cho vào
// ============================================================
// Hãy hình dung hàm này là "Nhân viên bảo vệ" đứng trước
// mỗi cánh cửa API. Ai muốn vào phải xuất trình Token hợp lệ.
// ============================================================

const verifyToken = (req, res, next) => {
    // 1. Lấy Token từ Header của Request
    // Frontend sẽ gửi token theo dạng: Authorization: "Bearer eyJhbG..."
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Tách lấy phần sau chữ "Bearer "

    // 2. Nếu không có Token → Đuổi ra, không cho vào
    if (!token) {
        return res.status(401).json({ message: '🔴 Truy cập bị từ chối: Không có Token. Vui lòng đăng nhập.' });
    }

    // 3. Nếu CÓ Token → Kiểm tra Token có hợp lệ và còn hạn không
    try {
        const decoded = jwt.verify(token, JWT_SECRET); // Giải mã và kiểm tra chữ ký
        req.user = decoded; // Đính kèm thông tin user vào request để các API dùng sau
        next(); // ✅ Token hợp lệ → Cho đi tiếp vào API
    } catch (error) {
        // Token bị giả mạo hoặc đã hết hạn
        return res.status(403).json({ message: '🔴 Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.' });
    }
};

export default verifyToken;
